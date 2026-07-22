# Tribely - Comprehensive Project Handover & Architecture Guide

> **Document Purpose:** This is the master handover document for the **Tribely** repository. It contains an exhaustive, file-by-file breakdown of the entire codebase (Backend & Frontend), internal implementation logic, database schemas, API contracts, real-time WebSocket protocol, and setup instructions. Any developer or team receiving this document can immediately understand the architecture, maintain existing features, and extend the platform.

---

## 1. Executive Summary & Product Architecture

**Tribely** is a full-stack, peer-verified accountability arena platform. It enables users to join goal pools ("Arenas") with daily deadlines and financial/reputational penalties, upload daily proof of work (images, links, text notes), verify peer submissions through upvoting/downvoting, engage in real-time room chat, and moderate communities through admin tools.

### Tech Stack Summary
* **Backend:** Python 3.10+, FastAPI, SQLAlchemy ORM, Pydantic v2 schemas, Passlib (bcrypt) for security, PyJWT (HS256) for authentication, WebSockets for real-time messaging, SQLite / PostgreSQL database support.
* **Frontend:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4 (@tailwindcss/postcss), Axios with auth interceptors, Custom WebSockets client, Lucide / Dynamic SVG iconography.

```
                  ┌─────────────────────────────────────────┐
                  │          Next.js Frontend Client        │
                  │ (Landing, Dashboard, Arena Room, Auth) │
                  └────────────────────┬────────────────────┘
                                       │
                         REST API &   │   WebSocket (/api/ws/{id})
                         Bearer JWT   │   Real-Time Chat
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │            FastAPI Backend              │
                  │   - Auth & Security (JWT + bcrypt)    │
                  │   - Arena Management & Invites       │
                  │   - Proof Submissions & Voting       │
                  │   - Real-time Connection Manager     │
                  └────────────────────┬────────────────────┘
                                       │
                                SQLAlchemy ORM
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       Database (SQLite / Postgres)      │
                  │  Users, Arenas, Submissions, Votes,     │
                  │  Messages, Memberships, Daily Sheets    │
                  └─────────────────────────────────────────┘
```

---

## 2. Project Directory Tree

