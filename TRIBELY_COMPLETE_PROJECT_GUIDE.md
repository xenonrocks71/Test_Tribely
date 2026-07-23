# TRIBELY - COMPLETE PROJECT DOCUMENTATION FOR AI AGENTS

**Purpose:** This document provides a complete breakdown of every file in the Tribely project. Use this to train AI agents (Claude, ChatGPT, Gemini) to understand the codebase and assist with development, debugging, and feature implementation.

**Project Type:** Full-stack social accountability platform  
**Tech Stack:** Next.js 15 (Frontend) + FastAPI (Backend) + PostgreSQL + Redis  
**Deployment:** Vercel (Frontend) + Render (Backend)

---

## TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Root-Level Files](#root-level-files)
3. [Backend Structure](#backend-structure)
4. [Frontend Structure](#frontend-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Development Workflow](#development-workflow)

---

## PROJECT OVERVIEW

### What is Tribely?

Tribely is a **social accountability platform** where:
- Users form groups called "Arenas" 
- Members commit to daily goals and submit proof (images/videos)
- Peers vote on proof authenticity (upvote/downvote)
- Failed members face automated financial penalties
- Real-time chat enables community interaction
- Immutable audit trail tracks all activity

### Core Features

1. **Authentication:** Email/password registration and login with JWT tokens
2. **Arena Management:** Create private/public accountability groups
3. **Daily Submissions:** Users submit proof of daily task completion
4. **Peer Voting:** Community validates submitted proof
5. **Automated Penalties:** Missed deadlines trigger fines
6. **Real-time Chat:** WebSocket-based arena chat
7. **Admin Controls:** Arena creators can approve/reject members
8. **Immutable Ledger:** Complete audit trail of all transactions
9. **User Profiles:** Profile management and password changes

### Architecture Diagram

```
┌─────────────────────┐
│   FRONTEND (Next.js)│
│  - Pages & Routes   │
│  - Components       │
│  - Utils & Config   │
└──────────┬──────────┘
           │ HTTP + WebSocket
           ▼
┌─────────────────────────────────┐
│   BACKEND (FastAPI)             │
│  ┌─────────────────────────────┐│
│  │ API Routes (auth, arenas... ││
│  ├─────────────────────────────┤│
│  │ Business Logic / CRUD       ││
│  ├─────────────────────────────┤│
│  │ ORM Models & Schemas        ││
│  ├─────────────────────────────┤│
│  │ Database & Security         ││
│  └─────────────────────────────┘│
└──────────┬──────────────────────┘
           │
    ┌──────┴────────┐
    ▼               ▼
┌─────────┐   ┌──────────┐
│PostgreSQL   │  Redis   │
│ (Persistent)│ (Cache)  │
└──────────┘   └──────────┘
```

---

## ROOT-LEVEL FILES

### `.vscode/` 
- VS Code workspace settings and extension configurations
- Contains `settings.json` and other IDE preferences
- Not essential for runtime, improves developer experience

### `.git/`
- Git version control metadata and commit history
- Used for source control, branching, and collaboration
- Not part of application code

### `PROJECT_FILE_WISE_SUMMARY.md`
- Interview preparation document
- High-level overview of file responsibilities
- Helps explain project structure to interviewers

### `INTERVIEW_QA_AND_PITCH.md`
- Q&A document for product/placement interviews
- Contains talking points and project pitch
- Shows business value and technical decisions

### `INTERVIEW_CROSS_QUESTIONS.md`
- Technical cross-examination questions
- Tests deep understanding of architecture
- Identifies potential interview topics

### `PROJECT_HANDOVER_GUIDE.md`
- Comprehensive handover documentation
- Setup instructions, environment configuration
- Troubleshooting guides and best practices

### `resources.md`
- Links to external resources, documentation, and references
- API documentation links
- Helpful tutorials and libraries

---

## BACKEND STRUCTURE

### Backend Root Files

#### `backend/main.py` ⭐ **APPLICATION ENTRY POINT**

**Purpose:** Initializes and runs the FastAPI application

**Key Responsibilities:**
- Creates FastAPI app instance with metadata
- Sets up CORS middleware for frontend communication
- Imports and registers all API routers
- Creates database tables on startup
- Exposes health check endpoint
- Starts Uvicorn server on port 8000

**Code Flow:**
```
1. Import all dependencies (FastAPI, CORS, routers)
2. Create FastAPI(app) instance with project metadata
3. Run Base.metadata.create_all(bind=engine) - create DB tables
4. Configure CORS to allow frontend communication
5. Include routers: auth, arenas, activity, websocket, admin_arena, profile
6. Define health_check() GET endpoint
7. Run uvicorn.run() to start server on 0.0.0.0:8000
```

**Dependencies:** All API routers from `backend/app/api/`

---

#### `backend/requirements.txt` 📦 **PYTHON DEPENDENCIES**

**Purpose:** Lists all Python packages needed for the backend

**Key Dependencies:**
- `fastapi==0.111.0` - Web framework
- `uvicorn[standard]==0.30.1` - ASGI server
- `sqlalchemy==2.0.30` - ORM for database
- `psycopg2-binary==2.9.9` - PostgreSQL driver
- `redis==5.0.4` - Redis client for caching
- `pydantic==2.7.2` - Data validation
- `pydantic-settings==2.3.0` - Environment configuration
- `python-jose[cryptography]==3.3.0` - JWT token generation
- `passlib[bcrypt]==1.7.4` - Password hashing
- `python-multipart==0.0.9` - Form data parsing
- `alembic==1.13.1` - Database migrations
- `bcrypt==4.1.3` - Additional password hashing

**How to Use:**
```bash
pip install -r backend/requirements.txt
```

---

### `backend/app/` - Core Application Package

#### `backend/app/__init__.py`
- Python package marker file
- Enables importing the app module
- Usually empty

---

### `backend/app/core/` - Infrastructure & Platform Layer

#### `backend/app/core/config.py` ⚙️ **CONFIGURATION MANAGEMENT**

**Purpose:** Centralized settings using Pydantic

**Key Responsibilities:**
- Loads environment variables from `.env` file
- Defines database URI with password encoding
- Sets JWT secrets and token expiry
- Configures project metadata

**Configuration Variables:**
```python
- PROJECT_NAME: "Tribely"
- DATABASE_URL: Built from DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
- SECRET_KEY: JWT signing key (from .env)
- ALGORITHM: "HS256"
- ACCESS_TOKEN_EXPIRE_MINUTES: Token lifetime
- BACKEND_CORS_ORIGINS: Allowed CORS domains
```

**Environment File (.env):**
```
DATABASE_URL=postgresql://user:password@localhost/tribely
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

#### `backend/app/core/database.py` 🗄️ **DATABASE CONNECTION**

**Purpose:** Sets up SQLAlchemy engine, session factory, and base model

**Key Responsibilities:**
- Creates SQLAlchemy engine connected to PostgreSQL
- Defines SessionLocal factory for DB sessions
- Creates Base class for ORM models
- Provides get_db() dependency for FastAPI routes

**Key Components:**
```python
engine = create_engine(DATABASE_URL) - Connects to PostgreSQL
SessionLocal = sessionmaker(bind=engine) - Creates sessions
Base = declarative_base() - Base class for all models

def get_db(): - FastAPI dependency
    - Yields database session
    - Automatically closes after request
```

**Usage:** Imported by all CRUD and model modules

---

#### `backend/app/core/security.py` 🔐 **SECURITY & AUTHENTICATION**

**Purpose:** Password hashing and JWT token management

**Key Functions:**

```python
verify_password(plain_password, hashed_password) -> bool
- Compares plaintext password with bcrypt hash
- Used during login verification

get_password_hash(password) -> str
- Hashes password using bcrypt
- Used during user registration

create_access_token(data: dict, expires_delta: timedelta) -> str
- Creates JWT access token
- Payload includes user_id and email
- Token expires based on expires_delta
```

**JWT Token Structure:**
```json
{
  "sub": "user_email",
  "user_id": 123,
  "exp": 1234567890  // expiration timestamp
}
```

---

#### `backend/app/core/init_db.py` 🌱 **DATABASE INITIALIZATION**

**Purpose:** Bootstrap script to create database tables

**Key Responsibilities:**
- Imports all model classes into metadata registry
- Calls Base.metadata.create_all() to create tables
- Sets up database schema on first run

**Usage:**
```bash
cd backend
python -c "from app.core.init_db import init_db; init_db()"
```

---

### `backend/app/models/` - ORM Entity Definitions

#### `backend/app/models/models.py` 📋 **DATABASE SCHEMA**

**Purpose:** Defines all database tables and relationships using SQLAlchemy ORM

**Entities Defined:**

##### 1. **User Table**
```python
- id (Integer, Primary Key)
- email (String, Unique) - Login identifier
- hashed_password (String) - Bcrypt hash
- full_name (String)
- is_active (Boolean) - Account status
- created_at (DateTime)
- Relationships:
  - memberships: Links to ArenaMembership (one-to-many)
  - submissions: Links to Submission (one-to-many)
  - messages: Links to Message (one-to-many)
```

##### 2. **UserProfile Table** (Optional user details)
```python
- id (Integer, Primary Key)
- user_id (Integer, Foreign Key → User)
- profile_image_url (Text)
- created_at (DateTime)
- updated_at (DateTime)
```

##### 3. **Arena Table** (Accountability groups)
```python
- id (Integer, Primary Key)
- name (String) - Group name
- description (Text) - About the arena
- invite_code (String, Unique) - Share code for joining
- creator_id (Integer, Foreign Key → User)
- proof_type (String) - Type of proof: "image", "video", etc.
- penalty_amount (Numeric) - Fine for missing deadline
- deadline_time (String) - Daily submission deadline (HH:MM)
- is_private (Boolean) - Private vs public discovery
- created_at (DateTime)
- Relationships:
  - memberships: Links to ArenaMembership (one-to-many)
  - submissions: Links to Submission (one-to-many)
  - messages: Links to Message (one-to-many)
  - logbook_entries: Links to ArenaLogbook (one-to-many)
```

##### 4. **ArenaMembership Table** (Who joined which arena)
```python
- id (Integer, Primary Key)
- user_id (Integer, Foreign Key → User)
- arena_id (Integer, Foreign Key → Arena)
- status (String) - "pending", "approved", "rejected"
- role (String) - "admin", "member"
- joined_at (DateTime)
- Relationships:
  - user: Links to User
  - arena: Links to Arena
```

##### 5. **Message Table** (Chat history)
```python
- id (Integer, Primary Key)
- arena_id (Integer, Foreign Key → Arena)
- user_id (Integer, Foreign Key → User)
- content (Text) - Message text
- message_type (String) - "text", "system_event", etc.
- created_at (DateTime)
- Relationships:
  - arena: Links to Arena
  - user: Links to User
```

##### 6. **Submission Table** (Daily proof)
```python
- id (Integer, Primary Key)
- arena_id (Integer, Foreign Key → Arena)
- user_id (Integer, Foreign Key → User)
- proof_url (Text) - URL to proof image/video (Cloudinary)
- is_verified (Boolean) - Verification status
- submitted_at (DateTime) - Submission timestamp
- upvotes (Integer) - Number of upvotes
- downvotes (Integer) - Number of downvotes
- is_absent (Boolean) - Marked absent if downvotes > threshold
- Relationships:
  - arena: Links to Arena
  - user: Links to User
  - votes: Links to SubmissionVote (one-to-many)
  - Unique Constraint: One submission per user per day per arena
```

##### 7. **SubmissionVote Table** (Peer voting)
```python
- id (Integer, Primary Key)
- submission_id (Integer, Foreign Key → Submission)
- user_id (Integer, Foreign Key → User)
- vote_type (String) - "upvote" or "downvote"
- voted_at (DateTime)
- Relationships:
  - submission: Links to Submission
  - user: Links to User
  - Unique Constraint: One vote per user per submission
```

##### 8. **DailyArenaSheet Table** (Daily status tracking)
```python
- id (Integer, Primary Key)
- arena_id (Integer, Foreign Key → Arena)
- date (Date) - Daily sheet date
- data (JSON) - Daily metrics
- created_at (DateTime)
```

##### 9. **ArenaLogbook Table** (Immutable audit trail)
```python
- id (Integer, Primary Key)
- arena_id (Integer, Foreign Key → Arena)
- action (String) - "user_joined", "submission_upvoted", "penalty_applied", etc.
- actor_id (Integer, Foreign Key → User)
- details (JSON) - Action metadata
- created_at (DateTime)
- Relationships:
  - arena: Links to Arena
  - actor: Links to User
```

---

### `backend/app/schemas/` - Pydantic Request/Response Models

#### `backend/app/schemas/schemas.py` 📝 **DATA VALIDATION**

**Purpose:** Defines input/output schemas for API endpoints

**Key Schemas:**

##### Authentication Schemas
```python
TokenResponse:
- access_token (str)
- token_type (str) = "bearer"
- user (UserResponse)

UserCreate:
- email (str)
- password (str)
- full_name (str)

UserResponse:
- id (int)
- email (str)
- full_name (str)
- is_active (bool)
- created_at (datetime)

PasswordChange:
- old_password (str)
- new_password (str)
```

##### Arena Schemas
```python
ArenaCreate:
- name (str)
- description (str, optional)
- proof_type (str) = "image"
- penalty_amount (float) = 0.0
- deadline_time (str) = "00:00"
- is_private (bool) = False

ArenaResponse:
- id (int)
- name (str)
- description (str)
- invite_code (str)
- creator_id (int)
- member_count (int)
- created_at (datetime)

ArenaMembershipResponse:
- id (int)
- user_id (int)
- arena_id (int)
- status (str)
- role (str)
- joined_at (datetime)
```

##### Submission Schemas
```python
SubmissionCreate:
- proof_url (str) - Image/video URL
- notes (str, optional)

SubmissionResponse:
- id (int)
- arena_id (int)
- user_id (int)
- proof_url (str)
- upvotes (int)
- downvotes (int)
- is_absent (bool)
- submitted_at (datetime)

VoteSubmissionRequest:
- vote_type (str) - "upvote" or "downvote"
```

##### Message Schemas
```python
MessageCreate:
- content (str)
- message_type (str) = "text"

MessageResponse:
- id (int)
- arena_id (int)
- user_id (int)
- content (str)
- message_type (str)
- created_at (datetime)
- user (UserResponse) - Nested user details
```

---

### `backend/app/crud/` - Data Access Layer

#### `backend/app/crud/crud_user.py` 👤 **USER OPERATIONS**

**Purpose:** Database operations for user management

**Key Functions:**

```python
get_user(db: Session, user_id: int) -> User
- Fetch user by ID
- Returns User object or None

get_user_by_email(db: Session, email: str) -> User
- Fetch user by email
- Used for login verification

create_user(db: Session, user: UserCreate) -> User
- Create new user account
- Hashes password using security.get_password_hash()
- Returns created User object

list_users(db: Session) -> List[User]
- Fetch all users (admin only)
```

---

#### `backend/app/crud/crud_arena.py` 🏛️ **ARENA OPERATIONS**

**Purpose:** Database operations for arena management

**Key Functions:**

```python
generate_unique_invite_code(db: Session) -> str
- Generates random alphanumeric invite code
- Ensures uniqueness in database

create_arena(db: Session, arena: ArenaCreate, creator_id: int) -> Arena
- Creates new arena
- Automatically adds creator as admin member
- Generates unique invite code
- Returns Arena object

get_arena(db: Session, arena_id: int) -> Arena
- Fetch arena by ID

get_arena_by_invite_code(db: Session, invite_code: str) -> Arena
- Fetch arena by invite code
- Used for join operations

join_arena(db: Session, user_id: int, arena_id: int, status: str) -> ArenaMembership
- Add user to arena
- Status: "approved" for public, "pending" for private
- Returns ArenaMembership

get_user_arenas(db: Session, user_id: int) -> List[Arena]
- Fetch all arenas user is member of

get_arena_members(db: Session, arena_id: int) -> List[ArenaMembership]
- Fetch all members in arena with their details

get_pending_members(db: Session, arena_id: int) -> List[ArenaMembership]
- Fetch pending join requests for arena

approve_member(db: Session, membership_id: int)
- Approve pending member request

remove_member(db: Session, membership_id: int)
- Remove member from arena
```

---

#### `backend/app/crud/crud_activity.py` 📊 **ACTIVITY OPERATIONS**

**Purpose:** Database operations for submissions, votes, and messages

**Key Functions:**

```python
create_submission(db: Session, submission: SubmissionCreate, arena_id: int, user_id: int) -> Submission
- Create daily proof submission
- Prevents duplicate submissions same-day
- Returns Submission object

get_submission(db: Session, submission_id: int) -> Submission
- Fetch submission by ID

get_user_arena_submissions(db: Session, user_id: int, arena_id: int) -> List[Submission]
- Fetch user's submissions in specific arena

get_arena_submissions(db: Session, arena_id: int) -> List[Submission]
- Fetch all submissions in arena (timeline)

create_vote(db: Session, submission_id: int, user_id: int, vote_type: str) -> SubmissionVote
- Add upvote/downvote to submission
- Prevents duplicate votes (one vote per user per submission)
- Returns SubmissionVote

update_submission_votes(db: Session, submission_id: int)
- Recalculates upvote/downvote counts
- Checks if downvotes exceed threshold → marks is_absent=True

create_message(db: Session, arena_id: int, user_id: int, content: str) -> Message
- Save chat message to database
- Returns Message object

get_arena_messages(db: Session, arena_id: int, limit: int) -> List[Message]
- Fetch recent messages from arena chat

check_membership(db: Session, user_id: int, arena_id: int) -> bool
- Verify user is member of arena
- Used for access control
```

---

### `backend/app/api/` - HTTP API Routes

#### `backend/app/api/auth.py` 🔑 **AUTHENTICATION**

**Purpose:** User registration and login endpoints

**Endpoints:**

```
POST /auth/register
- Request: UserCreate {email, password, full_name}
- Response: UserResponse
- Logic:
  1. Check if email already exists
  2. Hash password using passlib
  3. Create user record in DB
  4. Return user details (no password)

POST /auth/login
- Request: OAuth2 password form {username (email), password}
- Response: TokenResponse {access_token, token_type, user}
- Logic:
  1. Find user by email
  2. Verify password using verify_password()
  3. Create JWT token using security.create_access_token()
  4. Return token + user info
  5. Token expires in ACCESS_TOKEN_EXPIRE_MINUTES
```

**Key Components:**
- Uses `get_password_hash()` for password hashing
- Uses `create_access_token()` for JWT generation
- OAuth2PasswordRequestForm for secure form handling

---

#### `backend/app/api/arenas.py` 🏛️ **ARENA MANAGEMENT**

**Purpose:** Arena discovery, creation, and joining

**Endpoints:**

```
GET /arenas/discover
- Response: List[ArenaResponse]
- Returns public arenas (is_private=False)
- Used for arena discovery/browsing

POST /arenas
- Request: ArenaCreate {name, description, proof_type, penalty_amount, deadline_time, is_private}
- Response: ArenaResponse
- Creates new arena
- Current user becomes admin

GET /arenas/{arena_id}
- Response: ArenaResponse
- Fetch specific arena details

POST /arenas/join-by-invite
- Request: {invite_code}
- Response: ArenaMembership
- Join arena using invite code
- Auto-approve if public, pending if private

POST /arenas/{arena_id}/discover-join
- Request: empty
- Response: ArenaMembership
- Join public arena directly from discovery
- Auto-approve

GET /arenas/my-arenas
- Response: List[ArenaResponse]
- Fetch all arenas current user belongs to
- Requires authentication

GET /arenas/{arena_id}/members
- Response: List[ArenaMembershipResponse]
- Get all members in arena with role/status
```

**Key Features:**
- Public arena discovery
- Private arenas with invite codes
- Role-based access (admin vs member)
- Auto-approval for public arenas

---

#### `backend/app/api/activity.py` 📝 **SUBMISSIONS & VOTING**

**Purpose:** Daily proof submissions and peer voting

**Endpoints:**

```
POST /activity/submit
- Request: SubmissionCreate {proof_url, notes}
- Response: SubmissionResponse
- Submits daily proof
- Prevents duplicate submissions same-day (same user, same arena)
- Requires authentication + arena membership

GET /activity/{arena_id}/submissions
- Response: List[SubmissionResponse]
- Fetch all submissions in arena (timeline order)
- Used for activity ledger view

GET /activity/user/{user_id}/arena/{arena_id}
- Response: List[SubmissionResponse]
- Fetch specific user's submissions in arena

POST /activity/vote/{submission_id}
- Request: VoteSubmissionRequest {vote_type}
- Response: SubmissionResponse
- Cast vote on proof (upvote/downvote)
- Prevents duplicate votes (one vote per user per submission)
- Auto-marks is_absent=True if downvotes exceed threshold

PUT /activity/unvote/{submission_id}
- Remove vote from submission
- Updates vote counters

GET /activity/{arena_id}/history
- Response: {submissions, messages, timeline}
- Fetch combined activity + chat history
- Used for immutable audit trail/logbook view
```

**Key Business Logic:**
- Same-day duplicate prevention on submissions
- One vote per user per submission
- Auto-flag absent if downvotes > threshold (e.g., 50% members)
- Immutable transaction history

---

#### `backend/app/api/admin_arena.py` 👨‍⚖️ **ADMIN CONTROLS**

**Purpose:** Arena creator/admin operations

**Endpoints:**

```
GET /admin/arena/{arena_id}/pending
- Response: List[ArenaMembership]
- Fetch pending join requests
- Only accessible to arena admin/creator

POST /admin/arena/{arena_id}/approve/{membership_id}
- Approve member request
- Changes status from "pending" to "approved"
- Only accessible to arena admin

POST /admin/arena/{arena_id}/reject/{membership_id}
- Reject member request
- Removes membership record
- Only accessible to arena admin

DELETE /admin/arena/{arena_id}/member/{user_id}
- Remove existing member from arena
- Only accessible to arena admin
- Soft delete or hard delete based on configuration

POST /admin/arena/{arena_id}/invite-code
- Response: {invite_code, invite_link, qr_code_data}
- Generate shareable invite assets
- Returns code, full join URL, QR payload
```

**Access Control:**
- Requires user to be arena creator/admin
- Verified using arena.creator_id == current_user.id

---

#### `backend/app/api/profile.py` 👤 **USER PROFILE**

**Purpose:** User profile management

**Endpoints:**

```
GET /profile
- Response: UserResponse
- Fetch current user's profile
- Requires authentication

GET /profile/{user_id}
- Response: UserResponse
- Fetch any user's profile (optional arena context)
- Query param: arena_id (optional)
- Returns role if in specific arena context

POST /profile/change-password
- Request: PasswordChange {old_password, new_password}
- Changes user's password
- Verifies old password first
- Hashes new password
```

---

#### `backend/app/api/deps.py` 🔗 **DEPENDENCY INJECTION**

**Purpose:** Shared dependencies for route handlers

**Key Dependencies:**

```python
get_current_user(token: str = Depends(oauth2_scheme)) -> User
- Extracts JWT token from Authorization header
- Decodes token using SECRET_KEY
- Fetches user from database
- Returns User object
- Raises 401 if token invalid/expired

get_db() -> Session
- Yields database session
- Automatically closes after request
- Injected into routes needing DB access

oauth2_scheme = HTTPBearer()
- Defines OAuth2 bearer token scheme
- Used by FastAPI for automatic Swagger docs
```

**Usage Example:**
```python
@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user)):
    # current_user is automatically resolved from JWT token
    return current_user
