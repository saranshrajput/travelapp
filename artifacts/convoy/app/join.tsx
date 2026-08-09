import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getGetJoinPreviewQueryKey,
  useCreateSession,
  useGetJoinPreview,
  useJoinTrip,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSession } from '@/lib/session';
import { useScreenInsets } from '@/lib/insets';
import { Btn, Card, Field } from '@/components/UI';
import { fmtDate } from '@/lib/format';

export default function Join() {
  const c = useColors();
  const insets = useScreenInsets();
  const { user, signIn } = useSession();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalized = code.trim().toUpperCase();
  const preview = useGetJoinPreview(normalized, {
    query: {
      queryKey: getGetJoinPreviewQueryKey(normalized),
      enabled: normalized.length === 6,
      retry: 0,
    },
  });
  const createSession = useCreateSession();
  const joinTrip = useJoinTrip();

  const busy = createSession.isPending || joinTrip.isPending;

  const doJoin = async () => {
    setError(null);
    try {
      if (!user) {
        if (name.trim().length < 2 || phone.trim().length < 8) {
          setError('Enter your name and phone number to join');
          return;
        }
        const res = await createSession.mutateAsync({
          data: { name: name.trim(), phone: phone.trim() },
        });
        await signIn(res.token, res.user);
      }
      const detail = await joinTrip.mutateAsync({ data: { code: normalized } });
      router.replace(
        detail.trip.status === 'active'
          ? `/trip/${detail.trip.id}/tracking`
          : `/trip/${detail.trip.id}`,
      );
    } catch {
      setError('Could not join. Check the code and try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
            Join a trip
          </Text>
        </View>

        <Field
          label="Join code"
          placeholder="e.g. K7PW2N"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />

        {preview.data ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: c.foreground }}>
              {preview.data.tripName}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.mutedForeground }}>
              To {preview.data.destLabel}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13.5, color: c.mutedForeground }}>
              {fmtDate(preview.data.scheduledAt)} · {preview.data.memberCount}{' '}
              {preview.data.memberCount === 1 ? 'person' : 'people'} so far
              {preview.data.status === 'active' ? ' · already on the road' : ''}
            </Text>
          </Card>
        ) : normalized.length === 6 && preview.isError ? (
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.destructive }}>
            No trip found for that code.
          </Text>
        ) : null}

        {!user ? (
          <View style={{ gap: 14 }}>
            <Field
              label="Your name"
              placeholder="e.g. Ravi"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Field
              label="Phone number"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        {error ? (
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.destructive }}>
            {error}
          </Text>
        ) : null}

        <Btn
          title="Join trip"
          icon="users"
          onPress={doJoin}
          loading={busy}
          disabled={normalized.length !== 6 || !preview.data}
        />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground, textAlign: 'center' }}>
          Just a name and phone number — no password needed.
        </Text>
      </ScrollView>
    </View>
  );
}
