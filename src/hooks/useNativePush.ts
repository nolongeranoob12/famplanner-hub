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
let registrationAttempt = 0;
let pendingAttemptId: number | null = null;

export interface NativePushLogEntry {
  id: number;
  at: string;
  attemptId: number | null;
  step: string;
  details?: Record<string, unknown>;
  level: 'info' | 'warn' | 'error';
}

const MAX_LOG_ENTRIES = 200;
const nativePushLogBuffer: NativePushLogEntry[] = [];
const nativePushLogListeners = new Set<(entries: NativePushLogEntry[]) => void>();
let nativePushLogId = 0;

function emitNativePushLog(entry: NativePushLogEntry) {
  nativePushLogBuffer.push(entry);
  if (nativePushLogBuffer.length > MAX_LOG_ENTRIES) {
    nativePushLogBuffer.splice(0, nativePushLogBuffer.length - MAX_LOG_ENTRIES);
  }
  // Persist a small ring buffer so /debug can show logs even after navigation.
  try {
    localStorage.setItem('native-push-logs', JSON.stringify(nativePushLogBuffer.slice(-MAX_LOG_ENTRIES)));
  } catch {
    // ignore quota errors
  }
  const snapshot = [...nativePushLogBuffer];
  nativePushLogListeners.forEach((l) => {
    try { l(snapshot); } catch { /* noop */ }
  });
}

export function getNativePushLogs(): NativePushLogEntry[] {
  if (nativePushLogBuffer.length === 0) {
    try {
      const stored = localStorage.getItem('native-push-logs');
      if (stored) {
        const parsed = JSON.parse(stored) as NativePushLogEntry[];
        if (Array.isArray(parsed)) {
          nativePushLogBuffer.push(...parsed);
          nativePushLogId = Math.max(nativePushLogId, ...parsed.map((p) => p.id ?? 0));
        }
      }
    } catch {
      // ignore
    }
  }
  return [...nativePushLogBuffer];
}

export function subscribeNativePushLogs(listener: (entries: NativePushLogEntry[]) => void): () => void {
  nativePushLogListeners.add(listener);
  return () => { nativePushLogListeners.delete(listener); };
}

export function clearNativePushLogs() {
  nativePushLogBuffer.length = 0;
  try { localStorage.removeItem('native-push-logs'); } catch { /* noop */ }
  nativePushLogListeners.forEach((l) => { try { l([]); } catch { /* noop */ } });
}

function nativePushLog(
  attemptId: number | null,
  step: string,
  details?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const prefix = attemptId ? `[NativePush #${attemptId}]` : '[NativePush]';
  const at = new Date().toISOString();
  const payload = { at, ...(details ?? {}) };
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`${prefix} ${step}`, payload);
  emitNativePushLog({
    id: ++nativePushLogId,
    at,
    attemptId,
    step,
    details,
    level,
  });
}

function resolvePending(result: { ok: true } | { ok: false; reason: NativePushReason; detail?: string }) {
  nativePushLog(pendingAttemptId, 'resolving pending registration', {
    ok: result.ok,
    reason: result.ok ? undefined : (result as Exclude<NativePushResult, { ok: true }>).reason,
  });
  const r = tokenResolver;
  tokenResolver = null;
  pendingAttemptId = null;
  r?.(result);
}

async function saveTokenToBackend(token: string, ctx: PendingContext) {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : Capacitor.getPlatform();
  nativePushLog(null, 'saving native token to backend', {
    platform,
    userId: ctx.userId,
    familyId: ctx.familyId,
    memberName: ctx.displayName,
    tokenLength: token.length,
    tokenPreview: token.slice(0, 12),
  });
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
  nativePushLog(null, 'native token saved successfully', { platform, userId: ctx.userId });
}

