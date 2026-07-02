# Tribely Interview Preparation Pack

This file is for placement interview rounds (product-based companies).
It contains:

- 15 likely interview questions
- Strong sample answers (senior/product-company style)
- 3-minute and 10-minute pitch templates you can speak directly

How to use:

- Practice each answer in your own words.
- Keep each answer outcome-focused: problem -> decision -> impact.
- For deeper rounds, always mention trade-offs, constraints, and next steps.

---

## Section A: 15 Likely Interview Questions with Strong Sample Answers

## 1) What problem does Tribely solve?

Sample answer:
Tribely solves the consistency problem in habits by making accountability social and measurable. Most people fail solo tracking apps because there is no real consequence or peer visibility. In Tribely, users join micro-communities called arenas, submit daily proof, and receive peer validation. This creates social pressure, transparency, and a repeatable daily loop. The product goal is to improve completion consistency through community-driven behavior design.

## 2) Why did you choose this architecture?

Sample answer:
I chose a split architecture: FastAPI backend and Next.js frontend. FastAPI gives fast API development, built-in docs, and strong Python ecosystem support for business logic. Next.js gives route-based UI composition and good DX for building fast client experiences. I separated responsibilities into API, CRUD, models, and schemas on backend to keep the codebase maintainable as features grow.

## 3) Walk me through the end-to-end user flow.

Sample answer:
A user registers, logs in, and lands on the dashboard. They can create an arena or join an existing arena using invite/discovery. Inside an arena, they submit one proof per day, interact with room chat, and peers validate submissions with upvote/downvote. Admins handle membership requests for private arenas. This creates a full loop: onboarding -> participation -> validation -> moderation.

## 4) What are your core backend modules and why?

Sample answer:
The backend is modularized by function:

- API layer: request/response handling and route orchestration
- Core layer: config, DB session, and security primitives
- CRUD layer: database interaction logic
- Models: SQLAlchemy entities and relationships
- Schemas: Pydantic validation contracts
  This separation improves testability, change isolation, and clarity of ownership.

## 5) How do you handle authentication and authorization?

Sample answer:
Authentication is JWT-based. Users login via credential validation and receive a bearer token. Protected routes resolve current user from token using a shared dependency. I designed it so route handlers can work with user context consistently. For interview discussion, I also call out that authorization checks must be applied on every state-changing endpoint to prevent identity spoofing.

## 6) Explain your database design decisions.

Sample answer:
I modeled core entities around the domain loop: users, arenas, memberships, submissions, votes, messages, and daily tracking sheets. Membership is a separate table to support roles/status transitions like pending/approved. Votes have uniqueness constraints per user-submission pair to prevent duplicate votes. This schema supports both social interaction and auditability of daily proof behavior.

## 7) How does real-time chat work in Tribely?

Sample answer:
Each arena has a dedicated websocket channel. Clients connect room-wise, send payloads, and the server broadcasts to active room connections. Messages are persisted to database before broadcast so history is durable. That means users get both live interaction and historical replay when they reopen the room.

## 8) How did you prevent duplicate daily submissions?

Sample answer:
On proof submission, backend checks if the user already submitted for that arena within today’s time window. If yes, it rejects duplicate submission for that day. I intentionally kept this guard server-side so frontend bypasses cannot break product rules.

## 9) How does moderation/verification work?

Sample answer:
Peers can upvote/downvote proof submissions. Votes support add, switch, and undo behavior. If downvotes exceed a threshold relative to approved member count, the record can be flagged as absent. This combines social consensus with rule-based state transition, which is simple but effective for MVP moderation.

## 10) What engineering trade-offs did you make?

Sample answer:
I optimized for shipping an end-to-end product loop first: auth, rooms, proofs, moderation, chat. Trade-off was less upfront work on observability, test coverage, and hard security boundaries in some paths. I did this deliberately for MVP velocity, and I have a clear hardening roadmap: strict authorization, tests, rate limits, and deployment controls.

## 11) What are key risks in this project and how would you fix them?

Sample answer:
Top risks are inconsistent authorization checks, weak password-change hardening, and missing automated tests for regression prevention. I would fix these in priority order:

1. derive actor identity only from JWT in all mutating APIs
2. enforce hash verify/hash store for password update path
3. add integration tests for auth, arena join, submit, vote, and admin flows
4. add structured logging and rate limits
   This sequence gives maximum risk reduction per engineering effort.

## 12) If this had 100k users, what would break first?

Sample answer:
Likely pressure points are websocket fan-out, DB write amplification from chat/votes, and API hot paths without caching/rate limits. I would scale with connection management strategy, queue-assisted fan-out where needed, DB indexing and query tuning, horizontal app instances, and Redis-backed ephemeral coordination. I would also add metrics to identify bottlenecks before they become outages.

## 13) How would you improve this product in the next version?

Sample answer:
I would focus on retention and trust:

