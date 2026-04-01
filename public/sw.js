// Service Worker for Chau Family PWA — push notifications + badge

self.addEventListener("push", (event) => {
  let data = { title: "Chau Family", body: "Someone updated an activity" };
  try {
    data = event.data.json();
  } catch {
    // use defaults
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        vibrate: [200, 100, 200],
        tag: "activity-update",
        renotify: true,
      }),
      // Set app badge count
      navigator.setAppBadge ? navigator.setAppBadge(1) : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