async function initializeListenersOnce() {
  if (listenersInitialized) {
    nativePushLog(null, 'listeners already initialized');
    return;
  }
  if (!Capacitor.isNativePlatform()) {
    nativePushLog(null, 'skipping listener init: not native platform', { platform: Capacitor.getPlatform() });
    return;
  }
  nativePushLog(null, 'initializing Capacitor push listeners', { platform: Capacitor.getPlatform() });
  listenersInitialized = true;

  await PushNotifications.addListener('registration', async (token: Token) => {
    nativePushLog(pendingAttemptId, 'registration listener fired: native token received', {
      tokenLength: token.value?.length ?? 0,
      tokenPreview: token.value?.slice(0, 12),
      hasPendingContext: !!pendingContext,
      hasResolver: !!tokenResolver,
    });
    const ctx = pendingContext;
    if (!ctx) {
      nativePushLog(null, 'registration fired with no pending context', undefined, 'warn');
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
    console.error('[NativePush] registrationError', {
      at: new Date().toISOString(),
      attemptId: pendingAttemptId,
      detail,
      hasPendingContext: !!pendingContext,
      hasResolver: !!tokenResolver,
    });
    resolvePending({
      ok: false,
      reason: 'apns-error',
      detail: `iOS rejected APNs registration: ${detail}. Check that the build is signed with a provisioning profile that includes the Push Notifications entitlement (aps-environment).`,
    });
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    nativePushLog(null, 'pushNotificationReceived listener fired', {
      id: notification.id,
      title: notification.title,
      badge: notification.badge,
    });
    window.dispatchEvent(new CustomEvent('native-push-received'));
    if (typeof notification.badge === 'number') {
      Badge.set({ count: notification.badge }).catch(() => undefined);
    }
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    nativePushLog(null, 'pushNotificationActionPerformed listener fired');
    window.dispatchEvent(new CustomEvent('native-push-received'));
    if (window.location.pathname !== '/') window.location.assign('/');
  });

  nativePushLog(null, 'Capacitor push listeners initialized');
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
      const attemptId = ++registrationAttempt;
      nativePushLog(attemptId, 'register() requested', {
        platform: Capacitor.getPlatform(),
        isNativePlatform: Capacitor.isNativePlatform(),
        hasUserId: !!currentUserId,
        hasFamilyId: !!familyId,
        displayName,
        requestPermission: options.requestPermission ?? true,
      });

      if (!currentUserId) {
        nativePushLog(attemptId, 'aborting: missing currentUserId');
        return { ok: false, reason: 'no-user' };
      }
      if (!familyId) {
        nativePushLog(attemptId, 'aborting: missing familyId');
        return { ok: false, reason: 'no-family' };
      }
      if (!Capacitor.isNativePlatform()) {
        nativePushLog(attemptId, 'aborting: not native platform', { platform: Capacitor.getPlatform() });
        return { ok: false, reason: 'unsupported' };
      }

      try {
        nativePushLog(attemptId, 'initializing listeners before permission check');
        await initializeListenersOnce();

        const requestPermission = options.requestPermission ?? true;
        nativePushLog(attemptId, 'checking notification permissions');
        let perm = await PushNotifications.checkPermissions();
        nativePushLog(attemptId, 'checkPermissions() resolved', { receive: perm.receive });
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          if (!requestPermission) {
            nativePushLog(attemptId, 'permission prompt required but silent registration requested');
            setSubscribed(false);
            setLastError(null);
            return { ok: false, reason: 'permission-pending' };
          }
          nativePushLog(attemptId, 'requesting notification permissions');
          perm = await PushNotifications.requestPermissions();
          nativePushLog(attemptId, 'requestPermissions() resolved', { receive: perm.receive });
        } else {
          nativePushLog(attemptId, 'requestPermissions() skipped because permission is already decided', { receive: perm.receive });
        }

        nativePushLog(attemptId, 'requesting badge permission');
        await Badge.requestPermissions()
          .then(() => nativePushLog(attemptId, 'badge permission request resolved'))
          .catch((err) => nativePushLog(attemptId, 'badge permission request failed/non-fatal', { detail: (err as Error)?.message ?? String(err) }));

        if (perm.receive !== 'granted') {
          nativePushLog(attemptId, 'aborting: notification permission not granted', { receive: perm.receive });
          setSubscribed(false);
          setLastError('Permission denied. Enable notifications for this app in iOS Settings.');
          return { ok: false, reason: 'blocked' };
        }

        // Set the pending context BEFORE calling register so the listener has
        // the user/family info when iOS hands back the token.
        pendingContext = { userId: currentUserId, familyId, displayName };
        pendingAttemptId = attemptId;
        nativePushLog(attemptId, 'pending context set; calling PushNotifications.register() after permissions resolved', {
          permissionReceive: perm.receive,
          hasResolverBeforeSet: !!tokenResolver,
        });

        const result = await new Promise<NativePushResult>((resolve) => {
          nativePushLog(attemptId, 'token promise created and resolver installed');
          tokenResolver = resolve;
          const timeoutId = setTimeout(() => {
            if (tokenResolver === resolve) {
              nativePushLog(attemptId, 'timed out waiting for registration listener token');
              tokenResolver = null;
              pendingAttemptId = null;
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
              nativePushLog(attemptId, 'PushNotifications.register() resolved; waiting for registration listener token');
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              if (tokenResolver === resolve) {
                nativePushLog(attemptId, 'PushNotifications.register() rejected', { detail: (err as Error)?.message ?? String(err) });
                tokenResolver = null;
                pendingAttemptId = null;
                resolve({
                  ok: false,
                  reason: 'subscribe-failed',
                  detail: (err as Error)?.message ?? String(err),
                });
              }
            });
        });

        if (result.ok === true) {
          nativePushLog(attemptId, 'registration flow completed successfully');
          setSubscribed(true);
          setLastError(null);
        } else {
          nativePushLog(attemptId, 'registration flow completed with failure', {
            reason: result.reason,
            detail: result.detail,
          });
          setSubscribed(false);
          setLastError(result.detail ?? null);
        }
        return result;
      } catch (err) {
        console.error('[NativePush] register failed', { at: new Date().toISOString(), attemptId, err });
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
    if (!currentUserId || !familyId || !Capacitor.isNativePlatform()) {
      nativePushLog(null, 'silent auto-registration skipped', {
        hasUserId: !!currentUserId,
        hasFamilyId: !!familyId,
        isNativePlatform: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
      });
      return;
    }
    let cancelled = false;
    (async () => {
      nativePushLog(null, 'silent auto-registration effect started', { currentUserId, familyId });
      await initializeListenersOnce();
      if (cancelled) return;
      const perm = await PushNotifications.checkPermissions();
      nativePushLog(null, 'silent auto-registration permission check resolved', {
        receive: perm.receive,
        lastTokenSavedFor,
        currentUserId,
      });
      if (perm.receive === 'granted' && lastTokenSavedFor !== currentUserId) {
        nativePushLog(null, 'silent auto-registration calling register()', { currentUserId });
        await register({ requestPermission: false });
      } else if (perm.receive === 'granted') {
        nativePushLog(null, 'silent auto-registration already has token for user; marking subscribed');
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
