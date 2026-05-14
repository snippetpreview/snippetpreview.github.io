# GitHub Pages Deployment

This repository is designed to publish as a root-hosted GitHub Pages site, which matches the current preview routing and Service Worker registration model.

## Deployment flow

The deployment workflow should:

1. Check out the repository.
2. Set up Node.js.
3. Install dependencies with `npm ci`.
4. Build the static site with `npm run build`.
5. Upload the generated `dist/` directory as the GitHub Pages artifact.
6. Deploy that artifact through the GitHub Pages environment.

## Important runtime notes

- The app registers its Service Worker from the site root, so the published site must be served from the Pages root URL.
- Preview URLs are root-relative, such as `/gist.github/<gist-id>/<file-path?>`.
- If this repository ever becomes a project Pages site instead of a user or organization Pages site, the root-absolute paths will need to be revisited.

## Local verification

Before pushing a release, run:

```bash
npm ci
npm run build
```

## Why this workflow

GitHub Pages is a good fit because the app is fully static at build time. The Service Worker handles routed previews at runtime, so the published artifact only needs the compiled frontend and the provider assets already in `public/`.