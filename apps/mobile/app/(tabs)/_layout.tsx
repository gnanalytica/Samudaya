import { Redirect, Tabs, useRouter } from 'expo-router';
import { COPY, can } from '@samudaya/core';
import { Pressable, Text, View, type ColorValue } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { useTodoItems } from '../../src/lib/todo';
import { NotificationBell } from '../../src/components/notification-bell';
import { Loading, Screen } from '../../src/components/ui';
import { useTheme } from '../../src/lib/use-theme';

/**
 * Simple glyphs instead of an icon package: one less dependency to keep in
 * step with the SDK, and they render identically on both platforms.
 */
function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

/**
 * Contribute is the thing a resident most often opens the app to do, so it is
 * a raised button in the middle of the bar rather than a tab. It opens what is
 * collecting money over the tabs, or the one event that is.
 */
function ContributeButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Contribute"
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View
        style={{
          marginTop: -14,
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 3,
          borderColor: colors.surfaceRaised,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ color: colors.accentInk, fontSize: 26, lineHeight: 28, fontWeight: '600' }}>
          +
        </Text>
      </View>
      <Text style={{ color: colors.inkSubtle, fontSize: 10, marginTop: 2 }}>Contribute</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const { loading, user, memberships, welcomedAt, viewRole } = useAuth();
  // The committee's resident view hides Manage, exactly as residents see it.
  const staffView = can(viewRole, 'events:manage');
  // Staff don't contribute; residents and the committee do.
  const contributes = can(viewRole, 'contribute');
  const { data: todo } = useTodoItems();
  const todoCount = staffView ? (todo?.length ?? 0) : 0;

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // Guard the whole tab group rather than each screen: a signed-out user who
  // deep-links into a tab must not see a half-rendered shell.
  if (!user) return <Redirect href="/sign-in" />;
  if (memberships.length === 0) return <Redirect href="/join" />;
  // First time in after being admitted: a short role-specific welcome.
  if (!welcomedAt) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceRaised },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '600' },
        // Visible, so the Contribute button can rise above the bar's edge.
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: colors.border,
          overflow: 'visible',
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSubtle,
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon glyph="⌂" color={color} />,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <TabIcon glyph="◈" color={color} />,
          headerRight: () => <NotificationBell />,
        }}
      />
      <Tabs.Screen
        name="give"
        options={
          contributes
            ? {
                title: 'Contribute',
                tabBarButton: () => <ContributeButton onPress={() => router.push('/contribute')} />,
              }
            : { href: null }
        }
      />
      {/* The ledger is what the app exists to publish, so residents get it on
          the bar. Staff and the committee have Manage there instead and reach
          Money from Home and Me. */}
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          href: staffView ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon glyph="₹" color={color} />,
          headerRight: () => <NotificationBell />,
        }}
      />
      {/* Staff and the committee only; residents never see the tab. */}
      <Tabs.Screen
        name="manage"
        options={{
          title: COPY.manage,
          href: staffView ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} />,
          tabBarBadge: todoCount > 0 ? (todoCount > 99 ? '99+' : todoCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: 'Me', tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} /> }}
      />
      {/* Notices and polls are switched off for the pilot; the screen stays in
          the codebase but is kept out of the tab bar. */}
      <Tabs.Screen name="community" options={{ href: null }} />
      {/* The old More tab, now a redirect to Me. */}
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