```
Tribely-main/
├── PROJECT_HANDOVER_GUIDE.md      <-- [THIS DOCUMENT] Master Handover Documentation
├── PROJECT_FILE_WISE_SUMMARY.md   <-- Concise interview-prep summary
├── INTERVIEW_CROSS_QUESTIONS.md   <-- Interview cross-examination guide
├── INTERVIEW_QA_AND_PITCH.md      <-- Pitch script & technical Q&A
├── resources.md                   <-- Reference links
├── backend/                       <-- FastAPI Python Backend
│   ├── .env                       <-- Backend environment configuration
│   ├── main.py                    <-- Backend app entrypoint & Uvicorn runner
│   ├── requirements.txt           <-- Python package dependencies
│   └── app/                       <-- Core application package
│       ├── __init__.py            <-- Package marker
│       ├── api/                   <-- HTTP & WebSocket route handlers (Controllers)
│       │   ├── activity.py        <-- Proof submissions, peer voting & timeline
│       │   ├── admin_arena.py     <-- Pending requests approval, member removal & invite assets
│       │   ├── arenas.py          <-- Public discovery, arena creation, join flows
│       │   ├── auth.py            <-- User signup & OAuth2 password token login
│       │   ├── deps.py            <-- FastAPI dependencies (JWT token validation, DB session)
│       │   ├── profile.py         <-- Profile retrieval & password updates
│       │   └── websocket.py       <-- WebSocket connection manager & chat broadcasting
│       ├── core/                  <-- Infrastructure & Platform config
│       │   ├── config.py          <-- Pydantic environment settings reader
│       │   ├── database.py        <-- SQLAlchemy engine, SessionLocal & get_db helper
│       │   ├── init_db.py         <-- Database tables bootstrapper (Base.metadata.create_all)
│       │   └── security.py        <-- Bcrypt hashing & JWT token generation
│       ├── crud/                  <-- Data Access Layer (DB Queries & Mutations)
│       │   ├── crud_activity.py   <-- Proofs, votes, and chat message DB operations
│       │   ├── crud_arena.py      <-- Arena creation, invite codes, and join logic
│       │   └── crud_user.py       <-- User creation and email/ID lookups
│       ├── models/                <-- SQLAlchemy ORM Entities (Database Schema)
│       │   └── models.py          <-- User, Arena, Membership, Submission, Vote, Message
│       └── schemas/               <-- Pydantic Data Transfer Objects (Validation Schemas)
│           └── schemas.py         <-- Request & Response JSON models
└── frontend/                      <-- Next.js Frontend App Router
    ├── .env.local.example         <-- Frontend env template
    ├── eslint.config.mjs          <-- ESLint linting configuration
    ├── next.config.ts             <-- Next.js runtime configuration
    ├── package.json               <-- Node.js packages & scripts
    ├── postcss.config.mjs         <-- PostCSS & Tailwind v4 integration
    ├── tsconfig.json              <-- TypeScript compiler options
    └── src/                       <-- Source directory
        ├── app/                   <-- Next.js App Router routes & layouts
        │   ├── layout.tsx         <-- Global application root layout & fonts
        │   ├── page.tsx           <-- Home landing page router entry
        │   ├── globals.css        <-- Custom CSS, design variables & animations
        │   ├── apple-icon.tsx     <-- Dynamic Apple Touch Icon generator
        │   ├── icon.tsx           <-- Dynamic Browser Favicon generator
        │   ├── manifest.ts        <-- Progressive Web App (PWA) manifest
        │   ├── arena/[id]/        <-- Dynamic Arena Room page (Chat, Proofs, Voting, Admin)
        │   │   └── page.tsx       <-- Real-time Arena Room experience (44KB master view)
        │   ├── arenas/            <-- Public Arena Discovery catalog route
        │   │   └── page.tsx       <-- Explore arenas catalog
        │   ├── dashboard/         <-- User workspace route
        │   │   └── page.tsx       <-- Joined arenas list, create modal & join by invite
        │   ├── login/             <-- User login page
        │   │   └── page.tsx       <-- Authentication form & token storage
        │   ├── register/          <-- User registration page
        │   │   └── page.tsx       <-- Account sign-up form
        │   ├── profile/           <-- User profile page
        │   │   └── page.tsx       <-- Profile & password management
        │   ├── protocol/          <-- Informational page (How it works)
        │   ├── security/          <-- Informational page (Security & Privacy)
        │   ├── support/           <-- Informational page (FAQ & Support)
        │   ├── transparency/      <-- Informational page (Penalties & Integrity)
        │   └── utils/             <-- Frontend helpers & HTTP clients
        │       ├── api.ts         <-- Axios instance with JWT interceptors
        │       ├── arenas.ts      <-- Discovery mappers, arena icons & mock fallbacks
        │       └── config.ts      <-- API & WebSocket base URLs
        └── components/            <-- Reusable UI Components
            ├── LandingPage.jsx    <-- Discovery catalog, hero & details drawer
            ├── InfoPageShell.tsx  <-- Reusable layout wrapper for legal/info pages
            └── TribelyLogo.jsx    <-- Dynamic vector SVG brand logo
```

---

## 3. Detailed File-by-File Breakdown & Internal Implementation

### A. Backend Implementation (`/backend`)

#### Core & Config Files

##### 1. `backend/main.py`
* **Purpose:** Entry point for the FastAPI server.
* **Internal Logic:**
  * Instantiates `app = FastAPI(title="Tribely API")`.
  * Configures `CORSMiddleware` to allow requests from `http://localhost:3000` and `http://127.0.0.1:3000` with full headers and credentials.
  * Registers all domain routers under `/api`: `auth`, `arenas`, `admin_arena`, `activity`, `profile`, `websocket`.
  * Defines root health check endpoint `GET /health` returning `{"status": "ok"}`.
  * Launches `uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)` when run directly.

