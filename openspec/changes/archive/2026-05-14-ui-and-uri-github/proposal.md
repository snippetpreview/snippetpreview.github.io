## Why

The current preview URL format (`/<gist-id>/<file>`) hard-codes GitHub behavior into generic routing and does not provide a clear namespace for future providers. The landing page also lacks a synchronized, user-editable GitHub Gist URL workflow needed for reliable copy/share/navigation.

## What Changes

- Change GitHub preview namespace from `/<gist-id>/<file-path?>` to `/gist.github/<gist-id>/<file-path?>`.
- Refactor Service Worker architecture to be provider-agnostic at the routing layer, with provider-specific fetch/parse behavior isolated behind a formal provider interface.
- Add a GitHub provider module implementing that interface and move GitHub-specific logic out of the generic routing flow.
- Redesign landing page form behavior for GitHub with synchronized fields:
  - `gist-id`
  - `filePath` (optional)
  - editable `github-gist-url`
  - derived read-only `preview-url`
- Add actions: `go-to-github-gist`, `go-to-preview`, `copy-gist-url`, `copy-preview-url`, and `reset`.
- Define debounce behavior for URL decomposition (1.5s), log-output-based malformed URL feedback, encoding policy, and new-tab navigation policy.

## Capabilities

### New Capabilities
- `provider-routed-preview`: Provider-adapter routing contract and path namespace model for source-specific preview handlers.

### Modified Capabilities
- `gist-preview-service-worker-routing`: Update URL format, landing-page interaction model, and routing requirements to align with provider-based namespace and UI behavior.

## Impact

- Affected runtime files include Service Worker routing and provider logic modules under `public/` and landing page behavior under `src/`.
- Public preview URLs for GitHub change to `/gist.github/...` as an intentional breaking change with no legacy fallback.
- No new third-party dependency is required; impact is architectural (module boundaries, route contracts, and UI event flow).
