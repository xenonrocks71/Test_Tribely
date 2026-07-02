# Tribely Mock Interview Cross-Questions

This file is for pressure rounds.
It contains follow-up questions interviewers are likely to ask after each main answer in [INTERVIEW_QA_AND_PITCH.md](INTERVIEW_QA_AND_PITCH.md).

How to use:

- Read the main answer first.
- Then practice answering the follow-ups without losing structure.
- The goal is not memorization; the goal is to defend your design choices clearly.

---

## 1) Tribely solves habit accountability

Main answer idea:

- Tribely uses social accountability to improve habit consistency.

Likely follow-ups:

- Why is social accountability better than a normal habit tracker?
- What user behavior evidence made you believe this would work?
- What is the one metric you would use to prove the product is effective?

What the interviewer is testing:

- Product sense
- Clarity of problem framing
- Ability to define success metrics

Good response direction:

- Compare solo tracking vs social pressure.
- Mention retention, submission completion rate, and arena participation.

---

## 2) Why this architecture?

Main answer idea:

- FastAPI backend + Next.js frontend with clear modular boundaries.

Likely follow-ups:

- Why not use a monolith without separate CRUD and schemas?
- Why did you pick FastAPI over Node or Django?
- What would you change if the app got much larger?

What the interviewer is testing:

- Technology selection reasoning
- Trade-off awareness
- Scale thinking

Good response direction:

- Explain speed of development, type safety, modularity, and future maintainability.

---

## 3) End-to-end user flow

Main answer idea:

- Register -> login -> join/create arena -> submit proof -> receive validation -> interact in chat.

Likely follow-ups:

- What happens if the user joins a private arena?
- What happens when a user submits proof twice in one day?
- Where does this flow break if the user is offline?

What the interviewer is testing:

- Product journey understanding
- Edge-case thinking
- State transition reasoning

Good response direction:

- Mention pending approval for private arenas.
- Mention backend duplicate prevention.
- Mention websocket and database persistence separation.

---

## 4) Backend modules and responsibilities

Main answer idea:

- API, core, CRUD, models, schemas.

Likely follow-ups:

- Why not put database logic directly in route handlers?
- What belongs in CRUD versus service layer?
- If you had to add a notification feature, where would it go?

What the interviewer is testing:

- Code organization
- Layering discipline
- Extensibility

Good response direction:

- Explain separation of transport, business logic, and persistence.
- For notifications, mention a service layer or async worker later.

---

## 5) Authentication and authorization

Main answer idea:

- JWT authentication with protected routes resolving current user.

Likely follow-ups:

- How do you prevent token forgery?
- Why is authorization separate from authentication?
- What is one security weakness in your current implementation?

What the interviewer is testing:

- Security maturity
- Threat modeling
- Practical honesty

Good response direction:

- Explain signed tokens, server-side validation, and per-route permission checks.
- Acknowledge that every state-changing route must enforce authorization consistently.

---

## 6) Database design

Main answer idea:

- Users, arenas, memberships, submissions, votes, messages, sheets.

Likely follow-ups:

- Why is membership a separate table?
- Why do you need both submissions and daily sheets?
- What indexes would you add first?

What the interviewer is testing:

- Schema design judgment
- Normalization thinking
- Performance awareness

Good response direction:

- Membership enables status and role.
- Daily sheets support tracking states over time.
- Mention indexes on foreign keys, invite code, email, and timestamp-heavy queries.

---

## 7) Real-time chat

Main answer idea:

- WebSocket room per arena with persistent message storage.

Likely follow-ups:

- Why use WebSockets instead of polling?
- What happens if one socket disconnects during broadcast?
- How would you scale this across multiple backend instances?

What the interviewer is testing:

- Realtime systems understanding
- Fault tolerance
- Scaling strategy

Good response direction:

- Talk about low latency, room fan-out, reconnect handling, and Redis/pub-sub or broker-based coordination for scale.

---

## 8) Duplicate daily submissions

Main answer idea:

- Backend blocks same-day duplicate proof submission.

Likely follow-ups:

- What if the user changes timezone?
- Why do you enforce this on the backend and not frontend only?
- How would you make the rule configurable per arena?

What the interviewer is testing:

- Correctness thinking
- Server-side trust model
- Product flexibility

Good response direction:

