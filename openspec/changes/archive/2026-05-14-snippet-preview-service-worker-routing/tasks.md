## 1. Foundation

- [x] 1.1 Replace the Vite starter app shell with the snippet preview landing page entry point.
- [x] 1.2 Add Service Worker registration and update the root HTML metadata for the new app.
- [x] 1.3 Remove or replace the default counter-based starter logic so it no longer ships in the preview app.

## 2. Landing Page

- [x] 2.1 Build the gist ID and optional file path form with clean URL generation.
- [x] 2.2 Add example preview links and explanatory copy for root, file, and error flows.
- [x] 2.3 Validate gist IDs before navigation so invalid input does not generate broken preview URLs.

## 3. Service Worker Routing

- [x] 3.1 Implement Service Worker route matching for `/`, gist root paths, and gist file paths.
- [x] 3.2 Fetch gist metadata from GitHub's API and resolve the requested file or first available file.
- [x] 3.3 Detect truncated file content and fetch the raw file body before building the response document.

## 4. Error Handling and Caching

- [x] 4.1 Return generated HTML error pages for invalid gist IDs, missing files, and GitHub rate limits.
- [ ] 4.2 Cache successful preview responses and return cached content when the network is unavailable.
- [x] 4.3 Ensure non-gist paths continue through normal network handling instead of preview interception.

## 5. Verification

- [x] 5.1 Run build and typecheck validation after the routing and landing page changes land.
- [x] 5.2 Manually verify the root page, gist root route, gist file route, and error responses in the browser.