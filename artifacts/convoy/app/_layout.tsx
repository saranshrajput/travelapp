import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { getSessionToken, SessionProvider } from '@/lib/session';

// EXPO_PUBLIC_API_URL is an escape hatch for local dev, where there's no
// Replit domain to derive an https origin from (e.g. a plain http://localhost API).
setBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}`);
setAuthTokenGetter(() => getSessionToken());

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2000 },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="join" />
      <Stack.Screen name="trips" />
      <Stack.Screen name="create-trip" />
      <Stack.Screen name="trip/[id]/index" />
      <Stack.Screen name="trip/[id]/tracking" />
      <Stack.Screen name="trip/[id]/messages" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SessionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
