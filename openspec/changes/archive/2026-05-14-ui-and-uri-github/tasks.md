## 1. Provider Routing Foundation

- [x] 1.1 Define provider adapter contract for route matching, preview-path parse/build, canonical URL parse/build, and preview response handling
- [x] 1.2 Refactor Service Worker dispatch to select provider adapter by namespace and delegate preview handling
- [x] 1.3 Move GitHub-specific preview logic into a dedicated GitHub provider module implementing the adapter contract
- [x] 1.4 Ensure non-provider paths continue pass-through network handling

## 2. GitHub Namespace and Preview Behavior

- [x] 2.1 Update GitHub preview route matching to canonical `/gist.github/<gist-id>/<file-path?>`
- [x] 2.2 Preserve existing preview rendering semantics (HTML pass-through, non-HTML wrapper, detailed error pages)
- [x] 2.3 Implement file-path encoding in generated preview URLs while maintaining readable input values
- [x] 2.4 Remove legacy `/<gist-id>/<file-path?>` preview fallback and document breaking-change migration notes

## 3. Landing Page UI and Interaction Flow

- [x] 3.1 Update landing page fields to `gist-id`, `filePath`, editable `github-gist-url`, and read-only `preview-url`
- [x] 3.2 Arrange `gist-id` and `filePath` inputs in juxtaposed layout and keep URL fields full-width
- [x] 3.3 Implement compose flow from `gist-id` and `filePath` into `github-gist-url` and `preview-url`
- [x] 3.4 Implement debounced (1.5s) decomposition from edited `github-gist-url` into `gist-id` and `filePath`
- [x] 3.5 Add log output element with severity levels and write malformed URL decomposition failures as `error` while skipping state overwrite

## 4. Actions, Navigation, and Clipboard

- [x] 4.1 Add buttons: `go-to-github-gist`, `go-to-preview`, `copy-gist-url`, `copy-preview-url`, and `reset`
- [x] 4.2 Implement go-to actions to open new tabs, composing GitHub URL with parsed username when known and username-less gist URL when unknown
- [x] 4.3 Implement clipboard copy actions with user feedback for success/failure
- [x] 4.4 Implement reset action to clear all input fields and derived preview output

## 5. Verification

- [x] 5.1 Validate route dispatch and provider delegation with manual test cases for valid and invalid paths
- [x] 5.2 Validate URL compose/decompose scenarios including debounce timing and log output severity behavior
- [x] 5.3 Validate new-tab navigation and clipboard behavior across supported browsers
- [x] 5.4 Run build/tests and confirm no regressions in existing landing page and Service Worker registration
