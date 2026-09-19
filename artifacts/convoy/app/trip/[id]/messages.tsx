import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
import {
  getGetTripStateQueryKey,
  getListMessagesQueryKey,
  useGetTripState,
  useListMessages,
  useSendMessage,
  type Message,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useScreenInsets } from '@/lib/insets';
import { useUnread } from '@/lib/useUnread';
import { Avatar } from '@/components/UI';
import { fmtClock } from '@/lib/format';

const QUICK_REPLIES = ["I'm stopping", 'Catch up', 'Wrong turn', 'On my way'];

export default function Messages() {
  const c = useColors();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);

  const state = useGetTripState(tripId, {
    query: { queryKey: getGetTripStateQueryKey(tripId), refetchInterval: 8000 },
  });
  const messages = useListMessages(tripId, {
    query: { queryKey: getListMessagesQueryKey(tripId), refetchInterval: 3000 },
  });
  const sendMessage = useSendMessage();
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const me = state.data?.members.find((m) => m.isSelf);
  const others = (state.data?.members ?? []).filter(
    (m) => !m.isSelf && m.status !== 'not_joined',
  );
  const ended = state.data?.trip.status === 'ended';

  const { markRead } = useUnread(tripId, messages.data, me?.memberId);
  useEffect(() => {
    markRead();
  }, [markRead, messages.data]);

  const visible = useMemo(() => {
    const list = messages.data ?? [];
    const filtered =
      recipientId == null
        ? list.filter((m) => m.recipientMemberId == null)
        : list.filter(
            (m) =>
              (m.senderMemberId === recipientId && m.recipientMemberId === me?.memberId) ||
              (m.senderMemberId === me?.memberId && m.recipientMemberId === recipientId),
          );
    return [...filtered].reverse();
  }, [messages.data, recipientId, me?.memberId]);

  const sendBody = (body: string) => {
    if (!body || ended) return;
    sendMessage.mutate(
      { tripId, data: { body, recipientMemberId: recipientId } },
      { onSettled: () => messages.refetch() },
    );
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    sendBody(body);
    inputRef.current?.focus();
  };

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.senderMemberId === me?.memberId;
    const isDm = item.recipientMemberId != null;
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 5,
          justifyContent: mine ? 'flex-end' : 'flex-start',
        }}
      >
        {!mine ? (
          <Avatar color={item.senderColor} initial={item.senderInitial} size={30} />
        ) : null}
        <View
          style={{
            maxWidth: '75%',
            backgroundColor: mine ? c.ink : c.card,
            borderRadius: 16,
            borderBottomRightRadius: mine ? 5 : 16,
            borderBottomLeftRadius: mine ? 16 : 5,
            borderWidth: mine ? 0 : 1,
            borderColor: c.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!mine ? (
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: item.senderColor }}>
                {item.senderName}
              </Text>
            ) : null}
            {isDm ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Feather name="lock" size={9} color={mine ? c.inkMuted : c.mutedForeground} />
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10.5, color: mine ? c.inkMuted : c.mutedForeground }}>
                  {mine ? `to ${item.recipientName}` : 'private'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14.5, color: mine ? c.inkForeground : c.foreground }}>
            {item.body}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 10.5,
              color: mine ? c.inkMuted : c.mutedForeground,
              alignSelf: 'flex-end',
            }}
          >
            {fmtClock(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: c.ink,
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(`/trip/${tripId}/tracking`))} hitSlop={10}>
          <Feather name="chevron-down" size={24} color={c.inkForeground} />
        </Pressable>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.inkForeground, flex: 1 }}>
          Trip chat
        </Text>
      </View>

      {/* Recipient selector */}
      <View style={{ backgroundColor: c.ink, paddingBottom: 10 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          data={[null, ...others.map((o) => o.memberId)]}
          keyExtractor={(v) => String(v)}
          renderItem={({ item }) => {
            const isAll = item == null;
            const member = isAll ? null : others.find((o) => o.memberId === item);
            const active = recipientId === item;
            return (
              <Pressable
                onPress={() => setRecipientId(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.lime : 'rgba(255,255,255,0.08)',
                  },
                ]}
              >
                {member ? (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: member.color }} />
                ) : (
                  <Feather name="users" size={12} color={active ? c.ink : c.inkMuted} />
                )}
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: active ? c.ink : c.inkForeground,
                  }}
                >
                  {isAll ? 'Everyone' : member?.name}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        inverted
        data={visible}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 10 }}
        ListEmptyComponent={
          <View style={{ transform: [{ scaleY: -1 }], padding: 30, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.mutedForeground, textAlign: 'center' }}>
              {recipientId == null
                ? 'No messages yet. Say hello to the group!'
                : 'No private messages yet. Only the two of you can see these.'}
            </Text>
          </View>
        }
      />

      {/* Quick replies */}
      {!ended ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={QUICK_REPLIES}
          keyExtractor={(t) => t}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => sendBody(item)}
              style={[styles.quickReplyChip, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.foreground }}>
                {item}
              </Text>
            </Pressable>
          )}
        />
      ) : null}

      {/* Composer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.card,
        }}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          editable={!ended}
          placeholder={
            ended
              ? 'Trip ended — messaging is closed'
              : recipientId == null
                ? 'Message everyone…'
                : `Message ${others.find((o) => o.memberId === recipientId)?.name ?? ''} privately…`
          }
          placeholderTextColor={c.mutedForeground}
          onSubmitEditing={send}
          returnKeyType="send"
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: c.input,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            fontFamily: 'Inter_400Regular',
            color: c.foreground,
            backgroundColor: c.background,
          }}
        />
        <Pressable
          onPress={send}
          disabled={ended || text.trim().length === 0}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: ended || text.trim().length === 0 ? c.muted : c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather
            name="send"
            size={18}
            color={ended || text.trim().length === 0 ? c.mutedForeground : c.primaryForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  quickReplyChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
