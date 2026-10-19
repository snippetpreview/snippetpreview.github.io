## Context

Snippet Preview is a root-hosted GitHub Pages site. `index.html` + `src/main.ts` is the composer UI; `public/service-worker.js` is a provider-agnostic navigation router that delegates to adapters in `public/providers/`; preview URLs are `/gist.github/<id>/<file-path?>`.

Three facts constrain the design:

1. **GitHub Pages serves `404.html` (status 404) for any unknown path without changing the URL.** That is the only server-side hook available; there is no rewrite rule and no server code.
2. **A service worker cannot handle the navigation that caused it to be registered.** The first request for a preview path in a fresh profile will always reach GitHub Pages, never the worker.
3. **The existing specs explicitly excluded caching.** `gist-preview-service-worker-routing` states "No caching strategy in MVP"; the archived PWA change lists runtime caching as a non-goal. This change supersedes both.

Current defects found while surveying the code:

- Subresource requests under a preview path are passed to `fetch()` (`mode !== 'navigate'`), so a gist that references `./style.css` gets a GitHub Pages 404.
- When a requested file is absent, the provider silently serves `files[0]`, so a missing asset returns HTML bytes.
- `src/main.ts` registers the service worker unconditionally, contradicting the production-only registration requirement in `pwa-installable`.
- URL parsing and composition exist twice: once in TypeScript in `src/main.ts`, once in `public/providers/github-provider.js`.
- Provider adapters are served as static assets only because the service worker is not bundled.

## Goals / Non-Goals

**Goals:**
- Preview links work on a first, cold visit with no prior service worker.
- The app installs and launches offline, serving its own shell.
- Visited gist resources persist across sessions and are reused without network.
- Multi-file gists resolve their own relative assets.
- Users can inspect, download, open, and remove cached gists from `/cache.html`.
- One implementation of provider logic, shared by the worker, the landing page, and the cache UI.

**Non-Goals:**
- Making preview responses carry HTTP 200 for crawlers or social embedders (impossible without server-side rendering).
- Prefetching gists that were never visited.
- Per-file invalidation, sync, or export archives (zip) of a gist.
- Authenticated GitHub API usage or raising the 60 requests/hour unauthenticated limit.
- Background sync, push, or cross-device cache sharing.
- Changing the deployment model or the root-hosting requirement.

## Decisions

### 1. Cache identity is `(providerId, resourceId)`; revision is a field, not part of the key

A single gist is reachable through at least five distinct URL strings (with or without username, `#file` versus `/file`, trailing slash, percent-encoding variants), so a URL key produces duplicates of the same bytes. `Request` URLs also drop fragments, so a `#file` selector cannot be a cache key at all. Keys also must not embed a host, or future providers and any eventual domain change orphan the cache.

```
IndexedDB  db: snippet-preview
  store: resources   keyPath: ['providerId', 'resourceId']   (compound key)

  {
    providerId:  'gist.github',
    resourceId:  '95e2c10538e95f565120c5ed6adf947d',
    revision:    '<provider-defined opaque string>',
    etag:        'W/"..."',
    fetchedAt, lastCheckedAt, bytes,
    username, description,           // metadata, never identity
    files: { 'index.html': { content, mime, size, sha, truncated }, ... },
    visits: { 'index.html': <timestamp> }
  }
```

Lookup is fully derivable: `parsePreviewPath(pathname) → (providerId, resourceId, filePath)`, then one `get`, then `files[filePath]`. No path-to-resource index is stored.

