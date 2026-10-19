## Purpose

Provider resources fetched for a preview are persisted on the device so repeated previews avoid a network round-trip and cached previews remain available when the provider is unreachable, while staying correct when the source changes.

## Requirements

### Requirement: Cached resources are keyed by provider and resource identifier

The system SHALL persist fetched provider resources identified by the pair `(providerId, resourceId)` and SHALL NOT use the request URL, the canonical source URL, or the file path as the storage identifier.

#### Scenario: Equivalent URLs resolve to one cache entry
- **WHEN** the same gist is reached through `/gist.github/<gist-id>/`, `/gist.github/<gist-id>/index.html`, or any canonical URL variant for that gist
- **THEN** all of them read and write the same cache entry

#### Scenario: Username is metadata rather than identity
- **WHEN** the same gist is referenced both with and without its username
- **THEN** the cache stores one entry and retains the username only as descriptive metadata

#### Scenario: File paths are resolved inside an entry
- **WHEN** a cached resource is read for a specific file path
- **THEN** the system looks the path up within the resource's file map instead of deriving a separate cache key

### Requirement: Cache entries carry a provider-defined revision

The system SHALL record an opaque `revision` value and an HTTP `etag` for every cached resource, and SHALL NOT interpret the revision's format.

#### Scenario: Revision is stored without interpretation
- **WHEN** a provider returns a revision value
- **THEN** the system stores it verbatim alongside the resource and compares it only for equality

#### Scenario: Cached state is queryable without network access
- **WHEN** the system needs to determine whether a resource is cached
- **THEN** it answers from local storage without contacting the provider

### Requirement: Cached resources store source files rather than rendered output

The system SHALL persist the provider's file contents and metadata, and SHALL re-render preview responses on demand rather than storing rendered HTML.

#### Scenario: Rendering changes do not require re-fetching
- **WHEN** the application renderer changes and a previously cached resource is requested
- **THEN** the system serves the new rendering built from the cached source without a provider request

#### Scenario: Raw source is available for download
- **WHEN** the user requests a cached file's source
- **THEN** the system returns the persisted file content without rendering

### Requirement: Cached resources are revalidated conditionally

The system SHALL revalidate a cached resource using its stored `etag` before replacing it, and SHALL serve cached content when the provider reports no change.

#### Scenario: Unchanged resource avoids a full download
- **WHEN** a cached resource is requested and the provider responds that the resource has not changed
- **THEN** the system serves the cached content and updates only the last-checked timestamp

#### Scenario: Changed resource replaces the entry atomically
- **WHEN** a cached resource is requested and the provider returns updated content
- **THEN** the system replaces the entire entry in a single write so that no reader observes files from two revisions

#### Scenario: Unreachable provider falls back to cache
- **WHEN** a cached resource is requested while the provider is unreachable
- **THEN** the system serves the cached content instead of an error

#### Scenario: Uncached resource with unreachable provider reports failure
- **WHEN** an uncached resource is requested while the provider is unreachable
- **THEN** the system returns a not-cached error response and stores nothing

### Requirement: Cached resources support removal

The system SHALL allow a cached resource to be removed in full, and SHALL NOT offer per-file removal within a resource.

#### Scenario: Removing a resource deletes all of its files
- **WHEN** a cached resource is removed
- **THEN** every file belonging to that resource becomes unavailable and a subsequent request for the resource behaves as uncached

### Requirement: Cache failures degrade without breaking previews

The system SHALL treat storage as an optimization and SHALL continue serving previews when persistence is unavailable, full, or evicted.

#### Scenario: Storage unavailable
- **WHEN** persistent storage cannot be opened
- **THEN** the system serves previews from the network and falls back to a session-scoped in-memory store

#### Scenario: Quota exhausted during write
- **WHEN** a write fails because the storage quota is exhausted
- **THEN** the system evicts least-recently-checked entries, retries once, and otherwise continues without caching while reporting the condition

#### Scenario: Entry evicted by the browser
- **WHEN** a previously cached resource is missing on read
- **THEN** the system treats it as uncached and fetches normally