```

---

#### `backend/app/api/websocket.py` 💬 **REAL-TIME CHAT**

**Purpose:** WebSocket connection management for arena chat

**Features:**

```
WebSocket Endpoint: /ws/{arena_id}/{client_id}
- Establishes persistent connection per arena
- Handles multiple clients per arena
- Routes:
  1. Connection: Add client to arena room
  2. Receive: Broadcast message to all clients in room
  3. Persist: Save message to database via CRUD
  4. Disconnect: Remove client from room

Connection Flow:
1. Client connects to /ws/arena_id/user_id
2. Server accepts connection, adds to connection_manager
3. Client sends message {type: "message", content: "..."}
4. Server broadcasts to all clients in arena
5. Server persists message via create_message() CRUD
6. Client disconnects → remove from connection_manager
```

**Key Components:**
- `ConnectionManager` class: Manages active WebSocket connections per arena
- `connection_manager.connect()`: Add client to room
- `connection_manager.broadcast()`: Send to all clients in room
- `connection_manager.disconnect()`: Remove client from room

**Message Flow:**
```
Client → WebSocket → broadcast to arena members → persist to DB
```

---

## FRONTEND STRUCTURE

### Frontend Root Files

#### `frontend/package.json` 📦 **PROJECT MANIFEST**

**Purpose:** Defines dependencies and scripts

**Key Scripts:**
```json
"dev": "next dev -H 0.0.0.0 -p 3000"
  - Starts development server
  - -H 0.0.0.0: Listen on all interfaces (localhost + LAN)
  - -p 3000: Port 3000

