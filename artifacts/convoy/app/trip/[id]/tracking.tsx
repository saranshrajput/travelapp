import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetTripHistoryQueryKey,
  getGetTripQueryKey,
  getGetTripStateQueryKey,
  getListMessagesQueryKey,
  getListSafeZonesQueryKey,
  getListTripsQueryKey,
  getSearchPlacesQueryKey,
  useCreateSafeZone,
  useDropPitstop,
  useCancelPitstop,
  useRespondToPitstop,
  useEndTrip,
  useGetTrip,
  useGetTripHistory,
  useGetTripState,
  useLeaveTrip,
  useListMessages,
  useListSafeZones,
  usePromoteMember,
  useRemoveMember,
  useRemoveSafeZone,
  useSearchPlaces,
  useSetHistoryOptIn,
  useTriggerSos,
  type MemberState,
  type Pitstop,
  type Place,
  type SafeZone,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { useLocationSharing } from '@/lib/useLocationSharing';
import { useUnread } from '@/lib/useUnread';
import { useDriveMode } from '@/lib/useDriveMode';
import TripMap from '@/components/TripMap';
import PermissionExplainer from '@/components/PermissionExplainer';
import { MemberRow, MemberSheet } from '@/components/members';
import { Banner, Btn, Card } from '@/components/UI';
import { fmtDur, fmtKm } from '@/lib/format';

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

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

