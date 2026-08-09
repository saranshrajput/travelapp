import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Btn } from '@/components/UI';

/**
 * Plain-language explainer shown BEFORE the OS location prompt.
 * Rendered as a full-screen overlay on the tracking screen.
 */
export default function PermissionExplainer({
  onAllow,
  onSkip,
}: {
  onAllow: () => void;
  onSkip: () => void;
}) {
  const c = useColors();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, padding: 28, justifyContent: 'center' }]}>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: 'rgba(198,232,78,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="map-pin" size={38} color={c.lime} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 24,
            color: c.inkForeground,
            textAlign: 'center',
          }}
        >
          Share your location with your group
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 15.5,
            lineHeight: 23,
            color: c.inkMuted,
            textAlign: 'center',
          }}
        >
          Rally shows everyone in this trip where you are, so nobody gets left behind.
          Your location is shared only while this trip is running and only with people
          on the trip. It stops the moment the trip ends or you leave.
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 13.5,
            color: c.inkMuted,
            textAlign: 'center',
          }}
        >
          Keep the app open while travelling — sharing pauses when the app is closed.
        </Text>
      </View>
      <View style={{ gap: 12, marginTop: 34 }}>
        <Btn title="Share my location" icon="navigation" onPress={onAllow} />
        <Btn title="Not now — just watch the map" variant="ghost" onPress={onSkip} />
      </View>
    </View>
  );
}