"build": "next build"
  - Creates optimized production build
  - Outputs to .next/ directory

"start": "next start"
  - Runs production build

"lint": "eslint"
  - Runs ESLint for code quality
```

**Dependencies:**
- `next@16.2.9` - React framework
- `react@19.2.4` - UI library
- `react-dom@19.2.4` - React DOM rendering
- `axios@1.18.1` - HTTP client for API calls

**DevDependencies:**
- `typescript@5` - Type checking
- `tailwindcss@4` - CSS utility framework
- `@tailwindcss/postcss@4` - Tailwind PostCSS plugin
- `eslint@9` - Linting tool
- `eslint-config-next` - Next.js ESLint config

---

#### `frontend/tsconfig.json` 📘 **TYPESCRIPT CONFIGURATION**

**Purpose:** TypeScript compiler settings

**Key Configs:**
```json
"strict": true - Enable strict type checking
"module": "esnext" - Module system
"target": "esnext" - JS target version
"paths": {"@/*": ["./src/*"]} - Path aliases
  Usage: import X from "@/components/X"
```

---

#### `frontend/next.config.ts` ⚙️ **NEXT.JS CONFIGURATION**

**Purpose:** Next.js application configuration

**Current State:** Minimal/default configuration
**Future Enhancements:**
- PWA configuration (for mobile app)
- Image optimization
- Environment-specific configs
- Performance optimizations

---

#### `frontend/postcss.config.mjs` 🎨 **CSS PIPELINE**

**Purpose:** PostCSS configuration for Tailwind CSS

**Configuration:**
```javascript
plugins: {
  '@tailwindcss/postcss': {} - Tailwind v4 processing
}
```

**CSS Pipeline Flow:**
```
Source CSS with @tailwind directives
  ↓