*Alternatives rejected:* full-URL key (non-canonical, no revision); per-file keys (the API returns all files in one response, a gist revision is atomic, and `a/b/c` is ambiguous without the provider's parser); content hashing (cannot answer "is this cached?" without network).

### 2. `revision` is opaque to the cache

The cache never interprets the revision. GitHub supplies `history[0].version`; future providers supply whatever they use. This keeps the store provider-agnostic and preserves the adapter boundary established by `provider-routed-preview`.

### 3. Cache source files, never rendered HTML

Rendering depends on the request path (root versus trailing-slash handling) and on the app build. Storing rendered HTML would duplicate entries per entry path and serve stale chrome after a release. Source files plus a pure renderer give identical output on demand, and make "download raw source" trivial.

### 4. IndexedDB is the single store for gists; Workbox only precaches the shell

Workbox is URL-keyed, so using it for gist data would create a second, unmanageable copy that `cache.html` cannot see or evict. Division of responsibility:

| Store | Contents | Managed by |
|---|---|---|
| Workbox precache | app shell + built assets | build-time manifest |
| IndexedDB `resources` | gist data | application code |

*Alternative rejected:* Cache API for gist data — URL-only keys, awkward structured metadata, no efficient enumeration for the management UI.

### 5. Provider contract splits into `fetchResource` and `render`

```
fetchResource({resourceId}) → { ok, value: { providerId, resourceId, revision, etag, files, metadata } }
render({resource, filePath}) → Response        // pure, no network, deterministic
```

`handlePreview` remains as a thin compatibility wrapper (`fetchResource` + `render`) so the router keeps a single entry point. The split is what allows caching, offline rendering, subresource serving, and the cache page's download action to share one implementation.

### 6. Cold start runs through the landing page

```
/gist.github/<id>/<file>
   │ worker controls? ── yes ──▶ render from cache or network (200)
   │ no
   ▼
GitHub Pages 404.html (status 404)
   │ provider namespace match? ── no ──▶ plain not-found message
   │ yes
   ▼
location.replace('/?next=' + encodeURIComponent(location.pathname + location.search))
   ▼
index.html
   │ sanitize next (must start with a single '/', reject '//' and '/\')
   │ register SW, await controllerchange (timeout ~3s)
   ├── controlled ──▶ sessionStorage guard = next; location.replace(next)
   └── timeout ─────▶ render fallback: "preview requires a service worker" + open-on-GitHub link
```

The guard must be one-shot: if index loads with a `next` whose value equals the stored guard, it must **not** redirect again, otherwise an unusable worker produces a redirect loop. `location.replace` is required so the bounce does not accumulate history entries.

*Alternatives rejected:* bootstrapping inside `404.html` (works, but duplicates the shell and bypasses the landing page's fallback UI); rendering in-page without the worker (relative subresources cannot resolve before the worker controls the document, and it would create a second renderer).

### 7. `?next=` is sanitized as a same-origin absolute path

Any value beginning with `//` or containing `/\` is rejected, otherwise the parameter is an open redirect.

### 8. Preview routes must not be answered by a catch-all navigation fallback

A Workbox navigation fallback (`navigateFallback: '/index.html'`) would silently answer `/gist.github/<id>/` with the composer, and would also turn every unknown path into the composer with a `200` response — hiding genuine 404s and making the recovery document unreachable. The app therefore registers **no** catch-all fallback: precaching answers `/`, `/index.html`, and `/cache.html` exactly, and unknown paths still reach GitHub Pages.

```js
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] })
// no NavigationRoute fallback
```

Ignoring all query parameters keeps `/?next=...` matching the precached shell offline, which a narrow `utm`/`next` list only partially achieves.

`404.html` must never enter the precache manifest; it is served by GitHub Pages only.

### 9. All request modes are served for preview paths

The provider namespace check runs before the navigation-mode check. `files[filePath]` is served with a MIME type derived from the extension, falling back to `text/plain`. A missing file returns 404 rather than the first file. Root `''` continues to resolve to the first file, and the existing trailing-slash redirect for HTML documents is retained.

### 10. Revalidation uses `If-None-Match`, not a timer

```
visit → entry exists?
  yes → GET gists API with If-None-Match: entry.etag
          304 → update lastCheckedAt, serve cached entry (no re-download)
          200 → atomically put(entry'), serve entry'
   no → GET; on success cache and serve; on failure show provider error and cache nothing
offline → entry exists ? render(entry) : offline "not cached" page
```

There is no TTL, so cache contents never rot silently and offline reads never trigger a network wait.

### 11. Removal granularity is the whole resource

Files inside a gist share one revision, so per-file deletion would imply a consistency the data does not have. `cache.html` removes a gist and lists its files beneath it.

### 12. `cache.html` is a real static entry

A separate Vite HTML entry is precacheable, reachable from the installed app, and keeps the `?next=` bootstrap on the landing page unambiguous. Rejected: a worker-handled `/cache/` route (still needs precaching, adds a navigation branch) and `/?view=cache` (collides with the resume parameter).

### 13. Provider modules and the worker move into `src/`

`injectManifest` requires the worker to be built. Once built, adapters must be bundled too, which removes the duplicate parsers in `src/main.ts` and adds type checking. `public/` keeps only `manifest.webmanifest`, icons, favicon, and `404.html`. **This is breaking** for anyone importing `/providers/*.js` directly; nothing in-repo does.

### 14. Served documents declare their source at render time

Each preview document carries `<meta name="DC.source" scheme="URI" content="<source-url>">` as the first head element, where the source URL is `https://gist.githubusercontent.com/<username>/<gist-id>/raw/<file-path>`.

Decisions behind this:

- **Raw content host, not the gist page.** `https://gist.github.com/<user>/<id>/<file>` returns 404 (verified); GitHub selects a file on the gist page with a fragment (`#file-<slug>`), which does not carry the real file path. The raw host is the address that actually identifies one file and returns it with a `200`.
- **Injected at render time, not stored.** Cached entries hold source only, so the declaration follows the current renderer without invalidating the cache.
- **Identity comes from the served file.** When the request names no file, the declaration describes the file that was actually resolved, not the empty path.
- **Documents only.** Subresource responses return the file bytes untouched, and error pages carry no declaration.
- **Idempotent.** A gist document that already declares `DC.source` is left alone.

### 15. Wrapped source is presented as a source viewer

Non-HTML files are not just dumped into a `<pre>`; the generated document is a small self-contained source viewer:

- the source address — `https://gist.githubusercontent.com/<user>/<id>/raw/<file>`, the same URI the document declares — is shown verbatim above the container and opens in a new tab, so the preview survives the navigation (the gist page's `/<user>/<id>/<file>` form returns 404 and is not used);
- the container has a toolbar with the file's media type and a **Copy** control;
- copy reads `code.textContent`, so the clipboard receives the exact source with no re-escaping, and falls back to a selection copy when the async clipboard API is unavailable;
- styles are inlined and dark-mode aware, because the preview document does not load the app stylesheet;
- the declaration is still the first head element, so the metadata requirement holds for these documents too.

Only generated documents get this treatment: HTML gist files are the gist's own pages, and subresource responses stay byte-for-byte.

## Risks / Trade-offs

- **First request remains HTTP 404 to crawlers and share-preview bots** → accepted; document it, and note it is unfixable on static hosting.
- **`skipWaiting` + `clientsClaim` can serve new code into an already-open tab** → acceptable for a small app, but precache cleanup is versioned so a stale shell cannot outlive its cache.
- **Module service workers are not universally supported** → the timeout branch must degrade to a readable message, never a redirect loop.
- **Browser eviction can empty the cache** → call `navigator.storage.persist()`, show `estimate()` usage in `cache.html`, and treat a miss as normal rather than an error.
- **Quota exhaustion while writing** → catch `QuotaExceededError`, evict least-recently-checked entries, retry once, then surface a non-fatal warning.
- **IndexedDB unavailable (some private modes)** → fall back to an in-memory store for the session; the app stays usable without persistence.
- **Unauthenticated GitHub rate limit (60/hour)** → caching and conditional requests reduce consumption; 403 responses must be shown as rate-limit errors rather than cached as gist failures.
- **`?next=` briefly exposes the target path in the address bar** → acceptable; it is replaced immediately.
- **Secret gist content is written to disk** → this matches normal browser caching expectations; `cache.html` provides explicit removal, and the app never caches responses for other users' credentials.

## Migration Plan

1. Refactor provider modules into `src/` and remove duplicated parsers — no behaviour change, verifiable by the existing preview examples.
2. Split `fetchResource` / `render`; keep `handlePreview` as a wrapper.
3. Serve all request modes and return 404 for missing files.
4. Add the IndexedDB store with revalidation.
5. Introduce `vite-plugin-pwa` with `injectManifest` and the fallback denylist.
6. Add `404.html` recovery, then `cache.html`.
7. Update installability assets and the affected specs.

Rollback: the worker and `404.html` are independently revertible. Removing `404.html` restores the previous cold-start failure without breaking warm behaviour; reverting the worker restores network-only rendering and leaves any IndexedDB data inert (it is versioned and ignored by older builds).

## Open Questions

- PNG icon generation: commit rasterized icons, or generate at build time with an image dependency? Committing keeps the build dependency-free.
- Should `cache.html` also offer "clear all", and should it warn before removing the currently viewed gist?
- Do we surface `lastCheckedAt` or present a "refresh" action per gist, given revalidation is automatic?
