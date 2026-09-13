import { Redirect, Tabs } from 'expo-router';
import { COPY, can } from '@samudaya/core';
import { Text, type ColorValue } from 'react-native';
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

export default function TabsLayout() {
  const { colors } = useTheme();
  const { loading, user, memberships, welcomedAt, viewRole } = useAuth();
  // The committee's resident view hides Manage, exactly as residents see it.
  const staffView = can(viewRole, 'events:manage');
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
        tabBarStyle: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.border },
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
