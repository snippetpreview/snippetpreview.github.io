## ADDED Requirements

### Requirement: Landing page provides gist preview navigation
The system SHALL provide a landing page that accepts a 40-character lowercase hexadecimal gist ID and an optional file path. When the form is submitted, the system SHALL navigate to `/<gist-id>` when no file path is provided and to `/<gist-id>/<file-path>` when a file path is provided.

#### Scenario: Navigate to a gist root path
- **WHEN** a user submits a valid gist ID and leaves the file path empty
- **THEN** the browser navigates to `/<gist-id>`

#### Scenario: Navigate to a specific gist file
- **WHEN** a user submits a valid gist ID and file path
- **THEN** the browser navigates to `/<gist-id>/<file-path>`

### Requirement: Service worker registers for site-wide preview routing
The system SHALL register a Service Worker from the landing page at `/service-worker.js` with site-wide scope so it can intercept gist preview navigations.

#### Scenario: Service worker is registered on supported browsers
- **WHEN** a browser supports Service Workers and loads the landing page
- **THEN** the landing page attempts to register `/service-worker.js` with root scope

### Requirement: Root and non-gist paths are handled normally
The system SHALL serve the landing page for `/` and SHALL allow non-gist paths to pass through to normal network handling.

#### Scenario: Landing page is served at the site root
- **WHEN** a user visits `/`
- **THEN** the system returns the landing page document

#### Scenario: Non-gist paths are not treated as gist previews
- **WHEN** a user visits a path that does not match a gist ID pattern
- **THEN** the request is handled by normal network routing rather than gist preview logic

### Requirement: Gist preview URLs return complete HTML documents
The system SHALL recognize gist preview paths that match a gist ID with an optional file path, SHALL fetch gist metadata from GitHub's API, SHALL select the requested file or the first available file when no file is specified, and SHALL return a complete HTML document. If the selected file content is truncated, the system SHALL fetch the file's raw content before responding.

#### Scenario: Preview the first gist file
- **WHEN** a user visits `/<gist-id>` for a valid gist
- **THEN** the system returns an HTML document for the first available file in the gist

#### Scenario: Preview a specific gist file
- **WHEN** a user visits `/<gist-id>/<file-path>` and the file exists in the gist
- **THEN** the system returns an HTML document for that file

#### Scenario: Resolve truncated file content
- **WHEN** GitHub API metadata marks the selected file as truncated
- **THEN** the system fetches the file's raw content before constructing the response document

### Requirement: Invalid preview requests return user-friendly HTML errors
The system SHALL return a user-friendly HTML error response when the gist ID is invalid, the gist is deleted, the requested file is missing, or GitHub returns a rate-limit response. The error response SHALL include a path back to the landing page.

#### Scenario: Invalid gist ID returns an error page
- **WHEN** a user visits a path with an invalid gist ID
- **THEN** the system returns an HTML error page explaining that the gist cannot be found

#### Scenario: Missing file returns an error page
- **WHEN** a user visits a valid gist path for a file that does not exist
- **THEN** the system returns an HTML error page describing the missing file

#### Scenario: Rate-limited requests return an error page
- **WHEN** GitHub responds with a rate-limit error
- **THEN** the system returns an HTML error page that tells the user to try again later

### Requirement: Successful preview responses are cached
The system SHALL cache successful gist preview responses and SHALL return a cached preview when a network request fails after a preview has already been stored.

#### Scenario: Cached preview is used when offline
- **WHEN** a user revisits a previously loaded gist preview while offline
- **THEN** the system returns the cached HTML response for that preview