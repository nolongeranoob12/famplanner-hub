import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { supabase } from '@/integrations/supabase/client';

export type NativePushReason =
  | 'no-user'
  | 'no-family'
  | 'unsupported'
  | 'permission-pending'
  | 'blocked'
  | 'subscribe-failed'
  | 'register-timeout'
  | 'apns-error';

export type NativePushResult =
  | { ok: true }
  | { ok: false; reason: NativePushReason; detail?: string };

/**
 * Native iOS/Android push registration via Capacitor.
 *
 * IMPORTANT: Capacitor push listeners are registered ONCE at module level
 * (not inside an effect that re-runs on every render). Re-registering them
 * inside a React effect caused the 'registration' event to fire while
 * listeners were being torn down, producing false "no APNs token" errors
 * even when the iOS Push Notifications capability is correctly configured.
 */

interface PendingContext {
  userId: string;
  familyId: string;
  displayName: string;
}

let listenersInitialized = false;
let pendingContext: PendingContext | null = null;
let tokenResolver: ((result: { ok: true } | { ok: false; reason: NativePushReason; detail?: string }) => void) | null = null;
let lastTokenSavedFor: string | null = null; // userId for which we last saved a token

function resolvePending(result: { ok: true } | { ok: false; reason: NativePushReason; detail?: string }) {
  const r = tokenResolver;
  tokenResolver = null;
  r?.(result);
}

async function saveTokenToBackend(token: string, ctx: PendingContext) {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : Capacitor.getPlatform();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: ctx.userId,
      family_id: ctx.familyId,
      member_name: ctx.displayName,
      endpoint: `apns://${token}`,
      p256dh: 'native',
      auth: 'native',
      platform,
      device_token: token,
      bundle_id: 'com.nolongeranoob12.famplannerhub',
    } as any,
    { onConflict: 'device_token' }
  );
  if (error) throw error;
  lastTokenSavedFor = ctx.userId;
}

async function initializeListenersOnce() {
  if (listenersInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  listenersInitialized = true;

  await PushNotifications.addListener('registration', async (token: Token) => {
    console.log('[NativePush] APNs token received', token.value?.slice(0, 12));
    const ctx = pendingContext;
    if (!ctx) {
      console.warn('[NativePush] registration fired with no pending context');
      return;
    }
    try {
      await saveTokenToBackend(token.value, ctx);
      resolvePending({ ok: true });
    } catch (err) {
      console.error('[NativePush] save token failed', err);
      resolvePending({
        ok: false,
        reason: 'subscribe-failed',
        detail: `Saving token failed: ${(err as Error)?.message ?? String(err)}`,
      });
    }
  });

  await PushNotifications.addListener('registrationError', (err) => {
    const detail = (err as any)?.error ?? JSON.stringify(err);
    console.error('[NativePush] registrationError', detail);
    resolvePending({
      ok: false,
      reason: 'apns-error',
      detail: `iOS rejected APNs registration: ${detail}. Check that the build is signed with a provisioning profile that includes the Push Notifications entitlement (aps-environment).`,
    });
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    window.dispatchEvent(new CustomEvent('native-push-received'));
    if (typeof notification.badge === 'number') {
      Badge.set({ count: notification.badge }).catch(() => undefined);
    }
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    window.dispatchEvent(new CustomEvent('native-push-received'));
    if (window.location.pathname !== '/') window.location.assign('/');
  });
}

export function useNativePush(currentUserId: string | null, displayName: string, familyId: string | null) {
  const [subscribed, setSubscribed] = useState<boolean | null>(
    Capacitor.isNativePlatform() ? null : false
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const ctxRef = useRef<PendingContext | null>(null);

  // Keep latest context available for the module-level listeners.
  useEffect(() => {
    if (currentUserId && familyId) {
      ctxRef.current = { userId: currentUserId, familyId, displayName };
    } else {
      ctxRef.current = null;
    }
  }, [currentUserId, familyId, displayName]);

  const register = useCallback(
    async (options: { requestPermission?: boolean } = {}): Promise<NativePushResult> => {
      if (!currentUserId) return { ok: false, reason: 'no-user' };
      if (!familyId) return { ok: false, reason: 'no-family' };
      if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'unsupported' };

      try {
        await initializeListenersOnce();

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

        // Set the pending context BEFORE calling register so the listener has
        // the user/family info when iOS hands back the token.
        pendingContext = { userId: currentUserId, familyId, displayName };

        const result = await new Promise<NativePushResult>((resolve) => {
          tokenResolver = resolve;
          const timeoutId = setTimeout(() => {
            if (tokenResolver === resolve) {
              tokenResolver = null;
              resolve({
                ok: false,
                reason: 'register-timeout',
                detail:
                  'iOS did not return an APNs token within 15s. If the Push Notifications capability and aps-environment entitlement are confirmed in Xcode, try: (1) running on a real device (Simulator only supports APNs on iOS 16+ with a signed-in Apple ID), (2) checking that the provisioning profile includes the Push Notifications service, (3) ensuring the device has internet connectivity to Apple servers.',
              });
            }
          }, 15_000);

          PushNotifications.register()
            .then(() => {
              console.log('[NativePush] register() call resolved, waiting for token…');
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              if (tokenResolver === resolve) {
                tokenResolver = null;
                resolve({
                  ok: false,
                  reason: 'subscribe-failed',
                  detail: (err as Error)?.message ?? String(err),
                });
              }
            });
        });

        if (result.ok === true) {
          setSubscribed(true);
          setLastError(null);
        } else {
          setSubscribed(false);
          setLastError(result.detail ?? null);
        }
        return result;
      } catch (err) {
        console.error('[NativePush] register failed', err);
        setSubscribed(false);
        const detail = (err as Error)?.message ?? String(err);
        setLastError(detail);
        return { ok: false, reason: 'subscribe-failed', detail };
      }
    },
    [currentUserId, familyId, displayName]
  );

  // Auto-attempt silent registration once we have user + family, but only if
  // permission was already granted in a previous session.
  useEffect(() => {
    if (!currentUserId || !familyId || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    (async () => {
      await initializeListenersOnce();
      if (cancelled) return;
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'granted' && lastTokenSavedFor !== currentUserId) {
        await register({ requestPermission: false });
      } else if (perm.receive === 'granted') {
        setSubscribed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, familyId]);

  return { subscribed, subscribe: register, lastError };
}
