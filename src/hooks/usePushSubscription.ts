import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'OqtFyKuJTpwMOBrxkH-e9k8kieCQxL6wtNBgcnGa9l7QnosEqt7FlqqpRnW4Q6zzu5-2Tihn2_O3b57jeM0k6A';

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

export function usePushSubscription(currentUser: string | null) {
  useEffect(() => {
    if (!currentUser) return;

    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovableproject.com');

    if (isInIframe || isPreviewHost) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const existingSub = await registration.pushManager.getSubscription();
        let sub = existingSub;

        if (!sub) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const key = sub.getKey('p256dh');
        const auth = sub.getKey('auth');
        if (!key || !auth) return;

        const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
        const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

        // Upsert subscription to database
        await (supabase as any).from('push_subscriptions').upsert(
          {
            member_name: currentUser,
            endpoint: sub.endpoint,
            p256dh,
            auth: authKey,
          },
          { onConflict: 'endpoint' }
        );
      } catch (err) {
        console.error('Push subscription failed:', err);
      }
    }

    subscribe();
  }, [currentUser]);
}
