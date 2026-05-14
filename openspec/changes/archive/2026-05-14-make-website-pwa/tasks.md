## 1. Manifest and assets

- [ ] 1.1 Create `public/manifest.webmanifest` with installability fields and icon references.
- [ ] 1.2 Add icons at `public/icons/icon-192.png` and `public/icons/icon-512.png`.
- [ ] 1.3 Update `index.html` to reference the manifest and theme-color meta tag.

## 2. Minimal service worker

- [ ] 2.1 Simplify `public/service-worker.js` so it remains installable but does not cache assets.
- [ ] 2.2 Ensure the service worker file is registered successfully in production builds.

## 3. Registration and verification

- [ ] 3.1 Add service worker registration to `src/main.ts`, gated by production build.
- [ ] 3.2 Verify installability with a Lighthouse PWA audit and manual install prompt testing.
- [ ] 3.3 Update the README with the installability setup and verification steps.