Tailwind v4 processing (@tailwindcss/postcss)
  ↓
Compiled utility classes
  ↓
Optimized CSS output
```

---

#### `frontend/eslint.config.mjs` ✅ **LINTING**

**Purpose:** ESLint configuration for code quality

**Features:**
- Enables Next.js recommended rules
- TypeScript type checking
- Core Web Vitals optimization
- Auto-fixes common issues

---

#### `frontend/.gitignore` 🚫 **GIT IGNORE**

**Purpose:** Excludes files from version control

**Patterns:**
```
node_modules/ - Dependencies
.next/ - Build output
.env - Environment secrets
coverage/ - Test coverage reports
.DS_Store - macOS files
```

---

#### `frontend/package-lock.json` 🔒 **DEPENDENCY LOCK**

**Purpose:** Locks exact dependency versions for reproducible installs

**Usage:**
```bash
npm ci  # Uses lock file for exact versions
npm install  # Updates lock file
```

---

### `frontend/src/app/` - Application Pages & Layout

#### `frontend/src/app/layout.tsx` 📄 **ROOT LAYOUT**

**Purpose:** Global layout wrapper for all pages

**Responsibilities:**
- Wraps entire application
- Injects global fonts and base CSS
- Defines metadata (title, description, icons)
- Declares document structure (html, body tags)
- Provides global context/providers

**Structure:**
```tsx
export default function RootLayout({children}) {
  return (
    <html>
      <body>
        <nav /> {/* Global header/nav */}
        {children} {/* Page content */}
        <footer /> {/* Global footer */}
      </body>
    </html>
  )
}
```

---

#### `frontend/src/app/page.tsx` 🏠 **HOME PAGE**

**Purpose:** Landing page (/)

**Features:**
- Hero section with call-to-action
- Project value proposition
- Link to login/register
- Desktop & mobile responsive
- Renders LandingPage component from components folder

---

#### `frontend/src/app/register/page.tsx` 📝 **REGISTRATION PAGE**

**Purpose:** User signup (/register)

**Features:**
- Email input field
- Password input with strength indicator
- Full name input
- Submit button
- Link to login page
- Form validation
- API call to POST /auth/register
- Redirect to login on success
- Error handling + display

---

#### `frontend/src/app/login/page.tsx` 🔐 **LOGIN PAGE**

**Purpose:** User authentication (/login)

**Features:**
- Email input
- Password input
- "Remember me" checkbox (optional)
- Submit button
- Link to register page
- Form validation
- API call to POST /auth/login
- Stores JWT token + user context
- Redirect to /dashboard on success
- Support for success/error query parameters

---

#### `frontend/src/app/dashboard/page.tsx` 📊 **USER DASHBOARD**

**Purpose:** Main user workspace (/dashboard)

**Features:**
- Lists all user's joined arenas
- Arena cards showing:
  - Arena name
  - Member count
  - Recent activity
  - Join date
- "Create New Arena" button
- "Join by Invite Code" input
- Join from pending discovery requests
- Search/filter arenas
- Requires authentication

---

#### `frontend/src/app/arena/[id]/page.tsx` 🏛️ **ARENA ROOM**

**Purpose:** Main arena workspace (/arena/[id])

**Features:**
- Real-time chat using WebSocket
- Daily proof submission form
  - Image/video URL input
  - Submit button with validation
  - Duplicate submission prevention UI
- Voting on submissions
  - Upvote/downvote buttons
  - Vote count display
  - Undo vote option
- Activity ledger/history
  - Chronological list of submissions
  - Vote counts per submission
  - Immutable audit trail
- Members list
  - All arena members with roles
  - Admin badge for admins
  - Status indicators (active, pending)
- Admin controls (if user is admin)
  - Pending join requests list
  - Approve/reject buttons
  - Remove member option
  - Generate invite link/QR code

**State Management:**
- WebSocket connection to /ws/arena_id/user_id
- Local message buffer + optimistic updates
- Pagination for history

---

#### `frontend/src/app/arenas/page.tsx` 🔍 **ARENA DISCOVERY**

**Purpose:** Browse and join public arenas (/arenas)

**Features:**
- Fetch all public arenas from backend
- Display arena cards with:
  - Arena name
  - Description
  - Member count
  - Creator info
- Modal/drawer to show full details
- "Join" button for public arenas
- "Request to Join" for private arenas
- Search/filter by name
- Sort by members, date created, etc.

---

#### `frontend/src/app/arenas/new/page.tsx` ✨ **CREATE ARENA**

**Purpose:** Arena creation form (/arenas/new)

**Features:**
- Arena name input
- Description textarea
- Proof type selector (image, video, etc.)
- Penalty amount input
- Deadline time picker
- Privacy toggle (public/private)
- Form validation
- API call to POST /arenas
- Redirect to arena room on success

---

#### `frontend/src/app/profile/page.tsx` 👤 **USER PROFILE**

**Purpose:** Profile management (/profile)

**Features:**
- Display user info (email, full name)
- Profile image upload/display
- Show joined arenas with roles
- Password change form
  - Old password input
  - New password input
  - Confirm password input
  - Submit button
  - Validation
  - Success/error messages
- Edit profile details
- Account settings

**Client Component:** Uses profile-client.tsx for interactive features

---

#### `frontend/src/app/profile/profile-client.tsx` 💻 **PROFILE (CLIENT)**

**Purpose:** Client-side profile logic

**Features:**
- `"use client"` directive for client-side rendering
- State management for form inputs
- Password visibility toggle
- Form submission handling
- Error states and validation
- Loading states during API calls
- Success notifications

---

#### `frontend/src/app/login/page.tsx` (Additional Context)

**Query Parameters:**
- `registered=true` - Show success message after signup
- `error=invalid_credentials` - Show error message

---

### Additional Pages

#### `frontend/src/app/protocol/page.tsx` 📋 **PROTOCOL/RULES**

**Purpose:** Display arena protocol/rules (/protocol)

- Game rules and mechanics
- Scoring system explanation
- Submission guidelines
- Voting guidelines
- Penalty explanation

---

#### `frontend/src/app/security/page.tsx` 🔒 **SECURITY INFO**

**Purpose:** Security & privacy information (/security)

- Privacy policy
- Data security explanation
- Encryption details
- User data handling

---

#### `frontend/src/app/support/page.tsx` 💬 **SUPPORT**

**Purpose:** Support/help page (/support)

- FAQ section
- Contact form
- Help documentation
- Troubleshooting guides

---

#### `frontend/src/app/transparency/page.tsx` 📊 **TRANSPARENCY**

**Purpose:** Transparency & metrics (/transparency)

- Project statistics
- Community metrics
- Financial transparency (penalty distribution)
- Impact metrics

---

### Icon & Manifest

#### `frontend/src/app/icon.tsx` 🎯 **FAVICON**

**Purpose:** Browser tab icon

- App logo/icon
- Generated/exported as favicon.ico

---

#### `frontend/src/app/apple-icon.tsx` 🍎 **APPLE ICON**

**Purpose:** iOS app icon

- App icon for Apple devices
- Used for web app shortcut

---

#### `frontend/src/app/manifest.ts` 📋 **PWA MANIFEST**

**Purpose:** Progressive Web App manifest

**Configuration:**
```json
{
  "name": "Tribely",
  "short_name": "Tribely",
  "description": "Social Accountability Platform",
  "start_url": "/",
  "display": "standalone",
  "icons": [...]
}
```

**Enables:**
- Installable as mobile app
- Home screen icon
- App name & description

---

### `frontend/src/app/globals.css` 🎨 **GLOBAL STYLES**

**Purpose:** Global CSS for entire application

**Contents:**
```css
:root {
  --color-primary: #...; /* Primary brand color */
  --color-secondary: #...;
  /* ... other CSS variables ... */
}

