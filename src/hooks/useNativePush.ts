import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { supabase } from '@/integrations/supabase/client';

/**
 * Native iOS/Android push registration via Capacitor.
 *
 * Auto-requests permission at app launch and stores the device APNs/FCM token
 * so the backend can deliver real background/closed-app notifications.
 */
export function useNativePush(currentUserId: string | null, displayName: string) {
  const [subscribed, setSubscribed] = useState<boolean | null>(Capacitor.isNativePlatform() ? null : false);

  const register = useCallback(async () => {
    if (!currentUserId) return { ok: false as const, reason: 'no-user' as const };
    if (!Capacitor.isNativePlatform()) return { ok: false as const, reason: 'unsupported' as const };

    try {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        perm = await PushNotifications.requestPermissions();
      }

      await Badge.requestPermissions().catch(() => undefined);

      if (perm.receive !== 'granted') {
        setSubscribed(false);
        return { ok: false as const, reason: 'blocked' as const };
      }

      await PushNotifications.register();
      setSubscribed(true);
      return { ok: true as const };
    } catch (err) {
      console.error('[NativePush] register failed', err);
      setSubscribed(false);
      return { ok: false as const, reason: 'subscribe-failed' as const, detail: (err as Error)?.message ?? String(err) };
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !Capacitor.isNativePlatform()) return;

    let mounted = true;
    register();

    const regHandle = PushNotifications.addListener('registration', async (token) => {
      if (!mounted) return;
      try {
        const platform = Capacitor.getPlatform();
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: currentUserId,
            member_name: displayName,
            endpoint: `apns://${token.value}`,
            p256dh: 'native',
            auth: 'native',
            platform,
            device_token: token.value,
            bundle_id: 'com.nolongeranoob12.famplannerhub',
          } as any,
          { onConflict: 'device_token' }
        );
        setSubscribed(true);
      } catch (err) {
        console.error('[NativePush] save token failed', err);
        setSubscribed(false);
      }
    });

    const errHandle = PushNotifications.addListener('registrationError', (err) => {
      console.error('[NativePush] registrationError', err);
      setSubscribed(false);
    });

    const receiveHandle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      window.dispatchEvent(new CustomEvent('native-push-received'));
      if (typeof notification.badge === 'number') {
        Badge.set({ count: notification.badge }).catch(() => undefined);
      }
    });

    const actionHandle = PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.dispatchEvent(new CustomEvent('native-push-received'));
      if (window.location.pathname !== '/') window.location.assign('/');
    });

    return () => {
      mounted = false;
      regHandle.then((h) => h.remove());
      errHandle.then((h) => h.remove());
      receiveHandle.then((h) => h.remove());
      actionHandle.then((h) => h.remove());
    };

  }, [currentUserId, displayName, register]);

  return { subscribed, subscribe: register };
}
