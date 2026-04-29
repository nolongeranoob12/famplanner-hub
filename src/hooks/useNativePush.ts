import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { supabase } from '@/integrations/supabase/client';

export type NativePushReason =
  | 'no-user'
  | 'no-family'
  | 'unsupported'
  | 'permission-pending'
  | 'blocked'
  | 'subscribe-failed'
  | 'register-timeout';

export type NativePushResult =
  | { ok: true }
  | { ok: false; reason: NativePushReason; detail?: string };

/**
 * Native iOS/Android push registration via Capacitor.
 *
 * Auto-requests permission at app launch and stores the device APNs/FCM token
 * so the backend can deliver real background/closed-app notifications.
 */
export function useNativePush(currentUserId: string | null, displayName: string, familyId: string | null) {
  const [subscribed, setSubscribed] = useState<boolean | null>(
    Capacitor.isNativePlatform() ? null : false
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const tokenResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const listenersReadyRef = useRef(false);

  const register = useCallback(async (options: { requestPermission?: boolean } = {}): Promise<NativePushResult> => {
    if (!currentUserId) return { ok: false, reason: 'no-user' };
    if (!familyId) return { ok: false, reason: 'no-family' };
    if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'unsupported' };

    try {
      const requestPermission = options.requestPermission ?? true;
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        if (!requestPermission) {
          setSubscribed(false);
          setLastError(null);
          return { ok: false, reason: 'permission-pending' };
        }
        perm = await PushNotifications.requestPermissions();
      }

      await Badge.requestPermissions().catch(() => undefined);

      if (perm.receive !== 'granted') {
        setSubscribed(false);
        setLastError('Permission denied. Enable notifications for this app in iOS Settings.');
        return { ok: false, reason: 'blocked' };
      }

      if (!listenersReadyRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      // Wait for the 'registration' listener to actually save the token
      // (or for a timeout). This way the UI knows whether APNs returned a token.
      const tokenSaved = new Promise<boolean>((resolve) => {
        tokenResolverRef.current = resolve;
        setTimeout(() => {
          if (tokenResolverRef.current) {
            tokenResolverRef.current = null;
            resolve(false);
          }
        }, 10_000);
      });

      await PushNotifications.register();
      const ok = await tokenSaved;
      if (!ok) {
        setSubscribed(false);
        setLastError(
          'iOS did not return an APNs token. Most likely the app needs the Push Notifications capability enabled in Xcode (Signing & Capabilities → + Capability → Push Notifications).'
        );
        return { ok: false, reason: 'register-timeout' };
      }
      setSubscribed(true);
      setLastError(null);
      return { ok: true };
    } catch (err) {
      console.error('[NativePush] register failed', err);
      setSubscribed(false);
      const detail = (err as Error)?.message ?? String(err);
      setLastError(detail);
      return { ok: false, reason: 'subscribe-failed', detail };
    }
  }, [currentUserId, familyId]);

  useEffect(() => {
    if (!currentUserId || !familyId || !Capacitor.isNativePlatform()) return;

    let mounted = true;
    let handles: Array<{ remove: () => Promise<void> }> = [];

    const setup = async () => {
      const regHandle = await PushNotifications.addListener('registration', async (token) => {
      if (!mounted) return;
      try {
        const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : Capacitor.getPlatform();
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: currentUserId,
            family_id: familyId,
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
        if (error) throw error;
        setSubscribed(true);
        setLastError(null);
        tokenResolverRef.current?.(true);
        tokenResolverRef.current = null;
      } catch (err) {
        console.error('[NativePush] save token failed', err);
        setSubscribed(false);
        setLastError(`Saving token failed: ${(err as Error)?.message ?? String(err)}`);
        tokenResolverRef.current?.(false);
        tokenResolverRef.current = null;
      }
    });

      const errHandle = await PushNotifications.addListener('registrationError', (err) => {
      console.error('[NativePush] registrationError', err);
      setSubscribed(false);
      setLastError(`APNs registration error: ${err?.error ?? 'unknown'}`);
      tokenResolverRef.current?.(false);
      tokenResolverRef.current = null;
    });

      const receiveHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      window.dispatchEvent(new CustomEvent('native-push-received'));
      if (typeof notification.badge === 'number') {
        Badge.set({ count: notification.badge }).catch(() => undefined);
      }
    });

      const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.dispatchEvent(new CustomEvent('native-push-received'));
      if (window.location.pathname !== '/') window.location.assign('/');
    });

      handles = [regHandle, errHandle, receiveHandle, actionHandle];
      listenersReadyRef.current = true;
      await register({ requestPermission: false });
    };

    setup();

    return () => {
      mounted = false;
      listenersReadyRef.current = false;
      handles.forEach((h) => h.remove());
    };
  }, [currentUserId, displayName, familyId, register]);

  return { subscribed, subscribe: register, lastError };
}
