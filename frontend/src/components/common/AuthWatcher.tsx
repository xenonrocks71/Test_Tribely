"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { authService, getAuthCookie, setAuthCookie, clearAuthCookie } from "@/services/auth.service";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/protocol",
  "/security",
  "/support",
  "/transparency",
];

/**
 * AuthWatcher
 * Actively monitors browser session cookies and localStorage.
 * If the user clears cookies or storage in browser settings or DevTools,
 * it immediately terminates the session and brings them to the /login window.
 */
export function AuthWatcher() {
  const pathname = usePathname();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPublic = PUBLIC_PATHS.some((p) =>
      p === "/" ? pathname === "/" : pathname?.startsWith(p)
    );

    const checkSession = () => {
      const storageToken =
        localStorage.getItem("tribely_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token");
      const cookieToken = getAuthCookie();

      // If user is on a public route, do not force-redirect
      if (isPublic) {
        // If cookie and storage are both present or syncable, sync them
        if (storageToken && !cookieToken) {
          setAuthCookie(storageToken);
        }
        return;
      }

      // On protected routes:
      // First-time sync: if existing session has storage token but cookie wasn't set yet
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        if (storageToken && !cookieToken) {
          setAuthCookie(storageToken);
          return;
        }
      }

      // If either cookie or storage was cleared for a logged-in user on a protected route:
      if (!cookieToken || !storageToken) {
        authService.logout();
        clearAuthCookie();
        if (pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    };

    // 1. Initial check
    checkSession();

    // 2. Storage event (fires when localStorage is cleared in DevTools or across tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "tribely_token" || e.key === "token" || e.key === null) {
        checkSession();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Window focus & visibility (fires immediately when user clicks back from DevTools Application tab)
    const handleFocusOrVisibility = () => {
      checkSession();
    };
    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    // 4. Periodic 1-second heartbeat check
    const interval = setInterval(checkSession, 1000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
      clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
