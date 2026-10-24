## 1. Dependencies and renderer foundation

- [x] 1.1 Add the worker-safe Markdown parser, task-list extension, MathJax TeX-to-MathML pieces, and explicit HTML sanitizer dependencies with pinned versions.
- [x] 1.2 Create a Markdown rendering module with typed input/output helpers, placeholder handling, and a complete generated-document shell.
- [x] 1.3 Add Markdown-specific styles for headings, tables, task lists, block quotes, code, MathML, Mermaid fallbacks, source affordances, overflow, and light/dark themes.

## 2. Markdown and sanitization pipeline

- [x] 2.1 Configure Markdown parsing for GFM-compatible tables, strikethrough, autolinks, fenced code, task lists, and escaped source content.
- [x] 2.2 Implement math delimiter tokenization for `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` without parsing formulas inside fenced code or inline code.
- [x] 2.3 Convert valid TeX tokens to MathML with MathJax's worker-safe adaptor, isolate conversion errors, and normalize output needed for MathML Core compatibility.
- [x] 2.4 Implement the explicit raw-HTML sanitizer allowlist, including safe documentation elements and relative links/images while removing scripts, event handlers, unsafe URL schemes, frames, and executable styles.
- [x] 2.5 Restore generated MathML and Mermaid placeholders only after sanitization, and verify user-provided markup cannot inject generated-document scripts or attributes.

## 3. Provider integration and source affordances

- [x] 3.1 Route `.md` and `.markdown` files through the Markdown renderer before the existing HTML content sniff and raw source-view fallback.
- [x] 3.2 Preserve the exact raw source URL, `DC.source` meta declaration, original-source copy action, back links, cache links, and current first-file root selection.
- [x] 3.3 Preserve existing HTML-document behavior, non-Markdown source-view behavior, missing-file responses, and unmodified subresource responses.

## 4. Progressive Mermaid and highlighting runtime

- [x] 4.1 Emit escaped Mermaid fences and language-tagged code blocks with safe readable fallbacks.
- [x] 4.2 Add a versioned same-origin service-worker runtime route that CacheFirst-fetches pinned Mermaid and highlight.js assets and only caches successful responses.
- [x] 4.3 Add the Markdown page loader that initializes Mermaid and highlight.js progressively, retains fallbacks on load/render errors, and avoids treating runtime output as trusted source.
- [x] 4.4 Verify runtime cache versioning, offline-after-first-use behavior, and graceful first-use offline behavior in the generated preview.

## 5. Validation and documentation

- [x] 5.1 Add focused tests or deterministic renderer checks for GFM structures, all four math delimiter forms, fenced-code escaping, sanitizer cases, Mermaid fallback, and highlighting fallback.
- [x] 5.2 Run TypeScript checks and the production build, then inspect bundle output for the expected worker/runtime split.
- [x] 5.3 Update the project README and related OpenSpec/main documentation to describe Markdown rendering, MathML, progressive Mermaid/highlighting, and their fallbacks.
- [x] 5.4 Manually verify online, cached-offline, first-use-offline, and downloaded-HTML Markdown previews with relative assets and source metadata.