function PitstopBanner({
  pitstop,
  isLeader,
  myMemberId,
  onRespond,
  onCancel,
}: {
  pitstop: Pitstop;
  isLeader: boolean;
  myMemberId: number | undefined;
  onRespond: (r: 'on_my_way' | 'already_there') => void;
  onCancel: () => void;
}) {
  const c = useColors();
  const myResponse = pitstop.responses.find((r) => r.memberId === myMemberId);
  const onMyWayCount = pitstop.responses.filter((r) => r.response === 'on_my_way').length;
  const alreadyThereCount = pitstop.responses.filter((r) => r.response === 'already_there').length;

  return (
    <View
      style={[
        styles.pitstopBanner,
        { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Feather name="coffee" size={14} color="#92400E" />
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13.5, color: '#92400E' }}>
            Pitstop{pitstop.label ? `: ${pitstop.label}` : ''}
          </Text>
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#78350F' }}>
          Dropped by {pitstop.droppedByName}
          {(onMyWayCount + alreadyThereCount) > 0
            ? ` · ${onMyWayCount} on the way, ${alreadyThereCount} there`
            : ''}
        </Text>
        {!isLeader && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => onRespond('on_my_way')}
              style={[
                styles.pitstopBtn,
                {
                  backgroundColor: myResponse?.response === 'on_my_way' ? '#F59E0B' : '#fff',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12,
                  color: myResponse?.response === 'on_my_way' ? '#fff' : '#92400E',
                }}
              >
                On my way
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRespond('already_there')}
              style={[
                styles.pitstopBtn,
                {
                  backgroundColor: myResponse?.response === 'already_there' ? '#F59E0B' : '#fff',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 12,
                  color: myResponse?.response === 'already_there' ? '#fff' : '#92400E',
                }}
              >
                Already there
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {isLeader && (
        <Pressable onPress={onCancel} style={{ padding: 4 }} hitSlop={8}>
          <Feather name="x" size={18} color="#92400E" />
        </Pressable>
      )}
    </View>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);
  return debounced;
}

function DropPitstopModal({
  visible,
  onClose,
  onDrop,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onDrop: (label: string, point: { lat: number; lng: number } | null) => void;
  loading: boolean;
}) {
  const c = useColors();
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const debouncedText = useDebounce(text.trim(), 400);
  const search = useSearchPlaces(
    { q: debouncedText },
    {
      query: {
        queryKey: getSearchPlacesQueryKey({ q: debouncedText }),
        enabled: !selected && debouncedText.length >= 3,
        staleTime: 60000,
      },
    },
  );
  const showSuggestions =
    !selected && text.trim() === debouncedText && !!search.data && search.data.length > 0;

  const handleClose = () => {
    setText('');
    setSelected(null);
    onClose();
  };

  const handleDrop = () => {
    onDrop(selected?.label ?? text.trim(), selected ? { lat: selected.lat, lng: selected.lng } : null);
    setText('');
    setSelected(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalOverlay} onPress={handleClose} />
        <View style={[styles.modalSheet, { backgroundColor: c.background }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Feather name="coffee" size={18} color="#F59E0B" />
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 17,
                color: c.foreground,
                marginLeft: 8,
                flex: 1,
              }}
            >
              Drop Pitstop
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13.5, color: c.mutedForeground, marginBottom: 12 }}>
            Search for a place, or leave blank to pin your current location.
          </Text>
          <TextInput
            placeholder="Search a place (e.g. Dhaba, Petrol pump…)"
            placeholderTextColor={c.mutedForeground}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setSelected(null);
            }}
            style={[
              styles.input,
              {
                backgroundColor: c.card,
                color: c.foreground,
                borderColor: c.border,
                marginBottom: showSuggestions ? 8 : 16,
              },
            ]}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleDrop}
          />
          {showSuggestions ? (
            <Card style={{ padding: 4, gap: 0, marginBottom: 16 }}>
              {search.data!.slice(0, 5).map((p: Place, i: number) => (
                <Pressable
                  key={`${p.lat}-${p.lng}-${i}`}
                  onPress={() => {
                    setSelected({ lat: p.lat, lng: p.lng, label: p.label });
                    setText(p.label);
                  }}
                  style={({ pressed }) => ({
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: pressed ? c.muted : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Feather name="map-pin" size={14} color={c.mutedForeground} />
                  <Text
                    numberOfLines={2}
                    style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.foreground }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
          <Btn
            title={loading ? 'Dropping…' : selected ? 'Drop pitstop at this place' : 'Drop pitstop at current location'}
            onPress={handleDrop}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ZONE_RADIUS_PRESETS = [100, 300, 1000];

function AddSafeZoneModal({
  visible,
  onClose,
  onCreate,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (label: string, radiusM: number) => void;
  loading: boolean;
}) {
  const c = useColors();
  const [label, setLabel] = useState('');
  const [radiusM, setRadiusM] = useState(ZONE_RADIUS_PRESETS[1]!);

  const handleCreate = () => {
    onCreate(label.trim(), radiusM);
    setLabel('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: c.background }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Feather name="shield" size={18} color="#00897B" />
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 17,
              color: c.foreground,
              marginLeft: 8,
              flex: 1,
            }}
          >
            Add Safe Zone
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={c.mutedForeground} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13.5, color: c.mutedForeground, marginBottom: 12 }}>
          Centered on your current location. The group gets notified when a member enters or leaves —
          this only works while their app is open (foreground tracking, no background permission).
        </Text>
        <TextInput
          placeholder="Label (optional, e.g. Toll gate, Rest area…)"
          placeholderTextColor={c.mutedForeground}
          value={label}
          onChangeText={setLabel}
          style={[
            styles.input,
            { backgroundColor: c.card, color: c.foreground, borderColor: c.border },
          ]}
          maxLength={60}
          returnKeyType="done"
        />
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.mutedForeground, marginBottom: 8 }}>
          Radius
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {ZONE_RADIUS_PRESETS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadiusM(r)}
              style={[
                styles.radiusChip,
                {
                  backgroundColor: radiusM === r ? '#00897B' : c.card,
                  borderColor: radiusM === r ? '#00897B' : c.border,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 13,
                  color: radiusM === r ? '#fff' : c.foreground,
                }}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </Text>
            </Pressable>
          ))}
        </View>
        <Btn title={loading ? 'Creating…' : 'Create safe zone here'} onPress={handleCreate} />
      </View>
    </Modal>
  );
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

  const { permission, watching, begin, isOnline } = useLocationSharing(tripId, !!isActive);
  const [explainerDismissed, setExplainerDismissed] = useState(false);
  const [selected, setSelected] = useState<MemberState | null>(null);
  const [focusMemberId, setFocusMemberId] = useState<number | null>(null);
  const [showDropPitstop, setShowDropPitstop] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);

  const safeZones = useListSafeZones(tripId, {
    query: { queryKey: getListSafeZonesQueryKey(tripId), refetchInterval: isEnded ? false : 15000 },
  });

  const messages = useListMessages(tripId, {
    query: {
      queryKey: getListMessagesQueryKey(tripId),
      refetchInterval: isEnded ? false : 5000,
    },
  });
  const me = state.data?.members.find((m) => m.isSelf);
  const { unreadCount } = useUnread(tripId, messages.data, me?.memberId);
  const driveMode = useDriveMode();

  const endTrip = useEndTrip();
  const leaveTrip = useLeaveTrip();
  const promote = usePromoteMember();
  const removeMember = useRemoveMember();
  const dropPitstop = useDropPitstop();
  const cancelPitstop = useCancelPitstop();
  const respondToPitstop = useRespondToPitstop();
  const createSafeZone = useCreateSafeZone();
  const removeSafeZone = useRemoveSafeZone();
  const triggerSos = useTriggerSos();
  const setHistoryOptIn = useSetHistoryOptIn();

  const history = useGetTripHistory(tripId, {
    query: { queryKey: getGetTripHistoryQueryKey(tripId), enabled: isEnded },
  });

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
  const pitstop = state.data?.pitstop ?? null;

  // Proactive off-route nudge: fire a dismissible banner (and, in Drive Mode,
  // a spoken alert) the moment a member transitions into off-route or a
  // notable status change, instead of only showing it as a passive label.
  const [offRouteAlerts, setOffRouteAlerts] = useState<{ id: string; name: string }[]>([]);
  const prevMemberSnapshotRef = useRef<Map<number, { status: string; offRoute: boolean }> | null>(
    null,
  );
  useEffect(() => {
    const members = state.data?.members;
    if (!members) return;
    const prev = prevMemberSnapshotRef.current;
    const next = new Map<number, { status: string; offRoute: boolean }>();
    for (const m of members) {
      const snapshot = { status: m.status, offRoute: m.offRoute };
      next.set(m.memberId, snapshot);
      const prevSnapshot = prev?.get(m.memberId);
      if (!prev || m.isSelf) continue;

      if (m.offRoute && !(prevSnapshot?.offRoute ?? false)) {
        const alertId = `${m.memberId}-${Date.now()}`;
        setOffRouteAlerts((cur) => [...cur, { id: alertId, name: m.name }]);
        setTimeout(() => {
          setOffRouteAlerts((cur) => cur.filter((a) => a.id !== alertId));
        }, 15000);
        driveMode.speak(`${m.name} appears to have taken a different route.`);
      }

      const prevStatus = prevSnapshot?.status;
      if (prevStatus === 'moving' && m.status === 'stopped') {
        driveMode.speak(`${m.name} has stopped.`);
      } else if ((prevStatus === 'moving' || prevStatus === 'stopped') && m.status === 'not_updating') {
        driveMode.speak(`${m.name}'s location isn't updating.`);
      }
    }
    prevMemberSnapshotRef.current = next;
    // driveMode.speak is stable across renders (see useDriveMode); omitting it
    // keeps this effect keyed purely on the polled data it diffs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data?.members]);

  // Foreground-only safe-zone enter/exit nudge. Piggybacks on the existing
  // poll — this fires only while a member's app is open, unlike OS-level
  // background geofencing (which needs "always" location permission we
  // intentionally don't request).
  const [zoneAlerts, setZoneAlerts] = useState<{ id: string; text: string }[]>([]);
  const prevInZoneRef = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    const members = state.data?.members;
    const zones = safeZones.data;
    if (!members || !zones || zones.length === 0) return;
    const prev = prevInZoneRef.current;
    const next = new Map<string, boolean>();
    for (const z of zones) {
      for (const m of members) {
        if (m.lat == null || m.lng == null) continue;
        const key = `${m.memberId}:${z.id}`;
        const inside = haversineM({ lat: m.lat, lng: m.lng }, { lat: z.lat, lng: z.lng }) <= z.radiusM;
        next.set(key, inside);
        const wasInside = prev?.get(key);
        if (prev && wasInside != null && wasInside !== inside) {
          const zoneName = z.label || 'a safe zone';
          const text = inside ? `${m.name} entered ${zoneName}` : `${m.name} left ${zoneName}`;
          const alertId = `${key}-${Date.now()}`;
          setZoneAlerts((cur) => [...cur, { id: alertId, text }]);
          setTimeout(() => {
            setZoneAlerts((cur) => cur.filter((a) => a.id !== alertId));
          }, 15000);
          driveMode.speak(text);
        }
      }
    }
    prevInZoneRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data?.members, safeZones.data]);

  // Persistent SOS banner: shows whenever the server reports an SOS from the
  // last 15 minutes, re-appearing on a new SOS even if the previous one was
  // dismissed. In-app broadcast only — no SMS to anyone outside the trip.
  const activeSos = state.data?.activeSos ?? null;
  const [dismissedSosId, setDismissedSosId] = useState<number | null>(null);

  // Drive Mode: speak new messages aloud, independent of the unread-badge
  // last-read state (opening the messages screen shouldn't affect this).
  const lastAnnouncedMsgIdRef = useRef<number | null>(null);
  useEffect(() => {
    const msgs = messages.data;
    if (!msgs || msgs.length === 0) return;
    const prevId = lastAnnouncedMsgIdRef.current;
    if (prevId != null) {
      for (const m of msgs) {
        if (m.id > prevId && m.senderMemberId !== me?.memberId && m.kind !== 'sos') {
          driveMode.speak(`${m.senderName}: ${m.body}`);
        }
      }
    }
    lastAnnouncedMsgIdRef.current = Math.max(...msgs.map((m) => m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data, me?.memberId]);

  // Drive Mode: SOS is always spoken, bypassing the Drive Mode toggle itself
  // (it's already always shown visually regardless of mode — see the banner
  // below), and interrupts anything currently queued.
  const lastAnnouncedSosIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeSos || lastAnnouncedSosIdRef.current === activeSos.id) return;
    lastAnnouncedSosIdRef.current = activeSos.id;
    driveMode.speakUrgent(`S O S from ${activeSos.name}. They need help.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSos]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetTripStateQueryKey(tripId) });
    qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
  };

  const handleSos = () => {
    confirm(
      'Send SOS?',
      'Everyone on this trip will see an alert immediately. This does not call for help outside the app.',
      () => triggerSos.mutate({ tripId, data: {} }, { onSuccess: refresh }),
    );
  };

  const handleToggleHistory = () => {
    const next = !me?.recordHistory;
    setHistoryOptIn.mutate({ tripId, data: { enabled: next } }, { onSuccess: refresh });
  };

  const handleDropPitstop = (label: string, point: { lat: number; lng: number } | null) => {
    // Use the searched place if one was picked, otherwise the leader's current
    // location, falling back to the trip start.
    const lat = point?.lat ?? me?.lat ?? trip?.startLat ?? 0;
    const lng = point?.lng ?? me?.lng ?? trip?.startLng ?? 0;
    dropPitstop.mutate(
      { tripId, data: { lat, lng, ...(label ? { label } : {}) } },
      {
        onSuccess: () => {
          setShowDropPitstop(false);
          refresh();
        },
      },
    );
  };

  const handleCancelPitstop = () => {
    confirm('Cancel pitstop?', 'The pitstop pin will be removed for everyone.', () => {
      cancelPitstop.mutate({ tripId }, { onSuccess: refresh });
    });
  };

  const handleRespondToPitstop = (response: 'on_my_way' | 'already_there') => {
    respondToPitstop.mutate({ tripId, data: { response } }, { onSuccess: refresh });
  };

  const refreshZones = () => {
    qc.invalidateQueries({ queryKey: getListSafeZonesQueryKey(tripId) });
  };

  const handleCreateSafeZone = (label: string, radiusM: number) => {
    const lat = me?.lat ?? trip?.startLat ?? 0;
    const lng = me?.lng ?? trip?.startLng ?? 0;
    createSafeZone.mutate(
      { tripId, data: { lat, lng, radiusM, ...(label ? { label } : {}) } },
      {
        onSuccess: () => {
          setShowAddZone(false);
          refreshZones();
        },
      },
    );
  };

  const handleRemoveZonesMenu = () => {
    const zones = safeZones.data ?? [];
    if (zones.length === 0) return;
    const remove = (zone: SafeZone) =>
      confirm('Remove safe zone?', 'Members will stop getting enter/exit alerts for it.', () => {
        removeSafeZone.mutate({ tripId, zoneId: zone.id }, { onSuccess: refreshZones });
      });
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      const choice = window.prompt(
        `Remove which safe zone?\n${zones.map((z, i) => `${i + 1}. ${z.label || 'Unnamed zone'}`).join('\n')}\n\nEnter a number (or cancel):`,
      );
      const idx = choice ? Number(choice) - 1 : -1;
      if (idx >= 0 && idx < zones.length) remove(zones[idx]!);
      return;
    }
    Alert.alert('Remove a safe zone', undefined, [
      ...zones.map((z) => ({ text: z.label || 'Unnamed zone', onPress: () => remove(z) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const menu = () => {
    const opts: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: 'Trip details & join code', run: () => router.push(`/trip/${tripId}`) },
    ];
    if (isViewerLeader && isActive) {
      opts.push({
        label: pitstop ? 'Cancel pitstop' : 'Drop pitstop',
        run: () => (pitstop ? handleCancelPitstop() : setShowDropPitstop(true)),
      });
      opts.push({ label: 'Add safe zone', run: () => setShowAddZone(true) });
      if ((safeZones.data ?? []).length > 0) {
        opts.push({ label: 'Remove a safe zone', run: handleRemoveZonesMenu });
      }
      opts.push({
        label: 'End trip for everyone',
        destructive: true,
        run: () =>
          confirm('End the trip?', 'Location sharing stops for everyone immediately.', () =>
            endTrip.mutate({ tripId }, { onSuccess: refresh }),
          ),
      });
    }
    if (isActive) {
      opts.push({
        label: me?.recordHistory ? 'Stop recording my path' : 'Record my path for replay',
        run: handleToggleHistory,
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
        <Pressable onPress={() => driveMode.setEnabled(!driveMode.enabled)} hitSlop={8}>
          <Feather
            name={driveMode.enabled ? 'volume-2' : 'volume-x'}
            size={22}
            color={driveMode.enabled ? c.lime : c.inkForeground}
          />
        </Pressable>
        <Pressable onPress={menu} hitSlop={8}>
          <Feather name="more-vertical" size={22} color={c.inkForeground} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={{ flex: driveMode.enabled ? 2.2 : 1.35 }}>
        <TripMap
          route={detail.data?.routeGeometry ?? []}
          start={{ lat: trip.startLat, lng: trip.startLng }}
          dest={{ lat: trip.destLat, lng: trip.destLng }}
          members={sortedMembers}
          focusMemberId={focusMemberId}
          pitstop={pitstop}
          safeZones={safeZones.data ?? []}
          history={isEnded ? (history.data ?? []) : []}
          onMemberPress={(m) => setSelected(m)}
          simplified={driveMode.enabled}
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
        {/* Drop Pitstop FAB (leader only, active trip, no active pitstop) — hidden in Drive Mode, low priority while driving */}
        {isViewerLeader && isActive && !pitstop && !driveMode.enabled ? (
          <Pressable
            onPress={() => setShowDropPitstop(true)}
            style={[styles.pitstopFab, { backgroundColor: '#F59E0B', borderRadius: c.radius }]}
          >
            <Feather name="coffee" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              Pitstop
            </Text>
          </Pressable>
        ) : null}
        {/* SOS FAB — any member, active trip only. Enlarged in Drive Mode,
            since it's the one interactive element that should stay easy to
            hit without close attention. */}
        {isActive ? (
          <Pressable
            onPress={handleSos}
            style={[
              styles.sosFab,
              { backgroundColor: '#D93025', borderRadius: c.radius },
              driveMode.enabled ? { bottom: 14, paddingHorizontal: 20, paddingVertical: 16 } : null,
            ]}
          >
            <Feather name="alert-triangle" size={driveMode.enabled ? 22 : 15} color="#fff" />
            <Text
              style={{
                color: '#fff',
                fontFamily: 'Inter_700Bold',
                fontSize: driveMode.enabled ? 17 : 13,
              }}
            >
              SOS
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Banners */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 6 }}>
        {activeSos && activeSos.id !== dismissedSosId ? (
          <Banner
            tone="danger"
            text={`🆘 ${activeSos.name} triggered SOS — needs help!`}
            actionTitle="Dismiss"
            onAction={() => setDismissedSosId(activeSos.id)}
          />
        ) : null}
        {!isOnline ? (
          <Banner tone="info" text="You're offline — reconnecting… your last position will send once back online." />
        ) : null}
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
        {offRouteAlerts.map((a) => (
          <Banner
            key={a.id}
            tone="warning"
            text={`${a.name} appears to have taken a different route.`}
            actionTitle="Dismiss"
            onAction={() => setOffRouteAlerts((cur) => cur.filter((x) => x.id !== a.id))}
          />
        ))}
        {zoneAlerts.map((a) => (
          <Banner
            key={a.id}
            tone="info"
            text={a.text}
            actionTitle="Dismiss"
            onAction={() => setZoneAlerts((cur) => cur.filter((x) => x.id !== a.id))}
          />
        ))}
        {pitstop && isActive ? (
          <PitstopBanner
            pitstop={pitstop}
            isLeader={!!isViewerLeader}
            myMemberId={me?.memberId}
            onRespond={handleRespondToPitstop}
            onCancel={handleCancelPitstop}
          />
        ) : null}
      </View>

      {/* Member list, ordered front-to-back — hidden in Drive Mode in favor
          of the larger map and a single glanceable status line. */}
      {driveMode.enabled ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 4 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
            {isEnded ? 'Trip ended' : `${state.data.sharingCount} of ${state.data.joinedCount} sharing`}
          </Text>
        </View>
      ) : (
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
      )}

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

      {/* Drop Pitstop Modal */}
      <DropPitstopModal
        visible={showDropPitstop}
        onClose={() => setShowDropPitstop(false)}
        onDrop={handleDropPitstop}
        loading={dropPitstop.isPending}
      />

      {/* Add Safe Zone Modal */}
      <AddSafeZoneModal
        visible={showAddZone}
        onClose={() => setShowAddZone(false)}
        onCreate={handleCreateSafeZone}
        loading={createSafeZone.isPending}
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
  pitstopFab: {
    position: 'absolute',
    bottom: 14,
    left: 14,
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
  sosFab: {
    position: 'absolute',
    bottom: 62,
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
  pitstopBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  pitstopBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
  },
});
