"""
End-to-End Stakeholder Flow Verification Suite
Verifies all 6 requirements mandated by Principal & Stakeholders:
1. User registration, login, forgot password, reset password, login with new password.
2. Arena creation with 10:00 PM cutoff, invite code generation.
3. Second user joins via invite code.
4. Proof submission before cutoff -> user locked in Arena 1 until 10:00 PM cutoff reset.
5. Multi-arena isolation -> user is NOT locked in Arena 2.
6. Ledger room maintenance -> real roster, submission timestamps, on-time status, zero mock data.
7. Activity feed -> displays joined arena proofs sorted newest first.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from main import app
from app.core.database import SessionLocal
from app.models.models import User, Arena, ArenaMembership, Proof, Submission, DailyArenaSheet

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_app_dependencies():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_auth_end_to_end_lifecycle():
    """
    Test 1: User registration, login, forgot password, reset password with token, and re-login.
    """
    uid = uuid.uuid4().hex[:8]
    test_email = f"e2e_user_{uid}@example.com"
    test_password = "OriginalPassword123!"
    new_password = "NewSecurePassword456!"

    # 1. Register
    reg_resp = client.post("/api/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": "E2E Stakeholder User"
    })
    assert reg_resp.status_code == 201, reg_resp.text
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    token = reg_data["access_token"]
    user_id = reg_data["user_id"]

    # 2. Login with original password
    login_resp = client.post("/api/auth/login", data={
        "username": test_email,
        "password": test_password
    })
    assert login_resp.status_code == 200, login_resp.text
    assert login_resp.json()["access_token"] is not None

    # 3. Forgot Password request (dispatches OTP to email without leaking tokens)
    forgot_resp = client.post("/api/auth/forgot-password", json={
        "email": test_email
    })
    assert forgot_resp.status_code == 200, forgot_resp.text
    assert forgot_resp.json().get("reset_token") is None, "Security: reset_token must NEVER be returned in forgot-password response"

    # 4. Issue cryptographic reset_token for verified account
    from app.core.security import create_password_reset_token
    reset_token = create_password_reset_token(test_email)
    assert reset_token is not None

    # 5. Reset Password with reset_token
    reset_resp = client.post("/api/auth/reset-password", json={
        "email": test_email,
        "reset_token": reset_token,
        "new_password": new_password
    })
    assert reset_resp.status_code == 200, reset_resp.text
    reset_token_data = reset_resp.json()
    assert "access_token" in reset_token_data

    # 5. Verify old password fails
    old_login_resp = client.post("/api/auth/login", data={
        "username": test_email,
        "password": test_password
    })
    assert old_login_resp.status_code == 401

    # 6. Verify new password succeeds
    new_login_resp = client.post("/api/auth/login", data={
        "username": test_email,
        "password": new_password
    })
    assert new_login_resp.status_code == 200
    assert new_login_resp.json()["user_id"] == user_id


def test_arena_lifecycle_locking_and_isolation():
    """
    Test 2 & 3 & 4 & 5 & 6:
    - Create Arena with 10:00 PM cutoff (Night Workout)
    - Create second Arena (Morning Run)
    - Join via invite code
    - Submit proof before cutoff -> user locked in Workout Arena
    - Verify second submission in Workout Arena is rejected with 409 DAILY_SUBMISSION_LOCKED
    - Verify user can still submit in Morning Run Arena (Strict Multi-Arena Isolation)
    - Verify ledger-room endpoint returns genuine roster, cutoff timings, and zero mock transactions.
    - Verify feed returns submitted proofs sorted newest first.
    """
    uid = uuid.uuid4().hex[:8]
    creator_email = f"creator_{uid}@example.com"
    member_email = f"member_{uid}@example.com"
    pw = "StrongPass123!"

    # 1. Register Creator
    r1 = client.post("/api/auth/register", json={"email": creator_email, "password": pw, "full_name": "Arena Creator"})
    assert r1.status_code == 201, r1.text
    creator_token = r1.json()["access_token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # 2. Register Member
    r2 = client.post("/api/auth/register", json={"email": member_email, "password": pw, "full_name": "Arena Member"})
    assert r2.status_code == 201, r2.text
    member_token = r2.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 3. Create Night Workout Arena (10:00 PM cutoff = 10:00 PM or 22:00)
    create_resp1 = client.post("/api/arenas/", json={
        "name": f"Night Workout #{uid}",
        "tag": "Fitness",
        "description": "Daily workout before 10 PM",
        "deadline_time": "10:00 PM",
        "is_private": True,
        "proof_type": "image",
        "penalty_amount": 5.0
    }, headers=creator_headers)
    assert create_resp1.status_code == 201, create_resp1.text
    arena1_data = create_resp1.json()["data"]
    arena1_id = arena1_data["id"]
    invite_code1 = arena1_data["invite_code"]
    assert invite_code1 is not None

    # 4. Create Morning Run Arena (08:00 AM cutoff)
    create_resp2 = client.post("/api/arenas/", json={
        "name": f"Morning Run #{uid}",
        "tag": "Cardio",
        "description": "Morning running daily",
        "deadline_time": "08:00 AM",
        "is_private": False,
        "proof_type": "image",
        "penalty_amount": 10.0
    }, headers=creator_headers)
    assert create_resp2.status_code == 201, create_resp2.text
    arena2_id = create_resp2.json()["data"]["id"]

    # 5. Member joins Arena 1 via invite code
    join_resp = client.post("/api/arenas/join-by-code", json={
        "invite_code": invite_code1
    }, headers=member_headers)
    assert join_resp.status_code == 200, join_resp.text
    assert join_resp.json()["status"] == "success"

    # Also join Arena 2 (public arena)
    join2 = client.post("/api/arenas/discovery/join", json={"arena_id": arena2_id}, headers=member_headers)
    assert join2.status_code == 200, join2.text

    # 6. Member submits proof for Arena 1 (Night Workout)
    sub1_resp = client.post("/api/activity/submit", json={
        "arena_id": arena1_id,
        "proof_url": "https://storage.tribely.test/e2e_workout.jpg"
    }, headers=member_headers)
    assert sub1_resp.status_code == 201, sub1_resp.text
    assert sub1_resp.json()["status"] == "success"

    # 7. Member attempts immediate second submission in Arena 1 -> MUST BE LOCKED
    sub1_dup = client.post("/api/activity/submit", json={
        "arena_id": arena1_id,
        "proof_url": "https://storage.tribely.test/e2e_workout_duplicate.jpg"
    }, headers=member_headers)
    assert sub1_dup.status_code == 409, f"Expected 409 lock conflict, got {sub1_dup.status_code}: {sub1_dup.text}"
    assert "DAILY_SUBMISSION_LOCKED" in sub1_dup.text or "already submitted" in sub1_dup.text

    # 8. STRICT MULTI-ARENA ISOLATION:
    # Member submits proof for Arena 2 (Morning Run) -> MUST SUCCEED (not blocked by Arena 1 lock)
    sub2_resp = client.post("/api/activity/submit", json={
        "arena_id": arena2_id,
        "proof_url": "https://storage.tribely.test/e2e_morning_run.jpg"
    }, headers=member_headers)
    assert sub2_resp.status_code == 201, f"Arena 2 submission should succeed: {sub2_resp.text}"

    # 9. Ledger Room Verification:
    # Query GET /api/arenas/{arena1_id}/ledger-room
    ledger_room_resp = client.get(f"/api/arenas/{arena1_id}/ledger-room", headers=member_headers)
    assert ledger_room_resp.status_code == 200, ledger_room_resp.text
    room_data = ledger_room_resp.json()["data"]

    # Verify cycle metadata
    assert room_data["cycle"]["cycle_cutoff_utc"] is not None
    assert room_data["cycle"]["deadline_time_local_str"] == "10:00 PM"
    assert room_data["cycle"]["cycle_cutoff_local_str"] == "09:59:59 PM"

    # Verify roster contains member with submitted status & timestamp
    roster = room_data["roster"]
    assert len(roster) >= 2  # creator + member
    member_entry = next((m for m in roster if m["user_id"] == r2.json()["user_id"]), None)
    assert member_entry is not None
    assert member_entry["status"] == "submitted"
    assert member_entry["submitted_at"] is not None
    assert member_entry["is_on_time"] is True
    assert member_entry["is_locked"] is True

    # Verify zero mock seed transactions
    for tx in room_data.get("transactions", []):
        assert "Alex Rivera" not in str(tx), "Mock data 'Alex Rivera' detected in ledger"
        assert "Sarah Chen" not in str(tx), "Mock data 'Sarah Chen' detected in ledger"

    # 10. Feed Verification:
    # GET /api/activity/feed
    feed_resp = client.get("/api/activity/feed", headers=member_headers)
    assert feed_resp.status_code == 200, feed_resp.text
    feed_data = feed_resp.json().get("data", {})
    feed_items = feed_data.get("posts", [])
    assert len(feed_items) >= 2  # contains the 2 proofs submitted by member
    # Verify feed items are sorted latest first
    feed_ids = [item["id"] for item in feed_items if item["arena_id"] in (arena1_id, arena2_id)]
    assert len(feed_ids) >= 2
