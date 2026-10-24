## Purpose

Snippet Preview is a static GitHub Pages app that serves GitHub Gist previews from provider-namespaced URLs (`/gist.github/<gist-id>/<file-path?>`) while preserving a stable browser document for extension compatibility. The landing page provides a user-friendly interface for composing and decomposing GitHub Gist URLs with synchronized input/output fields and explicit action controls. The Service Worker acts as a routing layer, intercepting preview requests and returning the requested gist file or an error page. Served documents keep their own structure; the only addition is a source declaration in the document head.

## Design Intention

The app combines a clean provider-namespaced URL scheme with an intelligent landing page to improve both discoverability and UX:

1. **Provider namespacing** (`/gist.github/...`): Declares the content provider clearly, enabling future support for additional sources (GitLab, CodeBin, etc.).
2. **Landing page UI**: Provides three synchronized input fields (gist ID, file path, canonical GitHub URL) that bidirectionally compose and decompose each other, reducing friction for users.
3. **Debounce-based decomposition**: When users paste a GitHub Gist URL, the landing page parses it after 1.5 seconds of inactivity, automatically populating ID and path fields without disrupting editing.
4. **Explicit actions**: All navigation and copy operations are surfaced as buttons rather than implicit form submission, improving accessibility and intent clarity.
5. **Structured logging**: User-facing feedback (info, warning, error) is captured in a log output element for better error transparency than modal alerts.

The Service Worker remains provider-agnostic through a provider adapter pattern (see separate **provider-routed-preview** spec), keeping GitHub-specific logic separate and maintainable.

## System Architecture

The app is a two-part static system:

1. **Landing Page** (`index.html` + `src/main.ts`): Provides synchronized input/output fields for composing and decomposing GitHub Gist URLs, with explicit action buttons for navigation and clipboard operations.
2. **Service Worker** (`src/service-worker.ts`): Serves provider-namespaced preview requests by resolving cached provider resources and rendering responses, and manages preview routing and the offline app shell (see **provider-routed-preview** spec).

### URL Correspondence (Provider-Namespaced)

| Canonical Source | Preview URL | Meaning |
|---|---|---|
| `https://gist.github.com/<user>/<gist-id>` | `/gist.github/<gist-id>` | Preview first file |
| `https://gist.github.com/<user>/<gist-id>#<file.ext>` | `/gist.github/<gist-id>/<file.ext>` | Preview specific file |
| `https://gist.github.com/<gist-id>` (no username) | `/gist.github/<gist-id>` | Preview first file (username optional in canonical form) |

### Landing Page Field Model

The landing page maintains three synchronized input/output fields:

**Inputs (Synchronized)**:
- `gist-id`: Gist resource identifier (e.g., `30b90f63285fdcdb5cef974a4970bd10`)
- `file-path`: Optional path within the gist (e.g., `index.html` or `/src/main.ts`)
- `github-gist-url`: Editable GitHub Gist URL field for pasting canonical URLs

**Outputs (Derived)**:
- `preview-url`: Read-only preview path derived from ID and file path (e.g., `/gist.github/30b90f63285fdcdb5cef974a4970bd10/index.html`)
- `event-log`: Structured log output with severity labels (info, warning, error)

**Synchronization Flow**:
- When `gist-id` or `file-path` change → Immediately recompute `github-gist-url` and `preview-url`
- When `github-gist-url` changes → After 1.5s debounce, attempt to parse into `gist-id`, `file-path`, and username
- Parse failure → Append error message to log, do not overwrite current field state

## Module Specifications

### Landing Page (`index.html` + `src/main.ts`)

**Responsibility**: Provide a user-friendly interface for composing and decomposing GitHub Gist URLs with synchronized fields, explicit action controls, and structured logging.

**Input Fields**:
- `gist-id`: User-entered gist resource ID
- `file-path`: User-entered optional file path (accepts both `filename.ext` and `/absolute/path` formats)
- `github-gist-url`: User-editable canonical GitHub Gist URL field

**Output Elements**:
- `preview-url`: Read-only derived preview path
- `event-log`: Structured log output with timestamp and severity

**Action Buttons**:
- `go-to-github-gist`: Open canonical GitHub URL in new tab (uses retained username when known)
- `go-to-preview`: Open preview URL in new tab
- `copy-gist-url`: Copy canonical GitHub URL to clipboard
- `copy-preview-url`: Copy preview URL to clipboard
- `reset`: Clear all inputs and outputs

