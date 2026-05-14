## Purpose

Snippet Preview SHALL be installable as a Progressive Web App so users can add it to their home screen or desktop launcher.

## Requirements

### Requirement: Installable PWA metadata
The application MUST expose a Web App Manifest that enables installation as a standalone PWA.

#### Scenario: Browser reads manifest
- **WHEN** a supported browser loads the application
- **THEN** the browser can discover a valid manifest with standalone display settings and icon metadata

#### Scenario: Manifest references icons
- **WHEN** the browser evaluates the manifest
- **THEN** it can find at least a 192x192 icon and a 512x512 icon for install surfaces

### Requirement: Service worker registration
The application MUST register a service worker in production builds so browsers treat the site as installable.

#### Scenario: Production registration
- **WHEN** the application is served from a production build
- **THEN** the app registers a service worker successfully

#### Scenario: Development build stays unregistered
- **WHEN** the application runs in development mode
- **THEN** the service worker registration is skipped