##### 2. `backend/app/core/config.py`
* **Purpose:** Centralized application settings loading using `pydantic-settings`.
* **Internal Logic:**
  * Defines `Settings` class reading from `backend/.env`.
  * Properties: `SECRET_KEY`, `ALGORITHM` (default `"HS256"`), `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60*24 = 1 day), `DATABASE_URL`.
  * Safe database URI builder handling SQLite paths and escaping password special characters for PostgreSQL.

##### 3. `backend/app/core/database.py`
* **Purpose:** Database connection initialization and session management.
* **Internal Logic:**
  * Creates SQLAlchemy `engine`. For SQLite, injects `connect_args={"check_same_thread": False}`.
  * Creates `SessionLocal` factory with `autocommit=False, autoflush=False`.
  * Defines `Base = declarative_base()`.
  * Implements `get_db()` dependency generator that yields DB sessions to route handlers and guarantees `db.close()` in a `finally` block.

##### 4. `backend/app/core/security.py`
* **Purpose:** Password hashing and JWT generation security functions.
* **Internal Logic:**
  * Instantiates `passlib.context.CryptContext` with `bcrypt` scheme.
  * `verify_password(plain, hashed)`: Validates plain text passwords against stored bcrypt hashes.
  * `get_password_hash(password)`: Returns bcrypt hash.
  * `create_access_token(data, expires_delta)`: Encodes data payload with `exp` timestamp using `jose.jwt.encode` with `SECRET_KEY` and `HS256`.

##### 5. `backend/app/core/init_db.py`
* **Purpose:** Database bootstrap script.
* **Internal Logic:**
  * Imports `engine` and `Base`, alongside all ORM models.
  * Calls `Base.metadata.create_all(bind=engine)` to automatically create missing database tables on initialization.

#### Database ORM Layer (`backend/app/models/models.py`)
Defines the database relational schema using SQLAlchemy ORM:
* `User`: Stores credentials (`email`, `hashed_password`), profile details (`full_name`, `avatar_url`), timestamp (`created_at`).
* `Arena`: Stores accountability arena definitions:
  * `name`, `description`, `proof_type` ("image", "text", "link").
  * `penalty_amount`: Financial/stake penalty for failing daily cutoff.
  * `deadline_time`: Daily deadline string (e.g. `"23:59"`).
  * `is_private`: Boolean flag distinguishing open public arenas vs invite-only private arenas.
  * `invite_code`: 8-character unique random string.
  * `creator_id`: Foreign key to `User.id`.
* `ArenaMembership`: Pivot table managing user membership states:
  * `user_id` (FK), `arena_id` (FK).
  * `role`: `"admin"` (creator) or `"member"`.
  * `status`: `"approved"` (active) or `"pending"` (awaiting admin approval).
  * Unique constraint on `(user_id, arena_id)`.
* `Submission`: Daily proof submission entity:
  * `user_id` (FK), `arena_id` (FK).
  * `proof_type`: `"image"`, `"text"`, `"link"`.
  * `proof_content`: Base64 string, URL, or plain text note.
  * `notes`: Optional description.
  * `status`: `"submitted"`, `"verified"`, or `"rejected"`.
  * `upvotes_count`, `downvotes_count`: Aggregated peer votes.
  * `created_at`: UTC timestamp used for same-day duplicate validation.
* `SubmissionVote`: Peer verification record:
  * `submission_id` (FK), `voter_id` (FK).
  * `vote_type`: `"upvote"` or `"downvote"`.
  * Unique constraint on `(submission_id, voter_id)` preventing a user from voting twice on the same submission.
* `Message`: Real-time chat message history entity (`user_id`, `arena_id`, `content`, `created_at`).
* `DailyArenaSheet` & `ArenaLogbook`: System audit logging entities tracking daily member compliance and arena event history.

#### Data Transfer Objects / Schemas (`backend/app/schemas/schemas.py`)
Pydantic schemas validating HTTP payloads and serializing JSON responses:
* **Auth:** `UserCreate`, `UserLogin`, `UserResponse`, `UserUpdatePassword`, `Token`, `TokenData`.
* **Arena:** `ArenaCreate`, `ArenaResponse`, `ArenaDiscoveryResponse`, `JoinArenaRequest`.
* **Activity & Voting:** `SubmissionCreate`, `SubmissionResponse`, `VoteCreate`, `MessageCreate`, `MessageResponse`.
* **Admin & Members:** `MemberResponse`, `PendingMemberResponse`.

#### Data Access Layer (`backend/app/crud/`)

##### 1. `backend/app/crud/crud_user.py`
* `get_user_by_email(db, email)`: Fetches user by email.
* `get_user_by_id(db, user_id)`: Fetches user by primary key ID.
* `create_user(db, user_in)`: Hashes input password via `security.get_password_hash`, saves `User` entity, and returns it.

##### 2. `backend/app/crud/crud_arena.py`
* `generate_unique_invite_code(db)`: Generates 8-character random uppercase alphanumeric string and loops until DB uniqueness is confirmed.
* `create_arena(db, arena_in, creator_id)`: Creates `Arena` record with generated invite code and immediately inserts an `ArenaMembership` with `role="admin"` and `status="approved"`.
* `get_arena_by_id(db, arena_id)`, `get_arena_by_invite_code(db, code)`: Query helpers.
* `join_arena(db, user_id, arena_id, status)`: Creates membership with status (`"approved"` for public arenas, `"pending"` for private arenas).
* `get_user_arenas(db, user_id)`: Fetches all arenas where user has `status="approved"`.
* `get_public_arenas(db)`: Returns all non-private arenas with calculated active member counts.

##### 3. `backend/app/crud/crud_activity.py`
* `create_submission(db, user_id, arena_id, proof_type, proof_content, notes)`: Verifies if user already submitted proof for the current UTC date. Creates `Submission` record.
* `get_arena_submissions(db, arena_id)`: Returns chronological list of proof submissions.
* `create_message(db, user_id, arena_id, content)`: Saves chat message.
* `get_arena_messages(db, arena_id)`: Returns recent chat history.
* `is_user_arena_member(db, user_id, arena_id)`: Helper confirming active membership.

#### API Controllers & Endpoint Handlers (`backend/app/api/`)

##### 1. `backend/app/api/deps.py`
* **Purpose:** Auth dependency injection.
* **Internal Logic:**
  * Defines `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")`.
  * `get_current_user(db, token)`: Decodes JWT bearer token, extracts email from `sub` claim, queries DB for user. Raises HTTP 401 Unauthorized if token is invalid or user does not exist.

