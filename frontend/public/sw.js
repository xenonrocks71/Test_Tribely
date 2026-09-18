/* 
  Tribely WebPush & PWA Native Service Worker.
  Listens for background push notifications, enables offline caching,
  and fulfills complete Progressive Web App (PWA) installation criteria.
*/

const CACHE_NAME = "tribely-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/icons/BrandNewLook.png",
  "/icons/BrandLogo.png",
  "/icon.png",
  "/favicon.ico",
];

// Install event: precache essential assets & skip waiting
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("SW precache error:", err);
      });
    })
  );
});

// Activate event: claim clients & clean outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      }),
    ])
  );
});

// Fetch event: Network-first strategy with cache fallback
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;

  // Skip real-time APIs & WebSocket endpoints
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith("/icons/") ||
            url.pathname.endsWith(".png") ||
            url.pathname.endsWith(".ico") ||
            url.pathname.endsWith(".woff2"))
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
  );
});

// Push notification event listener
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Tribely Notification";
    const options = {
      body: payload.body || "New update in your habit arena!",
      icon: payload.icon || "/icons/BrandNewLook.png",
      badge: payload.badge || "/icons/BrandNewLook.png",
      vibrate: [100, 50, 100],
      data: payload.data || {},
      actions: [
        { action: "open", title: "View Arena 🚀" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Service worker push event error:", err);
  }
});

// Notification click event listener
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl =
    event.notification.data && event.notification.data.url
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
