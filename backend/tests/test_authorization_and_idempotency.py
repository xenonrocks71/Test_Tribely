"""
Authorization & Idempotency Invariant Verification Suite
Verifies:
1. Backend authorization: Private Arena data is strictly inaccessible to non-members (403 Forbidden).
2. Proof submission authorization: Non-members cannot submit proofs (403 Forbidden).
3. Nudge authorization: Non-members cannot send or receive nudges in an Arena.
4. Idempotent daily submission: Submitting twice in the same habit cycle triggers 409 Conflict.
5. Deadline processing endpoint: Creator/admin can trigger deadline processing; unsubmitted members marked absent with streak reset to 0.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.models import User, Arena, ArenaMembership, Proof, Submission, DailyArenaSheet

client = TestClient(app)


def create_test_user(email_prefix: str) -> tuple[str, int, str]:
    """Helper to register a user and return (email, user_id, token)."""
    uid = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{uid}@example.com"
    pwd = "TestPassword123!"
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pwd,
        "full_name": f"User {uid}"
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return email, data["user_id"], data["access_token"]


def test_private_arena_authorization_enforcement():
    """
    Verify that non-members cannot access private Arena details, members list, or ledger room.
    """
    # 1. Creator registers and creates a private arena
    _, creator_id, creator_token = create_test_user("creator")
    headers_creator = {"Authorization": f"Bearer {creator_token}"}

    create_resp = client.post("/api/arenas/", json={
        "name": f"Private Squad {uuid.uuid4().hex[:6]}",
        "description": "Exclusive fitness squad",
        "proof_type": "image",
        "is_private": True,
        "deadline_time": "22:00"
    }, headers=headers_creator)
    assert create_resp.status_code == 201, create_resp.text
    arena_id = create_resp.json()["data"]["id"]

    # 2. An outsider registers
    _, outsider_id, outsider_token = create_test_user("outsider")
    headers_outsider = {"Authorization": f"Bearer {outsider_token}"}

    # 3. Outsider attempts GET /api/arenas/{arena_id} -> 403 Forbidden
    detail_resp = client.get(f"/api/arenas/{arena_id}", headers=headers_outsider)
    assert detail_resp.status_code == 403, f"Expected 403 for private arena details, got {detail_resp.status_code}: {detail_resp.text}"

    # 4. Outsider attempts GET /api/arenas/{arena_id}/members -> 403 Forbidden
    members_resp = client.get(f"/api/arenas/{arena_id}/members", headers=headers_outsider)
    assert members_resp.status_code == 403, f"Expected 403 for private arena members, got {members_resp.status_code}: {members_resp.text}"

    # 5. Outsider attempts GET /api/arenas/{arena_id}/ledger-room -> 403 Forbidden
    ledger_resp = client.get(f"/api/arenas/{arena_id}/ledger-room", headers=headers_outsider)
    assert ledger_resp.status_code == 403, f"Expected 403 for private arena ledger room, got {ledger_resp.status_code}: {ledger_resp.text}"

    # 6. Creator can access all three without restriction
    creator_detail = client.get(f"/api/arenas/{arena_id}", headers=headers_creator)
    assert creator_detail.status_code == 200, f"Creator detail failed: {creator_detail.text}"
    assert client.get(f"/api/arenas/{arena_id}/members", headers=headers_creator).status_code == 200
    assert client.get(f"/api/arenas/{arena_id}/ledger-room", headers=headers_creator).status_code == 200


def test_proof_submission_authorization_and_idempotency():
    """
    Verify:
    1. Outsider cannot submit proof (403 Forbidden).
    2. Approved member submits proof -> 201 Created.
    3. Member submits again in same 24h cycle -> 409 Conflict (idempotency enforced).
    """
    _, creator_id, creator_token = create_test_user("sub_creator")
    headers_creator = {"Authorization": f"Bearer {creator_token}"}

    # Create public arena
    create_resp = client.post("/api/arenas/", json={
        "name": f"Habit Tribe {uuid.uuid4().hex[:6]}",
        "description": "Daily habit verification",
        "proof_type": "image",
        "is_private": False,
        "deadline_time": "23:59"
    }, headers=headers_creator)
    assert create_resp.status_code == 201
    arena_data = create_resp.json()["data"]
    arena_id = arena_data["id"]
    invite_code = arena_data["invite_code"]

    # Outsider attempts submission before joining
    _, outsider_id, outsider_token = create_test_user("sub_outsider")
    headers_outsider = {"Authorization": f"Bearer {outsider_token}"}

    unauth_sub = client.post("/api/activity/submit", json={
        "arena_id": arena_id,
        "proof_url": "https://storage.tribely.app/proofs/test_image.jpg"
    }, headers=headers_outsider)
    assert unauth_sub.status_code == 403, f"Expected 403 for unapproved submission, got {unauth_sub.status_code}"

    # Member joins via invite code
    join_resp = client.post("/api/arenas/join-by-code", json={
        "invite_code": invite_code
    }, headers=headers_outsider)
    assert join_resp.status_code == 200

    # Member submits valid proof -> 201 Created
    first_sub = client.post("/api/activity/submit", json={
        "arena_id": arena_id,
        "proof_url": "https://storage.tribely.app/proofs/valid_image.jpg"
    }, headers=headers_outsider)
    assert first_sub.status_code == 201, first_sub.text

    # Member attempts immediate second submission -> 409 Conflict
    dup_sub = client.post("/api/activity/submit", json={
        "arena_id": arena_id,
        "proof_url": "https://storage.tribely.app/proofs/valid_image.jpg"
    }, headers=headers_outsider)
    assert dup_sub.status_code == 409, f"Expected 409 Conflict for duplicate submission, got {dup_sub.status_code}"


def test_nudge_membership_authorization():
    """
    Verify that nudges can only be sent by approved members to other approved members of the same arena.
    """
    _, creator_id, creator_token = create_test_user("nudge_creator")
    headers_creator = {"Authorization": f"Bearer {creator_token}"}

    create_resp = client.post("/api/arenas/", json={
        "name": f"Nudge Squad {uuid.uuid4().hex[:6]}",
        "description": "Nudge test arena",
        "proof_type": "image",
        "is_private": False,
        "deadline_time": "23:59"
    }, headers=headers_creator)
    arena_id = create_resp.json()["data"]["id"]
    invite_code = create_resp.json()["data"]["invite_code"]

    _, member_id, member_token = create_test_user("nudge_member")
    headers_member = {"Authorization": f"Bearer {member_token}"}
    client.post("/api/arenas/join-by-code", json={"invite_code": invite_code}, headers=headers_member)

    _, non_member_id, non_member_token = create_test_user("nudge_outsider")
    headers_non_member = {"Authorization": f"Bearer {non_member_token}"}

    # 1. Non-member attempts to send nudge -> 403 Forbidden
    resp1 = client.post(f"/api/activity/arenas/{arena_id}/nudge/{member_id}", headers=headers_non_member)
    assert resp1.status_code == 403

    # 2. Member attempts to nudge a non-member -> 400 Bad Request
    resp2 = client.post(f"/api/activity/arenas/{arena_id}/nudge/{non_member_id}", headers=headers_member)
    assert resp2.status_code == 400

    # 3. Member nudges creator (both are members) -> 200 OK
    resp3 = client.post(f"/api/activity/arenas/{arena_id}/nudge/{creator_id}", headers=headers_member)
    assert resp3.status_code == 200
    assert resp3.json()["status"] == "success"


def test_process_deadline_endpoint_and_streak_reset():
    """
    Verify POST /api/arenas/{arena_id}/process-deadline:
    - Only creator or admin can trigger it (403 for non-admins).
    - Members without proof for target date are marked absent and their streak is reset to 0.
    """
    _, creator_id, creator_token = create_test_user("audit_creator")
    headers_creator = {"Authorization": f"Bearer {creator_token}"}

    create_resp = client.post("/api/arenas/", json={
        "name": f"Deadline Squad {uuid.uuid4().hex[:6]}",
        "description": "Deadline test",
        "proof_type": "image",
        "is_private": False,
        "deadline_time": "22:00"
    }, headers=headers_creator)
    arena_id = create_resp.json()["data"]["id"]
    invite_code = create_resp.json()["data"]["invite_code"]

    _, member_id, member_token = create_test_user("lazy_member")
    headers_member = {"Authorization": f"Bearer {member_token}"}
    client.post("/api/arenas/join-by-code", json={"invite_code": invite_code}, headers=headers_member)

    # Artificially set member's streak to 4 to verify it resets on missed deadline
    db = SessionLocal()
    mem = db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena_id, ArenaMembership.user_id == member_id).first()
    mem.current_streak = 4
    db.commit()
    db.close()

    # Member cannot trigger deadline processing -> 403 Forbidden
    forbidden_run = client.post(f"/api/arenas/{arena_id}/process-deadline", headers=headers_member)
    assert forbidden_run.status_code == 403

    # Creator triggers deadline processing
    audit_run = client.post(f"/api/arenas/{arena_id}/process-deadline", headers=headers_creator)
    assert audit_run.status_code == 200
    data = audit_run.json()["data"]
    assert data["status"] == "success"
    assert data["absent_count"] >= 1

    # Verify member's streak was reset to 0
    db = SessionLocal()
    refreshed_mem = db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena_id, ArenaMembership.user_id == member_id).first()
    assert refreshed_mem.current_streak == 0
    db.close()
