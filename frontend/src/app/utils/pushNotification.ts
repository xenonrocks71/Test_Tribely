import api from "./api";

/**
 * Utility helper to register PWA Service Worker and request native device push notification permissions.
 */
export async function initPushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    console.warn("Web Push notifications are not supported in this browser environment.");
    return false;
  }

  try {
    // 1. Register PWA Service Worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[ServiceWorker] Registered with scope:", registration.scope);

    // 2. Request OS Notification permission
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.warn("User notification permission state:", permission);
      return false;
    }

    // 3. Register push subscription with backend
    if ("pushManager" in registration) {
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        // Sample public VAPID key (base64url)
        const dummyVapidKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv69yViEuiBIa";
        try {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: dummyVapidKey
          });
        } catch {
          /* Fall back if VAPID server key is invalid in local dev */
        }
      }

      if (sub) {
        const subJson = sub.toJSON();
        await api.post("/api/notifications/subscribe", {
          endpoint: sub.endpoint,
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
          device_type: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile_pwa" : "desktop_os"
        }).catch(() => {});
      }
    }

    return true;
  } catch (err) {
    console.error("Push notification setup error:", err);
    return false;
  }
}
