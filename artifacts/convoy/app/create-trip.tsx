import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from '@/components/map';
import {
  getGetRouteOptionsQueryKey,
  getGetTripQueryKey,
  getSearchPlacesQueryKey,
  useCreateTrip,
  useGetRouteOptions,
  useGetTrip,
  useSearchPlaces,
  useUpdateTrip,
  type Place,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { Btn, Card, Field, SectionLabel } from '@/components/UI';
import { fmtDur, fmtKm } from '@/lib/format';

type Point = { lat: number; lng: number; label: string };

const DAY_OPTIONS = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: '+2 days', offset: 2 },
  { label: '+3 days', offset: 3 },
];
const TIME_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '15:00', '18:00', '21:00'];

function buildScheduledAt(dayOffset: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d.toISOString();
}

function PlaceSearch({
  label,
  placeholder,
  value,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: Point | null;
  onSelect: (p: Point) => void;
}) {
  const c = useColors();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const search = useSearchPlaces(
    { q: text.trim() },
    {
      query: {
        queryKey: getSearchPlacesQueryKey({ q: text.trim() }),
        enabled: open && text.trim().length >= 3,
        staleTime: 30000,
      },
    },
  );
  return (
    <View style={{ gap: 6 }}>
      <Field
        label={label}
        placeholder={placeholder}
        value={open ? text : (value?.label ?? '')}
        onFocus={() => setOpen(true)}
        onChangeText={(t) => {
          setText(t);
          setOpen(true);
        }}
      />
      {open && search.data && search.data.length > 0 ? (
        <Card style={{ padding: 4, gap: 0 }}>
          {search.data.slice(0, 5).map((p: Place, i: number) => (
            <Pressable
              key={`${p.lat}-${p.lng}-${i}`}
              onPress={() => {
                onSelect({ lat: p.lat, lng: p.lng, label: p.label });
                setOpen(false);
                setText('');
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
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.foreground }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export default function CreateTrip() {
  const c = useColors();
  const insets = useScreenInsets();
  const params = useLocalSearchParams<{ editTripId?: string }>();
  const editTripId = params.editTripId ? Number(params.editTripId) : null;
  const existing = useGetTrip(editTripId ?? 0, {
    query: { queryKey: getGetTripQueryKey(editTripId ?? 0), enabled: editTripId != null },
  });

  const [name, setName] = useState('');
  const [start, setStart] = useState<Point | null>(null);
  const [dest, setDest] = useState<Point | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState('08:00');
  const [routeIdx, setRouteIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill in edit mode
  useEffect(() => {
    if (editTripId != null && existing.data && !prefilled) {
      const t = existing.data.trip;
      setName(t.name);
      setStart({ lat: t.startLat, lng: t.startLng, label: t.startLabel });
      setDest({ lat: t.destLat, lng: t.destLng, label: t.destLabel });
      setPrefilled(true);
    }
  }, [editTripId, existing.data, prefilled]);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (Platform.OS === 'web') {
        coords = await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            () => resolve(null),
            { timeout: 10000 },
          ),
        );
      } else {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({});
          coords = pos.coords;
        }
      }
      if (coords) {
        setStart({ lat: coords.latitude, lng: coords.longitude, label: 'Current location' });
      } else {
        setError('Could not get your location — search for a start point instead.');
      }
    } finally {
      setLocating(false);
    }
  };

  // Default start = current location on first open (create mode)
  useEffect(() => {
    if (editTripId == null && start == null) {
      useCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeParams = {
    fromLat: start?.lat ?? 0,
    fromLng: start?.lng ?? 0,
    toLat: dest?.lat ?? 0,
    toLng: dest?.lng ?? 0,
  };
  const routes = useGetRouteOptions(routeParams, {
    query: {
      queryKey: getGetRouteOptionsQueryKey(routeParams),
      enabled: start != null && dest != null,
      staleTime: 60000,
      retry: 1,
    },
  });

  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const busy = createTrip.isPending || updateTrip.isPending;

  const selectedRoute = routes.data?.[routeIdx] ?? routes.data?.[0];

  const mapRegion = useMemo(() => {
    if (start && dest) {
      const latDelta = Math.abs(start.lat - dest.lat) * 1.6 + 0.05;
      const lngDelta = Math.abs(start.lng - dest.lng) * 1.6 + 0.05;
      return {
        latitude: (start.lat + dest.lat) / 2,
        longitude: (start.lng + dest.lng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }
    return null;
  }, [start, dest]);

  const submit = () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Give the trip a name');
      return;
    }
    if (!start || !dest) {
      setError('Choose a start point and destination');
      return;
    }
    if (!selectedRoute) {
      setError('Pick a route first');
      return;
    }
    const scheduledAt = buildScheduledAt(dayOffset, time);
    if (editTripId != null) {
      updateTrip.mutate(
        {
          tripId: editTripId,
          data: {
            name: name.trim(),
            scheduledAt,
            destLat: dest.lat,
            destLng: dest.lng,
            destLabel: dest.label,
            routeGeometry: selectedRoute.geometry,
            routeDistanceM: selectedRoute.distanceM,
            routeDurationS: selectedRoute.durationS,
          },
        },
        {
          onSuccess: (d) => router.replace(`/trip/${d.trip.id}`),
          onError: () => setError('Could not save changes.'),
        },
      );
    } else {
      createTrip.mutate(
        {
          data: {
            name: name.trim(),
            startLat: start.lat,
            startLng: start.lng,
            startLabel: start.label,
            destLat: dest.lat,
            destLng: dest.lng,
            destLabel: dest.label,
            scheduledAt,
            routeGeometry: selectedRoute.geometry,
            routeDistanceM: selectedRoute.distanceM,
            routeDurationS: selectedRoute.durationS,
          },
        },
        {
          onSuccess: (d) => router.replace(`/trip/${d.trip.id}`),
          onError: () => setError('Could not create the trip. Try again.'),
        },
      );
    }
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/trips'))} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
            {editTripId != null ? 'Edit trip' : 'Create a trip'}
          </Text>
        </View>

        <Field
          label="Trip name"
          placeholder="e.g. Goa New Year run"
          value={name}
          onChangeText={setName}
        />

        <View style={{ gap: 8 }}>
          <PlaceSearch
            label="Start point"
            placeholder="Search a place or use current location"
            value={start}
            onSelect={setStart}
          />
          <Btn
            title={locating ? 'Locating…' : 'Use current location'}
            icon="crosshair"
            variant="outline"
            small
            loading={locating}
            onPress={useCurrentLocation}
          />
        </View>

        <PlaceSearch
          label="Destination"
          placeholder="Search for the destination"
          value={dest}
          onSelect={setDest}
        />

        <View style={{ gap: 8 }}>
          <SectionLabel>When are you leaving?</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DAY_OPTIONS.map((d) => (
              <Pressable
                key={d.label}
                onPress={() => setDayOffset(d.offset)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: dayOffset === d.offset ? c.ink : c.card,
                    borderColor: dayOffset === d.offset ? c.ink : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: dayOffset === d.offset ? c.lime : c.foreground,
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TIME_OPTIONS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTime(t)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: time === t ? c.ink : c.card,
                    borderColor: time === t ? c.ink : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: time === t ? c.lime : c.foreground,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {start && dest ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Pick a route</SectionLabel>
            {mapRegion ? (
              <View style={{ height: 220, borderRadius: c.radius, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                <MapView style={StyleSheet.absoluteFill} initialRegion={mapRegion} region={mapRegion}>
                  {routes.data?.map((r, i) => (
                    <Polyline
                      key={i}
                      coordinates={r.geometry.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                      strokeColor={i === routeIdx ? c.mapRoute : c.mapRouteAlt}
                      strokeWidth={i === routeIdx ? 5 : 3}
                      tappable
                      onPress={() => setRouteIdx(i)}
                    />
                  ))}
                  <Marker coordinate={{ latitude: start.lat, longitude: start.lng }} pinColor={c.statusMoving} />
                  <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} pinColor={c.destructive} />
                </MapView>
              </View>
            ) : null}
            {routes.isLoading ? (
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.mutedForeground }}>
                Finding routes…
              </Text>
            ) : routes.isError ? (
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13.5, color: c.destructive }}>
                Could not fetch routes between these points.
              </Text>
            ) : (
              routes.data?.map((r, i) => (
                <Pressable
                  key={i}
                  onPress={() => setRouteIdx(i)}
                  style={[
                    styles.routeCard,
                    {
                      borderColor: i === routeIdx ? c.mapRoute : c.border,
                      backgroundColor: i === routeIdx ? '#E8F0FE' : c.card,
                      borderRadius: c.radius,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: i === routeIdx ? c.mapRoute : c.muted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: i === routeIdx ? '#fff' : c.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }}>
                    Route {i + 1}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.mutedForeground }}>
                    {fmtKm(r.distanceM)} · {fmtDur(r.durationS)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {error ? (
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.destructive }}>
            {error}
          </Text>
        ) : null}

        <Btn
          title={editTripId != null ? 'Save changes' : 'Create trip'}
          icon={editTripId != null ? 'check' : 'plus'}
          onPress={submit}
          loading={busy}
          disabled={!selectedRoute}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 2,
  },
});
