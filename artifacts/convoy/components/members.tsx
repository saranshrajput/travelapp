import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { MemberState } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Avatar, Btn } from '@/components/UI';
import { fmtKm, gapLabel, statusInfo, timeAgo } from '@/lib/format';
import { memberBadge } from '@/components/TripMap';

export function statusColor(kind: string, c: ReturnType<typeof useColors>): string {
  switch (kind) {
    case 'moving':
      return c.statusMoving;
    case 'stopped':
      return c.statusStopped;
    case 'stale':
    case 'off':
    case 'invited':
    default:
      return c.statusStale;
  }
}

export function MemberRow({
  m,
  furthestBack,
  onPress,
}: {
  m: MemberState;
  furthestBack?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const st = statusInfo(m);
  const gap = gapLabel(m);
  const dimmed = st.kind === 'stale' || st.kind === 'off' || st.kind === 'invited';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: furthestBack ? '#FEF7E0' : pressed ? c.muted : c.card,
          borderColor: c.border,
        },
      ]}
    >
      <Avatar
        color={st.kind === 'off' ? c.statusStale : m.color}
        initial={m.initial}
        size={38}
        dimmed={st.kind === 'stale'}
        ringColor={m.isSelf ? c.mapRoute : m.role === 'leader' ? c.ink : undefined}
        badge={memberBadge(m)}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 15,
              color: dimmed ? c.mutedForeground : c.foreground,
              flexShrink: 1,
            }}
          >
            {m.name}
            {m.isSelf ? ' (you)' : ''}
          </Text>
          {m.role === 'leader' ? (
            <View style={[styles.tag, { backgroundColor: c.ink }]}>
              <Text style={{ color: c.lime, fontSize: 10, fontFamily: 'Inter_700Bold' }}>LEAD</Text>
            </View>
          ) : null}
          {furthestBack ? (
            <View style={[styles.tag, { backgroundColor: c.statusStopped }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>LAST</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.dot, { backgroundColor: statusColor(st.kind, c) }]} />
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground, flex: 1 }}
          >
            {st.label}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {gap ? (
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 12.5,
              color: m.offRoute ? c.statusStopped : c.foreground,
            }}
          >
            {gap}
          </Text>
        ) : null}
        {m.remainingM != null ? (
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: c.mutedForeground }}>
            {fmtKm(m.remainingM)} to go
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={c.mutedForeground} />
    </Pressable>
  );
}

export function MemberSheet({
  m,
  isViewerLeader,
  tripEnded,
  onClose,
  onLocate,
  onPromote,
  onRemove,
}: {
  m: MemberState | null;
  isViewerLeader: boolean;
  tripEnded: boolean;
  onClose: () => void;
  onLocate: (m: MemberState) => void;
  onPromote: (m: MemberState) => void;
  onRemove: (m: MemberState) => void;
}) {
  const c = useColors();
  if (!m) return null;
  const st = statusInfo(m);
  const gap = gapLabel(m);
  const rows: { icon: keyof typeof Feather.glyphMap; label: string; value: string }[] = [];
  if (gap) rows.push({ icon: 'navigation', label: 'Gap to you', value: gap });
  if (m.remainingM != null)
    rows.push({ icon: 'flag', label: 'To destination', value: fmtKm(m.remainingM) });
  if (m.lastSeenLabel)
    rows.push({
      icon: 'map-pin',
      label: 'Last seen near',
      value: m.lastFixAt ? `${m.lastSeenLabel} · ${timeAgo(m.lastFixAt)}` : m.lastSeenLabel,
    });
  else if (m.lastFixAt) rows.push({ icon: 'clock', label: 'Last update', value: timeAgo(m.lastFixAt) });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar color={m.color} initial={m.initial} size={46} badge={memberBadge(m)} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: c.foreground }}>
              {m.name}
              {m.isSelf ? ' (you)' : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={[styles.dot, { backgroundColor: statusColor(st.kind, c) }]} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.mutedForeground }}>
                {st.label}
                {m.role === 'leader' ? ' · Trip leader' : ''}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={c.mutedForeground} />
          </Pressable>
        </View>

        <View style={{ gap: 12, marginTop: 18 }}>
          {rows.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name={r.icon} size={16} color={c.mutedForeground} />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.mutedForeground, width: 110 }}>
                {r.label}
              </Text>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.foreground, flex: 1 }}>
                {r.value}
              </Text>
            </View>
          ))}
          {rows.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.mutedForeground }}>
              No location shared yet.
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          {!m.isSelf ? (
            <Btn
              title="Call"
              icon="phone"
              variant="ink"
              small
              style={{ flex: 1 }}
              onPress={() => Linking.openURL(`tel:${m.phone}`)}
            />
          ) : null}
          {m.lat != null ? (
            <Btn
              title="Locate on map"
              icon="map-pin"
              variant="outline"
              small
              style={{ flex: 1 }}
              onPress={() => onLocate(m)}
            />
          ) : null}
        </View>
        {isViewerLeader && !m.isSelf && !tripEnded ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {m.role !== 'leader' && m.status !== 'not_joined' ? (
              <Btn
                title="Make leader"
                icon="star"
                variant="outline"
                small
                style={{ flex: 1 }}
                onPress={() => onPromote(m)}
              />
            ) : null}
            <Btn
              title="Remove"
              icon="user-x"
              variant="danger"
              small
              style={{ flex: 1 }}
              onPress={() => onRemove(m)}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 34,
  },
});
