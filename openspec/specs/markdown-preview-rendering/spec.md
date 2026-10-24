## Purpose

Provide complete, safe, deterministic Markdown preview documents for Markdown files served from GitHub Gists.

## Requirements

### Requirement: Markdown files render as complete preview documents

When the selected gist file has a Markdown extension, the system SHALL return a complete HTML preview document instead of the raw source viewer. The document SHALL include the rendered content, the file's source URL, a source declaration, navigation back to the application, and styles that follow the site's light/dark theme.

#### Scenario: Markdown gist file is rendered
- **WHEN** a user navigates to `/gist.github/<gist-id>/<file-path>.md`
- **THEN** the response is an HTML document containing rendered Markdown elements rather than an escaped raw source listing

#### Scenario: Markdown source affordances are present
- **WHEN** a Markdown preview document is rendered
- **THEN** the document exposes the exact raw source URL and an action that can copy the original Markdown source

#### Scenario: Markdown rendering is deterministic from cached data
- **WHEN** a cached Markdown gist is rendered offline
- **THEN** the document is generated from the cached file content without contacting GitHub

### Requirement: Markdown supports common documentation extensions

The Markdown renderer SHALL support GFM-compatible tables, strikethrough, autolinks, task-list items, fenced code blocks, block quotes, ordered and unordered lists, headings, links, images, and inline code. Relative links and images SHALL remain relative to the preview namespace so the service worker can resolve files from the same gist.

#### Scenario: GFM structures are rendered
- **WHEN** Markdown contains a table, `~~strike~~`, an autolink, and a task-list item
- **THEN** the generated document contains the corresponding table, deleted text, anchor, and checkbox presentation

#### Scenario: Relative assets use the gist namespace
- **WHEN** Markdown contains `![diagram](./assets/diagram.png)` or `[details](./guide.md)`
- **THEN** the rendered HTML preserves a relative URL that resolves beneath `/gist.github/<gist-id>/` rather than pointing to the application root or GitHub API

#### Scenario: Fenced code remains code
- **WHEN** Markdown contains a fenced block with Markdown, HTML, dollar signs, or Mermaid-like text
- **THEN** the content remains inside an escaped code block and is not interpreted as document markup or mathematical notation

### Requirement: TeX delimiters render to MathML

The Markdown renderer SHALL recognize inline `$...$` and `\(...\)` delimiters and display `$$...$$` and `\[...\]` delimiters, including display formulas spanning multiple lines. It SHALL convert valid formulas to serialized MathML in the generated response without requiring browser JavaScript.

#### Scenario: Inline dollar math is rendered
- **WHEN** Markdown contains `$a^2 + b^2 = c^2$`
- **THEN** the generated document contains MathML for the formula and does not display the delimiter characters as prose

#### Scenario: Display bracket math is rendered
- **WHEN** Markdown contains a multiline `\[...\]` expression
- **THEN** the generated document contains a block MathML element for the expression

#### Scenario: Escaped dollar text is preserved
- **WHEN** Markdown contains ordinary currency text such as `Price: \$5`
- **THEN** the dollar sign is rendered as text and is not treated as the start of a formula

#### Scenario: Invalid math does not break the document
- **WHEN** one formula cannot be parsed
- **THEN** the rest of the Markdown document renders successfully and the invalid formula is shown as an escaped, visibly marked source fallback

### Requirement: Raw Markdown HTML is sanitized

The renderer SHALL sanitize raw HTML produced from Markdown using a worker-safe explicit allowlist. The allowlist MAY retain safe documentation elements and relative links/images, but SHALL remove scripts, event-handler attributes, unsafe URL schemes, embedded frames, and executable styles.

#### Scenario: Script content is neutralized
- **WHEN** Markdown contains a `<script>` element or an `onclick` attribute
- **THEN** the response contains neither executable script content nor the event-handler attribute

#### Scenario: Safe documentation markup is retained
- **WHEN** Markdown contains an allowlisted element such as `<details>`, `<summary>`, `<sub>`, or `<kbd>`
- **THEN** the element is retained with only allowlisted attributes

#### Scenario: Unsafe URL schemes are removed
- **WHEN** Markdown contains a `javascript:` link or image URL
- **THEN** the generated element has no executable URL and cannot navigate to or load that scheme

### Requirement: Mermaid diagrams progressively enhance with a readable fallback

The renderer SHALL recognize Mermaid fenced blocks and emit an escaped, readable source block marked for Mermaid enhancement. The served document SHALL attempt to load a pinned Mermaid runtime through a same-origin, versioned runtime path. A successful render MAY replace the source block with an SVG diagram; any load or render failure SHALL leave the escaped source block visible.

#### Scenario: Mermaid fence is recognized
- **WHEN** Markdown contains a fenced block declared as `mermaid`
- **THEN** the response contains a Mermaid-marked source block whose diagram text is escaped

#### Scenario: Mermaid renders after runtime load
- **WHEN** the pinned Mermaid runtime loads and the diagram is valid
- **THEN** the Mermaid source block is replaced or augmented with a rendered diagram without navigating away from the preview

#### Scenario: Mermaid failure preserves source
- **WHEN** the runtime is unavailable, the browser is offline before first use, or the diagram is invalid
- **THEN** the original Mermaid source remains readable and the preview remains otherwise usable

#### Scenario: Mermaid runtime is cached by version
- **WHEN** the pinned Mermaid runtime is fetched successfully for the first time
- **THEN** a subsequent offline request for the same version can load it from the service-worker runtime cache

### Requirement: Fenced code can be highlighted progressively

The renderer SHALL emit escaped fenced code with a language identifier when one is provided and SHALL provide a readable unhighlighted fallback. The document MAY load a pinned client-side highlighting runtime through the same versioned runtime-cache mechanism and SHALL never treat highlighted output as trusted input.

#### Scenario: Known language is highlighted
- **WHEN** a fenced block declares a language supported by the pinned highlighter
- **THEN** the code remains readable immediately and is progressively decorated with syntax highlighting after the runtime loads

#### Scenario: Unknown language remains readable
- **WHEN** a fenced block declares an unsupported language or no language
- **THEN** the block remains an escaped code block and does not make the document fail

#### Scenario: Highlighting runtime failure is harmless
- **WHEN** the highlighter cannot be loaded or throws while processing a block
- **THEN** the original escaped code remains visible without executable markup
