## MODIFIED Requirements

### Requirement: Installable PWA metadata

The application MUST expose a Web App Manifest that enables installation as a standalone PWA, including a stable application identity and icon assets usable by platform install surfaces.

#### Scenario: Browser reads manifest
- **WHEN** a supported browser loads the application
- **THEN** the browser can discover a valid manifest with standalone display settings, a stable application `id`, and icon metadata

#### Scenario: Manifest references icons
- **WHEN** the browser evaluates the manifest
- **THEN** it can find at least a 192x192 icon and a 512x512 icon for install surfaces

#### Scenario: Icons declare a format-appropriate size
- **WHEN** the manifest lists a vector icon
- **THEN** that icon declares `sizes: "any"` rather than a fixed raster size, and raster icons are provided at their declared dimensions

#### Scenario: Platform-specific install icon is available
- **WHEN** a platform that ignores manifest icons installs the application
- **THEN** the application provides a platform-appropriate touch icon from its document head

### Requirement: Service worker registration

The application MUST register a service worker in production builds so browsers treat the site as installable, and MUST NOT register one in development.

#### Scenario: Production registration
- **WHEN** the application is served from a production build
- **THEN** the app registers a service worker successfully

#### Scenario: Development build stays unregistered
- **WHEN** the application runs in development mode
- **THEN** the service worker registration is skipped

## ADDED Requirements

### Requirement: Application shell is available offline

The system SHALL precache the application shell and its built assets so that the installed application opens without network access.

#### Scenario: Launch without network
- **WHEN** the user launches the installed application with no network connection
- **THEN** the landing page and the cache management page load from the precache

#### Scenario: Preview routes are not answered by the shell fallback
- **WHEN** a preview path is requested and no cached resource satisfies it
- **THEN** the shell fallback does not answer that navigation in place of the preview route handler

#### Scenario: Resume parameter does not bypass precache
- **WHEN** the landing page is opened with a resume parameter while offline
- **THEN** the shell is served from the precache rather than fetched from the network

#### Scenario: Stale asset versions are cleaned up
- **WHEN** a new application build activates
- **THEN** precache entries from the previous build are removed
