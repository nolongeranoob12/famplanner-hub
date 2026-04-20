import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'OqtFyKuJTpwMOBrxkH-e9k8kieCQxL6wtNBgcnGa9l7QnosEqt7FlqqpRnW4Q6zzu5-2Tihn2_O3b57jeM0k6A';

export type SubscribeFailureReason =
  | 'no-user'
  | 'preview'
  | 'ios-home-screen'
  | 'unsupported'
  | 'blocked'
  | 'save-failed'
  | 'subscribe-failed';

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeFailureReason; detail?: string };

function isIosNotStandalone() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  return !('standalone' in navigator && (navigator as any).standalone);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  if (outputArray.length === 64) {
    const normalizedKey = new Uint8Array(65);
    normalizedKey[0] = 0x04;
    normalizedKey.set(outputArray, 1);
    return normalizedKey;
  }
  return outputArray;
}

function isBlockedEnv() {
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreviewHost =
    window.location.hostname.includes('id-preview--') ||
    window.location.hostname.includes('lovableproject.com');
  return isInIframe || isPreviewHost;
}

async function ensureServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

function toBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function saveSubscription(userId: string, displayName: string, sub: PushSubscription) {
  const key = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  if (!key || !auth) return { ok: false as const, reason: 'subscribe-failed' as const };

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      member_name: displayName,
      endpoint: sub.endpoint,
      p256dh: toBase64(key),
      auth: toBase64(auth),
    } as any,
    { onConflict: 'endpoint' }
  );

  if (error) {
    console.error('Failed to save push subscription:', error);
    return { ok: false as const, reason: 'save-failed' as const };
  }
  return { ok: true as const };
}

export function usePushSubscription(currentUserId: string | null, displayName: string) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  const doSubscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (!currentUserId) return { ok: false, reason: 'no-user' };
    if (isBlockedEnv()) return { ok: false, reason: 'preview' };
    if (isIosNotStandalone()) return { ok: false, reason: 'ios-home-screen' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return { ok: false, reason: 'unsupported' };
    }

    try {
      const registration = await ensureServiceWorkerRegistration();
      await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        if (Notification.permission === 'denied') {
          setSubscribed(false);
          return { ok: false, reason: 'blocked' };
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setSubscribed(false);
          return { ok: false, reason: 'blocked' };
        }
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const saved = await saveSubscription(currentUserId, displayName, sub);
      if (!saved.ok) { setSubscribed(false); return saved; }
      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      setSubscribed(false);
      return { ok: false, reason: 'subscribe-failed', detail: (err as Error)?.message ?? String(err) };
    }
  }, [currentUserId, displayName]);

  useEffect(() => {
    if (!currentUserId || isBlockedEnv()) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSubscribed(false);
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        const registration = await ensureServiceWorkerRegistration();
        await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (sub) {
          const saved = await saveSubscription(currentUserId, displayName, sub);
          if (!cancelled) setSubscribed(saved.ok);
          return;
        }
        setSubscribed(false);
        if (Notification.permission === 'granted' || Notification.permission === 'default') {
          const result = await doSubscribe();
          if (!result.ok && !cancelled) setSubscribed(false);
        }
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    };

    sync();
    const interval = setInterval(sync, 30 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUserId, displayName, doSubscribe]);

  return { subscribed, subscribe: doSubscribe };
}
