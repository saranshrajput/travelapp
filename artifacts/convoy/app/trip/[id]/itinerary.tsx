import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetTripQueryKey,
  getListItineraryQueryKey,
  useCreateItineraryItem,
  useGetTrip,
  useListItinerary,
  useRemoveItineraryItem,
  useUpdateItineraryItem,
  type ItineraryItem,
  type ItineraryItemKind,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { Btn, Card, EmptyState, Field, SectionLabel } from '@/components/UI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { fmtClock } from '@/lib/format';

const KINDS: { kind: ItineraryItemKind; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { kind: 'stay', label: 'Hotel / stay', icon: 'home' },
  { kind: 'activity', label: 'Activity', icon: 'star' },
  { kind: 'transport', label: 'Transport', icon: 'navigation' },
  { kind: 'food', label: 'Food', icon: 'coffee' },
  { kind: 'other', label: 'Other', icon: 'bookmark' },
];

const TIME_OPTIONS = ['07:00', '09:00', '11:00', '12:00', '14:00', '15:00', '17:00', '19:00', '21:00'];
const CHECKOUT_TIME = '11:00';

function kindMeta(kind: ItineraryItemKind) {
  return KINDS.find((k) => k.kind === kind) ?? KINDS[KINDS.length - 1]!;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function atTime(day: Date, time: string): Date {
  const x = new Date(day);
  const [h, m] = time.split(':').map(Number);
  x.setHours(h ?? 0, m ?? 0, 0, 0);
  return x;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function nightsBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000));
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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1.5,
        backgroundColor: selected ? c.ink : c.card,
        borderColor: selected ? c.ink : c.border,
      }}
    >
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: selected ? c.lime : c.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({ label, onPrev, onNext, prevDisabled }: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: c.input,
        borderRadius: c.radius,
        backgroundColor: c.card,
      }}
    >
      <Pressable onPress={onPrev} disabled={prevDisabled} hitSlop={6} style={{ padding: 12, opacity: prevDisabled ? 0.3 : 1 }}>
        <Feather name="chevron-left" size={20} color={c.foreground} />
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }}>
        {label}
      </Text>
      <Pressable onPress={onNext} hitSlop={6} style={{ padding: 12 }}>
        <Feather name="chevron-right" size={20} color={c.foreground} />
      </Pressable>
    </View>
  );
}

