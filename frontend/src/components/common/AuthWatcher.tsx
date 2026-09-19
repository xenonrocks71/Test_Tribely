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

      // Bi-directional token synchronization:
      // If token exists in localStorage, ensure cookie is set
      if (storageToken && !cookieToken) {
        setAuthCookie(storageToken);
      }
      // If token exists in cookie, ensure localStorage is populated
      if (cookieToken && !storageToken) {
        try {
          localStorage.setItem("tribely_token", cookieToken);
          localStorage.setItem("token", cookieToken);
        } catch {}
      }

      // If user is on a public route, never redirect
      if (isPublic) return;

      // On protected routes: only if neither storage nor cookie has an active session
      const hasAnyToken = Boolean(storageToken || cookieToken);
      if (!hasAnyToken) {
        if (pathname !== "/login" && pathname !== "/register") {
          window.location.href = `/login?redirect=${encodeURIComponent(pathname || "/feed")}`;
        }
      }
    };

    // 1. Initial check
    checkSession();

    // 2. Storage event (fires when localStorage is cleared in another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "tribely_token" || e.key === "token" || e.key === null) {
        checkSession();
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Window focus & visibility
    const handleFocusOrVisibility = () => {
      checkSession();
    };
    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, [pathname]);

  return null;
}
