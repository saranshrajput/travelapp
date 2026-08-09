# Convoy — Product Write-up & PRD

**Status:** MVP implemented and in active development  
**Repository:** `sk72766/travelapp`  
**Product type:** Expo / React Native mobile application with an Express API

## 1. Product write-up

### The problem

When friends, families, or riding groups travel in separate vehicles, coordination usually happens through fragmented group-chat messages:

- “Where are you?”
- “How far behind are you?”
- “Did you stop?”
- “Are you still on the route?”

Text updates are manual, quickly become stale, and do not provide a shared picture of the group’s progress. Existing map and navigation applications are primarily designed for an individual traveller rather than a group moving together.

### The solution

**Convoy** is a lightweight, real-time group trip tracker. A leader creates a trip and shares a join code or link. Members join with only a name and phone number, then share their foreground location while the trip is active. Everyone sees the group on one route-aware map, with clear sharing states and relative progress.

> **One map. Every rider. Right now.**

Convoy is intentionally simple:

- no password or email account required for the MVP;
- no turn-by-turn navigation to build or maintain;
- no background location tracking when the app is closed;
- location status is explicit, so a missing update is never mistaken for a member disappearing.

### Primary users

1. **Trip leader** — plans the trip, manages the roster, starts and ends the trip.
2. **Trip member** — joins quickly, shares location, follows group progress, and communicates with the group.
3. **Late joiner** — joins an active trip and immediately sees the current live state.

### Core value proposition

Convoy reduces coordination overhead during group travel by making the group’s current location, route progress, and sharing health visible in one glance.

## 2. Product requirements

### 2.1 Trip creation

The leader can:

- create a trip with a name;
- choose a start point, defaulting to the current location;
- search for or pin a destination;
- choose a date and start time;
- select one of two or three suggested routes;
- review route distance and estimated duration before confirming.

### 2.2 Joining and identity

- A trip has a shareable join link and/or short join code.
- A new member joins with a name and phone number.
- No password, email address, or social login is required for the MVP.
- The client receives a bearer session token for subsequent API calls.
- A late joiner sees the current trip state immediately after joining.

### 2.3 Trip lobby and roster

The lobby shows:

- trip name and planned route;
- route distance and duration;
- map preview;
- member roster and join status.

Leaders can:

- add, remove, or promote members;
- edit the destination or route while the trip is in Draft;
- start the trip.

Members can leave the trip. The only leader cannot leave or demote themselves until another member has been promoted.

### 2.4 Location permission and sharing

Before the operating system permission prompt, Convoy displays a plain-language explanation of why location is needed.

If permission is denied:

- the user is not blocked from using the app;
- the map remains visible;
- a persistent “You’re not sharing” banner explains the state;
- a retry path remains available.

For the MVP, location sharing is foreground-only. The app must remain open while tracking. The client polls the server for the latest group state approximately every four seconds.

### 2.5 Live tracking map

The tracking view includes:

- the selected route and destination;
- one coloured or initialed marker per member;
- a visually distinct marker for the current user and leader;
- automatic map framing;
- a **Recentre** action after manual pan or zoom;
- a header showing the trip name and “N of M sharing”;
- a menu for leaving the trip and, for leaders, ending it.

Member states are:

| State | Meaning |
| --- | --- |
| **Moving** | Recent location updates show meaningful movement. |
| **Stopped** | The member has been stationary for at least three minutes; show the stopped duration. |
| **Not updating** | No update has arrived for at least five minutes; fade the member and show last-seen time. |
| **Not sharing** | The member has not granted or is not currently providing location permission. |

A marker never silently disappears. The last known position remains visible with a timestamp.

### 2.6 Route-aware progress

The member list is ordered front-to-back along the selected route. Each row shows:

- member identity and status;
- distance remaining;
- relative gap to the viewer, such as “12 km behind · ~22 min”;
- an explicit estimate label where appropriate.

