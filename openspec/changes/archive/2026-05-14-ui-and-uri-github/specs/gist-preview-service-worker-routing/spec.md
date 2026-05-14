## MODIFIED Requirements

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
