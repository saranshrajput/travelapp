import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCreateSession } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSession } from '@/lib/session';
import { useScreenInsets } from '@/lib/insets';
import { Btn, Field } from '@/components/UI';

export default function SignIn() {
  const c = useColors();
  const insets = useScreenInsets();
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createSession = useCreateSession();

  const submit = () => {
    if (name.trim().length < 2) {
      setError('Please enter your name');
      return;
    }
    if (phone.trim().length < 8) {
      setError('Please enter a valid phone number');
      return;
    }
    setError(null);
    createSession.mutate(
      { data: { name: name.trim(), phone: phone.trim() } },
      {
        onSuccess: async (res) => {
          await signIn(res.token, res.user);
          router.replace('/trips');
        },
        onError: () => setError('Could not sign in. Check your connection and try again.'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <View style={{ gap: 12 }}>
            <View style={[styles.logo, { backgroundColor: c.lime }]}>
              <Feather name="navigation" size={26} color={c.ink} />
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 34, color: c.inkForeground }}>
              Rally
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: c.inkMuted }}>
              One live map for your whole group. Travel together, even in separate vehicles.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderRadius: c.radius + 4 }]}>
            <Field
              label="Your name"
              placeholder="e.g. Priya"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Field
              label="Phone number"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={error}
            />
            <Btn
              title="Continue"
              onPress={submit}
              loading={createSession.isPending}
            />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, color: c.mutedForeground, textAlign: 'center' }}>
              No password, no email. Your phone number is only visible to people on your trips.
            </Text>
          </View>

          <Pressable onPress={() => router.push('/join')} style={{ alignItems: 'center' }} hitSlop={8}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.lime }}>
              Have a join code? Join a trip →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    gap: 16,
  },
});
