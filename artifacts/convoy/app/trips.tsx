import React, { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getListTripsQueryKey,
  useListTrips,
  type TripSummary,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSession, getSessionToken } from '@/lib/session';
import { useScreenInsets } from '@/lib/insets';
import { Btn, Card, EmptyState, SectionLabel } from '@/components/UI';
import { fmtDate, fmtKm } from '@/lib/format';

function TripCard({ s }: { s: TripSummary }) {
  const c = useColors();
  const t = s.trip;
  const isActive = t.status === 'active';
  const open = () => {
    router.push(isActive || t.status === 'ended' ? `/trip/${t.id}/tracking` : `/trip/${t.id}`);
  };
  return (
    <Pressable onPress={open}>
      {({ pressed }) => (
        <Card style={{ gap: 8, opacity: pressed ? 0.85 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.foreground, flex: 1 }}
            >
              {t.name}
            </Text>
            {isActive ? (
              <View style={[styles.liveTag, { backgroundColor: '#E6F4EA' }]}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.statusMoving }} />
                <Text style={{ color: c.statusMoving, fontFamily: 'Inter_700Bold', fontSize: 11 }}>
                  LIVE · {s.sharingCount} sharing
                </Text>
              </View>
            ) : s.myRole === 'leader' ? (
              <View style={[styles.liveTag, { backgroundColor: c.accent }]}>
                <Text style={{ color: c.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>
                  LEADER
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="flag" size={13} color={c.mutedForeground} />
            <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.mutedForeground, flex: 1 }}>
              {t.destLabel} · {fmtKm(t.routeDistanceM)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="clock" size={13} color={c.mutedForeground} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: c.mutedForeground }}>
              {fmtDate(t.scheduledAt)} · {s.memberCount} {s.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

async function createDemoTrip(): Promise<number> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE}/demo/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Demo creation failed: ${res.status}`);
  const data = (await res.json()) as { tripId: number };
  return data.tripId;
}

export default function Trips() {
  const c = useColors();
  const insets = useScreenInsets();
  const { user, signOut } = useSession();
  const [showPast, setShowPast] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const trips = useListTrips({
    query: { queryKey: getListTripsQueryKey(), refetchInterval: 10000 },
  });

  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      const tripId = await createDemoTrip();
      await trips.refetch();
      router.push(`/trip/${tripId}/tracking`);
    } catch {
      Alert.alert('Demo unavailable', 'Could not start the demo right now. Try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      trips.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const list = trips.data ?? [];
  const active = list.filter((s) => s.trip.status === 'active');
  const upcoming = list.filter((s) => s.trip.status === 'draft');
  const past = list.filter((s) => s.trip.status === 'ended');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          backgroundColor: c.ink,
          paddingTop: insets.top + 10,
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={[styles.miniLogo, { backgroundColor: c.lime }]}>
          <Feather name="navigation" size={15} color={c.ink} />
        </View>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: c.inkForeground, flex: 1 }}>
          My Trips
        </Text>
        <Pressable
          onPress={() => {
            signOut().then(() => router.replace('/signin'));
          }}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.inkMuted }}>
            {user?.name?.split(' ')[0]}
          </Text>
          <Feather name="log-out" size={16} color={c.inkMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={trips.isRefetching} onRefresh={() => trips.refetch()} />
        }
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn
            title="Create trip"
            icon="plus"
            style={{ flex: 1 }}
            onPress={() => router.push('/create-trip')}
          />
          <Btn
            title="Join"
            icon="hash"
            variant="outline"
            onPress={() => router.push('/join')}
          />
        </View>

        {/* Demo banner */}
        <Pressable
          onPress={handleTryDemo}
          disabled={demoLoading}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: c.radius,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.lime,
            backgroundColor: pressed ? '#F0FBF0' : 'transparent',
            opacity: demoLoading ? 0.6 : 1,
          })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="play" size={16} color={c.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.foreground }}>
              {demoLoading ? 'Starting demo…' : 'Try a live demo'}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground, marginTop: 1 }}>
              4 riders · Bangalore → Mysore · moves in real-time
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={c.mutedForeground} />
        </Pressable>

        {trips.isLoading ? null : list.length === 0 ? (
          <EmptyState
            icon="map"
            title="No trips yet"
            subtitle="Create a trip and share the join code, or ask your trip leader for theirs."
          />
        ) : (
          <View style={{ gap: 18, marginTop: 6 }}>
            {active.length > 0 ? (
              <View style={{ gap: 10 }}>
                <SectionLabel>Happening now</SectionLabel>
                {active.map((s) => (
                  <TripCard key={s.trip.id} s={s} />
                ))}
              </View>
            ) : null}
            {upcoming.length > 0 ? (
              <View style={{ gap: 10 }}>
                <SectionLabel>Upcoming</SectionLabel>
                {upcoming.map((s) => (
                  <TripCard key={s.trip.id} s={s} />
                ))}
              </View>
            ) : null}
            {past.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setShowPast((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <SectionLabel>
                    Past trips ({past.length})
                  </SectionLabel>
                  <Feather
                    name={showPast ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={c.mutedForeground}
                    style={{ marginBottom: 8 }}
                  />
                </Pressable>
                {showPast ? past.map((s) => <TripCard key={s.trip.id} s={s} />) : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  miniLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
