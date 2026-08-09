import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Safe-area insets with web preview adjustments (the web preview renders
 * inside a phone frame with a notch/home indicator overlay).
 */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') {
    return { ...insets, top: 67, bottom: 34 };
  }
  return insets;
}
