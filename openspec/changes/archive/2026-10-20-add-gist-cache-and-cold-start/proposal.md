## Why

Preview URLs only work for visitors whose browser has already registered the service worker. A shared link such as `/gist.github/<id>/index.html` opened cold fails on GitHub Pages with a generic 404, so previews appear broken exactly when they are first shared. The site is also installable but has no offline story: the existing PWA design explicitly excluded caching, and the service worker intercepts only navigations, so a gist that references its own files (`index.html` + `style.css`) is broken even with a warm worker.

## What Changes

- Add a `404.html` recovery page that resumes the originally requested preview path through the landing page, so cold links work on first visit.
- Add a persistent gist resource cache (IndexedDB) keyed by provider and resource, with revision tracking, conditional revalidation, and manual removal.
- Serve gist files for **all** request modes, not just navigations, so multi-file gists resolve their own relative assets; a missing file returns 404 instead of silently serving the first file.
- Split provider preview handling into `fetchResource` (network, cacheable data) and `render` (pure, deterministic response) so the router, the cache, and the UI can share one implementation.
- Move provider adapters and the service worker out of `public/` into `src/` so they are bundled and type-checked, and remove the duplicated URL parsing in the landing page.
- Adopt `vite-plugin-pwa` (Workbox `injectManifest`) to precache the app shell so the app launches offline.
- Add `/cache.html` to list cached gists, download rendered HTML or raw source, open a cached file, and remove cached gists.
- Tighten installability metadata (raster icons, `apple-touch-icon`, stable manifest `id`, correct SVG `sizes`).
- Amend existing specs that state "no caching strategy" and record the production-only registration guard that the code currently violates.
- **BREAKING**: provider adapters are no longer fetchable assets under `/providers/*.js`; they are bundled modules.

## Capabilities

### New Capabilities
- `gist-resource-cache`: Persistent, provider-agnostic storage of fetched gist resources keyed by `(providerId, resourceId)` with a revision field, conditional revalidation, quota handling, and removal.
- `preview-cold-start-recovery`: Recovery of preview navigations that arrive without a controlling service worker.
- `cache-management-ui`: The `/cache.html` interface for inspecting, downloading, opening, and removing cached gists.

### Modified Capabilities
- `gist-preview-service-worker-routing`: Adds caching and offline behavior, multi-file subresource serving, and the fetch/render split that replaces the single `handlePreview` path.
- `provider-routed-preview`: Adapter contract gains resource fetching and rendering as separate responsibilities; introduces opaque revision semantics.
- `pwa-installable`: Adds app-shell precaching for offline launch and codifies icon/metadata requirements for install surfaces.

## Impact

- **Code**: `public/service-worker.js` and `public/providers/*` move to `src/`; [src/main.ts](d:\Projects\snippetpreview.github.io\src\main.ts) loses its duplicate parsers and gains the `?next=` resume path; new `public/404.html` and `src/cache.html` entry.
- **Build**: `package.json` gains `vite-plugin-pwa`; `vite.config.ts` is introduced with `injectManifest`, a navigation-fallback denylist for `/gist.github/`, and `?next=` excluded from precache matching.
- **Dependencies**: first runtime build dependency added to a currently dependency-free static site.
- **Storage**: new IndexedDB database on the user's device; behaviour must degrade gracefully when storage is unavailable or full.
- **Deployment**: unchanged — still a root-hosted GitHub Pages artifact, which is required for the SW scope and the 404 recovery path.
