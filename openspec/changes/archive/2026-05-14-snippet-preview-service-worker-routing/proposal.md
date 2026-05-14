## Why

The current site is still the default Vite starter, while the product goal is a clean, extension-friendly GitHub Gist preview experience. The existing gist-hosting pattern that depends on document injection and query-string URLs is brittle for browser extensions and navigation, so this change establishes a path-based preview flow that behaves like a normal page load.

## What Changes

- Replace the starter landing page with a purpose-built preview entry page for gist IDs and optional file paths.
- Add Service Worker-based request interception for clean URLs like `/gist-id/file-name`.
- Fetch gist content from GitHub's API and return a complete HTML document instead of mutating the current DOM.
- Add user-facing fallback pages for invalid gists, missing files, and GitHub API rate limiting.
- Prepare the app for caching and offline-friendly responses.

## Capabilities

### New Capabilities
- `gist-preview-service-worker-routing`: Clean path-based gist navigation, Service Worker interception, API-backed file resolution, and user-facing error handling.

### Modified Capabilities

## Impact

- Affected app entry points: `index.html`, `src/main.ts`, and the current starter UI code in `src/counter.ts`.
- New static assets and runtime files for the landing page, Service Worker registration, Service Worker logic, and error pages.
- Browser behavior changes around navigation, caching, and extension compatibility, especially for Hypothesis-style annotators.
- GitHub API usage becomes a first-class dependency for gist preview rendering.