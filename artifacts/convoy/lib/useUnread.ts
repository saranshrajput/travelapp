import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '@workspace/api-client-react';

const key = (tripId: number) => `rally.lastread.${tripId}`;

/** Client-side unread tracking per trip. */
export function useUnread(tripId: number, messages: Message[] | undefined, myMemberId: number | undefined) {
  const [lastReadId, setLastReadId] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key(tripId)).then((raw) => {
      if (!cancelled) {
        setLastReadId(raw ? Number(raw) || 0 : 0);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const unreadCount =
    loaded && messages
      ? messages.filter((m) => m.id > lastReadId && m.senderMemberId !== myMemberId).length
      : 0;

  const markRead = useCallback(() => {
    if (!messages || messages.length === 0) return;
    const maxId = Math.max(...messages.map((m) => m.id));
    if (maxId > lastReadId) {
      setLastReadId(maxId);
      AsyncStorage.setItem(key(tripId), String(maxId));
    }
  }, [messages, lastReadId, tripId]);

  return { unreadCount, markRead };
}
