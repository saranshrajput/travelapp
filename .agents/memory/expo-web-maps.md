---
name: Maps on Expo web
description: How to render maps in an Expo app so both native and the web preview work
---

- `react-native-maps` imports react-native internals (`codegenNativeCommands`) and fails Metro web bundling with a 500 — the scaffold does NOT alias it for web.
- Fix: a platform-split module (e.g. `components/map/index.tsx` re-exporting react-native-maps for native, `index.web.tsx` implementing the same tiny API with Leaflet + OpenStreetMap tiles — no API key). Marker children render via `createPortal` into an `L.divIcon` element; expose `fitToCoordinates`/`animateToRegion` via `useImperativeHandle`. App code imports only from the wrapper, never from `react-native-maps` directly.
- `import 'leaflet/dist/leaflet.css'` works in Expo SDK 54 Metro web.
- Keep `react-native-maps` at the exact version pinned when installed; do not add it to app.json plugins (Expo Go compatibility).

**How to apply:** any Expo artifact that needs a map and must render in the Replit web preview.
