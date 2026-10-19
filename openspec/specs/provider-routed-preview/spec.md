## Purpose

Snippet Preview supports multiple content providers (GitHub Gist, GitLab snippets, CodeBin, etc.) through a provider-agnostic routing system. The Service Worker remains provider-neutral by delegating preview request handling to provider-specific adapter implementations. This design allows new providers to be added without modifying core routing logic, improving maintainability and extensibility.

## Design Intention

Rather than embedding provider-specific logic into the Service Worker, the app uses a **Provider Adapter Pattern** where:

1. Each provider (GitHub, GitLab, etc.) exports an adapter object that implements a contract.
2. The Service Worker maintains a registry of providers and dispatches routes based on namespace prefix (`/gist.github/`, `/gitlab.com/`, etc.).
3. Each adapter handles route parsing, canonical URL composition, and preview response generation.
4. Errors are surfaced through structured result objects rather than exceptions, preventing state mutation.

This separation of concerns provides:

- **Provider agnosticism**: The Service Worker routes to providers without knowing their implementation.
- **Type safety**: Explicit contract (method signatures and result formats) ensures adapters are interchangeable.
- **Graceful degradation**: Provider failures don't affect routing to other providers.
- **Easy testing**: Each provider adapter can be tested independently.

## System Architecture

### Two-Layer Provider System

```
Service Worker (Provider-Agnostic Router)
    ↓
    Provider Registry
    ├── GitHub Adapter (/gist.github/...)
    ├── GitLab Adapter (/gitlab.com/...) [future]
    └── CodeBin Adapter (/codebin.io/...) [future]
```

### Provider Adapter Contract

Each provider adapter MUST expose:

1. **`parsePreviewPath(pathname)`** → `{ok: true, value: {resourceId, filePath}} | {ok: false, error: {code, message}}`
   - Parses a preview URL path to extract resource ID and optional file path
   - Returns success only if the path matches the provider's namespace
   - Does not mutate application state on failure

2. **`parseCanonicalUrl(urlText)`** → `{ok: true, value: {resourceId, filePath, username?}} | {ok: false, error: {code, message}}`
   - Decomposes a canonical source URL (e.g., `https://gist.github.com/user/id#file`)
   - Returns the provider's resource ID format and optional username
   - Does not mutate application state on failure

3. **`buildPreviewPath({resourceId, filePath?})`** → string
   - Composes a preview path from resource ID and optional file path
   - Returns `/provider.namespace/resource-id/encoded-path?`
   - Must URL-encode special characters

4. **`buildCanonicalUrl({resourceId, filePath?, username?})`** → string
   - Composes a canonical URL pointing to the original source
   - Returns `https://provider.namespace/username?/resource-id#file?`
   - Includes username when known, omits when unavailable

5. **`fetchResource({resourceId, etag?})`** → `Promise<ResourceOutcome>`
   - Fetches provider data and returns files, metadata, revision, and validator
   - Returns an `unchanged` outcome when the supplied validator still matches
   - Never produces a response body and never caches; the router owns caching

6. **`render({resource, filePath?, request?})`** → `Response`
   - Builds a preview document solely from the supplied resource
   - Declares the served file's source in the document head

7. **`renderAsset({resource, filePath?})`** → `Response`
   - Returns a single file with an extension-derived content type

8. **`handlePreview({resourceId, filePath?})`** → `Promise<Response>`
   - Composition of `fetchResource` and `render`, retained for direct dispatch
   - Returns HTTP 4xx/5xx error Response for missing resources or provider errors
   - Never mutates application state

### Service Worker Routing

```
Preview Request (any mode)
    ↓
Loop through Provider Registry
    ├─→ Try parsePreviewPath() on each provider
    │   If match found, resolve the resource through the cache
    │   Render the document or the asset, return Response
    │
└─→ No provider matched
    Pass request to network (normal routing)
```

## Module Specifications

### Provider Adapter Implementations

**Location**: `public/providers/<provider-name>-provider.js`

**Exports**: Default export of provider adapter object with contract methods

**Constraints**:
- Result objects use `{ok: true/false, value?, error?}` format
- Parse failures never throw; return `{ok: false, error: {code, message}}`
- File content fetching is async; API calls must handle timeouts
- Must not rely on global state; all state is parameter-based

**Conventions**:
- Adapter registry pattern allows `providers: [githubProvider, gitlabProvider, ...]`
- Each adapter isolated to single file for clarity
- Helper functions: `ok(value)` and `fail(code, message)` for consistent result objects

### Service Worker Router

**Location**: `public/service-worker.js`

**Responsibility**: Import all provider adapters, maintain registry, dispatch based on namespace matching

**Input**: Service Worker fetch event with method `navigate`

**Output**: HTTP Response from matched provider adapter or pass-through to network

**Constraints**:
- Must try adapters in order until one matches
- Adapters are compiled into the service worker by the build, so they are imported as modules rather than fetched as assets
- Caching belongs to the router; adapters return data and must not cache

**Conventions**:
- Provider registry: `const providers = [githubProvider, gitlabProvider, ...]`
- Route matching: `for (const provider of providers) { const parsed = provider.parsePreviewPath(pathname); if (parsed.ok) return resolveAndRender(provider, parsed.value) }`, where `resolveAndRender` consults the cache before delegating to `render` or `renderAsset`

## Data Flow

```
User navigates to /gist.github/123/file.html
    ↓
Service Worker fetch event intercepts (any request mode)
    ↓
Loop through providers:
    → githubProvider.parsePreviewPath() matches
    ✓ Returns {ok: true, value: {resourceId: '123', filePath: 'file.html'}}
    ↓
Service Worker resolves the resource through the cache, then delegates:
    - navigate    → githubProvider.render({resource, filePath, request})
    - subresource → githubProvider.renderAsset({resource, filePath})
    ↓
GitHub Adapter (on a cache miss):
    - githubProvider.fetchResource({resourceId})
    - Fetches https://api.github.com/gists/123
    - Extracts file content, revision, and validator
    ↓
Browser renders document
```

## Requirements

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

### Requirement: Provider registration is extensible without changing route-dispatch semantics

The system SHALL support registration of additional provider adapters without changing the Service Worker dispatch contract.

#### Scenario: New provider registration preserves existing GitHub routing behavior
- **WHEN** an additional provider adapter is registered
- **THEN** existing `/gist.github/...` dispatch behavior remains unchanged and continues to route to the GitHub adapter
