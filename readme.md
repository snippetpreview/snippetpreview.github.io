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

- `/gist.github/<gist-id>`
- `/gist.github/<gist-id>/<file-path>`

When the browser navigates to one of those paths, the Service Worker intercepts the request, asks the matching provider adapter to resolve it, and returns the rendered preview response.

At the moment, GitHub Gists are the implemented provider, but the code is structured so additional providers can be added later.

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

## Current Scope

The current implementation focuses on GitHub Gists. The provider adapter layer exists so the preview system can grow beyond GitHub without changing the overall routing model.


## Local Development

This project uses Vite and TypeScript.

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

To preview the production output locally:

```bash
npm run preview
```

## Deployment

The site is intended to be deployed as a root-hosted GitHub Pages site. That matches the current Service Worker registration and the root-relative preview paths.

If you want to understand the deployment assumptions in more detail, see [ghpage.md](ghpage.md).
