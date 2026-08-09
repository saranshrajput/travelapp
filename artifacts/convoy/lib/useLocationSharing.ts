import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { usePostLocation, useSetSharing } from '@workspace/api-client-react';

export type SharePermission = 'unknown' | 'undetermined' | 'granted' | 'denied';

const POST_INTERVAL_MS = 4000;

/**
 * Foreground location sharing for an active trip.
 *
 * Never triggers the OS permission prompt by itself — call `begin()` from
 * the in-app explainer. If permission was already granted earlier, it
 * starts watching automatically.
 */
export function useLocationSharing(tripId: number, enabled: boolean) {
  const [permission, setPermission] = useState<SharePermission>('unknown');
  const [watching, setWatching] = useState(false);
  const postLocation = usePostLocation();
  const setSharing = useSetSharing();
  const lastPostRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const sendFix = useCallback(
    (lat: number, lng: number, speed: number | null, heading: number | null, accuracy: number | null) => {
      const now = Date.now();
      if (now - lastPostRef.current < POST_INTERVAL_MS) return;
      lastPostRef.current = now;
      if (!enabledRef.current) return;
      postLocation.mutate({
        tripId,
        data: {
          lat,
          lng,
          recordedAt: new Date().toISOString(),
          speedMps: speed != null && speed >= 0 ? speed : null,
          headingDeg: heading != null && heading >= 0 ? heading : null,
          accuracyM: accuracy,
        },
      });
    },
    [postLocation, tripId],
  );

  const startWatching = useCallback(async () => {
    if (stopRef.current) return;
    if (Platform.OS === 'web') {
      if (!('geolocation' in navigator)) {
        setPermission('denied');
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setPermission('granted');
          setWatching(true);
          sendFix(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.speed,
            pos.coords.heading,
            pos.coords.accuracy,
          );
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setPermission('denied');
            setWatching(false);
          }
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
      );
      stopRef.current = () => navigator.geolocation.clearWatch(id);
      return;
    }
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: POST_INTERVAL_MS,
        distanceInterval: 15,
      },
      (pos) => {
        setWatching(true);
        sendFix(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed,
          pos.coords.heading,
          pos.coords.accuracy,
        );
      },
    );
    stopRef.current = () => sub.remove();
  }, [sendFix]);

  // Determine current permission without prompting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'web') {
        try {
          const nav = navigator as Navigator & {
            permissions?: { query: (o: { name: string }) => Promise<{ state: string }> };
          };
          if (nav.permissions) {
            const st = await nav.permissions.query({ name: 'geolocation' });
            if (!cancelled) {
              setPermission(
                st.state === 'granted' ? 'granted' : st.state === 'denied' ? 'denied' : 'undetermined',
              );
            }
            return;
          }
        } catch {
          // fall through
        }
        if (!cancelled) setPermission('undetermined');
        return;
      }
      const st = await Location.getForegroundPermissionsAsync();
      if (!cancelled) {
        setPermission(st.granted ? 'granted' : st.canAskAgain ? 'undetermined' : 'denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Start/stop the watcher.
  useEffect(() => {
    if (enabled && permission === 'granted') {
      startWatching();
    }
    if (!enabled && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
      setWatching(false);
    }
    return () => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
  }, [enabled, permission, startWatching]);

  /** Trigger the OS prompt (call only after showing the in-app explainer). */
  const begin = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // The browser prompt appears on first watch/get call.
      await startWatching();
      return true;
    }
    const st = await Location.requestForegroundPermissionsAsync();
    if (st.granted) {
      setPermission('granted');
      return true;
    }
    setPermission('denied');
    if (enabledRef.current) {
      setSharing.mutate({ tripId, data: { sharing: false } });
    }
    return false;
  }, [startWatching, setSharing, tripId]);

  return { permission, watching, begin };
}
