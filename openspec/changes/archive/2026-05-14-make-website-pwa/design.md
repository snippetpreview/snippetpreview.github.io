## Context

The project is a static site serving snippet previews. It already has a service worker file at `public/service-worker.js`, but the goal now is only to make the app installable, not to introduce offline caching or navigation interception.

## Goals / Non-Goals

**Goals:**
- Provide an installable PWA experience with a Web App Manifest and icons.
- Ensure the app registers a service worker in production so browsers recognize it as installable.
- Keep the service worker minimal and avoid adding caching behavior.

**Non-Goals:**
- Offline browsing support.
- Runtime caching, precaching, or fetch interception.
- Changing provider APIs or preview routing behavior.

## Decisions

- Manifest: Add `manifest.webmanifest` in `public/` with `name`, `short_name`, `start_url`, `scope`, `icons`, `display: standalone`, and `theme_color`.
- Icons: Use a GitHub-themed icon derived from the existing brand mark and commit the install assets directly.
- Service Worker: Keep `public/service-worker.js` minimal. It should exist and be registered, but it does not need caching logic or custom fetch handlers.
- Registration: Add registration snippet to `src/main.ts` that registers the service worker only in production builds.

## Risks / Trade-offs

- Missing or incorrect manifest fields can block installability → verify with Lighthouse and browser install prompts.
- A service worker that is too minimal or registered incorrectly can prevent installability → test production build registration explicitly.

## Migration Plan

1. Add manifest and icons, and update `index.html` to reference the manifest.
2. Simplify `public/service-worker.js` to a minimal installable worker.
3. Add SW registration to `src/main.ts` behind a production-only guard.
4. Validate installability with Lighthouse and manual browser install checks.

