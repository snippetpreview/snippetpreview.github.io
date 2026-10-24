## Why

GitHub Gists commonly contain README and documentation Markdown, but the preview currently displays Markdown as an unformatted source listing. This makes links, images, tables, code examples, mathematical notation, and Mermaid diagrams difficult to read and prevents the site from serving as a useful documentation preview.

## What Changes

- Render Markdown gist files as complete styled HTML documents instead of plain source listings.
- Support common Markdown extensions, including GFM-style tables, task lists, strikethrough, autolinks, fenced code blocks, and relative links/images resolved through the existing gist route.
- Render TeX math delimiters `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` to MathML in the generated document.
- Recognize Mermaid fenced blocks and progressively replace them with diagrams in the browser, while retaining readable source fallback when Mermaid is unavailable.
- Sanitize raw HTML in Markdown with a worker-safe allowlist before it is included in the generated document.
- Add client-side syntax highlighting for fenced code blocks.
- Preserve source metadata, copy/download affordances, theme behavior, offline cache behavior, and the current first-file selection for root gist URLs.
- **BREAKING**: Markdown files will no longer be shown as the existing raw source viewer; they will be rendered documentation previews.

## Capabilities

### New Capabilities

- `markdown-preview-rendering`: Render sanitized Markdown gist files with common extensions, MathML formulas, Mermaid diagrams, and highlighted code.

### Modified Capabilities

- `gist-preview-service-worker-routing`: Define Markdown as a generated document type alongside raw HTML documents and the existing non-HTML source viewer, while preserving source declarations and subresource routing.

## Impact

- Affected provider rendering and source-view code in `src/providers/`, including the GitHub adapter and generated preview styles/scripts.
- Affected the service-worker bundle and cache-page bundle because both use the provider renderer.
- Adds Markdown, math, sanitization, Mermaid-loader, and syntax-highlighting implementation dependencies or pinned runtime assets.
- Adds a same-origin runtime cache path for the pinned Mermaid browser bundle so diagrams can work offline after first use.
- Requires documentation and OpenSpec requirements to describe the new Markdown response behavior and graceful fallbacks.
