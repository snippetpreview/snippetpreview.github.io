## MODIFIED Requirements

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

## ADDED Requirements

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

When a non-HTML gist file is served inside a generated document, the system SHALL present the content in a styled source container that provides a copy action, and SHALL display the gist file's address verbatim immediately above that container.

#### Scenario: Verbatim address precedes the source container
- **WHEN** the system serves a non-HTML gist file
- **THEN** the page shows `https://gist.githubusercontent.com/<username>/<gist-id>/raw/<file-path>` as an anchor above the source container

#### Scenario: Copy action writes the exact source
- **WHEN** the user activates the copy control
- **THEN** the clipboard receives the file's exact source text and the control confirms the copy briefly

#### Scenario: Long content remains readable
- **WHEN** the file contains long lines or many lines
- **THEN** the source container scrolls independently of the page

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