##### 2. `backend/app/api/auth.py`
* `POST /api/auth/register`: Takes `UserCreate`. Returns HTTP 400 if email exists; otherwise registers user and returns profile data.
* `POST /api/auth/login`: Accepts `OAuth2PasswordRequestForm` (`username` = email, `password`). Verifies password hash. Returns JWT access token and user context payload.

##### 3. `backend/app/api/arenas.py`
* `GET /api/arenas/discovery`: Returns open arenas for public discovery.
* `POST /api/arenas`: Creates new arena (Auth required).
* `GET /api/arenas/my-arenas`: Returns list of arenas joined by the authenticated user.
* `POST /api/arenas/join-by-code`: Joins a private arena using an 8-character invite code.
* `POST /api/arenas/{arena_id}/join`: Joins a public arena directly or creates a pending join request for a private arena.
* `GET /api/arenas/{arena_id}`: Returns detailed arena information and user's role.
* `GET /api/arenas/{arena_id}/members`: Lists approved members of an arena.

##### 4. `backend/app/api/activity.py`
* `POST /api/activity/{arena_id}/submit`: Files a daily proof submission. Enforces single-submission-per-day restriction.
* `POST /api/activity/submission/{submission_id}/vote`: Handles peer voting (`vote_type`: `"upvote"` or `"downvote"`).
  * If voter hasn't voted: creates vote record and increments count.
  * If voter sends same vote: toggles vote off (removes vote record, decrements count).
  * If voter switches vote: converts upvote to downvote (or vice versa) and updates counts.
  * **Auto-Rejection Logic:** If downvotes exceed 50% of active arena members or reach a set threshold, submission status is automatically updated to `"rejected"`.
* `GET /api/activity/{arena_id}/history`: Merges proof submissions, chat messages, and system log events into a unified chronological history timeline.

##### 5. `backend/app/api/admin_arena.py`
* `GET /api/admin/arena/{arena_id}/pending-requests`: (Admin only) Lists users awaiting membership approval.
* `POST /api/admin/arena/{arena_id}/approve/{user_id}`: Changes user membership status from `"pending"` to `"approved"`.
* `POST /api/admin/arena/{arena_id}/reject/{user_id}`: Removes pending request.
* `DELETE /api/admin/arena/{arena_id}/remove-member/{user_id}`: Removes an existing member from the arena.
* `GET /api/admin/arena/{arena_id}/invite-assets`: Returns shareable invite code, invite URL, and QR code payload.

##### 6. `backend/app/api/profile.py`
* `GET /api/profile`: Returns user profile details, optionally decorated with user role within a specific arena.
* `PUT /api/profile/change-password`: Verifies current password before updating to new hashed password.

