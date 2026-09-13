import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { usePushRegistration } from '../src/lib/use-push-registration';
import { useTheme } from '../src/lib/use-theme';

function RootStack() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Runs inside the provider so it re-registers whenever the signed-in user
  // changes, and does nothing at all while signed out.
  usePushRegistration(user?.id ?? null);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surfaceRaised },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="join" options={{ title: 'Join your community' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[slug]" options={{ title: 'Event' }} />
        <Stack.Screen name="contribute" options={{ title: 'Contribute', presentation: 'modal' }} />
        <Stack.Screen name="admin/approvals" options={{ title: 'Approvals' }} />
        <Stack.Screen name="admin/members" options={{ title: 'Members' }} />
        <Stack.Screen name="admin/member/[id]" options={{ title: 'Edit member' }} />
      </Stack>
    </>
  );
}

// Created once, outside the component, so a re-render never throws the cache
// away. Data here is community-scoped and changes slowly; a short stale window
// keeps tab switches instant without serving genuinely old information.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
