import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SessionUser = { id: number; name: string; phone: string };

const STORAGE_KEY = 'rally.session.v1';

let currentToken: string | null = null;

/** Module-level token accessor for the API client. */
export function getSessionToken(): string | null {
  return currentToken;
}

type SessionContextValue = {
  ready: boolean;
  user: SessionUser | null;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { token: string; user: SessionUser };
            currentToken = parsed.token;
            setUser(parsed.user);
          } catch {
            // corrupted — start fresh
          }
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (token: string, u: SessionUser) => {
    currentToken = token;
    setUser(u);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: u }));
  }, []);

  const signOut = useCallback(async () => {
    currentToken = null;
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ ready, user, signIn, signOut }),
    [ready, user, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
