## Why

The current static site is not installable as a Progressive Web App (PWA). Adding the minimum PWA pieces will let users install the site on mobile and desktop without introducing extra caching or offline behavior.

## What Changes

- Add a Web App Manifest and required icons.
- Register a minimal Service Worker so the site meets installability requirements.
- Update `index.html` and app bootstrap to register the Service Worker and reference the manifest.

## Capabilities

### New Capabilities
- `pwa-installable`: Adds PWA installability with a manifest, icons, and install hints.

### Modified Capabilities

## Impact

- Files: `public/service-worker.js` (simplified), `index.html` (manifest link), `src/main.ts` (service worker registration), new `manifest.webmanifest`, and icon assets under `public/icons/`.
- Build: May require adding icon generation or including static icons in the repo.
- Testing: Validate installability (Lighthouse) and install prompt behavior.