**Constraints**:
- Gist ID validation is permissive; let GitHub API surface format errors
- File path normalization accepts both relative (`file.ext`) and absolute (`/path/file.ext`) formats
- Debounce URL decomposition for 1.5 seconds after user finishes editing
- Parse failures must not overwrite existing field state
- Username retention: Store parsed username from successful decomposition; use for subsequent compositions
- Log messages must include severity level (info/warning/error) and human-readable text

**Conventions**:
- Helper: `normalizeFilePath(value)` → trim, remove leading `/`, return normalized path
 - Helper: `buildPreviewPath(gistId, filePath)` → `/gist.github/<encoded-id>/<encoded-path?>`.
     - Note: When `filePath` is empty, implementations SHOULD emit a trailing slash: `/gist.github/<encoded-id>/` to preserve correct relative URL resolution for HTML documents.
- Helper: `buildCanonicalGistUrl(gistId, filePath, username)` → `https://gist.github.com/<user?>/<id>#<path?>`
- Helper: `parseCanonicalGistUrl(urlText)` → `{gistId, filePath, username}` or null
- Helper: `log(level, message)` → append `[LEVEL TIMESTAMP] message` to log output
- Helper: `syncFromIdAndPath()` → recompute both outputs from current ID and path

### Service Worker (`src/service-worker.ts`)

**Responsibility**: Serve provider-namespaced preview requests by resolving the resource through the cache layer and delegating rendering to the matching provider adapter (detailed in **provider-routed-preview** spec).

**Input**: Same-origin HTTP fetch event whose pathname falls under a registered provider namespace, for any navigation mode.

**Output**: HTTP Response object containing either:
- Complete HTML document for a navigation
- Raw file content with a MIME type derived from the file extension for a subresource
- Pass-through to network for non-preview paths

**Constraints**:
- The worker is bundled by the build (Workbox `injectManifest`, IIFE output), so provider adapters are compiled modules rather than fetched assets
- Route dispatch: Try each provider adapter's `parsePreviewPath()` in order; on first match, resolve the resource and render it
- Non-matching paths pass through to normal network handling; there is no catch-all navigation fallback, so unknown paths still reach the site's not-found document
- Navigations revalidate the cached resource; subresources are served from the cache without revalidation
- The app shell and built assets are precached, and URL parameters are ignored when matching precached entries

**Conventions**:
- Import provider adapters: `import { githubProvider } from './providers/github-provider'`
- Provider registry: `const providers = [githubProvider]` (extensible for future providers)
- Route dispatch pattern: `for (const provider of providers) { const parsed = provider.parsePreviewPath(url.pathname); if (parsed.ok) { event.respondWith(servePreview(provider, parsed.value, request)); return } }`
- `servePreview` resolves the resource through the cache and delegates to `render()` for navigations or `renderAsset()` for subresources

### GitHub Provider Adapter (`src/providers/github-provider.ts`)

**Responsibility**: Implement provider adapter contract for GitHub Gists (see **provider-routed-preview** spec for contract details).

**Key Methods**:
- `parsePreviewPath(pathname)`: Extract gist ID and file path from `/gist.github/...` routes
- `parseCanonicalUrl(urlText)`: Decompose `gist.github.com` URLs to extract resource ID, file path, and username
- `buildPreviewPath({resourceId, filePath})`: Compose `/gist.github/<id>/<encoded-path?>` routes
- `buildCanonicalUrl({resourceId, filePath, username})`: Compose `https://gist.github.com/<user?>/<id>#<path?>`
- `handlePreview({resourceId, filePath})`: Composition of `fetchResource` and `render`, retained for direct dispatch
- `fetchResource({resourceId, etag})`: Return provider files, metadata, revision, and validator for caching
- `render({resource, filePath, request})`: Build a preview document from fetched data without network access
- `renderAsset({resource, filePath})`: Return a single file with its extension-derived MIME type

**Constraints**:
- GitHub API endpoint: `https://api.github.com/gists/<gist-id>`
- Must detect truncated files (check `truncated` flag) and fetch from `raw_url` if needed
- HTML content is returned with a `DC.source` declaration added to its head; non-HTML content is rendered in a styled source viewer with a copy control
- Error responses must include GitHub API error details

**Conventions**:
- Result objects: `{ok: true, value: ...}` for success, `{ok: false, error: {code, message}}` for failure
- Helper: `ok(value)` → `{ok: true, value}`
- Helper: `fail(code, message)` → `{ok: false, error: {code, message}}`

