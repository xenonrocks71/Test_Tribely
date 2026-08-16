/* 
  Tribely WebPush & PWA Native Service Worker.
  Listens for background push notifications from Meta/Instagram scale Pub/Sub engine
  and displays device notifications on Mobile (Android/iOS PWA) & Desktop OS machines.
*/

self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Tribely Notification";
    const options = {
      body: payload.body || "New update in your habit arena!",
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/badge-72x72.png",
      vibrate: [100, 50, 100],
      data: payload.data || {},
      actions: [
        { action: "open", title: "View Arena 🚀" },
        { action: "dismiss", title: "Dismiss" }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Service worker push event error:", err);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