body {
  font-family: -apple-system, BlinkMacSystemFont, ...;
  margin: 0;
  padding: 0;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
}

/* Global utility classes */
.container { }
.flex { }
/* ... Tailwind utilities ... */
```

---

### `frontend/src/components/` - Reusable Components

#### `frontend/src/components/LandingPage.jsx` 🎬 **HOME COMPONENT**

**Purpose:** Landing page content component

**Features:**
- Renders landing page hero section
- Displays public arena discovery
- Arena cards with quick info
- Preview of arena details in modal/drawer
- Call-to-action buttons (Join, Request to Join)
- Responsive grid layout
- Handles unauthenticated flow:
  - Prompt to login before joining
  - Store arena for deferred join after login
  - Redirect to register if no account

**Data Flow:**
```
Component mounts
  ↓
Fetch public arenas from GET /arenas/discover
  ↓
Display arena cards in grid
  ↓
User clicks arena → show details modal
  ↓
User clicks "Join":
  - If authenticated: Join directly or request to join
  - If not authenticated: Redirect to login with deferred arena
```

---

#### `frontend/src/components/TribelyLogo.jsx` 🏷️ **LOGO COMPONENT**

**Purpose:** Reusable logo component

**Features:**
- Renders Tribely logo
- Scalable SVG or image
- Used in header, landing page, etc.
- Props for sizing/styling

---

#### `frontend/src/components/InfoPageShell.tsx` 📄 **INFO PAGE LAYOUT**

**Purpose:** Layout wrapper for info pages (Protocol, Security, Support, Transparency)

**Features:**
- Common header/navigation
- Sidebar menu
- Main content area
- Footer
- Responsive layout
- Consistency across info pages

---

### `frontend/src/app/context/` - Context Providers

#### `frontend/src/app/context/ThemeContext.tsx` 🎨 **THEME CONTEXT**

**Purpose:** Global theme state management

**Features:**
```tsx
const ThemeContext = createContext({
  theme: 'light' | 'dark',
  toggleTheme: () => {},
});