## Data Flow

### Landing Page Interaction

```
User Interface
    ↓
User enters gist ID and optional file path (or pastes GitHub URL)
    ↓
Input event triggers syncFromIdAndPath() (immediate for ID/path)
    ↓
System recomputes preview-url: /gist.github/<encoded-id>/<encoded-path?>
System recomputes github-gist-url: https://gist.github.com/<user?>/<id>#<path?>
    ↓
(Optionally) User clicks go-to-github-gist or go-to-preview button
    ↓
Browser navigates to new tab with target URL
```

### URL Decomposition (Debounced)

```
User pastes GitHub URL into github-gist-url field
    ↓
Input event clears debounce timer
    ↓
After 1.5 seconds of no further edits:
    ↓
System calls parseCanonicalGistUrl(github-gist-url value)
    ↓
On success: Update gist-id, file-path, retain username, log info message
On failure: Append error message to log, do not modify field state
    ↓
System calls syncFromIdAndPath() to recompute outputs
```

### Preview Navigation (Provider-Namespaced)

```
User clicks go-to-preview button or navigates to /gist.github/123/file.html
    ↓
Browser navigates to /gist.github/<gist-id>/<file-path>
    ↓
Service Worker fetch event intercepts (any request mode)
    ↓
Service Worker attempts parsePreviewPath() on each provider in registry
    ↓
GitHub adapter matches /gist.github/... pattern
    ↓
Service Worker resolves the resource through the cache:
    - Cached entry revalidated with If-None-Match on navigations
    - Cached entry served directly for subresources and when offline
    ↓
MISS → GitHub Adapter:
    - Fetches https://api.github.com/gists/<gist-id>
    - Selects file by name or first available
    - If truncated, fetches raw content from GitHub
    - Stores the resource and returns its files
    ↓
Navigation → render() (document + DC.source declaration)
Subresource → renderAsset() (file bytes + extension-derived type)
    ↓
Browser renders document
```

## Implementation Constraints

- **GitHub API**: Uses unauthenticated endpoint (60 req/hour limit). Rate-limit errors must be caught and reported to user via log output.
- **File Size**: Large files may be truncated by GitHub. Check `truncated` flag and fetch from `raw_url` if needed.
- **Content Type**: Files can be any type (HTML, CSS, JavaScript, text, binary). HTML files are served as documents with a source declaration added; non-HTML, non-Markdown files are rendered in a styled source viewer; Markdown files are rendered as previews.
- **Path Encoding**: File paths containing special characters must be URI-encoded in preview URLs (e.g., `spaces` → `%20`).
- **Provider Namespace**: All preview routes must use `/gist.github/` prefix; legacy non-namespaced paths (`/<gist-id>/...`) are not supported as a breaking change.
- **Username Retention**: Landing page retains parsed username from successful URL decomposition to improve subsequent GitHub URL compositions.
- **Debounce Strategy**: URL decomposition waits 1.5 seconds after user finishes editing to avoid excessive parsing during typing.
- **Caching**: Provider resources are persisted in IndexedDB keyed by provider and resource identifier, with the provider revision stored as a field. Cached resources are revalidated with `If-None-Match` before replacement, and are served when the provider is unreachable. See **gist-resource-cache** and **cache-management-ui**.
- **Extension Compatibility**: Must return a complete, stable HTML document that extensions can attach to immediately.
- **Accessibility**: All user actions (navigation, copy, reset) exposed as explicit buttons rather than implicit form submission. Log output uses severity labels for clarity.
- **Structured Logging**: User-facing feedback recorded with timestamps and severity (info/warning/error) instead of modal alerts.

## Requirements

### Requirement: Landing page provides gist preview navigation

The system SHALL provide a landing page with three synchronized GitHub fields: `gist-id`, `filePath` (optional), and editable `github-gist-url`, and SHALL provide two outputs: a derived read-only `preview-url` and a log output element. The system SHALL compose `github-gist-url` and `preview-url` from `gist-id` and `filePath`. The system SHALL attempt decomposition of `github-gist-url` into `gist-id` and `filePath` after 1.5 seconds of no edit activity. If decomposition fails, the system SHALL append an `error` log message and SHALL keep existing field state unchanged.

#### Scenario: Compose URLs from id and file path
- **WHEN** a user edits `gist-id` or `filePath`
- **THEN** the system updates `github-gist-url` and `preview-url` using best-effort composition