- Explain backend as source of truth.
- For timezone, mention storing normalized timestamps or arena timezone.
- For configuration, mention arena policy fields.

---

## 9) Moderation and verification

Main answer idea:

- Peer voting can mark suspicious proof as absent based on threshold.

Likely follow-ups:

- Why did you choose peer voting instead of admin-only moderation?
- What if members collude to flag legitimate proofs?
- How do you prevent vote spam or abuse?

What the interviewer is testing:

- Product integrity
- Abuse handling
- Distributed decision design

Good response direction:

- Peer moderation scales community trust.
- Mention admin override, anti-abuse constraints, and rate limiting as next steps.

---

## 10) Engineering trade-offs

Main answer idea:

- Shipped the full loop first, then harden later.

Likely follow-ups:

- What would you have done differently if you had 2 more weeks?
- Which shortcut is the riskiest in production?
- Why was this trade-off acceptable?

What the interviewer is testing:

- Prioritization
- Product judgment
- Risk awareness

Good response direction:

- Mention tests, authorization hardening, observability, and deployment discipline as immediate follow-ups.

---

## 11) Key risks and fixes

Main answer idea:

- Authorization gaps, weak password change flow, missing tests.

Likely follow-ups:

- Which risk is most urgent?
- How would you prove the fix works?
- What could still break even after your fix?

What the interviewer is testing:

- Incident thinking
- Validation discipline
- Realistic engineering judgment

Good response direction:

- Prioritize identity/permission fixes first.
- Mention tests, logs, and security review as proof.

---

## 12) Scale to 100k users

Main answer idea:

- WebSocket fan-out, DB write amplification, hot paths, caching and rate limiting.

Likely follow-ups:

- What exactly would you cache?
- Would you use queues or streams?
- What metrics would you watch first in production?

What the interviewer is testing:

- System design instincts
- Observability thinking
- Bottleneck identification

Good response direction:

- Cache read-heavy discovery/profile data.
- Use queues or pub-sub for async fan-out if needed.
- Watch latency, error rate, connection count, DB CPU, and query time.

---

## 13) Next product improvements

Main answer idea:

- Retention, trust, onboarding, and analytics.

Likely follow-ups:

- Which one feature would you build first and why?
- How would you know if a new feature actually improves retention?
- What feature is nice-to-have but not essential?

What the interviewer is testing:

- Product prioritization
- Experiment design
- Value judgment

Good response direction:

- Start with reminders/notifications or streak analytics.
- Measure activation, retention, and daily proof completion.

---

## 14) Maintainability

Main answer idea:

- Layered code, explicit contracts, reusable API client.

Likely follow-ups:

- What would you add to make the codebase easier for a team?
- Why is schema discipline important?
- How would you introduce testing without slowing development?

What the interviewer is testing:

- Team readiness
- Codebase hygiene
- Engineering systems thinking

Good response direction:

- Add CI checks, tests, formatting, typed contracts, and migration discipline.

---

## 15) What are you proud of?

Main answer idea:

- A complete behavioral product loop, not just CRUD.

Likely follow-ups:

- What part was hardest technically?
- What part was hardest product-wise?
- If you had to rewrite one module, which would it be?

What the interviewer is testing:

- Ownership
- Reflection
- Depth of understanding

Good response direction:

- Be honest about the hardest module.
- Show you understand both execution and product value.

---

## Rapid-Fire Pressure Questions

Use these when the interviewer interrupts or asks for deeper clarity.

- Why should a user trust this product?
- What is the single biggest security issue today?
- What is the single biggest scalability issue today?
- What would you change first before deployment?
- How would you explain your project to a non-technical manager?
- What did you personally build versus what was boilerplate?
- If the backend went down, what user-facing behavior would fail first?
- If the frontend failed, what is still usable from the backend?
- Why did you not use a managed realtime service?
- What evidence would show that your product is working?

---

## How to Answer Follow-Ups

Use this structure:

- Acknowledge the concern.
- Give the direct answer.
- Mention the trade-off.
- Close with the improvement path.

Example pattern:

- "Yes, that is a real risk. Today I handle it this way because it kept the MVP simple. The trade-off is X. In the next iteration I would harden it by Y."

---

## Final Preparation Reminder

If you can defend these four areas clearly, you will sound strong in product-company interviews:

- Product thinking
- System design
- Security and correctness
- Trade-off awareness
