# Memory Index

- [OpenAPI codegen quirks](openapi-codegen.md) — use `type: number` not `integer` (zod 3.25); avoid optional query params colliding in `*Params`; generated hooks require explicit `queryKey` when passing query options.
- [Maps on Expo web](expo-web-maps.md) — react-native-maps breaks the web bundle; use a platform-split wrapper with Leaflet+OSM on web (`index.web.tsx`).
