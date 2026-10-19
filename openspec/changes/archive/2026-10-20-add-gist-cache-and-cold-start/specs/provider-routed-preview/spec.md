## MODIFIED Requirements

### Requirement: Service worker dispatches preview requests through provider adapters

The system SHALL define a provider adapter contract and SHALL dispatch provider-namespaced preview requests through adapter implementations instead of embedding source-specific logic in the generic Service Worker routing flow. Dispatch SHALL apply to every request under a provider namespace, including navigations and subresource requests.

#### Scenario: Service worker delegates GitHub namespace to matching adapter
- **WHEN** a navigation request path matches `/gist.github/<resource-id>/<file-path?>`
- **THEN** the Service Worker selects the GitHub adapter and delegates preview response generation to that adapter

#### Scenario: Subresource requests are delegated to the matching adapter
- **WHEN** a subresource request path falls under `/gist.github/<resource-id>/`
- **THEN** the Service Worker delegates to the GitHub adapter instead of passing the request to the network

#### Scenario: Service worker remains provider-agnostic for non-matching namespaces
- **WHEN** a request path does not match any registered provider namespace
- **THEN** the Service Worker passes the request through normal network handling

### Requirement: Provider adapter contract covers parse, compose, and preview response behavior

The system SHALL require each provider adapter to expose route matching, preview-path parsing, canonical-source URL parsing/composition, resource fetching, and response rendering operations with explicit success/failure outputs. Resource fetching SHALL be separable from rendering so that fetched data can be cached and rendered independently.

#### Scenario: Adapter parse failure does not mutate unrelated state
- **WHEN** provider URL parsing fails in adapter logic
- **THEN** the operation returns a parse failure result without mutating existing application state

#### Scenario: Adapter preview handler returns complete HTTP response
- **WHEN** the Service Worker calls adapter preview handling with a parsed resource identifier
- **THEN** the adapter returns an HTTP `Response` representing either rendered preview content or an error page

#### Scenario: Resource fetch returns data without rendering
- **WHEN** the Service Worker calls adapter resource fetching for a provider resource
- **THEN** the adapter returns the resource's files, metadata, revision, and validator without producing an HTTP response body

#### Scenario: Renderer is pure
- **WHEN** the adapter renders a resource for a given file path
- **THEN** it produces the response solely from the supplied resource data without performing network access

#### Scenario: Revision is provider-defined and opaque to consumers
- **WHEN** the adapter reports a revision for a fetched resource
- **THEN** consumers store and compare that value without interpreting its format
