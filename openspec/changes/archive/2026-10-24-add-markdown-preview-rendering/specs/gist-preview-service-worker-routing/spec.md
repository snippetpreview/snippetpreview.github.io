## MODIFIED Requirements

### Requirement: Wrapped source documents present source affordances

When a non-HTML, non-Markdown gist file is served inside a generated document, the system SHALL present the content in a styled source container that provides a copy action, and SHALL display the source address verbatim immediately above that container. Markdown files SHALL instead use the Markdown preview requirements and SHALL retain a source address and copy action in their generated document. HTML files SHALL continue to be served as the gist's own document.

#### Scenario: Verbatim address precedes a raw source container
- **WHEN** the system serves a non-HTML, non-Markdown gist file
- **THEN** the page shows `https://gist.githubusercontent.com/<username>/<gist-id>/raw/<file-path>` as an anchor above the source container

#### Scenario: Raw source copy action writes the exact source
- **WHEN** the user activates the copy control for a non-HTML, non-Markdown file
- **THEN** the clipboard receives the file's exact source text and the control confirms the copy briefly

#### Scenario: Long raw content remains readable
- **WHEN** a non-HTML, non-Markdown file contains long lines or many lines
- **THEN** its source container scrolls independently of the page

#### Scenario: Markdown uses a rendered document
- **WHEN** the served file is Markdown
- **THEN** the system renders a Markdown preview document with its source address and original-source copy action rather than the raw source container

#### Scenario: HTML gist files are unaffected
- **WHEN** the served file is HTML
- **THEN** the gist's own document is returned with only the source declaration added
