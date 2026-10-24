## Context

The service worker resolves a gist into a cached `ProviderResource` and delegates document generation to the GitHub provider. HTML files are served as documents with a `DC.source` meta tag; all other files are currently wrapped in the generated source viewer. The renderer is synchronous, has no DOM, and is reused by the cached-preview page when it downloads rendered HTML.

Markdown rendering therefore needs to produce a complete, self-contained HTML response from a worker-safe pipeline. Browser-only enhancements such as Mermaid diagrams and code highlighting must be progressive enhancements of that response, not prerequisites for serving it. Relative links and images must remain under the existing `/gist.github/<gist-id>/...` namespace so the service worker can resolve them from the same cached resource.

## Goals / Non-Goals

**Goals:**

- Render Markdown gist files as readable, themed HTML documents.
- Support GFM-style tables, task lists, strikethrough, autolinks, fenced code blocks, relative links, and relative images.
- Convert `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` formulas to MathML before the response is returned.
- Sanitize raw HTML while retaining a deliberately small set of useful documentation elements.
- Provide Mermaid and syntax highlighting enhancements with readable fallbacks and a first-use offline cache.
- Preserve source metadata, existing cache behavior, copy affordances, and the current first-file root selection.

**Non-Goals:**

- Changing gist fetching, file selection, URL parsing, or IndexedDB resource schema.
- Executing arbitrary scripts, stylesheets, or event handlers supplied by Markdown.
- Supporting every GitHub-specific Markdown extension or GitHub's exact CSS/DOM output.
- Making Mermaid or highlighting a requirement for offline Markdown rendering.
- Changing how standalone HTML gist files are served.

## Decisions

### Use a worker-safe Markdown pipeline

Use `markdown-it` with its GFM-compatible options and task-list plugin. Render Markdown with raw HTML enabled only long enough to pass the result through `xss` using an explicit allowlist. Math and Mermaid constructs are represented by generated placeholders/tokens during Markdown parsing and are restored only after sanitization, so generated MathML is not accidentally escaped or admitted through user HTML.

Alternatives considered:

- **`marked`**: familiar and capable, but the existing provider architecture benefits from markdown-it's token pipeline for delimiter-aware math and fenced-block handling.
- **Disable raw HTML entirely**: safer and simpler, but removes common documentation constructs such as `<details>`, `<summary>`, `<sub>`, and `<kbd>` even when they are harmless.
- **DOMPurify**: strong browser sanitizer, but it requires a DOM and cannot run in the service worker renderer.

### Produce MathML with MathJax in the service worker

Bundle the MathJax TeX input and MathML serialization pieces with the worker renderer, using the lite adaptor rather than a browser DOM. Configure the base, AMS, and new-command packages. Formula conversion errors are isolated per expression and produce an escaped, visibly marked source fallback instead of failing the whole preview.

MathJax's MathML output is normalized for MathML Core compatibility where practical, especially for mathematical font variants that otherwise rely on MathML3 `mathvariant` behavior. The generated document includes compact display/inline MathML styles and does not require external fonts.

Alternatives considered:

- **Temml**: smaller and already emits more Unicode mathematical characters, but MathJax was selected for the requested TeX coverage and established AMS/new-command support.
- **Client-side MathJax**: would reduce the worker bundle but would make downloaded and JavaScript-disabled previews show raw delimiters and would weaken offline behavior.
- **KaTeX**: outputs HTML/CSS rather than the requested MathML-first representation.

### Progressive Mermaid rendering through a pinned same-origin loader

Render Mermaid fences as `<pre class="mermaid">` blocks containing escaped diagram text. The generated page includes a small loader that requests a pinned Mermaid UMD asset from a same-origin runtime path. The service worker handles that path with a CacheFirst strategy: it fetches the pinned upstream asset on first use, caches a successful response, and serves it offline afterward. If loading or rendering fails, the original `<pre>` remains visible.

The runtime path is same-origin so the loader works under the site's existing service-worker scope and does not require a third-party script to be injected directly into the document. The upstream URL and version are pinned rather than using a floating CDN URL.

Alternatives considered:

- **Bundle Mermaid into the worker/app shell**: fully self-contained but adds roughly 800 KB compressed to the install and worker payload.
- **Import Mermaid directly from a CDN**: smaller initial application bundle, but cannot be reliably cached by this service worker and makes offline behavior dependent on cross-origin module loading.
- **Render Mermaid server-side**: not available in a static GitHub Pages deployment.

### Progressive client-side syntax highlighting

Emit fenced code blocks with a language class and a small loader that obtains a pinned highlight.js browser asset through the same runtime-cache mechanism. Highlighting runs only on matching code blocks after the document is usable. The unhighlighted `<pre><code>` content is the permanent fallback, and unknown languages remain readable.

The generated markup uses escaped code text and never treats highlighted output as Markdown or raw user HTML.

### Keep Markdown as a distinct provider rendering mode

Add a Markdown renderer alongside the existing HTML and source-view branches. Extension detection takes precedence over the current HTML content sniff so a Markdown file containing an HTML-looking example is still rendered as Markdown. The renderer keeps the existing raw source URL, `DC.source` metadata, back link, cache link, theme variables, and copy action.

The root URL continues to select the first file exactly as it does today. A requested `.md` path is the only input that enters the Markdown renderer.

## Risks / Trade-offs

- **[Worker bundle size]** MathJax and Markdown dependencies increase the service-worker and cache-page bundles → keep only required MathJax input packages, avoid bundling Mermaid/highlight.js, and measure the production build.
- **[MathML browser variance]** MathML Core does not implement every MathML3 feature → normalize mathematical variants where possible, preserve readable fallback text on conversion errors, and document that complex formulas may vary by browser.
- **[Sanitizer regressions]** An allowlist can remove legitimate documentation markup → test common documentation tags and attributes, and keep the original Markdown source available through the existing source URL.
- **[Runtime availability]** CDN failure prevents enhancement → never replace the source fallback until a diagram or highlight result has been produced; cache successful runtime responses only.
- **[Runtime cache scope]** A service-worker update could leave an incompatible runtime asset cached → include the pinned version in the runtime cache key and use a bounded cache name/version.
- **[Content-type ambiguity]** Some files have no `.md` extension but contain Markdown → intentionally do not content-sniff generic text; only Markdown extensions enter this mode to avoid changing existing previews unexpectedly.
- **[Downloaded HTML behavior]** A downloaded rendered preview may not be controlled by the service worker → retain static MathML and source fallbacks in the HTML, and treat Mermaid/highlighting as optional enhancements.

## Migration Plan

1. Add the Markdown renderer, worker-safe parser/math/sanitizer pipeline, styles, and progressive enhancement loader.
2. Add the versioned runtime-cache route for the pinned Mermaid and highlight.js assets.
3. Update provider routing requirements and user documentation.
4. Run TypeScript checks and the production build; manually verify online, first-use offline, and cached-offline Markdown previews.
5. Roll back by deploying the previous static bundle; existing cached gist resources remain compatible because the resource schema is unchanged.

## Open Questions

- Whether to expose a user-facing indicator when a Mermaid or highlighting runtime could not be loaded, or keep the fallback completely silent.
- Whether the initial safe HTML allowlist should include additional documentation tags after testing real-world gists.
