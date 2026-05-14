## Context

Snippet Preview currently uses a flat GitHub-centric route (`/<gist-id>/<file-path?>`) and keeps GitHub API handling directly inside the Service Worker. This couples provider-specific behavior to core routing and makes future source expansion harder. The landing page currently supports basic gist-id/file input but does not provide a synchronized canonical GitHub URL workflow with explicit copy/navigation controls.

The change introduces a provider-namespaced URI (`/gist.github/<gist-id>/<file-path?>`) and a provider adapter boundary so the Service Worker can remain routing-focused. The landing page is expanded to a GitHub-focused control panel that keeps `gist-id`, `filePath`, editable `github-gist-url`, and derived `preview-url` in sync under explicit composition/decomposition policies.

## Goals / Non-Goals

**Goals:**
- Make Service Worker routing provider-agnostic and isolate source-specific logic behind a stable interface.
- Adopt GitHub preview namespace `/gist.github/...` as the canonical preview path.
- Define deterministic landing-page synchronization rules for compose/decompose between fields.
- Define malformed URL handling, encoding policy, and button behaviors (new-tab navigation, clipboard copy, reset).
- Preserve current content rendering behavior (HTML pass-through, non-HTML wrapped, error pages with provider details).

**Non-Goals:**
- Implement providers other than GitHub in this change.
- Add caching strategies, authentication tokens, or rate-limit bypass mechanisms.
- Guarantee backward compatibility for legacy `/<gist-id>/<file-path?>` URLs; this change intentionally introduces a breaking URI update.
- Implement deep path semantics where a single file name token itself contains `/`.

## Decisions

1. Provider adapter interface as architectural boundary
- Decision: Introduce a provider contract with responsibilities for route matching/parsing, canonical URL parse/build, and preview response generation.
- Rationale: This keeps the Service Worker generic and allows new providers without reworking core dispatch logic.
- Alternatives considered:
  - Keep single-file Service Worker with conditional branches per provider. Rejected due to increasing coupling and harder maintenance.
  - Move all logic to landing page and fetch directly. Rejected because top-level navigation interception and extension compatibility rely on Service Worker behavior.

2. Canonical GitHub preview namespace
- Decision: Canonical preview route becomes `/gist.github/<gist-id>/<file-path?>`.
- Rationale: Encodes provider identity in path without committing to future provider naming conventions yet.
- Alternatives considered:
  - `/github/gist/<id>` or `/providers/github/<id>`. Rejected for now to keep route concise and aligned with the source-domain-inspired naming requested by product direction.

3. Landing-page synchronization model with debounce decomposition
- Decision: `gist-id` and `filePath` compose `github-gist-url` and `preview-url` immediately; edits to `github-gist-url` trigger decomposition after 1.5s debounce.
- Rationale: Supports direct paste/edit workflows while preventing noisy parse attempts during typing.
- Alternatives considered:
  - Parse on every keystroke. Rejected due to unstable UX and frequent false malformed states.
  - Require explicit parse button. Rejected due to unnecessary friction.

4. Feedback policy for malformed canonical URLs
- Decision: If `github-gist-url` decomposition fails after debounce, append an `error` entry to a landing-page log output element and skip state overwrite.
- Rationale: Preserves known-good field values while providing non-blocking and accessible feedback.
- Alternatives considered:
  - Silent failure. Rejected because malformed URL should be visible to users.
  - Blocking `alert`. Rejected in favor of persistent inline logging.
  - Auto-clear fields. Rejected because it destroys useful state.

5. Encoding and file-path conventions
- Decision: `filePath` input remains human-readable while preview URL uses encoded path segment; supported forms are `fileName.ext` or `/absolute/path/from origin_respository/fileName`.
- Rationale: Balances usability with safe path transport in navigation.
- Alternatives considered:
  - Encode and display encoded value in input. Rejected as poor UX.

6. Navigation and action policy
- Decision: `go-to-github-gist` and `go-to-preview` open new tabs; copy buttons use clipboard API; reset clears all input/output fields.
- Rationale: Preserves current page as a control surface and matches explicit user requirement.

7. GitHub canonical URL composition policy
- Decision: Preserve parsed GitHub username when known; when unknown, compose canonical URL as `https://gist.github.com/<gist-id>{#<filePath>}` without a placeholder username segment.
- Rationale: GitHub gist URLs do not reliably resolve with arbitrary placeholder usernames.
- Alternatives considered:
  - Always use `user` placeholder. Rejected due to known resolution failures.
  - Require username input as mandatory field. Rejected to keep flow simple for gist-id-first usage.

## Risks / Trade-offs

- [Risk] Legacy links using old route format will break after cutover. → Mitigation: document breaking change clearly in release notes and update all in-app examples.
- [Risk] Debounce decomposition can emit error logs during incomplete manual edits if user pauses. → Mitigation: parse with tolerant rules and log only on syntactically malformed GitHub gist URL patterns.
- [Risk] Provider interface overdesign for single provider. → Mitigation: keep interface minimal and only include behaviors already required by GitHub flow.
- [Risk] `filePath` assumptions exclude rare slash-containing file-name tokens. → Mitigation: explicitly document assumptions and constraints in spec scenarios.

## Migration Plan

- Update landing page examples and generated links to `/gist.github/...`.
- Update Service Worker routing to dispatch by provider namespace and delegate to GitHub adapter.
- Keep existing response behavior for content rendering and errors.
- Publish migration notice that legacy `/<gist-id>/<file-path?>` paths are removed as part of this breaking change.

## Resolved Decisions

- Legacy fallback is not included in this change; URI migration is a breaking change.
- GitHub URL composer retains parsed username when known, otherwise composes without username placeholder.
- Malformed URL feedback is emitted to a log output element with severity levels (for example `info`, `warning`, `error`) instead of blocking alerts.
