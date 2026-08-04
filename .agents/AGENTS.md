# Tribely Architecture & Scalability Guidelines

## Core System Architectural Principles (Google & Meta Standard)

1. **Decoupled Layered Architecture**:
   - API Controllers (`app/api/`) only handle HTTP request validation and response serialization using Pydantic schemas (`app/schemas/`).
   - Business logic resides strictly in Services (`app/services/`).
   - Data access resides in Repositories (`app/repositories/`) using SQLAlchemy 2.0 ORM models (`app/models/`).

2. **Real-Time WebSocket Synchronization**:
   - Every state change that impacts room members (member kick, join request, deadline setting change, chat message, daily proof submission) MUST broadcast a real-time event over the WebSocket connection pool (`websocket_manager.broadcast_to_arena`).
   - Clients must update state in real-time **without requiring a page refresh**.

3. **High-Scale Readiness**:
   - WebSocket manager supports dual-mode local connection pool + Redis Pub/Sub cluster adapter (`RedisPubSubManager`).
   - Database operations must maintain strict transaction boundaries with proper `db.commit()` and `db.rollback()` exception handling.