function ItemEditor({
  tripId,
  defaultDay,
  item,
  onDone,
}: {
  tripId: number;
  defaultDay: Date;
  item: ItineraryItem | null;
  onDone: () => void;
}) {
  const c = useColors();
  const qc = useQueryClient();
  const create = useCreateItineraryItem();
  const update = useUpdateItineraryItem();
  const remove = useRemoveItineraryItem();

  const initialStart = item ? new Date(item.startAt) : null;
  const [kind, setKind] = useState<ItineraryItemKind>(item?.kind ?? 'stay');
  const [title, setTitle] = useState(item?.title ?? '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [day, setDay] = useState(startOfDay(initialStart ?? defaultDay));
  const [time, setTime] = useState(initialStart ? hhmm(initialStart) : '15:00');
  const [nights, setNights] = useState(
    item?.kind === 'stay' && item.endAt && initialStart ? nightsBetween(initialStart, new Date(item.endAt)) : 1,
  );
  const [confirmationCode, setConfirmationCode] = useState(item?.confirmationCode ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const isStay = kind === 'stay';
  const timeOptions = TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [...TIME_OPTIONS, time].sort();
  const checkout = addDays(day, nights);

  const done = () => {
    qc.invalidateQueries({ queryKey: getListItineraryQueryKey(tripId) });
    onDone();
  };
  const fail = (e: unknown) =>
    setError((e as { error?: string })?.error ?? 'Could not save. Please try again.');

  const save = () => {
    if (!title.trim()) {
      setError(isStay ? 'Enter the hotel or place name.' : 'Enter a title.');
      return;
    }
    setError(null);
    const data = {
      kind,
      title: title.trim(),
      address: address.trim() || undefined,
      startAt: atTime(day, time).toISOString(),
      endAt: isStay ? atTime(checkout, CHECKOUT_TIME).toISOString() : undefined,
      confirmationCode: confirmationCode.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (item) {
      update.mutate({ tripId, itemId: item.id, data }, { onSuccess: done, onError: fail });
    } else {
      create.mutate({ tripId, data }, { onSuccess: done, onError: fail });
    }
  };

  const doRemove = () => {
    if (!item) return;
    confirm('Remove from itinerary?', `"${item.title}" will be removed for everyone.`, () =>
      remove.mutate({ tripId, itemId: item.id }, { onSuccess: done, onError: fail }),
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SectionLabel>Type</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((k) => (
            <Chip key={k.kind} label={k.label} selected={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </View>
      </View>

      <Field
        label={isStay ? 'Hotel / place name' : 'Title'}
        placeholder={isStay ? 'e.g. Taj Lake Palace' : 'e.g. Boat ride, dinner reservation'}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <Field
        label="Address (optional)"
        placeholder="Street, city"
        value={address}
        onChangeText={setAddress}
        maxLength={300}
      />

      <View style={{ gap: 8 }}>
        <SectionLabel>{isStay ? 'Check-in' : 'When'}</SectionLabel>
        <Stepper label={fmtDay(day)} onPrev={() => setDay(addDays(day, -1))} onNext={() => setDay(addDays(day, 1))} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {timeOptions.map((t) => (
            <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
          ))}
        </View>
      </View>

      {isStay ? (
        <View style={{ gap: 8 }}>
          <SectionLabel>Nights</SectionLabel>
          <Stepper
            label={`${nights} night${nights === 1 ? '' : 's'} · check out ${fmtDay(checkout)}`}
            onPrev={() => setNights(Math.max(1, nights - 1))}
            onNext={() => setNights(Math.min(60, nights + 1))}
            prevDisabled={nights <= 1}
          />
        </View>
      ) : null}

      <Field
        label="Booking / confirmation no. (optional)"
        placeholder="Visible to everyone on this trip"
        value={confirmationCode}
        onChangeText={setConfirmationCode}
        autoCapitalize="characters"
        maxLength={80}
      />
      <Field
        label="Notes (optional)"
        placeholder="Room numbers, parking, who's paying…"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={1000}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      {error ? (
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.destructive }}>{error}</Text>
      ) : null}

      <Btn
        title={item ? 'Save changes' : 'Add to itinerary'}
        icon="check"
        onPress={save}
        loading={create.isPending || update.isPending}
      />
      {item ? (
        <Btn title="Remove" icon="trash-2" variant="ghost" onPress={doRemove} loading={remove.isPending} />
      ) : null}
    </View>
  );
}

function ItemCard({ item, onPress }: { item: ItineraryItem; onPress?: () => void }) {
  const c = useColors();
  const meta = kindMeta(item.kind);
  const start = new Date(item.startAt);
  const end = item.endAt ? new Date(item.endAt) : null;
  let when = fmtClock(item.startAt);
  if (item.kind === 'stay' && end) {
    const n = nightsBetween(start, end);
    when = `Check-in ${fmtClock(item.startAt)} · ${n} night${n === 1 ? '' : 's'} · out ${fmtDay(end)}`;
  } else if (end) {
    when = `${fmtClock(item.startAt)} – ${fmtClock(item.endAt!)}`;
  }

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={{ flexDirection: 'row', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={meta.icon} size={17} color={c.accentForeground} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }}>{item.title}</Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.mutedForeground }}>{when}</Text>
          {item.address ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: c.mutedForeground }}>
              {item.address}
            </Text>
          ) : null}
          {item.confirmationCode ? (
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.foreground }}>
              Confirmation: {item.confirmationCode}
            </Text>
          ) : null}
          {item.notes ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: c.foreground }}>{item.notes}</Text>
          ) : null}
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: c.mutedForeground }}>
            Added by {item.createdByName}
          </Text>
        </View>
        {onPress ? <Feather name="edit-2" size={15} color={c.mutedForeground} /> : null}
      </Card>
    </Pressable>
  );
}

export default function Itinerary() {
  const c = useColors();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const trip = useGetTrip(tripId, { query: { queryKey: getGetTripQueryKey(tripId) } });
  const items = useListItinerary(tripId, {
    query: { queryKey: getListItineraryQueryKey(tripId), refetchInterval: 15000 },
  });
  // null = list view, 'new' = adding, otherwise the item being edited
  const [editing, setEditing] = useState<ItineraryItem | 'new' | null>(null);

  const isEnded = trip.data?.trip.status === 'ended';
  const defaultDay = trip.data ? new Date(trip.data.trip.scheduledAt) : new Date();

  const days = useMemo(() => {
    const groups: { key: string; label: string; items: ItineraryItem[] }[] = [];
    for (const it of items.data ?? []) {
      const d = new Date(it.startAt);
      const key = startOfDay(d).toISOString();
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: fmtDay(d), items: [] };
        groups.push(g);
      }
      g.items.push(it);
    }
    return groups;
  }, [items.data]);

  const goBack = () => {
    if (editing) {
      setEditing(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(`/trip/${tripId}`);
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={goBack} hitSlop={10}>
        <Feather name={editing ? 'x' : 'arrow-left'} size={22} color={c.foreground} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
          {editing === 'new' ? 'Add to itinerary' : editing ? 'Edit item' : 'Itinerary'}
        </Text>
        {trip.data ? (
          <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.mutedForeground }}>
            {trip.data.trip.name}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const contentStyle = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 20,
    gap: 16,
  };

  if (editing) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <KeyboardAwareScrollViewCompat contentContainerStyle={contentStyle} bottomOffset={24}>
          {header}
          <ItemEditor
            tripId={tripId}
            defaultDay={defaultDay}
            item={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={contentStyle}>
        {header}
        {!isEnded ? <Btn title="Add hotel, activity or booking" icon="plus" onPress={() => setEditing('new')} /> : null}

        {items.data && items.data.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing planned yet"
            subtitle="Add hotel stays, activities and bookings so the whole group knows the plan."
          />
        ) : null}

        {days.map((g) => (
          <View key={g.key} style={{ gap: 10 }}>
            <SectionLabel>{g.label}</SectionLabel>
            {g.items.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                onPress={it.canEdit && !isEnded ? () => setEditing(it) : undefined}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
