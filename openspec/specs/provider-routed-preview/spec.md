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

5. **`handlePreview({resourceId, filePath})`** → `Promise<Response>`
   - Fetches provider API, resolves file content, returns complete HTML document
   - Returns HTTP 2xx Response for valid previews
   - Returns HTTP 4xx/5xx error Response for missing resources or provider errors
   - Never mutates application state

### Service Worker Routing

```
Navigation Request
    ↓
Loop through Provider Registry
    ├─→ Try parsePreviewPath() on each provider
    │   If match found, call handlePreview()
    │   Return Response
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
- Must register with `type: 'module'` to support ES6 imports
- Must not cache provider responses

**Conventions**:
- Provider registry: `const providers = [githubProvider, gitlabProvider, ...]`
- Route matching: `for (const provider of providers) { const result = provider.parsePreviewPath(pathname); if (result.ok) return provider.handlePreview(result.value); }`

## Data Flow

```
User navigates to /gist.github/123/file.html
    ↓
Service Worker fetch event intercepts (mode=navigate)
    ↓
Loop through providers:
    → githubProvider.parsePreviewPath() matches
    ✓ Returns {ok: true, value: {resourceId: '123', filePath: 'file.html'}}
    ↓
Service Worker calls githubProvider.handlePreview({resourceId, filePath})
    ↓
GitHub Adapter:
    - Fetches https://api.github.com/gists/123
    - Extracts file content
    - Returns complete HTML Response
    ↓
Browser renders document
```

## Requirements

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