The furthest-back member receives a subtle visual highlight.

Gaps are measured by projecting each location onto the selected route. If a member is more than approximately 500 metres from the route, Convoy labels them **off-route** and uses straight-line distance instead of fabricating a route-based number.

### 2.7 Member details

Selecting a member opens a detail sheet with:

- current status and duration;
- distance and time gap;
- distance to destination;
- last-seen area and timestamp;
- **Call** action opening the phone dialler;
- **Locate on map** action.

Leaders also see promote and remove actions where permitted.

### 2.8 Messaging

Members can send:

- a message to the whole trip; or
- a direct message to one member.

Messaging requirements:

- the message panel is reachable from the tracking screen;
- opening messages does not permanently lose the map context;
- unread messages are clearly indicated;
- sender identity uses colour and initials;
- history is retained for the duration of the trip;
- messaging stops when the trip ends.

### 2.9 Ending a trip

The leader can end a trip manually. A trip also auto-ends after 12 hours of inactivity.

When ended:

- all location sharing stops immediately;
- the map becomes read-only;
- a summary shows total distance, duration, and who completed the trip.

### 2.10 My Trips

The trip list contains:

- active trips first, with a live indicator and sharing count;
- upcoming trips next;
- past trips in a collapsed section;
- a prominent **Create Trip** action;
- a useful empty state for new users.

## 3. Design and accessibility requirements

Convoy is used outdoors and may be viewed from a phone mount. The interface must:

- remain readable at arm’s length and in bright sunlight;
- keep sharing state visible at all times;
- use colour for identity and status, not decoration alone;
- pair colour with text or icon meaning;
- maintain strong contrast and large touch targets;
- avoid relying on colour alone for error, warning, or sharing state.

The visual identity blends:

- **Ola-inspired brand energy** for app chrome and primary actions; and
- **Google Maps-inspired map language** for roads, routes, markers, and geographic information.

Brand colours belong to the product UI. Map colours are reserved for map semantics and status meaning.

## 4. Technical architecture

### Client

- Expo / React Native
- Expo Router
- Native map view on iOS and Android
- Leaflet + OpenStreetMap wrapper for web preview
- Foreground location polling and sharing
- Bearer token authentication

### API

- Express 5
- Node.js 24
- TypeScript
- PostgreSQL
- Drizzle ORM
- OpenAPI contract with generated client hooks and schemas

### External services

- Photon for address search and geocoding
- OSRM public API for route alternatives and route geometry
- OpenStreetMap data for the web map preview

No mapping API key is required for the current MVP implementation.

### Data and privacy model

The server stores the latest and previous location fix per member rather than an unlimited location history. This supports current status and movement detection while reducing unnecessary retention of sensitive travel data.

Trip and member data must always be scoped to the authenticated user’s membership and role. Client-supplied trip IDs, member IDs, and roles are not trusted without server-side authorization.

## 5. API and lifecycle plan

### Trip lifecycle

```text
Draft → Active → Ended
```

- **Draft:** planning, route selection, roster management.
- **Active:** location sharing, live map, member status, and messaging.
- **Ended:** read-only summary and map.

### Core API capabilities

The API contract and server cover these capability areas:

1. Lightweight identity and bearer-token authentication.
2. Trip creation, retrieval, update, and listing.
3. Join-by-link or join-code flow.
4. Roster management with leader-only authorization.
5. Start and end lifecycle actions.
6. Location ingestion and latest group-state polling.
7. Status calculation and route-projected progress.
8. Off-route detection.
9. Group and direct messaging.
10. Health checking for the API and static mobile server.

### Demo mode

The app includes a live demo flow that creates a Bangalore-to-Mysore trip with simulated members. Demo members advance periodically so the tracking screen can be evaluated without multiple physical devices.

## 6. Delivery plan

### Phase 1 — Contract and data model

