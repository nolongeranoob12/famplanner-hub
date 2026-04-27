import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Native iOS/Android push registration via Capacitor.
 *
 * Auto-requests permission at app launch (no button tap required) and stores
 * the device's APNs/FCM token in `push_subscriptions` so the backend can
 * deliver pushes. Backend APNs delivery is not yet wired — web push still
 * works in parallel via usePushSubscription.
 */
export function useNativePush(currentUserId: string | null, displayName: string) {
  useEffect(() => {
    if (!currentUserId) return;
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;

    (async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();
      } catch (err) {
        console.error('[NativePush] register failed', err);
      }
    })();

    const regHandle = PushNotifications.addListener('registration', async (token) => {
      if (!mounted) return;
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: currentUserId,
            member_name: displayName,
            endpoint: `apns://${token.value}`,
            p256dh: 'native',
            auth: 'native',
          } as any,
          { onConflict: 'endpoint' }
        );
      } catch (err) {
        console.error('[NativePush] save token failed', err);
      }
    });

    const errHandle = PushNotifications.addListener('registrationError', (err) => {
      console.error('[NativePush] registrationError', err);
    });

    return () => {
      mounted = false;
      regHandle.then((h) => h.remove());
      errHandle.then((h) => h.remove());
    };
  }, [currentUserId, displayName]);
}