// Provides:
// - Current theme state
// - Toggle function
// - Apply theme to document
// - Persist theme preference
```

**Usage:**
```tsx
const { theme, toggleTheme } = useContext(ThemeContext);
```

---

### `frontend/src/app/utils/` - Utility Functions

#### `frontend/src/app/utils/api.ts` 🔗 **API CLIENT**

**Purpose:** Shared Axios instance for all API calls

**Features:**
```tsx
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Handle 401 globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Usage:**
```tsx
import api from '@/app/utils/api';

const response = await api.post('/auth/login', {email, password});
const arenas = await api.get('/arenas');
await api.post(`/activity/vote/${submissionId}`, {vote_type: 'upvote'});
```

---

#### `frontend/src/app/utils/arenas.ts` 🏛️ **ARENA UTILITIES**

**Purpose:** Arena-related helper functions

**Functions:**
```tsx
// Format arena for display
formatArena(arena: Arena): FormattedArena
- Convert timestamps
- Calculate member count
- Format currency (penalty)
- Extract relevant fields

// Check if user is admin
isArenaAdmin(arena: Arena, userId: number): boolean
- Compare creator_id with current user

// Generate invite URL
generateInviteUrl(arenaId: number, inviteCode: string): string
- Build shareable link
- Format: https://domain/arenas/join?code=...

// Generate QR code data
generateQrCodeData(inviteUrl: string): string
- QR payload for invite link
```

