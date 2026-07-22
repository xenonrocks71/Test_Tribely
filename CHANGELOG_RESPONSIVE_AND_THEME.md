# Tribely - File-by-File Responsive, Theme & Network IP Changelog

> **Document Purpose:** This document details all modifications made across the repository to enable full mobile responsiveness, PWA readiness, dark/light theme switching in the profile and landing page, and seamless local Network IP support across devices.

---

## 1. Summary of Enhancements

* **Global Theme System (`ThemeContext`):** Light & Dark mode support managed at the root layout level with `localStorage` persistence (`tribely_theme`) and automatic root class (`.dark`) toggling.
* **Profile & Landing Theme Toggle:** Synchronized theme toggle added to the **Profile Page Settings** panel and connected to the existing **Landing Page** header control.
* **Mobile Responsiveness & PWA Optimization:** Configured responsive layouts, touch-friendly inputs, adaptive flex/grid structures, viewport meta settings (`width=device-width, initial-scale=1, maximum-scale=1`), and theme-color metadata.
* **Dynamic Network IP Resolution:** Configured client API and WebSocket connection builders to derive backend IP dynamically from `window.location.hostname`. Accessing `http://192.168.x.x:3000` on a mobile device automatically links to `http://192.168.x.x:8000` and `ws://192.168.x.x:8000`.
* **Zero Business Logic Mutation:** All existing authentication, proof submission, peer voting, admin moderation, and invite code mechanics remain 100% intact.

---

## 2. File-by-File Changes Log

### Frontend Files (`/frontend`)

#### 1. `frontend/src/app/context/ThemeContext.tsx` `[NEW]`
* **Changes Made:** Created `ThemeProvider` and `useTheme()` hook.
* **Purpose:** Manages `"dark" | "light"` theme state, handles `localStorage` synchronization, applies `.dark` class and `color-scheme` to `document.documentElement`.

#### 2. `frontend/src/app/layout.tsx` `[MODIFIED]`
* **Changes Made:** Wrapped application root with `<ThemeProvider>`, added `.dark` base class fallback, and verified PWA viewport metadata (`themeColor: "#5B4DFF"`, `viewportFit: "cover"`).
* **Purpose:** Ensures dark mode and light mode styles apply seamlessly across all pages on initial render.

#### 3. `frontend/src/app/utils/config.ts` `[MODIFIED]`
* **Changes Made:** Added dynamic `getApiBaseUrl()` and `getWsBaseUrl()` helper functions.
* **Purpose:** Dynamically computes HTTP and WebSocket backend URLs based on `window.location.hostname` for Wi-Fi / Local Network IP testing across laptops and mobile devices.

#### 4. `frontend/src/app/utils/api.ts` `[MODIFIED]`
* **Changes Made:** Configured Axios instance base URL to use dynamic host resolution and increased request timeout to 10 seconds for mobile Wi-Fi networks.
* **Purpose:** Ensures API requests work over localhost and network IP addresses without hardcoding.

#### 5. `frontend/src/app/profile/profile-client.tsx` `[MODIFIED]`
* **Changes Made:**
  1. Imported `useTheme` from `@/app/context/ThemeContext`.
  2. Integrated an explicit **Appearance & Theme** section under the *Security & Settings* tab allowing users to toggle between Dark Mode and Light Mode with real-time UI preview.
  3. Enhanced mobile padding, form layout responsiveness, and text wrapping for small screens.
* **Purpose:** Provides logged-in users with a dedicated theme control panel and ensures mobile friendly profile management.

#### 6. `frontend/src/components/LandingPage.jsx` `[MODIFIED]`
* **Changes Made:** Connected landing page theme toggle button to global `useTheme()` context.
* **Purpose:** Synchronizes theme changes made on the Landing Page with the user's Profile settings and app-wide preference.

#### 7. `frontend/src/components/InfoPageShell.tsx` `[MODIFIED]`
* **Changes Made:** Updated container backgrounds and text colors to use `dark:bg-slate-900`, `dark:text-slate-100`, and adjusted mobile padding (`px-4 sm:px-6`).
* **Purpose:** Ensures legal/informational pages (`/protocol`, `/security`, `/support`, `/transparency`) render cleanly in both dark and light modes on mobile.

#### 8. `frontend/src/app/globals.css` `[MODIFIED]`
* **Changes Made:** Added `@variant dark (&:where(.dark, .dark *));`, custom dark mode CSS variables, smooth theme transition classes, and `-webkit-tap-highlight-color: transparent`.
* **Purpose:** Configures Tailwind CSS v4 dark mode variant and touch interactions for mobile devices.

---

### Backend Files (`/backend`)

#### 9. `backend/main.py` `[VERIFIED]`
* **Status:** Verified CORS configuration (`allow_origins=["*"]`) and Uvicorn runner host (`0.0.0.0:8000`).
* **Purpose:** Allows incoming HTTP and WebSocket connections from all local network IPs and localhost interfaces.

---

## 3. Verification & Build Results

* **Next.js Production Build:** Completed successfully (`npm run build`) with Turbopack & TypeScript verification (17 static & dynamic routes compiled without errors).

---
*End of Changelog.*
