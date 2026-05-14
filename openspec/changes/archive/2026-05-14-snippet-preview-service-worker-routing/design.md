## Context

The repository is still the default Vite vanilla TypeScript starter, so the change is both an architectural shift and a product reset. The target runtime is GitHub Pages, which means the solution must remain fully static while still behaving like a routed application for gist preview URLs.

The main stakeholders are people opening gist preview links directly in the browser and browser extensions that expect a stable, document-shaped page. The design must avoid DOM replacement, preserve natural browser navigation, and work without any server-side process.

## Goals / Non-Goals

**Goals:**
- Serve gist previews from clean path-based URLs.
- Preserve a stable document so browser extensions can inject normally.
- Register a Service Worker that intercepts only the preview routes it owns.
- Resolve gist content from GitHub's API and return a complete HTML document.
- Provide predictable error responses and cache fallback behavior.

**Non-Goals:**
- Building a gist editor or gist creation flow.
- Adding authenticated GitHub API support in this change.
- Implementing search, discovery, or user accounts.
- Replacing GitHub Pages with a custom backend.

## Decisions

1. Use a Service Worker as the routing layer instead of a client-side router.
   - Rationale: the page content must be delivered as a full document, not injected into an existing DOM. A Service Worker can act like a virtual server and return a document response for direct navigations.
   - Alternatives considered: History API routing in the page, or a document.write-based rewrite. Both keep the browser on the same document and do not solve the extension-compatibility problem.

2. Keep the landing page simple and static, with a separate registration script.
   - Rationale: the landing page only needs to collect a gist ID and optional file path, explain the URL format, and register the worker. Keeping that logic separate reduces coupling and makes the root page easy to maintain.
   - Alternatives considered: bundling registration into the main app module or making the landing page a single-page app. Those options add complexity without helping the preview routing problem.

3. Fetch gist metadata in the Service Worker and forward file content unchanged.
   - Rationale: the Service Worker should act as a transparent transport — fetch gist metadata and the target file content, and respond with the original file body as-is (no modification to the retrieved HTML fragment). The worker only generates or modifies responses when producing error pages or when a non-HTML response must be wrapped for safe rendering.
   - Alternatives considered: fetching in the page and then rewriting the DOM, or redirecting to GitHub-hosted content. Those options lose the stable-document behavior and make consistent error handling harder to control.

4. Network-first by default; caching deferred for MVP.
   - Rationale: the initial implementation SHALL always request fresh content from GitHub (network-first) and SHALL NOT implement caching in the MVP to reduce complexity. The design SHALL be implemented so adding a cache strategy (cache-first, stale-while-revalidate, etc.) later requires minimal changes.
   - Alternatives considered: cache-first, stale-while-revalidate, or network-only. Those strategies remain options for later releases, but are deferred now to focus on correctness and simplicity.

5. Return generated HTML for errors instead of plain text or JSON.
   - Rationale: direct navigations should always land on a browser-renderable page with a clear recovery path back to the home page.
   - Alternatives considered: browser default error pages or API-style JSON responses. Those would be less usable for a direct top-level navigation.

## Risks / Trade-offs

- [Service Worker scope and GitHub Pages path handling can be brittle] → Keep the worker registration explicit, test root and nested gist routes on the deployed path, and fall back cleanly when the worker is unavailable.
- [GitHub API rate limits can block unauthenticated users] → Surface a dedicated rate-limit page and keep the code path isolated so token support can be added later without changing the routing model.
- [Caching adds complexity] → Caching is deferred in the MVP; the implementation should include clear extension points for adding cache behavior later.
- [Previewing arbitrary gist files can expose unexpected content types] → The worker SHALL forward HTML content unchanged; when non-HTML or unsafe content is encountered, the worker SHALL wrap or sanitize the response into a safe HTML document.

## Migration Plan

1. Replace the starter Vite counter UI with the new landing page and registration flow.
2. Add the Service Worker file and verify it registers at site root.
3. Implement gist route resolution, HTML response generation, and error pages.
4. Add caching behavior after the basic routing path is working.
5. Roll back by removing the Service Worker registration and reverting the root page to a standard static landing page if deployment issues appear.

## Open Questions / Decisions

- Support for gist file names that contain path separators: design SHALL allow supporting these in future releases. The initial resolver will treat the path portion as the file name to match literally, but the code should be structured to add alternate matching strategies later.
- Caching: no cache in the first release. If a network error occurs, the error page SHOULD include the detailed GitHub API response (status, message, headers) to aid debugging and user guidance. Caching strategies will be added in a follow-up when needed.
- Token-based GitHub API support: deferred to future work; the system's design SHALL keep authentication hooks ready so tokens can be added without rewiring routing logic.
- Multi-provider support (GitLab, CodeBin, etc.): the implementation SHOULD be modular so additional providers can be added later with adapter modules that normalize provider responses into the same preview contract.