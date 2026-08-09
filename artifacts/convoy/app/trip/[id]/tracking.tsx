import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetTripQueryKey,
  getGetTripStateQueryKey,
  getListMessagesQueryKey,
  getListTripsQueryKey,
  useEndTrip,
  useGetTrip,
  useGetTripState,
  useLeaveTrip,
  useListMessages,
  usePromoteMember,
  useRemoveMember,
  type MemberState,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { useLocationSharing } from '@/lib/useLocationSharing';
import { useUnread } from '@/lib/useUnread';
import TripMap from '@/components/TripMap';
import PermissionExplainer from '@/components/PermissionExplainer';
import { MemberRow, MemberSheet } from '@/components/members';
import { Banner, Btn, Card } from '@/components/UI';
import { fmtDur, fmtKm } from '@/lib/format';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes },
  ]);
}

export default function Tracking() {
  const c = useColors();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const qc = useQueryClient();

  const state = useGetTripState(tripId, {
    query: { queryKey: getGetTripStateQueryKey(tripId), refetchInterval: 4000 },
  });
  const detail = useGetTrip(tripId, {
    query: { queryKey: getGetTripQueryKey(tripId), staleTime: 60000 },
  });
  const trip = state.data?.trip;
  const isActive = trip?.status === 'active';
  const isEnded = trip?.status === 'ended';

  const { permission, watching, begin } = useLocationSharing(tripId, !!isActive);
  const [explainerDismissed, setExplainerDismissed] = useState(false);
  const [selected, setSelected] = useState<MemberState | null>(null);
  const [focusMemberId, setFocusMemberId] = useState<number | null>(null);

  const messages = useListMessages(tripId, {
    query: {
      queryKey: getListMessagesQueryKey(tripId),
      refetchInterval: isEnded ? false : 5000,
    },
  });
  const me = state.data?.members.find((m) => m.isSelf);
  const { unreadCount } = useUnread(tripId, messages.data, me?.memberId);

  const endTrip = useEndTrip();
  const leaveTrip = useLeaveTrip();
  const promote = usePromoteMember();
  const removeMember = useRemoveMember();

  const sortedMembers = useMemo(() => {
    const list = state.data?.members ? [...state.data.members] : [];
    list.sort((a, b) => a.sortIndex - b.sortIndex);
    return list;
  }, [state.data?.members]);

  // Furthest back = last member that has an on-route position
  const furthestBackId = useMemo(() => {
    const positioned = sortedMembers.filter((m) => m.progressM != null);
    return positioned.length > 1 ? positioned[positioned.length - 1]!.memberId : null;
  }, [sortedMembers]);

  const isViewerLeader = me?.role === 'leader';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetTripStateQueryKey(tripId) });
    qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
  };

  const menu = () => {
    const opts: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: 'Trip details & join code', run: () => router.push(`/trip/${tripId}`) },
    ];
    if (isViewerLeader && isActive) {
      opts.push({
        label: 'End trip for everyone',
        destructive: true,
        run: () =>
          confirm('End the trip?', 'Location sharing stops for everyone immediately.', () =>
            endTrip.mutate({ tripId }, { onSuccess: refresh }),
          ),
      });
    }
    if (!isEnded) {
      opts.push({
        label: 'Leave trip',
        destructive: true,
        run: () =>
          confirm('Leave trip?', 'You will stop sharing and lose access to this trip.', () =>
            leaveTrip.mutate(
              { tripId },
              {
                onSuccess: () => router.replace('/trips'),
                onError: (e) => {
                  const msg = (e as { error?: string })?.error ?? 'Could not leave the trip.';
                  if (Platform.OS === 'web') {
                    // eslint-disable-next-line no-alert
                    window.alert(msg);
                  } else {
                    Alert.alert('Cannot leave', msg);
                  }
                },
              },
            ),
          ),
      });
    }
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      const choice = window.prompt(
        `Menu:\n${opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\n\nEnter a number (or cancel):`,
      );
      const idx = choice ? Number(choice) - 1 : -1;
      if (idx >= 0 && idx < opts.length) opts[idx]!.run();
      return;
    }
    Alert.alert(trip?.name ?? 'Trip', undefined, [
      ...opts.map((o) => ({
        text: o.label,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
        onPress: o.run,
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (!state.data || !trip) {
    return <View style={{ flex: 1, backgroundColor: c.background }} />;
  }

  const showExplainer =
    isActive && permission === 'undetermined' && !explainerDismissed && !watching;
  const showDeniedBanner = isActive && permission === 'denied';
  const showNotSharingBanner =
    isActive && permission === 'undetermined' && explainerDismissed;

  const summary = state.data.summary;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: c.ink,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/trips'))}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={c.inkForeground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.inkForeground }}>
            {trip.name}
          </Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12.5, color: isEnded ? c.inkMuted : c.lime }}>
            {isEnded
              ? 'Trip ended'
              : `${state.data.sharingCount} of ${state.data.joinedCount} sharing`}
          </Text>
        </View>
        <Pressable onPress={() => router.push(`/trip/${tripId}/messages`)} hitSlop={8}>
          <View>
            <Feather name="message-circle" size={22} color={c.inkForeground} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.lime }]}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: c.ink }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={menu} hitSlop={8}>
          <Feather name="more-vertical" size={22} color={c.inkForeground} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={{ flex: 1.35 }}>
        <TripMap
          route={detail.data?.routeGeometry ?? []}
          start={{ lat: trip.startLat, lng: trip.startLng }}
          dest={{ lat: trip.destLat, lng: trip.destLng }}
          members={sortedMembers}
          focusMemberId={focusMemberId}
          onMemberPress={(m) => setSelected(m)}
        />
        {isEnded && summary ? (
          <View style={styles.summaryWrap} pointerEvents="box-none">
            <Card style={{ gap: 10 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: c.foreground }}>
                Trip complete
              </Text>
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: c.foreground }}>
                    {fmtKm(summary.totalDistanceM)}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground }}>
                    route distance
                  </Text>
                </View>
                <View>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: c.foreground }}>
                    {fmtDur(summary.durationS)}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground }}>
                    duration
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.mutedForeground }}>
                {summary.completedNames.length > 0
                  ? `Reached destination: ${summary.completedNames.join(', ')}`
                  : 'Nobody was recorded at the destination.'}
              </Text>
            </Card>
          </View>
        ) : null}
      </View>

      {/* Banners */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 6 }}>
        {showDeniedBanner ? (
          <Banner
            tone="danger"
            text="You're not sharing your location — others can't see you."
            actionTitle="Fix"
            onAction={() => {
              if (Platform.OS !== 'web') {
                Linking.openSettings().catch(() => {});
              } else {
                begin();
              }
            }}
          />
        ) : null}
        {showNotSharingBanner ? (
          <Banner
            tone="warning"
            text="You're watching without sharing your location."
            actionTitle="Share"
            onAction={() => setExplainerDismissed(false)}
          />
        ) : null}
        {isActive && state.data.joinedCount === 1 ? (
          <Banner
            tone="info"
            text="You're the only one here. Share the join code so others can appear on the map."
            actionTitle="Invite"
            onAction={() => router.push(`/trip/${tripId}`)}
          />
        ) : null}
      </View>

      {/* Member list, ordered front-to-back */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={sortedMembers}
          keyExtractor={(m) => String(m.memberId)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 8, paddingTop: 6 }}
          renderItem={({ item }) => (
            <MemberRow
              m={item}
              furthestBack={item.memberId === furthestBackId}
              onPress={() => setSelected(item)}
            />
          )}
        />
      </View>

      {/* Permission explainer BEFORE the OS prompt */}
      {showExplainer ? (
        <PermissionExplainer
          onAllow={async () => {
            setExplainerDismissed(true);
            await begin();
          }}
          onSkip={() => setExplainerDismissed(true)}
        />
      ) : null}

      <MemberSheet
        m={selected}
        isViewerLeader={!!isViewerLeader}
        tripEnded={!!isEnded}
        onClose={() => setSelected(null)}
        onLocate={(m) => {
          setSelected(null);
          setFocusMemberId(null);
          requestAnimationFrame(() => setFocusMemberId(m.memberId));
        }}
        onPromote={(m) =>
          confirm(`Make ${m.name} a leader?`, 'They will be able to manage members and end the trip.', () =>
            promote.mutate(
              { tripId, memberId: m.memberId },
              { onSuccess: () => { setSelected(null); refresh(); } },
            ),
          )
        }
        onRemove={(m) =>
          confirm(`Remove ${m.name}?`, 'They will lose access to this trip immediately.', () =>
            removeMember.mutate(
              { tripId, memberId: m.memberId },
              { onSuccess: () => { setSelected(null); refresh(); } },
            ),
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  summaryWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
  },
});
