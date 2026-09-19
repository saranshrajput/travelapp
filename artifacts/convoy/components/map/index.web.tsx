/**
 * Web implementation of the map module using Leaflet + OpenStreetMap tiles.
 * Mirrors the small react-native-maps API surface the app uses:
 * default MapView (ref: fitToCoordinates / animateToRegion), Marker, Polyline.
 */
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

export type MapHandle = {
  fitToCoordinates: (
    coords: LatLng[],
    opts?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    },
  ) => void;
  animateToRegion: (region: Region, durationMs?: number) => void;
};

const MapCtx = createContext<L.Map | null>(null);

function zoomFor(region: Region): number {
  const delta = Math.max(region.longitudeDelta, region.latitudeDelta, 0.002);
  return Math.max(3, Math.min(17, Math.floor(Math.log2(360 / delta))));
}

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  region?: Region;
  children?: React.ReactNode;
  onPanDrag?: () => void;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  // Ignored props accepted for API compatibility
  toolbarEnabled?: boolean;
  showsCompass?: boolean;
  showsMyLocationButton?: boolean;
};

const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { style, initialRegion, region, children, onPanDrag, pointerEvents },
  ref,
) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return undefined;
    const m = L.map(div, { zoomControl: false, attributionControl: true });
    const r = initialRegion ?? region;
    if (r) {
      m.setView([r.latitude, r.longitude], zoomFor(r));
    } else {
      m.setView([20, 78], 4);
    }
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m);
    if (onPanDrag) {
      m.on('dragstart', onPanDrag);
      m.on('zoomstart', () => {
        // user zoom (wheel/pinch) also counts as manual interaction
      });
    }
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(div);
    setMap(m);
    return () => {
      ro.disconnect();
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map && region) {
      map.setView([region.latitude, region.longitude], zoomFor(region));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta]);

  useImperativeHandle(
    ref,
    () => ({
      fitToCoordinates(coords, opts) {
        if (!map || coords.length === 0) return;
        const b = L.latLngBounds(coords.map((c) => [c.latitude, c.longitude] as [number, number]));
        const pad = opts?.edgePadding;
        map.fitBounds(b, {
          paddingTopLeft: [pad?.left ?? 60, pad?.top ?? 60],
          paddingBottomRight: [pad?.right ?? 60, pad?.bottom ?? 60],
          animate: opts?.animated !== false,
          maxZoom: 15,
        });
      },
      animateToRegion(r) {
        map?.setView([r.latitude, r.longitude], zoomFor(r), { animate: true });
      },
    }),
    [map],
  );

  return (
    <View style={style} pointerEvents={pointerEvents}>
      <div ref={divRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {map ? <MapCtx.Provider value={map}>{children}</MapCtx.Provider> : null}
    </View>
  );
});

export default MapView;

export function Marker({
  coordinate,
  children,
  onPress,
  zIndex,
  anchor,
  pinColor,
}: {
  coordinate: LatLng;
  children?: React.ReactNode;
  onPress?: () => void;
  zIndex?: number;
  anchor?: { x: number; y: number };
  pinColor?: string;
  tracksViewChanges?: boolean;
}) {
  const map = useContext(MapCtx);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return undefined;
    const icon = L.divIcon({ className: '', html: '<div></div>', iconSize: [0, 0] });
    const m = L.marker([coordinate.latitude, coordinate.longitude], {
      icon,
      zIndexOffset: (zIndex ?? 0) * 100,
      interactive: true,
    }).addTo(map);
    if (onPress) m.on('click', onPress);
    const root = m.getElement()?.firstElementChild as HTMLElement | null;
    setEl(root);
    markerRef.current = m;
    return () => {
      m.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLatLng([coordinate.latitude, coordinate.longitude]);
  }, [coordinate.latitude, coordinate.longitude]);

  if (!el) return null;
  const ax = anchor?.x ?? 0.5;
  const ay = anchor?.y ?? 1;
  const content = children ?? (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50% 50% 50% 0',
        background: pinColor ?? '#EA4335',
        border: '2px solid #fff',
        transform: 'rotate(-45deg)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }}
    />
  );
  return createPortal(
    <div
      style={{
        transform: `translate(${-ax * 100}%, ${-ay * 100}%)`,
        display: 'inline-block',
        cursor: onPress ? 'pointer' : 'default',
      }}
    >
      {content}
    </div>,
    el,
  );
}

export function Circle({
  center,
  radius,
  strokeColor,
  fillColor,
  strokeWidth,
}: {
  center: LatLng;
  radius: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}) {
  const map = useContext(MapCtx);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!map) return undefined;
    const c = L.circle([center.latitude, center.longitude], {
      radius,
      color: strokeColor ?? '#4285F4',
      weight: strokeWidth ?? 2,
      fillColor: fillColor ?? strokeColor ?? '#4285F4',
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);
    circleRef.current = c;
    return () => {
      c.remove();
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    circleRef.current?.setLatLng([center.latitude, center.longitude]);
    circleRef.current?.setRadius(radius);
  }, [center.latitude, center.longitude, radius]);

  useEffect(() => {
    circleRef.current?.setStyle({
      color: strokeColor ?? '#4285F4',
      weight: strokeWidth ?? 2,
      fillColor: fillColor ?? strokeColor ?? '#4285F4',
    });
  }, [strokeColor, fillColor, strokeWidth]);

  return null;
}

export function Polyline({
  coordinates,
  strokeColor,
  strokeWidth,
  tappable,
  onPress,
}: {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  tappable?: boolean;
  onPress?: () => void;
}) {
  const map = useContext(MapCtx);
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map) return undefined;
    const p = L.polyline([], {
      color: strokeColor ?? '#4285F4',
      weight: strokeWidth ?? 4,
      interactive: !!tappable,
    }).addTo(map);
    if (tappable && onPress) p.on('click', onPress);
    lineRef.current = p;
    return () => {
      p.remove();
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    lineRef.current?.setLatLngs(coordinates.map((c) => [c.latitude, c.longitude]));
  }, [coordinates]);

  useEffect(() => {
    lineRef.current?.setStyle({ color: strokeColor ?? '#4285F4', weight: strokeWidth ?? 4 });
  }, [strokeColor, strokeWidth]);

  return null;
}
