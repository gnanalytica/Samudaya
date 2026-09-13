import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnreadCount } from '../lib/notifications';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/** The header bell on Home and Events, with the unread count. */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const unread = useUnreadCount();
  const label = unread > 99 ? '99+' : String(unread);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20, color: colors.ink }}>🔔</Text>
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: spacing.sm,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
