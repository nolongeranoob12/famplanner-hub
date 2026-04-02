// Service Worker for Chau Family PWA — push notifications + badge

// This file supplements VitePWA's generated SW with push handling.
// Badge count stored in a simple variable (resets on SW restart, but good enough)
let badgeCount = 0;

self.addEventListener("push", (event) => {
  let data = { title: "Chau Family", body: "Someone updated an activity" };
  try {
    data = event.data.json();
  } catch {
    // use defaults
  }

  badgeCount += 1;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        vibrate: [200, 100, 200],
        tag: "activity-update-" + Date.now(),
        renotify: true,
        data: { url: "/" },
      }),
      navigator.setAppBadge ? navigator.setAppBadge(badgeCount) : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  badgeCount = 0;
  if (navigator.clearAppBadge) navigator.clearAppBadge();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

// Clear badge when user opens/focuses the app
self.addEventListener("message", (event) => {
  if (event.data === "clear-badge" || event.data?.type === "clear-badge") {
    badgeCount = 0;
    if (navigator.clearAppBadge) navigator.clearAppBadge();
  }

  if (event.data?.type === "set-badge-count") {
    badgeCount = Math.max(0, Number(event.data.count) || 0);

    if (badgeCount > 0) {
      if (navigator.setAppBadge) event.waitUntil(navigator.setAppBadge(badgeCount));
      return;
    }

    if (navigator.clearAppBadge) event.waitUntil(navigator.clearAppBadge());
  }
});
