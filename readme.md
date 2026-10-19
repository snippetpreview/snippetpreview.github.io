# Snippet Preview

[Start Here!](https://snippetpreview.github.io)

Snippet Preview is a static website for previewing GitHub Gist content through clean, provider-namespaced routes. It is designed to work well as a GitHub Pages site and to behave more like a normal web app than older gist preview tools.

## What It Does

The app lets you take a GitHub Gist URL, extract the gist ID and optional file path, and turn it into a stable preview URL. The preview route is handled by a Service Worker, which means the browser navigates to a real path instead of rendering the page through `document.write` like that of [gistpreview](https://gistpreview.github.io) and [gisthost](https://gisthost.github.io)

That design matters because it avoids two common problems in older tools:

1. Different previews share the same base page and only vary by query string.
2. Browser extensions, bookmarklets, and annotation tools often struggle with pages built around `document.write`.

This project was built to avoid those limitations while still staying fully static.

## How Routing Works

The site publishes a root-level preview namespace such as:

- `/gist.github/<gist-id>/`
- `/gist.github/<gist-id>/<file-path>`

When the browser navigates to one of those paths, the Service Worker intercepts the request, asks the matching provider adapter to resolve it, and returns the rendered preview response.

The same applies to subresources: `/gist.github/<gist-id>/style.css` is answered from the gist's own files, so a gist whose HTML references `./style.css` or `./app.js` renders correctly. A file path the gist does not contain returns 404 instead of substituting another file.

At the moment, GitHub Gists are the implemented provider, but the code is structured so additional providers can be added later: the worker dispatches on `parsePreviewPath()`, and adapters live in `src/providers/`.

## Served Documents

Every preview document declares the file it was served from as its first head element:

```html
<meta name="DC.source" scheme="URI" content="https://gist.githubusercontent.com/<user>/<gist-id>/raw/<file-path>">
```

The value uses the raw content address because `gist.github.com/<user>/<id>/<file>` does not exist — GitHub selects files on the gist page with a `#file-...` fragment, which carries no real path. Gist HTML that already declares its own `DC.source` is left untouched, and subresource responses are never modified.

HTML files are served as the gist's own document with only that declaration added. Everything else is presented in a small source viewer: the raw source address verbatim, a bordered code container with the media type, a **Copy** button, horizontal scrolling for long lines, and light/dark theming that follows the system.

## Cold Start and Offline Behavior

A service worker can only control a page after it is installed, so the very first visit to a preview path in a fresh browser never reaches the worker. GitHub Pages therefore answers with `404.html`, which forwards the requested path to `/?next=<path>`. The landing page registers the worker, waits until the page is actually controlled, and then replaces the URL with the original path. Each path is retried at most once per tab, so a browser that cannot run the worker gets an explanatory message and a link to GitHub instead of a redirect loop.

The app is installable and works offline:

- the app shell (`/` and `/cache.html`) and its built assets are precached, so the installed app opens without a network;
- visited gists are stored in IndexedDB and revalidated with `If-None-Match`, so an unchanged gist is served from cache without re-downloading it, and a cached gist still renders when the provider is unreachable.

Cached gists can be inspected at [`/cache.html`](https://snippetpreview.github.io/cache.html), which lists what is stored, lets you download the rendered HTML or any file's raw source, open a file, or remove a gist.

## Main Interface

The homepage is a small composer UI that helps you:

- enter a gist ID and optional file path
- paste a canonical `gist.github.com` URL and decompose it automatically
- generate the preview URL
- open or copy either the canonical GitHub URL or the preview URL

The page also includes example preview routes so you can test the routing directly.

## Project Goals

The main goals of the project are:

- provide gist previews with stable, routable URLs
- avoid `document.write`
- keep the site static and easy to host
- make previews friendlier to browser extensions and annotation tools
- keep visited gists available offline, and let users see and clear what was stored
- declare the provenance of every document the site serves

## Current Scope

The current implementation focuses on GitHub Gists. The provider adapter layer exists so the preview system can grow beyond GitHub without changing the overall routing model.

## Project Structure

```
index.html                  composer page (Vite entry)
cache.html                  cached-preview manager (Vite entry)
vite.config.ts              multi-page build + vite-plugin-pwa (injectManifest)
tsconfig.json               app type checking (DOM libs)
tsconfig.worker.json        worker-only type checking (WebWorker libs)

src/
  main.ts                   composer UI, resume handling, production SW registration
  cache.ts                  cache management page
  resume.ts                 ?next= validation, control wait, one-shot guard
  service-worker.ts         precache + provider dispatch + cache-aware serving
  style.css                 shared styles
  providers/
    provider-adapter.ts     adapter contract and result types
    github-provider.ts      gist parsing, fetchResource, render, renderAsset
    html-meta.ts            DC.source injection
    source-view.ts          wrapped non-HTML source viewer
    mime.ts                 extension to content type
  cache/
    resource-store.ts       IndexedDB store, revalidation, quota, persistence
    preview-service.ts      cache-first resolution and error responses

public/
  404.html                  cold-start recovery document
  manifest.webmanifest      install metadata
  icons/                    generated PNG, maskable, touch, favicon
  favicon.svg

scripts/
  serve-pages.mjs           static server with GitHub Pages 404 semantics
```

## Local Development

This project uses Vite and TypeScript.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server. The service worker is **not** registered, so preview routes behave as plain unknown paths. |
| `npm run build` | Type-checks the app (`tsconfig.json`), type-checks the worker (`tsconfig.worker.json`), then builds `dist/` including `service-worker.js` and its precache manifest. |
| `npm run preview` | Serves the built output with `vite preview`. Does not emulate GitHub Pages' unknown-path behavior. |
| `npm run preview:pages` | Serves `dist/` and returns `404.html` with a 404 status for unknown paths, like GitHub Pages. Add `-- --port 4180` for another port. |

```bash
npm install
npm run dev
```

For a production build, and the Pages-like preview used to exercise the cold-start redirect:

```bash
npm run build
npm run preview:pages
# optionally: npm run preview:pages -- --port 4180
```

`vite preview` never serves `404.html`, so the cold-start redirect cannot be exercised there. Use a port you have not visited before (or a private window) when testing it, otherwise the service worker is already installed and the request takes the warm path.

### Manual verification

`npm run build && npm run preview:pages`, then in a fresh browser profile:

1. Open `/gist.github/<gist-id>/` — the preview should render even though the first request was a 404.
2. Follow a relative link inside the gist — the second file should render from the same cached resource.
3. Open `/cache.html` — the gist is listed with its revision, files, and sizes.
4. Stop the server (or go offline) and reload — `/`, `/cache.html`, and the cached preview should all still load.
5. Open a path outside every provider namespace — the real `404.html` should render, not the composer.

PWA icons in `public/icons/` were generated from `public/icons/pwa-icon.svg` with:

```bash
npx @vite-pwa/assets-generator --preset minimal public/icons/pwa-icon.svg
```

## Limitations

- The first request for a preview URL in a fresh browser is still an HTTP 404 with a generic document; a service worker cannot handle the navigation that installs it. The redirect recovers the view, but crawlers and social embeds see the 404.
- Previews are rendered client-side, so link unfurls do not show gist content.
- GitHub's unauthenticated API allows 60 requests per hour per IP. Caching and conditional requests reduce consumption, but a busy address will hit the limit; rate-limit responses are reported rather than cached.
- Gists are cached as a unit. Removing a cached preview removes every file in that gist, because its files share one revision.

## Deployment

The site is intended to be deployed as a root-hosted GitHub Pages site. That matches the current Service Worker registration and the root-relative preview paths.

The build emits `dist/service-worker.js` from `src/service-worker.ts`; do not add a hand-written worker to `public/`, and keep `404.html` at the artifact root so GitHub Pages serves it for unknown paths.

If you want to understand the deployment assumptions in more detail, see [ghpage.md](ghpage.md).