---

#### `frontend/src/app/utils/config.ts` ⚙️ **CONFIG**

**Purpose:** Global configuration constants

**Exports:**
```tsx
const CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  WEBSOCKET_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  APP_NAME: 'Tribely',
  
  // API endpoints
  endpoints: {
    auth: {
      register: '/auth/register',
      login: '/auth/login',
    },
    arenas: {
      discover: '/arenas/discover',
      list: '/arenas',
      create: '/arenas',
      join: '/arenas/join-by-invite',
    },
    activity: {
      submit: '/activity/submit',
      vote: '/activity/vote',
    },
  },
  
  // UI constants
  ITEMS_PER_PAGE: 10,
  DEBOUNCE_DELAY: 300,
  
  // Business logic
  DOWNVOTE_THRESHOLD: 0.5, // 50% downvotes = absent
};

export default CONFIG;
```

---

### `frontend/public/` - Static Assets

#### Static Files:
- `globe.svg` - Illustration asset
- `window.svg` - Illustration asset
- `file.svg` - Illustration asset
- `next.svg` - Next.js logo
- `vercel.svg` - Vercel logo
- `favicon.ico` - Browser tab icon

---

### `frontend/.next/` - Build Output

**Purpose:** Next.js build artifacts (auto-generated)

**Should Be:**
- Gitignored
- Generated by `npm run build`
- Not manually edited

---

### `frontend/node_modules/` - Dependencies

**Purpose:** Installed npm packages (auto-generated)

**Should Be:**
- Gitignored
- Generated by `npm install`
- Not manually edited

---

### Frontend Documentation Files

#### `frontend/AGENTS.md` 🤖 **AI AGENT INSTRUCTIONS**

**Purpose:** Guidelines for AI/Claude when working on this project

**Contains:**
- Next.js 15 specific conventions
- Folder structure explanation
- Component patterns
- Routing conventions
- State management approach
- Common pitfalls to avoid

---

#### `frontend/CLAUDE.md` 🤖 **CLAUDE INSTRUCTIONS**

**Purpose:** Delegates to AGENTS.md

---

---

## DATABASE SCHEMA DIAGRAM

```
┌─────────────┐
│   User      │
├─────────────┤
│ id (PK)     │
│ email (U)   │
│ password    │
│ full_name   │
│ is_active   │
│ created_at  │
└──────┬──────┘
       │
       ├─────────────────────┬──────────────────────┐
       │                     │                      │
       ▼                     ▼                      ▼
┌─────────────────────┐ ┌──────────────┐ ┌────────────────┐
│ ArenaMembership     │ │  Submission  │ │    Message     │
├─────────────────────┤ ├──────────────┤ ├────────────────┤
│ id (PK)             │ │ id (PK)      │ │ id (PK)        │
│ user_id (FK)        │ │ user_id (FK) │ │ user_id (FK)   │
│ arena_id (FK)       │ │ arena_id (FK)│ │ arena_id (FK)  │
│ status              │ │ proof_url    │ │ content        │
│ role                │ │ upvotes      │ │ created_at     │
│ joined_at           │ │ downvotes    │ └────────────────┘
└─────────────────────┘ │ is_absent    │
                        │ submitted_at │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ SubmissionVote   │
                        ├──────────────────┤
                        │ id (PK)          │
                        │ submission_id(FK)│
                        │ user_id (FK)     │
                        │ vote_type        │
                        │ voted_at         │
                        └──────────────────┘

       ▼
    ┌──────────┐
    │  Arena   │
    ├──────────┤
    │ id (PK)  │
    │ name     │
    │ desc     │
    │ invite.. │
    │ creator..│
    │ proof..  │
    │ penalty..│
    │ deadline.│
    │ is_priv..│
    │ created_at
    └────┬─────┘
         │
         ▼
    ┌──────────────────┐
    │   ArenaLogbook   │
    ├──────────────────┤
    │ id (PK)          │
    │ arena_id (FK)    │
    │ actor_id (FK)    │
    │ action           │
    │ details (JSON)   │
    │ created_at       │
    └──────────────────┘
```

---

## API ENDPOINTS REFERENCE

### Authentication
```
POST   /auth/register              Create user account
POST   /auth/login                 Get JWT token
```

### Arenas
```
GET    /arenas/discover            List public arenas
GET    /arenas                     List user's arenas
GET    /arenas/{id}                Get arena details
POST   /arenas                     Create new arena
POST   /arenas/join-by-invite      Join using invite code
POST   /arenas/{id}/discover-join  Join public arena
GET    /arenas/{id}/members        Get arena members
```

### Activity
```
POST   /activity/submit            Submit daily proof
GET    /activity/{arena_id}/submissions    Get submissions
POST   /activity/vote/{id}         Vote on submission
PUT    /activity/unvote/{id}       Remove vote
GET    /activity/{arena_id}/history Get audit trail
```

### Admin
```
GET    /admin/arena/{id}/pending   Get pending requests
POST   /admin/arena/{id}/approve/{member_id}  Approve member
POST   /admin/arena/{id}/reject/{member_id}   Reject member
DELETE /admin/arena/{id}/member/{user_id}     Remove member
POST   /admin/arena/{id}/invite-code          Generate invite
```

### Profile
```
GET    /profile                    Get current user
GET    /profile/{id}               Get any user
POST   /profile/change-password    Change password
```

### WebSocket
```
WS     /ws/{arena_id}/{client_id}  Real-time chat
```

---

## DEVELOPMENT WORKFLOW

### Setup Local Environment

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
echo "DATABASE_URL=postgresql://user:password@localhost/tribely" > .env
echo "SECRET_KEY=your-secret-key" >> .env

# Initialize database
python -c "from app.core.init_db import init_db; init_db()"

# Run server
python main.py
# Server runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local