##### 7. `backend/app/api/websocket.py`
* **Purpose:** Real-time in-room WebSocket communication.
* **Internal Logic:**
  * Implements `ConnectionManager`: Tracks active WebSocket connections per `arena_id` in a dictionary (`active_connections: Dict[int, List[WebSocket]]`).
  * `WEBSOCKET /api/ws/{arena_id}`:
    1. Authenticates connection using query parameter token (`?token=...`).
    2. Adds client to the room's active connections list upon handshake.
    3. Receives incoming JSON chat messages (`{"content": "..."}`).
    4. Persists chat message into database via `crud_activity.create_message`.
    5. Broadcasts formatted message payload to all connected clients in that arena.
    6. Removes connection on client disconnect.

---

### B. Frontend Implementation (`/frontend`)

#### App Setup & Utilities (`frontend/src/app/utils/`)

##### 1. `frontend/src/app/utils/api.ts`
* **Purpose:** Centralized Axios HTTP client configuration.
* **Internal Logic:**
  * Creates `axios` instance configured with `baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`.
  * **Request Interceptor:** Reads `token` from `localStorage` and automatically sets `Authorization: Bearer <token>` header on outgoing requests.
  * **Response Interceptor:** Intercepts `401 Unauthorized` responses, clears `token` and `user` from `localStorage`, and redirects window to `/login`.

##### 2. `frontend/src/app/utils/arenas.ts`
* **Purpose:** UI helper utilities for arena display and data normalization.
* **Internal Logic:**
  * `iconForArena(name, proofType)`: Performs regex keyword matching against arena names (e.g. matching "5 AM" -> ⏰, "workout" -> 🗡️, "code" -> ⌨️) with fallback to proof type icons (📸, ✍️, 🔗).
  * `mapDiscoveryArena(arena)`: Transforms raw backend discovery response objects into frontend landing card UI state objects.
  * `FALLBACK_ARENAS`: Static mock arena list used if backend API is unreachable.
  * `storePendingArenaJoin(arenaId, isPrivate)`: Stores unauthenticated user join intent in `sessionStorage`.

##### 3. `frontend/src/app/utils/config.ts`
* Centralized export of `API_BASE_URL` (`http://localhost:8000`) and `WS_BASE_URL` (`ws://localhost:8000`).

#### Core Components (`frontend/src/components/`)

##### 1. `frontend/src/components/LandingPage.jsx`
* **Purpose:** Public landing page and discovery catalog component.
* **Internal Logic:**
  * Fetches public arenas via `GET /api/arenas/discovery` (falls back to `FALLBACK_ARENAS` on network error).
  * Renders hero section, platform statistics ticker (Total Stake at Risk, Active Arenas, Pass Rate), and tabbed arena exploration grid ("Explore", "Top Streaks", "High Stakes").
  * Provides detailed side-drawer modal when an arena card is clicked.
  * Handles "Join Arena" CTA button: If user is authenticated, joins or redirects to dashboard; if unauthenticated, saves intent to `sessionStorage` and navigates to `/login`.

##### 2. `frontend/src/components/InfoPageShell.tsx`
* **Purpose:** Reusable layout container for informational and legal pages (`/protocol`, `/security`, `/support`, `/transparency`).
* Renders standard top navigation bar with `TribelyLogo`, clean body card container, and bottom navigation link back to homepage.

##### 3. `frontend/src/components/TribelyLogo.jsx`
* Custom inline vector SVG rendering the Tribely brand mark with gradient styling.

#### Route Pages (`frontend/src/app/`)

##### 1. `frontend/src/app/layout.tsx` & `globals.css`
* Application root wrapper establishing HTML font classes (Inter / Outfit), setting body styling, metadata declarations, and global CSS keyframe animations.

##### 2. `frontend/src/app/login/page.tsx`
* Login view capturing email and password. Submits URL-encoded form data to `/api/auth/login`. Stores `access_token` and `user` object in `localStorage` and redirects to `/dashboard`.

##### 3. `frontend/src/app/register/page.tsx`
* Signup view capturing full name, email, and password. Submits payload to `/api/auth/register` and redirects user to `/login?registered=true`.

##### 4. `frontend/src/app/dashboard/page.tsx`
* Authenticated user workspace.
* Fetches user's joined arenas using `GET /api/arenas/my-arenas`.
* Features:
  * "Create Arena" modal form (name, description, proof type, penalty amount, daily deadline time, privacy mode).
  * "Join by Invite Code" modal form for private access codes.
  * Auto-executes pending join stored in `sessionStorage` if user was redirected after authentication.
  * Displays user arena cards with direct links to `/arena/[id]`.

