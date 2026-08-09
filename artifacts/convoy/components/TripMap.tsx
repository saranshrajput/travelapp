import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type MapHandle } from '@/components/map';
import { Feather } from '@expo/vector-icons';
import type { MemberState } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Avatar } from '@/components/UI';

type LatLng = { latitude: number; longitude: number };

function toLatLng(p: { lat: number; lng: number }): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

export function memberBadge(m: MemberState): 'leader' | 'stopped' | 'off' | undefined {
  if (m.status === 'stopped') return 'stopped';
  if (m.status === 'not_updating') return 'off';
  if (m.role === 'leader') return 'leader';
  return undefined;
}

export default function TripMap({
  route,
  start,
  dest,
  members = [],
  onMemberPress,
  focusMemberId,
  children,
}: {
  route: { lat: number; lng: number }[];
  start?: { lat: number; lng: number };
  dest: { lat: number; lng: number };
  members?: MemberState[];
  onMemberPress?: (m: MemberState) => void;
  focusMemberId?: number | null;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const mapRef = useRef<MapHandle>(null);
  const [autoFrame, setAutoFrame] = useState(true);
  const framedOnce = useRef(false);

  const frame = useCallback(() => {
    const coords: LatLng[] = [];
    for (const m of members) {
      if (m.lat != null && m.lng != null && m.status !== 'not_sharing') {
        coords.push({ latitude: m.lat, longitude: m.lng });
      }
    }
    coords.push(toLatLng(dest));
    if (coords.length < 2 && route.length > 0) {
      coords.push(toLatLng(route[0]!));
    }
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 70, right: 60, bottom: 70, left: 60 },
      animated: true,
    });
  }, [members, dest, route]);

  useEffect(() => {
    if (autoFrame) {
      const t = setTimeout(frame, framedOnce.current ? 400 : 900);
      framedOnce.current = true;
      return () => clearTimeout(t);
    }
    return undefined;
  }, [frame, autoFrame]);

  useEffect(() => {
    if (focusMemberId != null) {
      const m = members.find((x) => x.memberId === focusMemberId);
      if (m && m.lat != null && m.lng != null) {
        setAutoFrame(false);
        mapRef.current?.animateToRegion(
          { latitude: m.lat, longitude: m.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          500,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemberId]);

  const initialRegion = {
    latitude: dest.lat,
    longitude: dest.lng,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef as React.Ref<never>}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onPanDrag={() => setAutoFrame(false)}
        toolbarEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {route.length > 1 ? (
          <Polyline
            coordinates={route.map(toLatLng)}
            strokeColor={c.mapRoute}
            strokeWidth={4}
          />
        ) : null}
        {start ? (
          <Marker coordinate={toLatLng(start)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.startDot, { borderColor: c.mapRoute }]} />
          </Marker>
        ) : null}
        <Marker coordinate={toLatLng(dest)} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.destWrap}>
            <View style={[styles.destPin, { backgroundColor: c.ink }]}>
              <Feather name="flag" size={13} color={c.lime} />
            </View>
            <View style={[styles.destStem, { backgroundColor: c.ink }]} />
          </View>
        </Marker>
        {members.map((m) => {
          if (m.lat == null || m.lng == null) return null;
          const dimmed = m.status === 'not_updating';
          const grey = m.status === 'not_sharing';
          return (
            <Marker
              key={m.memberId}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onMemberPress?.(m)}
              zIndex={m.isSelf ? 10 : 1}
            >
              <Avatar
                color={grey ? c.statusStale : m.color}
                initial={m.initial}
                size={m.isSelf ? 40 : 34}
                dimmed={dimmed}
                ringColor={m.isSelf ? c.mapRoute : m.role === 'leader' ? c.ink : undefined}
                badge={memberBadge(m)}
              />
            </Marker>
          );
        })}
        {children}
      </MapView>
      {!autoFrame ? (
        <Pressable
          onPress={() => setAutoFrame(true)}
          style={[styles.recentre, { backgroundColor: c.ink, borderRadius: c.radius }]}
        >
          <Feather name="crosshair" size={15} color={c.lime} />
          <Text style={{ color: c.inkForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            Recentre
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 4,
  },
  destWrap: { alignItems: 'center' },
  destPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destStem: { width: 3, height: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  recentre: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