#### Scenario: Decompose editable GitHub URL after debounce
- **WHEN** a user edits `github-gist-url` and no further edits occur for 1.5 seconds
- **THEN** the system attempts to extract `gist-id` and `filePath` from that URL and updates fields on success

#### Scenario: Decomposition failure logs error without destructive overwrite
- **WHEN** decomposition of `github-gist-url` fails after debounce
- **THEN** the system appends an `error` message in the log output element and does not overwrite current `gist-id` or `filePath`

#### Scenario: Log output supports severity labels
- **WHEN** the landing page emits user-facing runtime feedback
- **THEN** the log output element records messages with severity labels such as `info`, `warning`, or `error`

### Requirement: Gist preview URLs return complete HTML documents

The system SHALL recognize GitHub gist preview paths in the form `/gist.github/<gist-id>/<file-path?>`, SHALL serve the requested file or the first available file when no file is specified, and SHALL return a complete HTML document. The system SHALL prefer a cached resource when the provider reports it unchanged, and SHALL fetch gist metadata from GitHub's API when no cached resource exists or the cached resource has changed. If the selected file content is truncated, the system SHALL fetch the file's raw content before responding.

#### Scenario: Preview the first gist file from provider namespace
- **WHEN** a user visits `/gist.github/<gist-id>` for a valid gist
- **THEN** the system returns an HTML document for the first available file in the gist

#### Scenario: Preview a specific gist file from provider namespace
- **WHEN** a user visits `/gist.github/<gist-id>/<file-path>` and the file exists in the gist
- **THEN** the system returns an HTML document for that file

#### Scenario: Preview URL encodes file path while input remains readable
- **WHEN** a user enters a human-readable `filePath`
- **THEN** the system keeps `filePath` readable in the field and uses encoded form for the `preview-url`

#### Scenario: Cached resource serves the preview without re-downloading
- **WHEN** a user visits a preview path for a gist whose cached revision is still current
- **THEN** the system returns the preview rendered from the cached resource without downloading the gist again

#### Scenario: Cached resource serves the preview while offline
- **WHEN** a user visits a preview path for a cached gist while the provider is unreachable
- **THEN** the system returns the preview rendered from the cached resource

### Requirement: Preview subresource requests resolve to gist files

The system SHALL resolve requests under a provider namespace to that resource's files regardless of the request's navigation mode, so that a previewed document can load its own relative assets.

#### Scenario: Relative stylesheet loads from the gist
- **WHEN** a previewed HTML document requests `./style.css` and the gist contains that file
- **THEN** the system returns that file's content with a stylesheet content type

#### Scenario: Relative script loads from the gist
- **WHEN** a previewed HTML document requests a script that the gist contains
- **THEN** the system returns that file's content with a script content type

#### Scenario: Request mode does not change resolution
- **WHEN** the same gist file is requested as a navigation and as a subresource
- **THEN** both requests resolve to the same cached or fetched file content

### Requirement: Missing gist files return not-found responses

The system SHALL return a not-found response when a specific file path is requested and does not exist in the resource, and SHALL NOT substitute another file.

#### Scenario: Missing asset does not return the first file
- **WHEN** a subresource request names a file that the gist does not contain
- **THEN** the system responds with a not-found status rather than the contents of a different file

#### Scenario: Root request still falls back to the first file
- **WHEN** a preview request names no file at all
- **THEN** the system serves the first available file

### Requirement: Wrapped source documents present source affordances

When a non-HTML, non-Markdown gist file is served inside a generated document, the system SHALL present the content in a styled source container that provides a copy action, and SHALL display the source address verbatim immediately above that container. Markdown files SHALL instead use the Markdown preview requirements and SHALL retain a source address and copy action in their generated document. HTML files SHALL continue to be served as the gist's own document.

#### Scenario: Verbatim address precedes a raw source container
- **WHEN** the system serves a non-HTML, non-Markdown gist file
- **THEN** the page shows `https://gist.githubusercontent.com/<username>/<gist-id>/raw/<file-path>` as an anchor above the source container

#### Scenario: Raw source copy action writes the exact source
- **WHEN** the user activates the copy control for a non-HTML, non-Markdown file
- **THEN** the clipboard receives the file's exact source text and the control confirms the copy briefly

#### Scenario: Long raw content remains readable
- **WHEN** a non-HTML, non-Markdown file contains long lines or many lines
- **THEN** the source container scrolls independently of the page

