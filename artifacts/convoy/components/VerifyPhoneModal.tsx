import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ConfirmationResult } from 'firebase/auth';
import { useColors } from '@/hooks/useColors';
import { Btn } from '@/components/UI';
import { confirmVerificationCode, sendVerificationCode } from '@/lib/phoneVerify';

export default function VerifyPhoneModal({
  visible,
  phone,
  onClose,
  onVerified,
}: {
  visible: boolean;
  phone: string;
  onClose: () => void;
  onVerified: (idToken: string) => void;
}) {
  const c = useColors();
  const [stage, setStage] = useState<'send' | 'code'>('send');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage('send');
    setCode('');
    setConfirmation(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendVerificationCode(phone);
      setConfirmation(result);
      setStage('code');
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmation) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await confirmVerificationCode(confirmation, code.trim());
      onVerified(idToken);
      reset();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={handleClose}
      />
      <View
        style={{
          backgroundColor: c.background,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 36,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Feather name="shield" size={18} color={c.mapRoute} />
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 17,
              color: c.foreground,
              marginLeft: 8,
              flex: 1,
            }}
          >
            Verify your number
          </Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Feather name="x" size={20} color={c.mutedForeground} />
          </Pressable>
        </View>

        {stage === 'send' ? (
          <>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 13.5,
                color: c.mutedForeground,
                marginBottom: 16,
              }}
            >
              We'll text a one-time code to {phone}. This is optional and doesn't affect your
              ability to use Convoy.
            </Text>
            <Btn
              title={loading ? 'Sending…' : 'Send code'}
              onPress={handleSend}
              loading={loading}
            />
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 13.5,
                color: c.mutedForeground,
                marginBottom: 12,
              }}
            >
              Enter the 6-digit code sent to {phone}.
            </Text>
            <TextInput
              placeholder="123456"
              placeholderTextColor={c.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 11,
                fontSize: 20,
                letterSpacing: 4,
                fontFamily: 'Inter_600SemiBold',
                marginBottom: 16,
                backgroundColor: c.card,
                color: c.foreground,
                borderColor: c.border,
                textAlign: 'center',
              }}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <Btn
              title={loading ? 'Verifying…' : 'Verify'}
              onPress={handleConfirm}
              loading={loading}
              disabled={code.trim().length < 6}
            />
          </>
        )}

        {error ? (
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12.5,
              color: '#A50E0E',
              marginTop: 12,
            }}
          >
            {error}
          </Text>
        ) : null}

        {Platform.OS === 'web' ? <View nativeID="recaptcha-container" /> : null}
      </View>
    </Modal>
  );
}
