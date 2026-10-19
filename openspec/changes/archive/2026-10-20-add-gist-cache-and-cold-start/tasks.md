## 1. Provider module consolidation

- [x] 1.1 Move `public/providers/github-provider.js` and `public/providers/provider-adapter.js` into `src/providers/` and convert them to TypeScript with shared result types
- [x] 1.2 Update `src/main.ts` to import parse/compose helpers from `src/providers/github-provider.ts` and delete the duplicated `parseCanonicalGistUrl`, `parsePreviewUrl`, `buildPreviewPath`, and `buildCanonicalGistUrl` implementations
- [x] 1.3 Verify the landing page still composes and decomposes URLs identically for the documented examples

## 2. Fetch/render split

- [x] 2.1 Extend the adapter contract with `fetchResource({resourceId})` returning files, metadata, `revision`, and `etag`, and with `render({resource, filePath})` returning a `Response`
- [x] 2.2 Implement the GitHub adapter's `fetchResource`, including truncated-file raw fetching, and map the gist `history[0].version` to `revision`
- [x] 2.3 Implement the pure `render` function covering HTML documents, wrapped source listings, and the existing root trailing-slash redirect
- [x] 2.4 Reduce `handlePreview` to a `fetchResource` + `render` composition so existing dispatch keeps working

## 3. Multi-file serving

- [x] 3.1 Move the provider namespace check ahead of the navigation-mode check in the service worker
- [x] 3.2 Serve `files[filePath]` for all request modes with a content type derived from the file extension
- [x] 3.3 Return a not-found response when a specific file path is absent, removing the silent first-file fallback for path requests
- [x] 3.4 Verify a gist containing `index.html` plus a relative stylesheet and script loads both assets

## 4. Resource cache

- [x] 4.1 Add an IndexedDB module storing records under the compound key `['providerId', 'resourceId']` with a schema version and an index on last-checked time
- [x] 4.2 Implement read, write, remove, and enumerate operations, treating an absent IndexedDB as a session-scoped in-memory fallback
- [x] 4.3 Implement conditional revalidation using the stored `etag` and `If-None-Match`, updating only the check timestamp on an unchanged response and replacing the entry in one write on change
- [x] 4.4 Serve cached content when the provider is unreachable, and return a not-cached response for uncached resources
- [x] 4.5 Handle `QuotaExceededError` by evicting least-recently-checked entries, retrying once, and degrading to uncached operation
- [x] 4.6 Request persistent storage on first cache write and record whether it was granted

## 5. Build tooling and offline shell

- [x] 5.1 Add `vite-plugin-pwa` and create `vite.config.ts` using the `injectManifest` strategy with a stable worker output filename
- [x] 5.2 Move the service worker to `src/service-worker.ts` and import the precache manifest placeholder
- [x] 5.3 Ensure no catch-all navigation fallback answers preview routes or unknown paths, and ignore URL parameters when matching precached entries
- [x] 5.4 Confirm `404.html` is excluded from the precache manifest
- [x] 5.5 Add `cache.html` as a second Vite HTML entry and confirm it is precached
- [x] 5.6 Verify `npm run build` produces the worker, the precache manifest, and both HTML entries

## 6. Cold-start recovery

- [x] 6.1 Add `public/404.html` that redirects preview-namespace paths to `/?next=<encoded pathname + search>` and otherwise shows a not-found message
- [x] 6.2 Add a `next` handler to the landing page that validates the value as an absolute same-origin path, rejecting schemes, `//`, and `/\` prefixes
- [x] 6.3 Wait for the page to become controlled, with a timeout, before navigating, and use history-replacing navigation
- [x] 6.4 Add a one-shot `sessionStorage` guard so a given path is resumed at most once per tab
- [x] 6.5 Render a fallback that explains the service worker requirement and links to the canonical source when control is not obtained
- [x] 6.6 Verify a cold visit to `/gist.github/<id>/` and to `/gist.github/<id>/index.html` in a clean profile, and verify no redirect loop when the worker fails to register

## 7. Cache management page

- [x] 7.1 Build the `cache.html` listing view showing provider, resource, revision, fetch time, size, and file rows
- [x] 7.2 Add a rendered-preview download action that renders from cached source with the current renderer
- [x] 7.3 Add a raw-source download action per file using the file's name and content type
- [x] 7.4 Add an open action per file that navigates to its preview path
- [x] 7.5 Add a remove action per resource that deletes the whole entry and refreshes the listing
- [x] 7.6 Add the empty state and a link back to the landing page
- [x] 7.7 Display storage usage from `navigator.storage.estimate()` and the persistent-storage outcome
- [x] 7.8 Link to the cache page from the landing page

## 8. Installability polish

- [x] 8.1 Add raster 192x192 and 512x512 icons and update the manifest to declare `sizes: "any"` for the vector icon
- [x] 8.2 Add a manifest `id` and an `apple-touch-icon` link in the document head
- [x] 8.3 Guard service worker registration behind the production build check in `src/main.ts`

## 9. Specs and docs

- [x] 9.1 Remove the "No caching strategy in MVP" statement from `openspec/specs/gist-preview-service-worker-routing/spec.md` prose sections and describe the cache layer
- [x] 9.2 Update `readme.md` and `ghpage.md` to document offline behavior, the not-found recovery path, and the requirement that the site stay root-hosted
- [x] 9.3 Run `openspec validate add-gist-cache-and-cold-start --strict` and resolve findings

## 10. Source metadata

- [x] 10.1 Add a shared head-injection helper and build the source URL from the gist identity plus the file actually served
- [x] 10.2 Inject the `DC.source` declaration into HTML documents and into generated wrapper documents
- [x] 10.3 Verify the declaration is the first head element in a served preview and that its content URL resolves with a 200

## 11. Wrapped source viewer

- [x] 11.1 Build a self-contained, dark-mode-aware source container with a toolbar and copy control
- [x] 11.2 Show the gist file address verbatim above the container
- [x] 11.3 Verify the copy control writes the exact source text and that long lines scroll inside the container
