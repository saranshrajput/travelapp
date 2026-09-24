import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const STORAGE_KEY = 'rally.drivemode.enabled';

/**
 * Drive Mode: a manually-toggled, low-attention mode for the tracking screen.
 * Owns the persisted on/off preference plus a thin TTS wrapper — expo-speech
 * already queues utterances natively, so `speak` just calls through to it.
 */
export function useDriveMode() {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!cancelled) {
        setEnabledState(raw === '1');
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      try {
        Speech.speak(text);
      } catch {
        // expo-speech may be unsupported in some web environments — never
        // let a TTS failure break the tracking screen.
      }
    },
    [enabled],
  );

  const speakUrgent = useCallback((text: string) => {
    try {
      Speech.stop().finally(() => Speech.speak(text));
    } catch {
      // see note above
    }
  }, []);

  return { enabled: loaded && enabled, setEnabled, speak, speakUrgent };
}
