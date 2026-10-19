## ADDED Requirements

### Requirement: Unhandled preview navigations are recovered on first visit

The system SHALL provide a not-found document that, when GitHub Pages serves it for a path inside a registered provider namespace, resumes that path through the landing page so the preview can be served once a service worker controls the page.

#### Scenario: Cold visit to a preview path is resumed
- **WHEN** a visitor with no controlling service worker opens `/gist.github/<gist-id>/<file-path>`
- **THEN** the not-found document redirects to the landing page with the original path carried in a `next` parameter

#### Scenario: Non-preview paths are not resumed
- **WHEN** the not-found document is served for a path outside every registered provider namespace
- **THEN** it presents a not-found message and does not redirect elsewhere

#### Scenario: Original path is preserved verbatim
- **WHEN** the not-found document forwards a preview path
- **THEN** the forwarded value retains the full pathname, including any trailing slash, and any query string

### Requirement: Landing page resumes a pending preview path

The system SHALL consume a `next` parameter on the landing page by ensuring a service worker controls the page and then navigating to the pending path.

#### Scenario: Resume after the worker takes control
- **WHEN** the landing page loads with a `next` value and a service worker gains control
- **THEN** the system navigates to the pending path without leaving an intermediate entry in browser history

#### Scenario: Worker takes control after registration
- **WHEN** the landing page registers a service worker for the first time
- **THEN** the system waits for the page to become controlled, rather than for registration alone, before navigating

### Requirement: Resume attempts are bounded to prevent redirect loops

The system SHALL attempt to resume a given pending path at most once per tab session and SHALL present a fallback when the resume does not succeed.

#### Scenario: A path is never resumed twice
- **WHEN** the landing page loads with a `next` value that has already been attempted in this tab
- **THEN** the system does not navigate and presents the fallback instead

#### Scenario: Worker fails to take control
- **WHEN** no service worker controls the page before the wait expires
- **THEN** the system presents an explanatory message with a link to the canonical source, and no further redirect occurs

### Requirement: Pending resume values are restricted to same-origin paths

The system SHALL accept a `next` value only when it is an absolute path on the current origin, and SHALL reject values that could navigate to another origin.

#### Scenario: Cross-origin value is rejected
- **WHEN** `next` contains a scheme, a protocol-relative prefix (`//`), or a backslash-based prefix (`/\`)
- **THEN** the system discards the value and shows the landing page normally

#### Scenario: Normalization does not reintroduce an external target
- **WHEN** `next` is accepted
- **THEN** the resulting navigation target resolves to the current origin
