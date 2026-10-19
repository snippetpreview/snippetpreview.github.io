## Purpose

Previews stored on a device are inspectable and removable through a dedicated page, so the cache is not an opaque side effect of browsing.

## Requirements

### Requirement: Cache management page lists cached resources

The system SHALL provide a cache management page that lists every cached resource with its provider, resource identifier, revision, fetch time, and total size, together with the files it contains.

#### Scenario: Cached resources are listed
- **WHEN** the user opens the cache management page and cached resources exist
- **THEN** each resource is shown with its files grouped beneath it

#### Scenario: Empty state is explicit
- **WHEN** the user opens the cache management page and nothing is cached
- **THEN** the page states that no previews are cached and offers a link back to the landing page

#### Scenario: Page works while offline
- **WHEN** the user opens the cache management page with no network connection
- **THEN** the page loads and lists cached resources from local storage

### Requirement: Cache management page exposes per-resource actions

The system SHALL provide actions to download the rendered preview, download a file's raw source, open a cached file, and remove a cached resource.

#### Scenario: Download rendered preview
- **WHEN** the user chooses to download the rendered preview for a cached resource
- **THEN** the system produces an HTML document rendered from the cached source with the current renderer

#### Scenario: Download raw source
- **WHEN** the user chooses to download a file's source
- **THEN** the system saves that file's persisted content using the file's own name and content type

#### Scenario: Open a cached file
- **WHEN** the user chooses to open a cached file
- **THEN** the system navigates to that file's preview path and the service worker serves it from the cache when the provider is unreachable

#### Scenario: Remove a cached resource
- **WHEN** the user removes a cached resource
- **THEN** the resource and all of its files disappear from the listing and from subsequent cache reads

### Requirement: Cache management page reports storage usage

The system SHALL display current storage usage and SHALL request persistent storage so that cached previews are not evicted silently.

#### Scenario: Usage is displayed
- **WHEN** the cache management page loads
- **THEN** it shows the estimated bytes used by cached resources against the available quota

#### Scenario: Persistence is requested
- **WHEN** the cache management page loads and persistent storage has not yet been granted
- **THEN** the system requests persistent storage and reflects the outcome in the page
