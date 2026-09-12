import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Registers this device for push, once the user is signed in.
 *
 * Deliberately quiet: a resident who declines notifications, or runs the app
 * in a simulator, should see no error — they simply do not get pushes. The
 * token is upserted so reinstalls and token rotations do not pile up rows.
 */
export function usePushRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const register = async () => {
      // Push needs real hardware; simulators have no token to hand out.
      if (!Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted' || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Community updates',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;

      try {
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;

        await supabase.from('device_push_tokens').upsert(
          {
            user_id: userId,
            token: token.data,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            app_version: Constants.expoConfig?.version ?? null,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        );
      } catch {
        // A missing EAS project or a revoked permission both land here. Neither
        // is worth interrupting the user over.
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
