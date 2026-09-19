/**
 * Platform-split map module (native side).
 * Web uses ./index.web.tsx (Leaflet + OpenStreetMap — no API key needed).
 */
import MapView from 'react-native-maps';

export { Marker, Polyline, Circle } from 'react-native-maps';

export type MapHandle = {
  fitToCoordinates: (
    coords: { latitude: number; longitude: number }[],
    opts?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    },
  ) => void;
  animateToRegion: (
    region: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    },
    durationMs?: number,
  ) => void;
};

export default MapView;
