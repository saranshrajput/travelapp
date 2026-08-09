import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type BtnVariant = 'primary' | 'ink' | 'outline' | 'danger' | 'ghost';

export function Btn({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const palette: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, fg: c.primaryForeground },
    ink: { bg: c.ink, fg: c.lime },
    outline: { bg: 'transparent', fg: c.foreground, border: c.border },
    danger: { bg: c.destructive, fg: c.destructiveForeground },
    ghost: { bg: 'transparent', fg: c.mutedForeground },
  };
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        {
          backgroundColor: p.bg,
          borderRadius: c.radius,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? <Feather name={icon} size={small ? 15 : 18} color={p.fg} /> : null}
          <Text
            style={{
              color: p.fg,
              fontFamily: 'Inter_600SemiBold',
              fontSize: small ? 14 : 16,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label?: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.mutedForeground }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        {...inputProps}
        style={[
          {
            borderWidth: 1.5,
            borderColor: error ? c.destructive : c.input,
            borderRadius: c.radius,
            backgroundColor: c.card,
            color: c.foreground,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            fontFamily: 'Inter_500Medium',
          },
          inputProps.style,
        ]}
      />
      {error ? (
        <Text style={{ color: c.destructive, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text
      style={{
        fontFamily: 'Inter_700Bold',
        fontSize: 13,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: c.mutedForeground,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

export function Banner({
  text,
  tone,
  actionTitle,
  onAction,
}: {
  text: string;
  tone: 'warning' | 'danger' | 'info';
  actionTitle?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  const bg = tone === 'danger' ? '#FCE8E6' : tone === 'warning' ? '#FEF7E0' : c.accent;
  const fg = tone === 'danger' ? '#A50E0E' : tone === 'warning' ? '#7A4F01' : c.accentForeground;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: c.radius,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Feather
        name={tone === 'info' ? 'info' : 'alert-triangle'}
        size={16}
        color={fg}
      />
      <Text style={{ flex: 1, color: fg, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
        {text}
      </Text>
      {actionTitle && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: fg, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
            {actionTitle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({
  color,
  initial,
  size = 36,
  dimmed,
  ringColor,
  badge,
}: {
  color: string;
  initial: string;
  size?: number;
  dimmed?: boolean;
  ringColor?: string;
  badge?: 'leader' | 'stopped' | 'off';
}) {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, opacity: dimmed ? 0.45 : 1 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: ringColor ? 3 : 2,
          borderColor: ringColor ?? '#FFFFFF',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontFamily: 'Inter_700Bold',
            fontSize: size * 0.42,
          }}
        >
          {initial}
        </Text>
      </View>
      {badge ? (
        <View
          style={{
            position: 'absolute',
            right: -3,
            top: -3,
            width: size * 0.44,
            height: size * 0.44,
            borderRadius: size * 0.22,
            backgroundColor:
              badge === 'leader' ? c.ink : badge === 'stopped' ? c.statusStopped : c.statusStale,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        >
          <Feather
            name={badge === 'leader' ? 'star' : badge === 'stopped' ? 'pause' : 'wifi-off'}
            size={size * 0.22}
            color={badge === 'leader' ? c.lime : '#fff'}
          />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={28} color={c.accentForeground} />
      </View>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.foreground }}>
        {title}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          color: c.mutedForeground,
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  btnSmall: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
});
