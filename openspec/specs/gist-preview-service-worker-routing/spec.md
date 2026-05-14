## Purpose

Snippet Preview is a static GitHub Pages app that serves GitHub Gist previews from provider-namespaced URLs (`/gist.github/<gist-id>/<file-path?>`) while preserving a stable browser document for extension compatibility. The landing page provides a user-friendly interface for composing and decomposing GitHub Gist URLs with synchronized input/output fields and explicit action controls. The Service Worker acts as a transparent routing layer, intercepting preview navigations and returning the requested gist file or an error page—without modifying the document structure.

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
2. **Service Worker** (`public/service-worker.js`): Intercepts provider-namespaced preview navigations, delegates to provider adapters (see **provider-routed-preview** spec), and manages preview routing.

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
- Helper: `buildPreviewPath(gistId, filePath)` → `/gist.github/<encoded-id>/<encoded-path?>`
- Helper: `buildCanonicalGistUrl(gistId, filePath, username)` → `https://gist.github.com/<user?>/<id>#<path?>`
- Helper: `parseCanonicalGistUrl(urlText)` → `{gistId, filePath, username}` or null
- Helper: `log(level, message)` → append `[LEVEL TIMESTAMP] message` to log output
- Helper: `syncFromIdAndPath()` → recompute both outputs from current ID and path

### Service Worker (`public/service-worker.js`)

**Responsibility**: Intercept provider-namespaced preview navigations and delegate to appropriate provider adapters (detailed in **provider-routed-preview** spec).

**Input**: HTTP fetch event with method `navigate`

**Output**: HTTP Response object containing either:
- Complete HTML document (from provider adapter preview response)
- Pass-through to network for non-preview paths

**Constraints**:
- Must register with `type: 'module'` to support ES6 imports of provider adapters
- Route dispatch: Try each provider adapter's `parsePreviewPath()` in order; on first match, call adapter's `handlePreview()`
- Non-matching paths pass through to normal network handling
- No caching strategy in MVP

**Conventions**:
- Import provider adapters: `import { githubProvider } from './providers/github-provider.js'`
- Provider registry: `const providers = [githubProvider]` (extensible for future providers)
- Route dispatch pattern: `for (const provider of providers) { const parseResult = provider.parsePreviewPath(pathname); if (parseResult.ok) { return provider.handlePreview(parseResult.value); } }`

### GitHub Provider Adapter (`public/providers/github-provider.js`)

**Responsibility**: Implement provider adapter contract for GitHub Gists (see **provider-routed-preview** spec for contract details).

**Key Methods**:
- `parsePreviewPath(pathname)`: Extract gist ID and file path from `/gist.github/...` routes
- `parseCanonicalUrl(urlText)`: Decompose `gist.github.com` URLs to extract resource ID, file path, and username
- `buildPreviewPath({resourceId, filePath})`: Compose `/gist.github/<id>/<encoded-path?>` routes
- `buildCanonicalUrl({resourceId, filePath, username})`: Compose `https://gist.github.com/<user?>/<id>#<path?>`
- `handlePreview({resourceId, filePath})`: Fetch GitHub API, resolve file content, return HTML Response

**Constraints**:
- GitHub API endpoint: `https://api.github.com/gists/<gist-id>`
- Must detect truncated files (check `truncated` flag) and fetch from `raw_url` if needed
- HTML content returned as-is; non-HTML content wrapped in `<pre>` tag
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
Service Worker fetch event intercepts (mode=navigate)
    ↓
Service Worker attempts parsePreviewPath() on each provider in registry
    ↓
GitHub adapter matches /gist.github/... pattern
    ↓
Service Worker calls githubProvider.handlePreview({resourceId, filePath})
    ↓
GitHub Adapter:
    - Fetches https://api.github.com/gists/<gist-id>
    - Selects file by name or first available
    - If truncated, fetches raw content from GitHub
    - Returns complete HTML Response
    ↓
Browser renders document
```

## Implementation Constraints

- **GitHub API**: Uses unauthenticated endpoint (60 req/hour limit). Rate-limit errors must be caught and reported to user via log output.
- **File Size**: Large files may be truncated by GitHub. Check `truncated` flag and fetch from `raw_url` if needed.
- **Content Type**: Files can be any type (HTML, CSS, JavaScript, text, binary). Only HTML files are returned as-is; others are wrapped in a `<pre>` tag.
- **Path Encoding**: File paths containing special characters must be URI-encoded in preview URLs (e.g., `spaces` → `%20`).
- **Provider Namespace**: All preview routes must use `/gist.github/` prefix; legacy non-namespaced paths (`/<gist-id>/...`) are not supported as a breaking change.
- **Username Retention**: Landing page retains parsed username from successful URL decomposition to improve subsequent GitHub URL compositions.
- **Debounce Strategy**: URL decomposition waits 1.5 seconds after user finishes editing to avoid excessive parsing during typing.
- **No Caching**: MVP does not implement any cache strategy. All requests go to network first.
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

The system SHALL recognize GitHub gist preview paths in the form `/gist.github/<gist-id>/<file-path?>`, SHALL fetch gist metadata from GitHub's API, SHALL select the requested file or the first available file when no file is specified, and SHALL return a complete HTML document. If the selected file content is truncated, the system SHALL fetch the file's raw content before responding.

#### Scenario: Preview the first gist file from provider namespace
- **WHEN** a user visits `/gist.github/<gist-id>` for a valid gist
- **THEN** the system returns an HTML document for the first available file in the gist

#### Scenario: Preview a specific gist file from provider namespace
- **WHEN** a user visits `/gist.github/<gist-id>/<file-path>` and the file exists in the gist
- **THEN** the system returns an HTML document for that file

#### Scenario: Preview URL encodes file path while input remains readable
- **WHEN** a user enters a human-readable `filePath`
- **THEN** the system keeps `filePath` readable in the field and uses encoded form for the `preview-url`

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
