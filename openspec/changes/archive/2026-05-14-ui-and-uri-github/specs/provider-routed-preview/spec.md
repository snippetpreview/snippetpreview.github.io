## ADDED Requirements

### Requirement: Service worker dispatches preview requests through provider adapters
The system SHALL define a provider adapter contract and SHALL dispatch provider-namespaced preview requests through adapter implementations instead of embedding source-specific logic in the generic Service Worker routing flow.

#### Scenario: Service worker delegates GitHub namespace to matching adapter
- **WHEN** a navigation request path matches `/gist.github/<resource-id>/<file-path?>`
- **THEN** the Service Worker selects the GitHub adapter and delegates preview response generation to that adapter

#### Scenario: Service worker remains provider-agnostic for non-matching namespaces
- **WHEN** a navigation request path does not match any registered provider namespace
- **THEN** the Service Worker passes the request through normal network handling

### Requirement: Provider adapter contract covers parse, compose, and preview response behavior
The system SHALL require each provider adapter to expose route matching, preview-path parsing, canonical-source URL parsing/composition, and preview response generation operations with explicit success/failure outputs.

#### Scenario: Adapter parse failure does not mutate unrelated state
- **WHEN** provider URL parsing fails in adapter logic
- **THEN** the operation returns a parse failure result without mutating existing application state

#### Scenario: Adapter preview handler returns complete HTTP response
- **WHEN** the Service Worker calls adapter preview handling with a parsed resource identifier
- **THEN** the adapter returns an HTTP `Response` representing either rendered preview content or an error page

### Requirement: Provider registration is extensible without changing route-dispatch semantics
The system SHALL support registration of additional provider adapters without changing the Service Worker dispatch contract.

#### Scenario: New provider registration preserves existing GitHub routing behavior
- **WHEN** an additional provider adapter is registered
- **THEN** existing `/gist.github/...` dispatch behavior remains unchanged and continues to route to the GitHub adapter
