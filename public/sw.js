import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

let badgeCount = 0;

function syncBadge(count) {
  badgeCount = Math.max(0, Number(count) || 0);

  if (badgeCount > 0) {
    return navigator.setAppBadge ? navigator.setAppBadge(badgeCount) : Promise.resolve();
  }

  return navigator.clearAppBadge ? navigator.clearAppBadge() : Promise.resolve();
}

self.addEventListener('push', (event) => {
  let data = { title: 'Chau Family', body: 'Someone updated an activity', url: '/', badgeCount: badgeCount + 1 };

  try {
    const parsed = event.data?.json?.() ?? {};
    data = {
      ...data,
      ...parsed,
      badgeCount:
        typeof parsed.badgeCount === 'number'
          ? parsed.badgeCount
          : typeof parsed.badge_count === 'number'
            ? parsed.badge_count
            : data.badgeCount,
    };
  } catch {
    // use defaults
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        vibrate: [200, 100, 200],
        tag: 'activity-update-' + Date.now(),
        renotify: true,
        data: { url: data.url || '/' },
      }),
      syncBadge(data.badgeCount),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    Promise.all([
      syncBadge(0),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) return client.focus();
        }

        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-badge' || event.data?.type === 'clear-badge') {
    event.waitUntil(syncBadge(0));
    return;
  }

  if (event.data?.type === 'set-badge-count') {
    event.waitUntil(syncBadge(event.data.count));
  }
});