#### Scenario: Markdown uses a rendered document
- **WHEN** the served file is Markdown
- **THEN** the system renders a Markdown preview document with its source address and original-source copy action rather than the raw source container

#### Scenario: HTML gist files are unaffected
- **WHEN** the served file is HTML
- **THEN** the gist's own document is returned with only the source declaration added

### Requirement: Served preview documents declare their source

Every preview document the system returns SHALL declare its source in the document head as `<meta name="DC.source" scheme="URI" content="<source-url>">`, where the source URL identifies the exact gist file being served.

#### Scenario: HTML gist file is annotated
- **WHEN** the system serves a gist file as an HTML document
- **THEN** the served document's head begins with a `DC.source` declaration whose content is the raw content URL of that file

#### Scenario: Wrapped source document is annotated
- **WHEN** the system serves a non-HTML gist file inside a generated document
- **THEN** the generated head carries the same `DC.source` declaration for that file

#### Scenario: Root request identifies the served file
- **WHEN** the request names no file and the system resolves to the first available file
- **THEN** the declaration identifies that file rather than the empty path

#### Scenario: Existing declaration is preserved
- **WHEN** the gist's own HTML already declares a `DC.source` meta element
- **THEN** the system does not add a second declaration and leaves the document's head unchanged

#### Scenario: Non-document responses are not modified
- **WHEN** the system serves a subresource such as a stylesheet or script
- **THEN** the file content is returned unmodified without injected markup

### Requirement: Legacy non-namespaced gist paths are removed

The system SHALL treat the migration to `/gist.github/<gist-id>/<file-path?>` as a breaking change and SHALL not provide fallback routing for legacy paths in the form `/<gist-id>/<file-path?>`.

#### Scenario: Legacy path does not resolve as a gist preview route
- **WHEN** a user visits `/<gist-id>/<file-path?>` after migration
- **THEN** the request is not interpreted as the canonical gist preview route

### Requirement: Root and non-gist paths are handled normally

The system SHALL serve the landing page for `/` and SHALL allow paths outside registered provider namespaces to pass through to normal network handling.

#### Scenario: Landing page is served at the site root
- **WHEN** a user visits `/`
- **THEN** the system returns the landing page document

#### Scenario: Paths outside provider namespaces are not intercepted as previews
- **WHEN** a user visits a path that does not match any registered provider namespace
- **THEN** the request is handled by normal network routing rather than preview logic

### Requirement: Landing page provides explicit GitHub and preview actions

The system SHALL provide action buttons `go-to-github-gist`, `go-to-preview`, `copy-gist-url`, `copy-preview-url`, and `reset`. Both go-to actions SHALL open in a new tab. Copy actions SHALL copy the current target URL to clipboard. Reset SHALL clear all form inputs and derived preview output.

#### Scenario: Open canonical GitHub URL in a new tab
- **WHEN** a user clicks `go-to-github-gist`
- **THEN** the system opens `https://gist.github.com/<username>/<gist-id>{#<filePath>}` when username is known, otherwise `https://gist.github.com/<gist-id>{#<filePath>}`, in a new tab

#### Scenario: Open preview URL in a new tab
- **WHEN** a user clicks `go-to-preview`
- **THEN** the system opens the current-site preview URL `https://snippetpreview.github.io/gist.github/<gist-id>/<encoded-file-path?>` in a new tab

#### Scenario: Copy and reset actions
- **WHEN** a user clicks either copy action or reset
- **THEN** the system copies the corresponding URL to clipboard for copy actions, and clears all fields for reset

## Trailing-Slash Redirect Behavior

To ensure relative URLs inside fetched HTML documents resolve correctly, the provider adapter SHALL redirect navigation requests that target an HTML preview but lack a trailing slash.

- **WHEN** the Service Worker delegates a navigation request to the GitHub provider and the provider determines the selected file is HTML, and the incoming request targets the gist resource root (i.e., no specific file path was requested) and the incoming request pathname does not end with `/`.
- **THEN** the provider SHALL respond with a `302` redirect to the same URL with a trailing slash appended to the pathname (preserving query and hash), so that subsequent navigation requests resolve relative URLs against the directory-like base.

Notes:
- This behavior avoids mutating upstream HTML content and preserves canonical resolution semantics for relative resource references (scripts, styles, images, anchors).
- Implementations SHOULD choose a conservative redirect status (e.g., `302`) to avoid inadvertently making a permanent canonical change for upstream links.
