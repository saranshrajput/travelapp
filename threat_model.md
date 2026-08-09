# Threat Model

## Project Overview

Convoy is a mobile/web application (Expo/React Native) for coordinated group travel. A leader drops pitstop pins on a map; members receive updates and can confirm or get directions. The backend is an Express 5 API server (Node.js 24, TypeScript, PostgreSQL + Drizzle ORM) served on Replit Autoscale (public visibility). The mobile artifact is served by a standalone Node.js static file server (`artifacts/convoy/server/serve.js`).

## Assets

- **User accounts and sessions** — authentication state, identities of leaders vs. members in a trip.
- **Trip and pitstop data** — location pins, routes, member lists. Exposure could reveal physical locations and travel patterns.
- **Application secrets** — `DATABASE_URL` and any future API keys (push notification services, mapping APIs). Compromise allows full DB access.
- **Static mobile build** — the Expo web/mobile bundle served from `static-build/`. Tampering could inject malicious JS.

## Trust Boundaries

- **Browser / mobile client → API server** — all incoming HTTP is untrusted. The API must authenticate and authorize every data-mutating or private-data request.
- **API server → PostgreSQL** — the server has full DB credentials. SQL injection at the API layer would grant full DB access; Drizzle ORM with parameterized queries is the primary control.
- **Static file server → filesystem** — `serve.js` reads from `static-build/` based on the URL path. Path traversal controls are in place and correct (see Scan Anchors).
- **Expo platform header** — `expo-platform` header selects manifest variant (`ios`/`android`). Validated to an allowlist before use in file paths.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/` (Express API, port 5000), `artifacts/convoy/server/serve.js` (static asset server, port 3000/configured port)
- **Highest-risk areas:** API route handlers in `artifacts/api-server/` (auth, trip/pitstop CRUD, membership), DB schema in the `db` workspace package
- **Public surface:** `/status` health check (unauthenticated); manifest and static file routes (unauthenticated, read-only static assets)
- **Authenticated surface:** trip creation, pitstop mutation, member management — must enforce server-side ownership/membership checks
- **Dev-only / mockup:** `artifacts/mockup-sandbox/` (design artifact, `/__mockup` path) — not a production concern unless reachable via the main deployment

## Threat Categories

### Spoofing / Authentication

The API uses session-based or token-based auth (mechanism in `artifacts/api-server/`). Every trip/pitstop endpoint must validate the caller's identity server-side. The static server has no auth (correct for a public asset server).

### Tampering

Pitstop data (coordinates, labels) originates from leader input. Server must validate and scope writes to confirmed leaders/members of the trip. Client-supplied `tripId`, `pitstopId`, or role fields must not be trusted without server-side verification.

### Information Disclosure

Trip and member data must be scoped to the requesting user's trips. List/read endpoints must not return data for trips the caller does not belong to. Error responses must not leak stack traces or DB details in production. `DATABASE_URL` must not appear in logs or client bundles.

### Denial of Service

The static server reads files synchronously (`fs.readFileSync`); large files or high request volume could block the event loop. No rate limiting is currently visible on the static server. The API server should rate-limit auth and mutation endpoints.

### Elevation of Privilege

Broken object-level authorization (IDOR) is the primary risk: API endpoints that accept `tripId` or `pitstopId` must verify the caller is an authorized member/leader of that trip before returning data or applying mutations. Role escalation (member → leader) must be enforced server-side.

### Path Traversal (Static Server)

`serve.js` protects against path traversal with: URL normalization, leading-`..`-stripping regex, and a `startsWith(STATIC_ROOT)` boundary check after `path.join`. The `expo-platform` header is validated to `'ios' | 'android'` before use in file paths. Both controls are correct as of the last scan.