- Define trips, members, roles, join codes, locations, messages, and lifecycle states.
- Maintain the OpenAPI specification as the API source of truth.
- Regenerate client hooks and validation schemas after contract changes.
- Apply the development database schema.

### Phase 2 — Backend

- Implement trip CRUD and membership checks.
- Implement join, leave, promote, and remove operations.
- Enforce the only-leader guard.
- Implement start/end and inactivity auto-end.
- Implement location ingestion and group-state polling.
- Calculate moving, stopped, not-updating, and not-sharing states.
- Calculate route progress, gaps, and off-route status.
- Implement trip-scoped group and direct messaging.

### Phase 3 — Maps and routing

- Provide native maps on iOS and Android.
- Provide the platform-split web map preview.
- Add Photon search with debounce and caching.
- Add OSRM route alternatives with distance and duration.
- Draw route geometry, destination, and member markers.

### Phase 4 — Mobile experience

- Sign-in / join flow.
- My Trips.
- Create Trip and route picker.
- Trip Lobby.
- Permission explainer and retry path.
- Tracking map and ordered member list.
- Member detail sheet.
- Messaging panel.
- Ended-trip summary.

### Phase 5 — Edge cases and hardening

Validate:

- denied location permission;
- app backgrounded or closed;
- signal loss;
- late joining;
- off-route movement;
- only-leader leave and demotion attempts;
- ending while members are travelling;
- a trip with one member;
- stale location timestamps;
- API and static-server health checks.

### Phase 6 — Release readiness

- Run typecheck and production builds.
- Validate the slide/deck artifact separately where applicable.
- Run dependency, SAST, and security scans.
- Verify no secrets are committed.
- Test the published app and API health endpoints.
- Publish the mobile artifact after preview verification.

## 7. MVP scope boundaries

The following are intentionally excluded from the original MVP:

- background location while the app is closed or the screen is off;
- turn-by-turn navigation;
- push notifications;
- live traffic-aware ETAs;
- payments;
- social features;
- multi-day trips;
- trip replays, history, or analytics;
- SOS and emergency functionality;
- push-to-talk voice.

Pitstop planning is treated as a follow-on capability in the current codebase and should be evaluated separately from the core live-tracking acceptance criteria.

## 8. Success criteria

The MVP is successful when:

1. A leader can create a trip and select a route in under two minutes.
2. A member can join with name and phone only in under one minute.
3. All members can understand who is sharing and who is stale from the tracking screen alone.
4. Relative group progress is route-aware and never presents fabricated route distances.
5. Permission denial is recoverable and does not dead-end the user.
6. A late joiner sees the live state immediately.
7. Ending a trip reliably stops sharing and produces a read-only summary.
8. The app remains legible and usable outdoors.
9. Unauthorized users cannot read or mutate another trip’s data.

## 9. Repository map

| Area | Location |
| --- | --- |
| Mobile app | `artifacts/convoy/` |
| API server | `artifacts/api-server/` |
| API contract and generated packages | `lib/api-spec/` and workspace packages |
| Database schema | `lib/db/` |
| Pitch deck | `artifacts/convoy-deck/` |
| Design sandbox | `artifacts/mockup-sandbox/` |
| MVP task plan | `.local/tasks/convoy-mvp.md` |
| Threat model | `threat_model.md` |

## 10. Development commands

```bash
# Start the API
pnpm --filter @workspace/api-server run dev

# Start the Expo app
pnpm --filter @workspace/convoy run dev

# Check the whole workspace
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API client code
pnpm --filter @workspace/api-spec run codegen

# Push development database schema
pnpm --filter @workspace/db run push
```

## 11. Open follow-up work

- Add a retention and cleanup policy for demo trips so repeated demos do not accumulate indefinitely.
- Reconcile and verify pitstop planning against the core MVP scope.
- Continue release testing on native iOS and Android devices.
- Revisit background location, notifications, and trip history only after validating the foreground MVP.
