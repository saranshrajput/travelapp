# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Convoy** — a lightweight, real-time group trip tracker (Expo/React Native mobile app + Express API). A leader creates a trip and shares a join code/link; members join with just a name and phone number and share foreground location while the trip is active. Everyone sees the group on one route-aware map. Full product spec and delivery plan: [CONVOY_PRD.md](CONVOY_PRD.md). Security model and trust boundaries: [threat_model.md](threat_model.md).

This is a pnpm-workspace monorepo hosted on Replit (Autoscale deployment, Postgres 16, Node 24 — see [.replit](.replit)).

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
- `pnpm-workspace.yaml` enforces a 1-day `minimumReleaseAge` on npm installs (supply-chain defense) with an allowlist for `@replit/*` and a couple of trusted exceptions — don't remove this or add exclusions casually.

### API contract flow (OpenAPI → generated code)

`lib/api-spec/openapi.yaml` is the single source of truth for the API. Running its `codegen` script (Orval) regenerates:
- `lib/api-client-react/src/generated/` — react-query hooks used by the Expo app, via a custom fetch mutator (`custom-fetch.ts`) and workspace-relative base URL `/api`.
- `lib/api-zod/src/generated/` — Zod schemas + TS types for request/response validation, shared by client and server.

Never hand-edit files under either `generated/` directory — edit the OpenAPI spec and re-run codegen. See [.agents/memory/openapi-codegen.md](.agents/memory/openapi-codegen.md) for known pitfalls (use `type: number` not `integer`; avoid colliding optional query param names across operations; generated query hooks need an explicit `queryKey` when passing query options).

### API server (`artifacts/api-server`)

- Entry point `src/index.ts`: validates `PORT`, runs a one-time migration-bootstrap step that reconciles databases previously managed via `drizzle-kit push` with the newer migration-file flow (checks for pre-existing tables and backdates `__drizzle_migrations` rows using the journal's timestamps so `drizzle-orm`'s `migrate()` ordering stays correct), then runs `migrate()` and starts listening.
- `src/app.ts` wires up `pino-http` request logging, CORS, JSON/urlencoded body parsing, and mounts everything under `/api` via `src/routes/index.ts`.
- Routes are split by domain: `auth`, `geo`, `tracking`, `messages`, `pitstops`, `demo`, `trips`, `health` — each a self-contained Express router.
- Auth (`src/lib/auth.ts`) is a bespoke bearer-token scheme, not sessions/JWT: `authRequired` middleware looks up the raw token directly against `usersTable.token` and stashes the user on `res.locals["user"]` (read via `currentUser(res)`). There is no token expiry/refresh — tokens are opaque random hex strings created at sign-in/join time.
- Authorization is enforced per-route by checking trip membership/role server-side — client-supplied `tripId`/`memberId`/`role` values are never trusted (see [threat_model.md](threat_model.md), Elevation of Privilege). When adding endpoints, follow this pattern rather than trusting IDs from the request body.

### Database (`lib/db`)

- Single schema file [lib/db/src/schema/convoy.ts](lib/db/src/schema/convoy.ts): `users`, `trips`, `trip_members`, `messages`, `pitstops`, `pitstop_responses`. Drizzle-zod generates `insert*Schema` + row types alongside each table.
- Trip lifecycle is a string status column (`draft | active | ended`), not an enum type. Trip members store both a "latest fix" and a "previous fix" (lat/lng/timestamp) rather than a location history table — this is intentional (see PRD §4, data/privacy model) to support movement/status detection while minimizing retention of location history.
- Two ways to evolve the schema: `pnpm --filter db run push` (drizzle-kit push, direct/dev-only, no migration file) vs. proper migration files under `lib/db/drizzle` consumed by `migrate()` at server startup. `scripts/post-merge.sh` runs `pnpm --filter db push` automatically after merges to main — be aware schema drift between `push` and generated migrations is what the bootstrap logic in `src/index.ts` reconciles.

### Mobile app (`artifacts/convoy`)

- Expo Router app; `app/` holds file-based routes (`trips.tsx`, `create-trip.tsx`, `join.tsx`, `signin.tsx`, `trip/[id]/{index,tracking,messages}.tsx`).
- Auth/session state lives in `lib/session.tsx` (React context backed by AsyncStorage); the bearer token is also cached at module scope (`getSessionToken()`) so the API client can attach it outside React.
- Maps use a platform-split wrapper, not `react-native-maps` directly: `components/map/index.tsx` (native) vs. `components/map/index.web.tsx` (Leaflet + OpenStreetMap for the web preview, no API key). `react-native-maps` breaks Metro's web bundling if imported directly. See [.agents/memory/expo-web-maps.md](.agents/memory/expo-web-maps.md) for the constraints (keep the pinned version, don't add it to `app.json` plugins, always import the app's map API through the wrapper).
- `pnpm --filter @workspace/convoy run build` builds a static bundle; `pnpm --filter @workspace/convoy run serve` runs `server/serve.js`, a zero-dependency Node static file server used in production (serves `expo-platform`-aware manifests plus a landing page, with path-traversal guards — see [threat_model.md](threat_model.md)).

## Agent memory

This repo maintains its own cross-session memory under `.agents/memory/` (separate from Claude Code's own memory system) — check [.agents/memory/MEMORY.md](.agents/memory/MEMORY.md) for accumulated gotchas (currently: OpenAPI codegen quirks, Expo web map setup) before touching those areas.
