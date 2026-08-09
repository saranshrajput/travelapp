import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from '@/components/map';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetTripQueryKey,
  getListTripsQueryKey,
  useGetTrip,
  useInviteMember,
  useLeaveTrip,
  usePromoteMember,
  useRemoveMember,
  useStartTrip,
  type Member,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { Avatar, Btn, Card, Field, SectionLabel } from '@/components/UI';
import { fmtDate, fmtDur, fmtKm } from '@/lib/format';

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

export default function TripLobby() {
  const c = useColors();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const qc = useQueryClient();
  const detail = useGetTrip(tripId, {
    query: { queryKey: getGetTripQueryKey(tripId), refetchInterval: 5000 },
  });
  const startTrip = useStartTrip();
  const leaveTrip = useLeaveTrip();
  const invite = useInviteMember();
  const promote = usePromoteMember();
  const removeMember = useRemoveMember();
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const d = detail.data;
  const isLeader = d?.myRole === 'leader';

  // Active/ended trips live on the tracking screen
  useEffect(() => {
    if (d && d.trip.status !== 'draft') {
      router.replace(`/trip/${tripId}/tracking`);
    }
  }, [d, tripId]);

  if (!d) {
    return <View style={{ flex: 1, backgroundColor: c.background }} />;
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
    qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
  };

  const shareCode = async () => {
    const msg = `Join my trip "${d.trip.name}" on Rally!\n\nOpen https://${process.env.EXPO_PUBLIC_DOMAIN}/join?code=${d.trip.joinCode} or enter code: ${d.trip.joinCode}`;
    if (Platform.OS === 'web') {
      if (navigator.share) {
        navigator.share({ text: msg }).catch(() => {});
      } else {
        await navigator.clipboard?.writeText(msg);
        // eslint-disable-next-line no-alert
        window.alert('Invite copied to clipboard');
      }
      return;
    }
    Share.share({ message: msg }).catch(() => {});
  };

  const memberActions = (m: Member) => {
    if (!isLeader || m.isSelf) return;
    const opts: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (m.role !== 'leader' && m.joinStatus === 'joined') {
      opts.push({
        label: `Make ${m.name} a leader`,
        run: () =>
          promote.mutate(
            { tripId, memberId: m.id },
            { onSuccess: refresh, onError: () => setActionError('Could not promote member.') },
          ),
      });
    }
    opts.push({
      label: `Remove ${m.name} from trip`,
      destructive: true,
      run: () =>
        removeMember.mutate(
          { tripId, memberId: m.id },
          {
            onSuccess: refresh,
            onError: (e) =>
              setActionError(
                (e as { error?: string })?.error ?? 'Could not remove member.',
              ),
          },
        ),
    });
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      const choice = window.prompt(
        `${m.name}:\n${opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\n\nEnter a number (or cancel):`,
      );
      const idx = choice ? Number(choice) - 1 : -1;
      if (idx >= 0 && idx < opts.length) opts[idx]!.run();
      return;
    }
    Alert.alert(m.name, undefined, [
      ...opts.map((o) => ({
        text: o.label,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
        onPress: o.run,
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const doLeave = () => {
    confirm('Leave trip?', 'You will stop seeing this trip and it will disappear from your list.', () =>
      leaveTrip.mutate(
        { tripId },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
            router.replace('/trips');
          },
          onError: (e) =>
            setActionError(
              (e as { error?: string })?.error ?? 'Could not leave the trip.',
            ),
        },
      ),
    );
  };

  const doStart = () => {
    confirm('Start the trip?', 'Everyone will be asked to share their live location.', () =>
      startTrip.mutate(
        { tripId },
        {
          onSuccess: () => router.replace(`/trip/${tripId}/tracking`),
          onError: () => setActionError('Could not start the trip.'),
        },
      ),
    );
  };

  const route = d.routeGeometry;
  const region = {
    latitude: (d.trip.startLat + d.trip.destLat) / 2,
    longitude: (d.trip.startLng + d.trip.destLng) / 2,
    latitudeDelta: Math.abs(d.trip.startLat - d.trip.destLat) * 1.6 + 0.05,
    longitudeDelta: Math.abs(d.trip.startLng - d.trip.destLng) * 1.6 + 0.05,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/trips'))} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
              {d.trip.name}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.mutedForeground }}>
              Trip plan · not started yet
            </Text>
          </View>
          {isLeader ? (
            <Pressable onPress={() => router.push(`/create-trip?editTripId=${tripId}`)} hitSlop={8}>
              <Feather name="edit-2" size={19} color={c.foreground} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ height: 200, borderRadius: c.radius, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          <MapView style={StyleSheet.absoluteFill} initialRegion={region} pointerEvents="none">
            {route.length > 1 ? (
              <Polyline
                coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={c.mapRoute}
                strokeWidth={4}
              />
            ) : null}
            <Marker coordinate={{ latitude: d.trip.startLat, longitude: d.trip.startLng }} pinColor={c.statusMoving} />
            <Marker coordinate={{ latitude: d.trip.destLat, longitude: d.trip.destLng }} pinColor={c.destructive} />
          </MapView>
        </View>

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="flag" size={15} color={c.mutedForeground} />
            <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }}>
              {d.trip.startLabel} → {d.trip.destLabel}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.mutedForeground }}>
            {fmtKm(d.trip.routeDistanceM)} · about {fmtDur(d.trip.routeDurationS)} driving
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13.5, color: c.mutedForeground }}>
            Leaving {fmtDate(d.trip.scheduledAt)}
          </Text>
        </Card>

        <Card style={{ gap: 10, backgroundColor: c.ink, borderColor: c.ink }}>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.inkMuted }}>
            Share this code to invite people
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: 5, color: c.lime }}>
              {d.trip.joinCode}
            </Text>
            <Btn title="Share" icon="share-2" small onPress={shareCode} />
          </View>
        </Card>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SectionLabel>Members ({d.members.length})</SectionLabel>
            </View>
            {isLeader ? (
              <Pressable onPress={() => setShowInvite((v) => !v)} hitSlop={8} style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.tint }}>
                  {showInvite ? 'Close' : '+ Add by phone'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {showInvite ? (
            <Card style={{ gap: 10 }}>
              <Field placeholder="Phone number" value={invitePhone} onChangeText={setInvitePhone} keyboardType="phone-pad" />
              <Field placeholder="Name (optional)" value={inviteName} onChangeText={setInviteName} />
              <Btn
                title="Add to trip"
                small
                loading={invite.isPending}
                onPress={() => {
                  if (invitePhone.trim().length < 8) {
                    setActionError('Enter a valid phone number to invite.');
                    return;
                  }
                  setActionError(null);
                  invite.mutate(
                    { tripId, data: { phone: invitePhone.trim(), name: inviteName.trim() || undefined } },
                    {
                      onSuccess: () => {
                        setInvitePhone('');
                        setInviteName('');
                        setShowInvite(false);
                        refresh();
                      },
                      onError: (e) =>
                        setActionError((e as { error?: string })?.error ?? 'Could not add member.'),
                    },
                  );
                }}
              />
            </Card>
          ) : null}

          <Card style={{ padding: 6 }}>
            {d.members.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => memberActions(m)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderBottomWidth: i < d.members.length - 1 ? 1 : 0,
                  borderBottomColor: c.border,
                }}
              >
                <Avatar color={m.color} initial={m.initial} size={34} badge={m.role === 'leader' ? 'leader' : undefined} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: c.foreground }}>
                    {m.name}
                    {m.isSelf ? ' (you)' : ''}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground }}>
                    {m.role === 'leader' ? 'Leader · ' : ''}
                    {m.joinStatus === 'joined' ? 'Joined' : 'Invited — waiting to join'}
                  </Text>
                </View>
                {isLeader && !m.isSelf ? (
                  <Feather name="more-horizontal" size={18} color={c.mutedForeground} />
                ) : null}
              </Pressable>
            ))}
          </Card>
        </View>

        {actionError ? (
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.destructive }}>
            {actionError}
          </Text>
        ) : null}

        {isLeader ? (
          <Btn title="Start trip" icon="play" onPress={doStart} loading={startTrip.isPending} />
        ) : (
          <Card style={{ backgroundColor: c.accent, borderColor: c.accent }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.accentForeground }}>
              Waiting for the leader to start the trip. You'll share your live location once it begins.
            </Text>
          </Card>
        )}
        <Btn title="Leave trip" icon="log-out" variant="ghost" onPress={doLeave} />
      </ScrollView>
    </View>
  );
}