##### 5. `frontend/src/app/arena/[id]/page.tsx` (Master Arena Room Page - 44KB)
* **Purpose:** Full feature-rich real-time Arena Room experience.
* **Internal Features:**
  * **Real-time WebSocket Chat:** Connects to `ws://localhost:8000/api/ws/{id}?token=...`. Automatically updates chat message state upon receiving incoming messages; falls back to REST polling if WebSocket connection drops.
  * **Daily Proof Submission Drawer:** Supports Image (URL/base64), Text, or Link submissions. Enforces immediate daily cutoff validation UI.
  * **Peer Verification & Voting:** Renders active proof submissions with Upvote and Downvote buttons. Connects to `POST /api/activity/submission/{id}/vote` with optimistic state updates.
  * **Arena History Ledger:** Combined timeline displaying verified proofs, system penalties, and audit log events.
  * **Member Directory:** Displays active room members, streak counters, and roles.
  * **Admin Moderation Panel (Visible only to Arena Admins):**
    * Review and approve/reject pending join requests (`/api/admin/arena/{id}/pending-requests`).
    * Remove non-compliant members (`DELETE /api/admin/arena/{id}/remove-member/{user_id}`).
    * Render shareable invite code, invite URL, and QR code payload (`/api/admin/arena/{id}/invite-assets`).

##### 6. Additional Static Routes
* `frontend/src/app/arenas/page.tsx`: Full-screen exploration catalog view.
* `frontend/src/app/profile/page.tsx`: Profile identity view & password modification form (`PUT /api/profile/change-password`).
* `frontend/src/app/protocol/page.tsx`: Protocol rules explanation.
* `frontend/src/app/security/page.tsx`: Security & data encryption details.
* `frontend/src/app/support/page.tsx`: Help center & support contact details.
* `frontend/src/app/transparency/page.tsx`: Transparency and penalty integrity breakdown.

---

## 4. Key Workflows & State Machines

### A. Authentication & Intent Preservation Flow
1. Visitor browses public landing page (`/`) and clicks "Join" on a private or public arena.
2. If unauthenticated, `storePendingArenaJoin(arenaId, isPrivate)` saves the target `arena_id` in `sessionStorage` and redirects user to `/login`.
3. User logs in or registers; JWT token is stored in `localStorage`.
4. User lands on `/dashboard`. The page checks `sessionStorage` for `pending_join_arena_id`, automatically triggers `/api/arenas/{id}/join`, clears storage, and redirects user into the arena room (`/arena/{id}`).

### B. Daily Proof Submission & Peer Verification Flow
```
User Submits Proof (Image / Text / Link)
                  │
                  ▼
          Enforce Single UTC
          Submission / Day
                  │
                  ▼
     Saved to DB (Status: "submitted")
                  │
                  ▼
  Visible to Room Members for Peer Voting
         ┌────────┴────────┐
         ▼                 ▼
   Peer Upvote       Peer Downvote
         │                 │
         └────────┬────────┘
                  ▼
     Recalculate Upvotes & Downvotes
                  │
                  ▼
   Downvotes > 50% threshold?
         ├── Yes ──► Auto-Update Status: "rejected"
         └── No   ──► Status remains: "submitted" / "verified"
```

---

## 5. Local Setup & Execution Guide

### Prerequisites
* Python 3.10 or higher
* Node.js 18.0 or higher & npm

### Step 1: Running the Backend
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not present)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server (starts on http://localhost:8000)
python main.py
```
* API Documentation / Swagger UI will be available at: `http://localhost:8000/docs`

### Step 2: Running the Frontend
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Run Next.js development server (starts on http://localhost:3000)
npm run dev
```

---

## 6. Developer Checklist for Handover

- [x] **Database Schema & Migrations:** Initialized via `backend/app/core/init_db.py`. To configure PostgreSQL, update `DATABASE_URL` in `backend/.env`.
- [x] **CORS Configuration:** Enforced in `backend/main.py` for `http://localhost:3000`. Update CORS origins list when deploying to production domains.
- [x] **Auth State Management:** Interceptors configured in `frontend/src/app/utils/api.ts` handle token attachment and auto-logout on token expiration.
- [x] **Real-Time Communication:** WebSockets managed in `backend/app/api/websocket.py` and `frontend/src/app/arena/[id]/page.tsx`.

---
*End of Handover Documentation.*