# Run development server
npm run dev
# Runs on http://localhost:3000
```

### Key Development Files

**Backend:**
- `main.py` - Start here, edit endpoints in `app/api/`
- `app/models/models.py` - Add/modify database tables
- `app/crud/` - Add/modify data access logic
- `app/schemas/schemas.py` - Update request/response formats

**Frontend:**
- `src/app/` - Add new pages
- `src/components/` - Create reusable components
- `src/app/utils/` - Add helper functions
- `globals.css` - Modify global styles

### Common Tasks

**Add New Database Field:**
1. Update model in `app/models/models.py`
2. Update schema in `app/schemas/schemas.py`
3. Update CRUD in `app/crud/`
4. Recreate database or use Alembic migration

**Add New API Endpoint:**
1. Create schema in `schemas.py`
2. Create CRUD function in appropriate `crud_*.py`
3. Add route in `app/api/*.py` file
4. Update frontend with new API call

**Add New Frontend Page:**
1. Create folder in `frontend/src/app/`
2. Add `page.tsx` file
3. Add navigation link
4. Call backend APIs using `api` client

---

## DEPLOYMENT

### Backend (Render.com)
```
Environment Variables:
- DATABASE_URL: PostgreSQL connection string
- SECRET_KEY: JWT secret key
- ALGORITHM: HS256

Build: pip install -r requirements.txt
Start: uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend (Vercel)
```
Environment Variables:
- NEXT_PUBLIC_API_URL: Backend API URL
- NEXT_PUBLIC_WS_URL: WebSocket URL

Build: npm run build
Start: npm start
```

---

## KEY CONCEPTS FOR AI AGENTS

### Authentication Flow
```
1. User registers: POST /auth/register
   → Backend hashes password, creates user
   → Frontend redirects to login

2. User logs in: POST /auth/login
   → Backend verifies password, creates JWT
   → Frontend stores token in localStorage
   → Token sent in Authorization header for all subsequent requests

3. Protected routes check current_user via JWT:
   → get_current_user() dependency validates token
   → If invalid/expired, return 401
   → Frontend interceptor redirects to login
```

### Submission & Voting Flow
```
1. User submits proof: POST /activity/submit
   → CRUD checks for duplicate same-day submission
   → Creates record, returns Submission object
   → Frontend shows submission in ledger

2. Users vote: POST /activity/vote/{submission_id}
   → CRUD checks for duplicate vote (one per user)
   → Updates vote counters
   → Frontend updates vote UI optimistically
   → Auto-check: If downvotes > 50%, mark is_absent=True

3. Immutable ledger: GET /activity/{arena_id}/history
   → Returns all submissions + messages + votes
   → Chronologically ordered
   → Used for audit trail
```

### WebSocket Chat Flow
```
1. Frontend connects: WebSocket(/ws/{arena_id}/{user_id})
2. User sends message: {type: "message", content: "..."}
3. Server receives, broadcasts to all clients in arena
4. Server persists message to database via CRUD
5. Clients display message immediately
6. Client disconnects: Remove from connection_manager
```

### Arena Join Flow
```
Public Arena:
1. User clicks "Join"
2. POST /arenas/{arena_id}/discover-join
3. Auto-approve, ArenaMembership.status="approved"
4. User sees arena in dashboard immediately

Private Arena:
1. User clicks "Join by Invite"
2. POST /arenas/join-by-invite with invite_code
3. ArenaMembership.status="pending"
4. Arena admin approves: POST /admin/arena/{id}/approve/{member_id}
5. Status changes to "approved"
6. User sees arena in dashboard
```

### Admin Controls Flow
```
1. Arena creator automatically gets role="admin"
2. Admin fetches pending: GET /admin/arena/{id}/pending
3. Admin approves: POST /admin/arena/{id}/approve/{member_id}
4. Admin removes: DELETE /admin/arena/{id}/member/{user_id}
5. Admin generates invite: POST /admin/arena/{id}/invite-code
   → Returns invite_code, invite_link, QR payload
```

---

## COMMON DEBUGGING TIPS

### Backend Won't Connect to Frontend
- Check CORS in `main.py`
- Verify frontend API_URL in config
- Check firewall/network settings
- Ensure backend running on 0.0.0.0:8000

### WebSocket Connection Fails
- Verify WS URL correct (ws://not http://)
- Check arena_id and user_id in URL
- Ensure WebSocket endpoint exists in backend

### Duplicate Submission Error
- Check unique constraint in Submission model
- Verify submitted_at date comparison in CRUD
- Clear DB if needed for testing

### Login Token Expires
- Check ACCESS_TOKEN_EXPIRE_MINUTES in config
- Verify token decode in get_current_user()
- Check for clock skew between client/server

### Database Connection Failed
- Verify DATABASE_URL format
- Check PostgreSQL running
- Ensure credentials correct
- Check network connectivity

---

## FUTURE ENHANCEMENTS

1. **Payment Integration** (Stripe)
   - Automate penalty collection
   - Track financial transactions
   - Refund logic for appeals

2. **Immutable Ledger** (Blockchain)
   - Hash-linked transactions
   - Cryptographic proof of activity
   - Audit trail verification

3. **Redis Integration** (Cache)
   - Cache arena/member lists
   - Rate limiting
   - Message queue for notifications

4. **Mobile App**
   - React Native version
   - Push notifications
   - Offline sync

5. **Advanced Voting**
   - Weighted voting (admin vote = 2x)
   - Confidence scores
   - Appeal mechanism

6. **Analytics Dashboard**
   - Completion rates
   - Penalty distribution
   - Community metrics
   - Growth charts

---

## FILE CHECKLIST FOR AI AGENTS

Use this checklist when training an AI agent:

### Backend Files
- [ ] `backend/main.py` - Understand app initialization
- [ ] `backend/app/core/config.py` - Know configuration system
- [ ] `backend/app/core/database.py` - Understand DB setup
- [ ] `backend/app/core/security.py` - Know auth primitives
- [ ] `backend/app/models/models.py` - Know database schema
- [ ] `backend/app/schemas/schemas.py` - Know API contracts
- [ ] `backend/app/crud/` - Know data access patterns
- [ ] `backend/app/api/` - Know all endpoints

### Frontend Files
- [ ] `frontend/package.json` - Know dependencies
- [ ] `frontend/src/app/layout.tsx` - Understand structure
- [ ] `frontend/src/app/utils/api.ts` - Know API client
- [ ] `frontend/src/app/utils/config.ts` - Know config
- [ ] `frontend/src/components/` - Know UI components
- [ ] `frontend/src/app/` - Know all pages

---

**Document Version:** 1.0  
**Last Updated:** July 2026  
**Maintained By:** Tribely Development Team  
**For:** AI Agent Training & Development Support

---

This document serves as the complete blueprint for understanding Tribely's architecture and enabling AI agents to assist with development, debugging, and feature implementation. Share this with ChatGPT, Gemini, or Claude to ensure they have full context about your project.
