# Tribely - System, Layout, Voting Logic & Route Fix Changelog

> **Document Purpose:** This document details all modifications made across the repository to enable full global dark/light theme persistence, mobile responsiveness, private arena join approval gates, Instagram DM chat UI styling, side-by-side desktop / mobile right-drawer arena room layouts, voting rules enforcement, and backend route path resolutions.

---

## 1. Summary of Bug Fixes & Business Rules Implemented

* **404 Voting Route Fix (`backend/app/api/activity.py`):**
  * Added missing path endpoint `@router.post("/submission/{submission_id}/vote")` to match frontend calls. Both `/api/activity/submission/{submission_id}/vote` and `/api/activity/vote` are now supported.

* **Voting & Disqualification Rules Enforcement:**
  1. **Self-Voting Restriction:** The sender of a proof is strictly prohibited from voting on their own proof submission (`submission.user_id != current_user.id`).
  2. **Active Deadline Window Restriction:** Voting is restricted to proofs submitted within the **current active deadline window** for that arena (`submitted_at >= window_start`). Voting on past deadline proofs is disabled.
  3. **Majoritarian Disqualification Threshold (`Downvotes > N/2`):** If the number of downvotes for a proof exceeds `N/2` (where `N` is the count of approved arena members), the proof is automatically **Disqualified** (`is_absent = True` / `sheet_record.status = "absent"`).
  4. **Live Event Broadcast:** Real-time WebSocket `ledger_update` events broadcast upvote, downvote, and disqualification state changes instantly to all connected room members.

* **404 Route Fix for Admin Pending Requests (`backend/app/api/admin_arena.py`):**
  * Corrected router decorator to `@router.get("/{arena_id}/requests")`, resolving 404 AxiosError when admins query pending gate access requests.

* **Arena Room Split Layout & Mobile Right Drawer (`arena/[id]/page.tsx`):**
  * **Desktop View (`lg:` >= 1024px):** Chatting Room and Ledger Room display **side-by-side** simultaneously in a split-screen layout.
  * **Mobile View (`< lg`):** Chatting Room displays on full width by default. Header button (`📋 Ledger`) triggers an Instagram-style drawer that **slides smoothly out from the right side of the screen** (`translate-x-0`) with a dark backdrop overlay.

* **Instagram Direct Chat UI Design:**
  * **Header:** Displays arena title, active status pulse, avatar circle, member count, and action buttons.
  * **Bubbles:** Instagram gradient outgoing bubbles (`from-[#0095F6] via-[#5B4DFF] to-[#A855F7]`) and soft grey/slate incoming bubbles with sender avatars.
  * **Bottom Bar:** Instagram DM pill input bar with blue camera icon, `Message...` text input, and blue send button.

---

## 2. File-by-File Changes Log

### Backend Files (`/backend`)

#### 1. `backend/app/api/activity.py` `[MODIFIED & FIXED]`
* **Changes Made:**
  1. Changed `APIRouter` prefix to `prefix="/api/activity"`.
  2. Added `@router.post("/submission/{submission_id}/vote")` endpoint.
  3. Enforced self-vote check (`submission.user_id == current_user.id`).
  4. Enforced active deadline window check (`submitted_at >= window_start`).
  5. Implemented `Downvotes > N/2` majoritarian disqualification logic.
* **Purpose:** Fixes voting 404 error and enforces core peer-verification business logic.

#### 2. `backend/app/api/admin_arena.py` `[MODIFIED & FIXED]`
* **Changes Made:** Changed `@router.get("/arenas/{arena_id}/requests")` to `@router.get("/{arena_id}/requests")`.

#### 3. `backend/app/api/arenas.py` `[MODIFIED]`
* **Changes Made:** Attached `membership_status` and `user_role` to `GET /api/arenas/` responses; set `initial_status = "pending"` for private arenas in `POST /api/arenas/join-by-code`.

---

### Frontend Files (`/frontend`)

#### 4. `frontend/src/app/arena/[id]/page.tsx` `[OVERHAULED]`
* **Changes Made:**
  1. Updated `handleVoteSubmission` error handling to display informative alert messages when voting rules (e.g. self-vote, closed window) are triggered.
  2. Handled React dev double-mount WebSocket closing cleanly (`ws.onopen = () => ws.close()`).
  3. Built side-by-side desktop layout and mobile slide-over right drawer.
  4. Redesigned Chatting Room bubbles, avatars, and bottom input bar to match Instagram Direct DMs.

#### 5. `frontend/src/app/dashboard/page.tsx` `[MODIFIED]`
* **Changes Made:** Rendered pending private arena cards in a locked state with `🔒 Pending Approval` badge and disabled action button.

#### 6. `frontend/src/components/LandingPage.jsx` `[MODIFIED]`
* **Changes Made:** Redesigned into a product landing page without in-app sidebar tabs.

---

## 3. Verification & Build Results

* **Next.js Production Build:** Completed successfully (`npm run build`) in **5.6 seconds** with Turbopack & TypeScript verification (17 static & dynamic routes compiled without errors).

---
*End of Changelog.*