- streak analytics and weekly consistency score
- notification system for missed proof and pending approvals
- improved proof integrity checks
- better onboarding with guided arena templates
- analytics dashboard for admin/community insights
  This balances user growth, habit stickiness, and platform quality.

## 14) How did you ensure maintainability?

Sample answer:
I used layered architecture, explicit models/schemas, and utility centralization for auth/API calls. This keeps changes localized and readable. For long-term maintainability, I would enforce lint/test gates in CI, add migration discipline, and gradually strengthen typing/contracts between frontend and backend.

## 15) What are you most proud of in this project?

Sample answer:
I’m most proud that this is not just a CRUD app; it has a complete behavioral product loop. Users can discover/join communities, perform daily actions, get peer feedback, and interact in real-time. Technically, I built a coherent full-stack system that demonstrates architecture thinking, product sense, and execution speed.

---

## Section B: 3-Minute Project Pitch Template

Use this when interviewer says: "Explain your project quickly."

### 0:00 - 0:30 (Problem)

Hi, I built Tribely, a social accountability platform for habit consistency. The core problem is that individual habit trackers fail because there is no social pressure and weak consequences. Tribely solves this by putting users in small accountability arenas.

### 0:30 - 1:15 (Product Flow)

Users register, create or join arenas, and submit one proof daily. Other members validate submissions through upvotes/downvotes, and private arenas require admin approval. Each arena also has real-time chat, so the community stays active and responsive.

### 1:15 - 2:00 (Tech + Architecture)

I built the backend with FastAPI, SQLAlchemy, and PostgreSQL, using JWT authentication and modular layering: API, core, CRUD, models, and schemas. Frontend is Next.js with route-based pages for landing, auth, dashboard, arena room, and profile. WebSockets power room chat, and axios interceptors handle auth headers/session behavior.

### 2:00 - 2:40 (Key Engineering Decisions)

I prioritized shipping an end-to-end user loop first, then structured the codebase for easy hardening. I included role-based arena controls, moderation logic, and daily submission constraints. The architecture is ready for adding tests, observability, and stronger authorization checks.

### 2:40 - 3:00 (Impact + Next Step)

This project demonstrates product thinking plus full-stack execution: behavior-driven features, real-time communication, and scalable architecture foundations. My next step is production hardening with strict permission controls, test coverage, and deployment-grade monitoring.

---

## Section C: 10-Minute Project Pitch Template

Use this in deeper rounds where interviewer wants detail.

## 1) Problem Context (1 minute)

- Habit apps often fail due to lack of accountability.
- Social environments improve consistency through visibility and peer pressure.
- Tribely is designed as a social habit accountability engine.

## 2) Product Design (1.5 minutes)

- Core entity is arena: a small group with shared rules.
- Users can create/join arenas (public or private).
- Daily proof submission enforces consistency.
- Peer validation layer (votes) creates trust mechanism.
- Admin layer manages membership in private communities.

## 3) System Architecture (2 minutes)

- Backend: FastAPI + SQLAlchemy + PostgreSQL.
- Frontend: Next.js + React + Tailwind + Axios.
- Backend layers:
  - API for transport logic
  - Core for config/security/DB
  - CRUD for data access
  - Models for schema
  - Schemas for request/response contracts
- Realtime: websocket room channels for instant messaging.

## 4) Deep Dive: One End-to-End Flow (2 minutes)

- Example flow: daily proof lifecycle.

1. User opens arena room.
2. User submits proof URL.
3. Backend checks same-day duplicate rule.
4. Submission is stored and appears in history.
5. Peers vote on validity.
6. Threshold logic can mark submission absent.
   This shows both domain logic and state transition reasoning.

## 5) Engineering Quality + Trade-offs (1.5 minutes)

- Strengths:
  - complete product loop
  - modular backend organization
  - realtime + persistence integration
- Trade-offs:
  - MVP-first approach leaves some hardening tasks
  - test and observability depth can be improved
- Why acceptable: validated core value fast, now ready for structured hardening.

## 6) Scalability and Production Plan (1 minute)

- Enforce strict authorization on all mutations.
- Add integration tests and CI quality gates.
- Add logging/metrics and rate limits.
- Optimize websocket and DB hot paths for larger concurrency.
- Add migration discipline and deployment checks.

## 7) Closing (1 minute)

Tribely demonstrates my ability to turn a user-behavior problem into a full-stack product with clear architecture, realtime features, and a practical roadmap from MVP to production-grade system.

---

## Section D: Interview Delivery Tips (Short)

- Speak in outcomes, not only technologies.
- For every technical decision, mention one trade-off.
- When discussing gaps, show prioritization and action plan.
- Keep answers structured: context -> decision -> result -> next step.

End goal in interviews:
Show that you can build, reason, prioritize, and evolve a product system like an engineer who can own features end-to-end.
