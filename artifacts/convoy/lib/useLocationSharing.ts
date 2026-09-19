import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { usePostLocation, useSetSharing } from '@workspace/api-client-react';

type QueuedFix = {
  lat: number;
  lng: number;
  recordedAt: string;
  speedMps: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
};

const QUEUE_KEY_PREFIX = 'rally.locationQueue.';

// Only the most recent fix is kept — for a live tracker, an older queued
// position has no value once a newer one exists, and the server only stores
// the latest + previous fix anyway.
async function saveQueuedFix(tripId: number, fix: QueuedFix): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY_PREFIX + tripId, JSON.stringify(fix));
  } catch {
    // best-effort — losing the queued fix just means one fewer retry on reconnect
  }
}
async function loadQueuedFix(tripId: number): Promise<QueuedFix | null> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY_PREFIX + tripId);
    return raw ? (JSON.parse(raw) as QueuedFix) : null;
  } catch {
    return null;
  }
}
async function clearQueuedFix(tripId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY_PREFIX + tripId);
  } catch {
    // ignore
  }
}

export type SharePermission = 'unknown' | 'undetermined' | 'granted' | 'denied';

type WatchMode = 'active' | 'idle';

// Mirrors the server's STOPPED_AFTER_S threshold (artifacts/api-server/src/lib/convoy.ts)
// so the client throttles down roughly when the server would also mark you "stopped".
const STATIONARY_AFTER_MS = 3 * 60 * 1000;
const MOVING_SPEED_MPS = 1; // ~3.6 km/h — below this we don't count it as "moving"
const MOVED_DISTANCE_M = 25; // fallback movement check when speed isn't reported (e.g. some web browsers)

const MODE_CONFIG: Record<
  WatchMode,
  { postIntervalMs: number; timeIntervalMs: number; distanceIntervalM: number; accuracy: Location.Accuracy }
> = {
  active: {
    postIntervalMs: 4000,
    timeIntervalMs: 4000,
    distanceIntervalM: 15,
    accuracy: Location.Accuracy.Balanced,
  },
  idle: {
    postIntervalMs: 15000,
    timeIntervalMs: 15000,
    distanceIntervalM: 50,
    accuracy: Location.Accuracy.Low,
  },
};

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Foreground location sharing for an active trip.
 *
 * Never triggers the OS permission prompt by itself — call `begin()` from
 * the in-app explainer. If permission was already granted earlier, it
 * starts watching automatically.
 *
 * Battery-aware: once the device looks stationary for as long as the
 * server's "stopped" threshold, GPS polling backs off to a slower,
 * lower-accuracy cadence, and snaps back to the fast cadence the moment
 * movement resumes.
 */
export function useLocationSharing(tripId: number, enabled: boolean) {
  const [permission, setPermission] = useState<SharePermission>('unknown');
  const [watching, setWatching] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const postLocation = usePostLocation();
  const setSharing = useSetSharing();
  const lastPostRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const modeRef = useRef<WatchMode>('active');
  const lastCoordRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const lastMovementAtRef = useRef<number>(Date.now());
  const restartingRef = useRef(false);

  // Forward-declared so startWatching (mode-aware) and handleFix can reference
  // each other without a circular hook-ordering problem.
  const startWatchingRef = useRef<(mode: WatchMode) => Promise<void>>(async () => {});

  const evaluateMode = useCallback(
    (lat: number, lng: number, speed: number | null, now: number): WatchMode => {
      const prev = lastCoordRef.current;
      let moving = false;
      if (speed != null && speed >= 0) {
        moving = speed >= MOVING_SPEED_MPS;
      } else if (prev) {
        const dtS = (now - prev.at) / 1000;
        if (dtS > 0) {
          const distM = haversineM(prev, { lat, lng });
          moving = distM / dtS >= MOVING_SPEED_MPS || distM >= MOVED_DISTANCE_M;
        }
      } else {
        moving = true; // first fix — assume active until proven stationary
      }
      lastCoordRef.current = { lat, lng, at: now };
      if (moving) lastMovementAtRef.current = now;
      const stationaryForMs = now - lastMovementAtRef.current;
      return stationaryForMs >= STATIONARY_AFTER_MS ? 'idle' : 'active';
    },
    [],
  );

  const sendFix = useCallback(
    (lat: number, lng: number, speed: number | null, heading: number | null, accuracy: number | null) => {
      const now = Date.now();
      const desiredMode = evaluateMode(lat, lng, speed, now);
      if (desiredMode !== modeRef.current && !restartingRef.current) {
        modeRef.current = desiredMode;
        restartingRef.current = true;
        Promise.resolve(startWatchingRef.current(desiredMode)).finally(() => {
          restartingRef.current = false;
        });
      }

      const postIntervalMs = MODE_CONFIG[modeRef.current].postIntervalMs;
      if (now - lastPostRef.current < postIntervalMs) return;
      lastPostRef.current = now;
      if (!enabledRef.current) return;

      const data: QueuedFix = {
        lat,
        lng,
        recordedAt: new Date().toISOString(),
        speedMps: speed != null && speed >= 0 ? speed : null,
        headingDeg: heading != null && heading >= 0 ? heading : null,
        accuracyM: accuracy,
      };
      postLocation.mutate(
        { tripId, data },
        {
          // Network drop (or a signal gap) — hold onto this fix instead of
          // silently dropping it, and retry once connectivity returns.
          onError: () => {
            saveQueuedFix(tripId, data);
          },
        },
      );
    },
    [evaluateMode, postLocation, tripId],
  );

  // Track connectivity and flush any queued fix the moment it returns.
  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync()
      .then((s) => {
        if (mounted) setIsOnline(s.isConnected ?? true);
      })
      .catch(() => {});
    const sub = Network.addNetworkStateListener((s) => {
      if (mounted) setIsOnline(s.isConnected ?? true);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !enabled) return;
    let cancelled = false;
    (async () => {
      const queued = await loadQueuedFix(tripId);
      if (!queued || cancelled) return;
      postLocation.mutate(
        { tripId, data: queued },
        {
          onSuccess: () => clearQueuedFix(tripId),
          // Still offline / another transient failure — leave it queued for the next flush attempt.
        },
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, enabled, tripId]);

  const startWatching = useCallback(
    async (mode: WatchMode) => {
      // Tear down any existing watcher before starting one with new settings.
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      const cfg = MODE_CONFIG[mode];
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
          { enableHighAccuracy: mode === 'active', maximumAge: cfg.timeIntervalMs / 2, timeout: 20000 },
        );
        stopRef.current = () => navigator.geolocation.clearWatch(id);
        return;
      }
      const sub = await Location.watchPositionAsync(
        {
          accuracy: cfg.accuracy,
          timeInterval: cfg.timeIntervalMs,
          distanceInterval: cfg.distanceIntervalM,
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
    },
    [sendFix],
  );
  startWatchingRef.current = startWatching;

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
      modeRef.current = 'active';
      lastMovementAtRef.current = Date.now();
      lastCoordRef.current = null;
      startWatching('active');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, permission]);

  /** Trigger the OS prompt (call only after showing the in-app explainer). */
  const begin = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // The browser prompt appears on first watch/get call.
      await startWatching('active');
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

  return { permission, watching, begin, isOnline };
}
