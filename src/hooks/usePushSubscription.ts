import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'OqtFyKuJTpwMOBrxkH-e9k8kieCQxL6wtNBgcnGa9l7QnosEqt7FlqqpRnW4Q6zzu5-2Tihn2_O3b57jeM0k6A';

type SubscribeFailureReason =
  | 'no-user'
  | 'preview'
  | 'ios-home-screen'
  | 'unsupported'
  | 'blocked'
  | 'save-failed'
  | 'subscribe-failed';

type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeFailureReason };

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isBlockedEnv() {
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const isPreviewHost =
    window.location.hostname.includes('id-preview--') ||
    window.location.hostname.includes('lovableproject.com');

  return isInIframe || isPreviewHost;
}

async function ensureServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/');
  if (existingRegistration) return existingRegistration;

  return navigator.serviceWorker.register('/sw.js');
}

export function usePushSubscription(currentUser: string | null) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  const doSubscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (!currentUser) return { ok: false, reason: 'no-user' };
    if (isBlockedEnv()) return { ok: false, reason: 'preview' };
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

      const key = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      if (!key || !auth) {
        setSubscribed(false);
        return { ok: false, reason: 'subscribe-failed' };
      }

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          member_name: currentUser,
          endpoint: sub.endpoint,
          p256dh,
          auth: authKey,
        },
        { onConflict: 'endpoint' }
      );

      if (error) {
        console.error('Failed to save push subscription:', error);
        setSubscribed(false);
        return { ok: false, reason: 'save-failed' };
      }

      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      console.error('Push subscription failed:', err);
      setSubscribed(false);
      return { ok: false, reason: 'subscribe-failed' };
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || isBlockedEnv()) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSubscribed(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const registration = await ensureServiceWorkerRegistration();
        await navigator.serviceWorker.ready;

        const sub = await registration.pushManager.getSubscription();
        if (cancelled) return;

        setSubscribed(!!sub);

        if (!sub && Notification.permission === 'granted') {
          const result = await doSubscribe();
          if (!result.ok && !cancelled) {
            setSubscribed(false);
          }
        }
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, doSubscribe]);

  return { subscribed, subscribe: doSubscribe };
}
