# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Convoy** — a lightweight, real-time group trip tracker (Expo/React Native mobile app + Express API). A leader creates a trip and shares a join code/link; members join with just a name and phone number and share foreground location while the trip is active. Everyone sees the group on one route-aware map. Full product spec and delivery plan: [CONVOY_PRD.md](CONVOY_PRD.md). Security model and trust boundaries: [threat_model.md](threat_model.md).

This is a pnpm-workspace monorepo hosted on Replit (Autoscale deployment, Postgres 16, Node 24 — see [.replit](.replit)). For local development off Replit, `DATABASE_URL` can point at any reachable Postgres — a free-tier [Neon](https://neon.tech) branch works well and needs no local Postgres install.

## Commands

```bash
# Run the API server (port from $PORT env var, required)
pnpm --filter @workspace/api-server run dev

# Run the Expo app (dev server)
pnpm --filter @workspace/convoy run dev

# Typecheck everything (libs via tsc --build, then artifacts + scripts)
pnpm run typecheck

# Typecheck a single package
pnpm --filter <pkg-name> run typecheck

# Build all packages (runs typecheck first)
pnpm run build

# Regenerate react-query hooks + Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to the dev database (drizzle-kit push, no migration file)
pnpm --filter @workspace/db run push
```

There is no test runner configured in this repo — verification is via `typecheck` and `build`.

Required env: `DATABASE_URL` (Postgres connection string). The API server also requires `PORT` to be set or it throws at startup.

Package names for `--filter` are the `name` field in each `package.json` (e.g. `@workspace/api-server`, `@workspace/convoy`, `@workspace/db`, `@workspace/api-spec`, `@workspace/api-zod`, `@workspace/api-client-react`, `@workspace/convoy-deck`, `@workspace/mockup-sandbox`).

Use `pnpm`, not `npm`/`yarn` — the root `preinstall` script deletes `package-lock.json`/`yarn.lock` and fails outright if invoked via a different package manager.

## Repository map

| Area | Location | Notes |
| --- | --- | --- |
| Mobile app | `artifacts/convoy/` | Expo Router app (native + web preview) |
| API server | `artifacts/api-server/` | Express 5, esbuild-bundled to a single ESM file |
| API contract (source of truth) | `lib/api-spec/openapi.yaml` | Orval generates the other two packages from this |
| Generated API hooks | `lib/api-client-react/src/generated/` | react-query hooks, do not hand-edit |
| Generated Zod schemas | `lib/api-zod/src/generated/` | request/response validation, do not hand-edit |
| DB schema | `lib/db/src/schema/convoy.ts` | Drizzle ORM, Postgres |
| Pitch deck | `artifacts/convoy-deck/` | Vite + React, standalone artifact |
| Design sandbox | `artifacts/mockup-sandbox/` | Vite + shadcn/radix components, `/__mockup` path, not production |
| Misc scripts | `scripts/` | tsx-run TS scripts |
| Threat model | `threat_model.md` | keep in sync when adding endpoints or trust boundaries |

## Architecture

### Workspace / build pipeline

- `pnpm-workspace.yaml` defines packages under `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`, plus a `catalog:` of pinned shared dependency versions (react/react-dom pinned to exact versions because Expo requires it — don't bump these independently).
- TypeScript project references: root `tsconfig.json` references `lib/db`, `lib/api-client-react`, `lib/api-zod` — `pnpm run typecheck:libs` builds these via `tsc --build`. `pnpm run typecheck` then typechecks everything under `artifacts/**` and `scripts` (each has its own non-referenced `typecheck` script run via `pnpm -r --filter`).
- The API server is bundled with esbuild ([artifacts/api-server/build.mjs](artifacts/api-server/build.mjs)) into a single `dist/index.mjs`, with a long externals list for native/unbundleable packages and a banner that restores `require`/`__dirname`/`__filename` in the ESM output (needed because some bundled deps are CJS-only, e.g. `express`). Drizzle migrations from `lib/db/drizzle` are copied into `dist/migrations` at build time so they ship with the server.
- `pnpm-workspace.yaml` enforces a 1-day `minimumReleaseAge` on npm installs (supply-chain defense) with an allowlist for `@replit/*` and a couple of trusted exceptions — don't remove this or add exclusions casually. It also pins an `allowBuilds` trust list for packages with postinstall scripts (`@firebase/util`, `@swc/core`, `esbuild`, `msw`, `protobufjs`, `unrs-resolver`) — adding a new dependency with a postinstall script will prompt to extend this list; edit it directly rather than running `pnpm approve-builds` interactively, which has previously silently dropped existing entries during a schema migration.
- Root `package.json` pins `packageManager: pnpm@12.4.2` and `.node-version` pins Node 24, so CI/deploy hosts (e.g. Render) build with the same toolchain used locally.

### Deployment

- **Backend**: [render.yaml](render.yaml) is a Render Blueprint for `@workspace/api-server` — build/start commands are scoped via `pnpm --filter` directly to that package (not the root `build` script), so the pre-existing typecheck failures in `convoy-deck`/`mockup-sandbox` don't block deployment. `DATABASE_URL` is `sync: false` in the blueprint (set manually in Render's dashboard, e.g. to a Neon connection string) — never committed.
- **Mobile**: [artifacts/convoy/eas.json](artifacts/convoy/eas.json) has EAS Build profiles (development/preview/production); `app.json` carries the EAS `projectId`, `owner`, and `updates` config from `eas init` / `eas update:configure`. `runtimeVersion.policy` must stay `"sdkVersion"` — `"appVersion"` (the `eas update:configure` default) breaks Expo Go entirely ("not available in Expo Go") since Expo Go only resolves updates by SDK version, not an app-version-derived runtime string.
- A published EAS Update (`eas update --branch preview`) lets anyone with the Expo Go app run the app live without a native build or an Apple Developer account — but EAS projects default to requiring the viewer be signed into Expo Go with an account that has project access (a 403 "requires authentication" otherwise); there's currently no reliable self-service "make public" toggle in the EAS dashboard.
- A real installable/signed iOS build (not via Expo Go) needs EAS Build plus an Apple Developer Program membership ($99/year) to sign it for a physical device — there is no free iOS equivalent to Android's APK sideloading.

### API contract flow (OpenAPI → generated code)

`lib/api-spec/openapi.yaml` is the single source of truth for the API. Running its `codegen` script (Orval) regenerates:
- `lib/api-client-react/src/generated/` — react-query hooks used by the Expo app, via a custom fetch mutator (`custom-fetch.ts`) and workspace-relative base URL `/api`.
- `lib/api-zod/src/generated/` — Zod schemas + TS types for request/response validation, shared by client and server.

Never hand-edit files under either `generated/` directory — edit the OpenAPI spec and re-run codegen. See [.agents/memory/openapi-codegen.md](.agents/memory/openapi-codegen.md) for known pitfalls (use `type: number` not `integer`; avoid colliding optional query param names across operations; generated query hooks need an explicit `queryKey` when passing query options).

### API server (`artifacts/api-server`)

- Entry point `src/index.ts`: validates `PORT`, runs a one-time migration-bootstrap step that reconciles databases previously managed via `drizzle-kit push` with the newer migration-file flow (checks for pre-existing tables and backdates `__drizzle_migrations` rows using the journal's timestamps so `drizzle-orm`'s `migrate()` ordering stays correct), then runs `migrate()` and starts listening.
- `src/app.ts` wires up `pino-http` request logging, CORS, JSON/urlencoded body parsing, and mounts everything under `/api` via `src/routes/index.ts`.
- Routes are split by domain: `auth`, `geo`, `tracking`, `messages`, `pitstops`, `safeZones`, `demo`, `trips`, `health` — each a self-contained Express router.
- Auth (`src/lib/auth.ts`) is a bespoke bearer-token scheme, not sessions/JWT: `authRequired` middleware looks up the raw token directly against `usersTable.token` and stashes the user on `res.locals["user"]` (read via `currentUser(res)`). There is no token expiry/refresh — tokens are opaque random hex strings created at sign-in/join time.
- Authorization is enforced per-route by checking trip membership/role server-side — client-supplied `tripId`/`memberId`/`role` values are never trusted (see [threat_model.md](threat_model.md), Elevation of Privilege). When adding endpoints, follow this pattern rather than trusting IDs from the request body.
- `tracking.ts` also computes an `activeSos` field on `GET /trips/:tripId/state` (most recent `kind: "sos"` message within 15 minutes) and handles the breadcrumb-replay endpoints (`POST /trips/:tripId/history-opt-in`, `GET /trips/:tripId/history`, with a lazy purge of rows more than 7 days past `trip.endedAt`). `messages.ts` handles `POST /trips/:tripId/sos` (in-app broadcast only, no outside SMS).
- Optional phone verification: `POST /auth/verify-phone` (`auth.ts`) verifies a Firebase Phone Auth ID token against Google's public JWKS via `jose` (`src/lib/firebaseAuth.ts`) — no `firebase-admin`/service-account credentials needed — then checks the verified number matches the account's own phone before setting `usersTable.verifiedAt`. Never gates sign-in/join.

### Database (`lib/db`)

- Single schema file [lib/db/src/schema/convoy.ts](lib/db/src/schema/convoy.ts): `users`, `trips`, `trip_members`, `messages`, `pitstops`, `pitstop_responses`, `safe_zones`, `location_history`. Drizzle-zod generates `insert*Schema` + row types alongside each table.
- Trip lifecycle is a string status column (`draft | active | ended`), not an enum type. Trip members store both a "latest fix" and a "previous fix" (lat/lng/timestamp) rather than a location history table — this is intentional (see PRD §4, data/privacy model) to support movement/status detection while minimizing retention of location history.
- `trip_members.recordHistory` (default `false`) is a per-trip, per-member opt-in for breadcrumb replay — only when set does the location handler also append to `location_history`, which is purged 7 days after the trip ends. This is a deliberate, bounded exception to the latest/previous-fix-only design above, not a change to it.
- `messages.kind` (`text | sos`, default `text`) distinguishes SOS broadcasts from normal chat.
- `users.verifiedAt` is set once by `POST /auth/verify-phone`; optional and non-blocking (see API server section).
- Two ways to evolve the schema: `pnpm --filter db run push` (drizzle-kit push, direct/dev-only, no migration file) vs. proper migration files under `lib/db/drizzle` consumed by `migrate()` at server startup. `scripts/post-merge.sh` runs `pnpm --filter db push` automatically after merges to main — be aware schema drift between `push` and generated migrations is what the bootstrap logic in `src/index.ts` reconciles.

### Mobile app (`artifacts/convoy`)

- Expo SDK 57 (React Native 0.86, React 19.2 — react/react-dom pinned via the workspace `catalog:`, see above). When bumping the SDK: `expo install expo@<version>` then `expo install --fix`, but verify the result rather than trusting it blindly — `--fix` has previously (a) overwritten the `catalog:` protocol reference for react/react-dom with a literal version (restore it and bump the catalog value instead), (b) left `@expo/cli` on a stale pin instead of the version `expo` actually requires, and (c) bumped `typescript` to a version whose deprecations break this project's `baseUrl`-based path aliases (pinned back and excluded via `expo.install.exclude` in `package.json`). Run `npx expo-doctor@latest` after any SDK bump — it caught `app.json` schema errors (`newArchEnabled` and top-level `splash` are both obsolete under SDK 57; splash config now lives in the `expo-splash-screen` plugin entry) that `tsc`/`expo start` didn't.
- Expo Router app; `app/` holds file-based routes (`trips.tsx`, `create-trip.tsx`, `join.tsx`, `signin.tsx`, `trip/[id]/{index,tracking,messages}.tsx`).
- Auth/session state lives in `lib/session.tsx` (React context backed by AsyncStorage); the bearer token is also cached at module scope (`getSessionToken()`) so the API client can attach it outside React.
- Maps use a platform-split wrapper, not `react-native-maps` directly: `components/map/index.tsx` (native) vs. `components/map/index.web.tsx` (Leaflet + OpenStreetMap for the web preview, no API key). `react-native-maps` breaks Metro's web bundling if imported directly. See [.agents/memory/expo-web-maps.md](.agents/memory/expo-web-maps.md) for the constraints (keep the pinned version, don't add it to `app.json` plugins, always import the app's map API through the wrapper). Both wrappers export a `Circle` primitive (used for safe zones) alongside `Marker`/`Polyline` (the latter also renders breadcrumb-replay paths in `TripMap.tsx`).
- `lib/useLocationSharing.ts` adapts polling cadence locally (active vs. idle `MODE_CONFIG`, switching based on GPS speed/distance) and queues failed location posts in `AsyncStorage`, flushing on reconnect (via `expo-network`) — no server round-trip is needed to decide the cadence.
- Optional phone verification (`lib/phoneVerify.ts`, `components/VerifyPhoneModal.tsx`) uses the plain `firebase` Web SDK (`signInWithPhoneNumber` + invisible reCAPTCHA), gated to web only via `phoneVerifySupported` — the reCAPTCHA needs a real DOM, and native support would need `@react-native-firebase/auth` (a native module requiring a custom dev client build, not set up here). The Firebase web config is hardcoded in `phoneVerify.ts`; it's client-safe, not a secret.
- `pnpm --filter @workspace/convoy run build` builds a static bundle; `pnpm --filter @workspace/convoy run serve` runs `server/serve.js`, a zero-dependency Node static file server used in production (serves `expo-platform`-aware manifests plus a landing page, with path-traversal guards — see [threat_model.md](threat_model.md)).

## Agent memory

This repo maintains its own cross-session memory under `.agents/memory/` (separate from Claude Code's own memory system) — check [.agents/memory/MEMORY.md](.agents/memory/MEMORY.md) for accumulated gotchas (currently: OpenAPI codegen quirks, Expo web map setup) before touching those areas.
