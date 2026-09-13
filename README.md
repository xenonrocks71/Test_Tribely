# Tribely — Social Accountability & Habit-Tracking Platform

[![Full-Stack Architecture](https://img.shields.io/badge/Architecture-FastAPI%20%2B%20Next.js-009688.svg)](#system-architecture)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016%20%7C%20Turbopack%20%7C%20TypeScript-000000.svg?logo=next.js)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLAlchemy%202.0-336791.svg?logo=postgresql)](https://www.postgresql.org/)
[![Real-Time](https://img.shields.io/badge/Real--Time-WebSockets%20%2B%20Redis%20Pub%2FSub-DC382D.svg?logo=redis)](https://redis.io/)
[![Test Suite](https://img.shields.io/badge/Test%20Suite-37%2F37%20Passed%20(100%25)-brightgreen.svg)](#testing--verification)

> **README regenerated from the verified final codebase.**

---

## Project Overview

**Tribely** is a full-stack social accountability and habit-tracking web application where small peer groups create **Arenas**, configure habit objectives and daily submission deadlines, submit daily proof, track consistency streaks, and interact in real time.

Built to demonstrate core full-stack software engineering principles, Tribely emphasizes:
- **Relational Integrity & ACID Transactions**: Atomic database operations with rollback exception handling and composite unique constraints.
- **Strict Backend Authorization**: Access control enforced on every API route so non-members cannot read or mutate private Arena data.
- **Idempotent Proof Ingestion**: Database-enforced single-submission invariants for the active 24-hour cycle.
- **Real-Time Synchronization**: WebSockets backed by a Redis Pub/Sub message broker for multi-client state propagation without polling.
- **Layered Architecture**: Decoupled routes (`app/api/`), business services (`app/services/`), and SQLAlchemy 2.0 repositories (`app/repositories/`).

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide React Icons, Framer Motion
- **Verified Routes**: 15 routes compiled cleanly with zero TypeScript errors

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Validation & Serialization**: Pydantic v2
- **ORM**: SQLAlchemy 2.0
- **Authentication**: Passlib (bcrypt password hashing), PyJWT (Bearer token authentication)

### Data & Messaging Layer
- **Relational Database**: PostgreSQL (SQLite supported for fast in-memory unit tests)
- **Message Broker & Cache**: Redis (Pub/Sub for WebSocket synchronization, rate limiting, and recent chat caching)
- **WebSockets**: Native FastAPI connection manager with room connection tracking and Redis Pub/Sub broadcast

---

## System Architecture

```text
                           [ Next.js 16 Client (React 19) ]
                       Optimistic UI • WebSockets • Responsive
                                        │
                                        ▼ (HTTP / WS)
              ┌───────────────────────────────────────────────────┐
              │             FastAPI Application Server            │
              │                                                   │
              │   ┌───────────────────────────────────────────┐   │
              │   │ API Controllers (app/api/)                │   │
              │   │ - Request validation via Pydantic v2      │   │
              │   │ - JWT Authentication dependencies         │   │
              │   │ - HTTP error translation                  │   │
              │   └─────────────────────┬─────────────────────┘   │
              │                         │                         │
              │   ┌─────────────────────▼─────────────────────┐   │
              │   │ Domain Services (app/services/)           │   │
              │   │ - CycleService (24h deadline calculation) │   │
              │   │ - ProofService (Validation & ingestion)   │   │
              │   │ - AuditService (Deadline absence audit)   │   │
              │   │ - StreakService (Deterministic streaks)   │   │
              │   │ - WebSocketManager (Pub/Sub broadcast)   │   │
              │   └─────────────────────┬─────────────────────┘   │
              │                         │                         │
              │   ┌─────────────────────▼─────────────────────┐   │
              │   │ Repositories (app/repositories/)          │   │
              │   │ - SQLAlchemy 2.0 ORM query execution      │   │
              │   └─────────────────────┬─────────────────────┘   │
              └─────────────────────────┼─────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
       [ PostgreSQL Database ]                     [ Redis Pub/Sub ]
   - Unique Invariant Constraints              - Cross-instance broadcast
   - Relational Foreign Keys                   - Rate limiting counters
   - Transactional Integrity (Commit/Rollback) - Recent 50-message chat cache
```

---

## Core Engineering Features

### 1. 24-Hour Habit Cycle & Locking (`CycleService`)
Habit groups often have members working out or completing habits at different times of day (morning vs. evening). Rather than fixing submissions to midnight UTC, Tribely anchors daily cycles to each Arena's customized deadline $D$ (e.g., `10:00 PM`):
- **Cycle Window**: A continuous 24-hour window ending at the deadline cutoff.
- **Submission Lock**: Once a user submits valid proof for the active cycle, submissions are locked until the cycle resets at the deadline.
- **Multi-Arena Isolation**: Actions are strictly scoped by `arena_id`. Submitting in a "Night Workout" arena does not lock the user in a "Morning Study" arena.

### 2. Idempotent Daily Proof Submission
Duplicate submissions from double-clicks or network retries are prevented at the database layer:
- **Database Invariant**: Composite `UniqueConstraint('arena_id', 'user_id', 'submission_date', name='uq_proofs_arena_user_date')` on the `Proof` model, coupled with unique constraints on `DailyArenaSheet`.
- **Error Handling**: When a duplicate submission is attempted concurrently, the database raises an `IntegrityError`, which the backend catches, rolls back cleanly, and returns an HTTP `409 Conflict` with `DUPLICATE_DAILY_SUBMISSION`.
- **Atomic Transaction**: Membership verification, proof persistence, daily status record, and streak updates occur in a single database transaction (`db.commit()` / `db.rollback()`).

### 3. Automatic Deadline Processing (`AuditService`)
When an Arena deadline passes:
1. The deadline processor identifies enrolled members who have not submitted valid proof for that cycle date.
2. Missing members are marked `status="absent"` in `DailyArenaSheet`.
3. If an emergency streak shield is available, 1 shield is consumed and status becomes `shielded`; otherwise, the member's active streak resets to `0`.
4. A WebSocket event (`member_absent_penalty`) broadcasts to all connected members so the cohort roster updates live.
5. Can be triggered via background schedule or through `POST /api/arenas/{arena_id}/process-deadline` by Arena owners/admins.

### 4. Streak Shields & Milestone Rewards
- **Streak Freeze Shield**: An accountability buffer (up to 3 shields maximum).
- **Consumption**: When a member misses a daily cutoff deadline, 1 shield is automatically consumed to mark the day `shielded` and preserve their streak. If no shields remain, the streak resets to 0.
- **Milestone Rewards**: Completing 7-day consecutive streak milestones awards +1 streak shield.

### 5. Backend Authorization Matrix
Authorization is enforced authoritatively on the backend, never relying solely on UI button visibility:

| Resource / Action | Public Arena Member | Public Arena Non-Member | Private Arena Member | Private Arena Non-Member |
| :--- | :---: | :---: | :---: | :---: |
| **View Arena Overview** | Allow | Allow | Allow | **403 Forbidden** |
| **View Member Roster** | Allow | Allow | Allow | **403 Forbidden** |
| **View Habit Roster / Chamber** | Allow | Allow | Allow | **403 Forbidden** |
| **Submit Daily Proof** | Allow | **403 Forbidden** | Allow | **403 Forbidden** |
| **Send Arena Message** | Allow | **403 Forbidden** | Allow | **403 Forbidden** |
| **Send Member Nudge** | Allow | **403 Forbidden** | Allow | **403 Forbidden** |
| **Trigger Deadline Audit** | **403** (Admin only) | **403 Forbidden** | **403** (Admin only) | **403 Forbidden** |

### 6. Deterministic Streaks & Heatmap
- **Streak Calculation**: Evaluated from persisted daily status records (`DailyArenaSheet` and `Proof`). Streaks increment on verified submissions and reset on missed deadlines.
- **Consistency Heatmap**: The 30-day and 90-day matrix queries real historical records (`present`, `shielded`, `absent`) directly from the database. Zero mock or hardcoded calendar squares.

### 7. Real-Time WebSockets with Redis Pub/Sub
- Clients connect to `/ws/{arena_id}?token={jwt}`.
- State-changing operations (proof submitted, reaction toggled, chat message sent, nudge dispatched, member joined) write to PostgreSQL first.
- Upon successful database commit, the event broadcasts through `WebSocketManager` backed by Redis Pub/Sub, updating all active peers in the Arena without a full page refresh.

### 8. Product Features & Polish
- **Camera-First Workflow**: Mobile-optimized proof submission supporting image, link, and text reflections.
- **Social Feed & Emoji Reactions**: Activity feed with live reaction toggles (🔥, 👏, ⚡) stored in `proof_reactions`.
- **Cohort Nudges**: 1-tap nudge allowing peers to alert members at risk of missing deadlines before the daily cutoff.
- **9:16 Instagram Story Export**: Generates shareable consistency cards displaying avatar, streak count, habit objective, and Tribely branding using client-side canvas rendering.

---

## Database Design

The relational database schema is modeled in SQLAlchemy 2.0. Habit goals and verification rules are embedded directly on the `Arena` entity:

```text
users
 ├── id (PK)
 ├── email (Unique, Indexed)
 ├── full_name
 ├── hashed_password
 └── created_at

arenas (Habit Group Entity)
 ├── id (PK)
 ├── name (Habit / Squad Name)
 ├── description (Habit Instructions)
 ├── proof_type (image, text, link)
 ├── deadline_time (e.g. "22:00")
 ├── is_private (Boolean)
 ├── invite_code (Unique, Indexed)
 ├── creator_id (FK -> users.id)
 └── created_at

arena_memberships
 ├── id (PK)
 ├── arena_id (FK -> arenas.id)
 ├── user_id (FK -> users.id)
 ├── role (admin, member)
 ├── status (approved, pending, rejected)
 ├── current_streak (Integer)
 ├── joined_at
 └── UNIQUE(arena_id, user_id)

proofs
 ├── id (PK)
 ├── arena_id (FK -> arenas.id)
 ├── user_id (FK -> users.id)
 ├── submission_date (Date)
 ├── media_url (String)
 ├── caption (String)
 ├── created_at
 └── UNIQUE(arena_id, user_id, submission_date)

proof_reactions
 ├── id (PK)
 ├── proof_id (FK -> proofs.id)
 ├── user_id (FK -> users.id)
 ├── emoji (String, e.g. "🔥", "👏", "⚡")
 ├── created_at
 └── UNIQUE(proof_id, user_id, emoji)

daily_arena_sheets (Daily Attendance & Activity Sheet)
 ├── id (PK)
 ├── arena_id (FK -> arenas.id)
 ├── user_id (FK -> users.id)
 ├── date_day (String YYYY-MM-DD)
 ├── status (present, absent, shielded, pending)
 └── UNIQUE(arena_id, user_id, date_day)

arena_logbooks (Chamber Activity Audit Log)
 ├── id (PK)
 ├── arena_id (FK -> arenas.id)
 ├── user_id (FK -> users.id)
 ├── entry_type (proof_submitted, deadline_missed, streak_shield_used)
 ├── description (Text)
 └── created_at

messages
 ├── id (PK)
 ├── arena_id (FK -> arenas.id)
 ├── user_id (FK -> users.id)
 ├── content (Text)
 ├── message_type (text, image)
 └── created_at
```

---

## API Surface

| Group | Method | Endpoint | Description |
| :--- | :---: | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Register new user with bcrypt password hashing |
| | `POST` | `/api/auth/login` | Authenticate credentials and issue JWT access token |
| | `POST` | `/api/auth/forgot-password` | Issue signed 15-minute password reset token |
| | `POST` | `/api/auth/reset-password` | Reset password using verified cryptographic token |
| **Arenas** | `GET` | `/api/arenas/discovery/list` | List public and discoverable arenas with member counts |
| | `POST` | `/api/arenas/` | Create new Arena with habit goal, cutoff deadline, and visibility |
| | `GET` | `/api/arenas/{id}` | Fetch Arena overview and metrics (authorized) |
| | `POST` | `/api/arenas/join-by-code` | Join Arena using invite code |
| | `POST` | `/api/arenas/discovery/join` | Request membership (instant for public, pending for private) |
| | `GET` | `/api/arenas/{id}/members` | Fetch approved Arena member list (authorized) |
| | `GET` | `/api/arenas/{id}/ledger-room` | Fetch daily habit roster, cycle countdown, and check-in history |
| | `POST` | `/api/arenas/{id}/leave` | Leave Arena (auto-transfers ownership if admin) |
| | `POST` | `/api/arenas/{id}/process-deadline` | Trigger deadline evaluation, record absences, reset streaks |
| **Activity** | `POST` | `/api/activity/submit` | Submit daily proof with idempotency and cycle window locking |
| | `GET` | `/api/activity/feed` | Keyset-paginated social proof feed |
| | `POST` | `/api/activity/reactions` | Toggle emoji reactions (🔥, 👏, ⚡) on proofs in `proof_reactions` |
| | `POST` | `/api/activity/arenas/{id}/messages`| Send chat message into Arena chamber |
| | `POST` | `/api/activity/arenas/{id}/nudge/{user_id}` | Send peer nudge to at-risk cohort member |
| | `GET` | `/api/activity/arenas/{id}/heatmap/{user_id}` | Fetch 30/90-day consistency heatmap data |
| **Media** | `POST` | `/api/upload/file` | Upload binary proof (10MB limit, magic byte validation) |
| **WebSocket** | `WS` | `/ws/{arena_id}` | Real-time bi-directional connection authenticated via JWT |

---

## Testing & Verification

The automated test suite validates authentication, authorization, transactional invariants, idempotency, deadline rollover, multi-arena isolation, and real-time broadcasts.

### Run Backend Tests
```bash
cd backend
python run_tests.py
```

### Verified Test Results
```text
============================== test session starts ==============================
platform win32 -- Python 3.12.10, pytest-9.0.2, pluggy-1.6.0
rootdir: C:\Users\mayur\Downloads\Tribely-main\backend

tests/test_24h_cycle_and_isolation.py ..........                         [ 27%]
tests/test_auth_registration.py ..                                       [ 32%]
tests/test_authorization_and_idempotency.py ....                         [ 43%]
tests/test_chat_cache.py .                                               [ 45%]
tests/test_chat_media_upload.py ..                                       [ 51%]
tests/test_concurrency_edge_cases.py .......                             [ 70%]
tests/test_cycle_and_multiplier.py ...                                   [ 78%]
tests/test_e2e_stakeholder_flows.py ..                                   [ 83%]
tests/test_heatmap_and_feed.py ..                                        [ 89%]
tests/test_keyset_pagination.py .                                        [ 91%]
tests/test_outbox_concurrency.py ..                                      [ 97%]
tests/test_streak_shields.py ..                                          [100%]

====================== 37 passed, 261 warnings in 19.34s =======================
```

### Run Frontend Build
```bash
cd frontend
npm run build
```
- **Next.js 16 (Turbopack)**: Compiled successfully with zero TypeScript and zero build errors across all 15 routes (`/`, `/arenas`, `/arenas/[id]`, `/arenas/new`, `/dashboard`, `/feed`, `/login`, `/profile`, `/protocol`, `/register`, `/security`, `/support`, `/transparency`, `/_not-found`, `/manifest.webmanifest`).

---

## Local Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+ & npm
- PostgreSQL (or local SQLite for lightweight development)
- Redis server (local or Docker container)

### 1. Redis Setup (Docker)
```bash
docker run -d --name tribely-redis -p 6379:6379 redis:7-alpine
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and adjust DATABASE_URL and REDIS_HOST as needed
cp .env.example .env

# Run database schema initialization
python -c "from app.core.database import sync_engine, Base; import app.models.models; Base.metadata.create_all(bind=sync_engine)"

# Start FastAPI development server
uvicorn main:app --reload --port 8000
```
Backend API will be available at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## Interview Defensibility Guide

Key concepts for interview discussions:

1. **Authentication vs. Authorization**:
   - *Authentication* (JWT tokens + bcrypt password hashing) verifies *who* the user is.
   - *Authorization* checks *what* the user can do. In Tribely, every sensitive endpoint validates membership and role in `ArenaMembership` before performing mutations or returning private data.
2. **Database Invariants vs. Application Locks**:
   - Instead of fragile distributed Redis locks (Redlock), Tribely enforces duplicate submission prevention directly at the database layer with `UniqueConstraint('arena_id', 'user_id', 'submission_date')`. This makes concurrent race conditions impossible and keeps transactions ACID-compliant.
3. **Transaction Rollbacks**:
   - In multi-entity operations (e.g. proof submission updating proofs, sheets, and streaks simultaneously), any exception triggers `db.rollback()`. State never gets partially updated.
4. **WebSocket Scaling with Redis Pub/Sub**:
   - Single-server WebSocket managers break down across horizontal instances. By backing the local connection pool with Redis Pub/Sub, a message published on server instance A is broadcast to clients connected to instance B.
5. **Keyset vs. Offset Pagination**:
   - Feed uses cursor-based (keyset) pagination using `(created_at, id)`. This avoids costly `OFFSET` table scans on large tables and prevents duplicate or skipped items when new proofs are posted in real time.
