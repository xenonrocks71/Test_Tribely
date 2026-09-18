"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Check for updates periodically
            reg.update().catch(() => {});
          })
          .catch((e) => {
            console.warn("SW registration error:", e);
          });
      });
    }
  }, []);

  return null;
}
