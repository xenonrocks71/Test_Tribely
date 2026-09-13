"""
Unit and Integration tests for Submission Comments on Habit Proofs.
Tests multi-user comment creation, retrieval, validation, and feed comment counts.
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.api.deps import get_current_user, get_current_user_optional
from app.models.models import User, Arena, ArenaMembership, Submission, SubmissionComment

client = TestClient(app)

_user_a = None
_user_b = None
_test_arena = None
_test_submission = None


def get_or_create_comment_test_entities():
    global _user_a, _user_b, _test_arena, _test_submission
    with SessionLocal() as db:
        user_a = db.query(User).filter(User.email == "comment_tester_a@tribely.internal").first()
        if not user_a:
            user_a = User(
                email="comment_tester_a@tribely.internal",
                full_name="Alice Commenter",
                hashed_password="hashedpassword123"
            )
            db.add(user_a)
            db.commit()
            db.refresh(user_a)
        _user_a = user_a

        user_b = db.query(User).filter(User.email == "comment_tester_b@tribely.internal").first()
        if not user_b:
            user_b = User(
                email="comment_tester_b@tribely.internal",
                full_name="Bob Observer",
                hashed_password="hashedpassword123"
            )
            db.add(user_b)
            db.commit()
            db.refresh(user_b)
        _user_b = user_b

        arena = db.query(Arena).filter(Arena.invite_code == "COMMENTTEST99").first()
        if not arena:
            arena = Arena(
                name="Comment Test Arena",
                invite_code="COMMENTTEST99",
                creator_id=user_a.id,
                is_private=False
            )
            db.add(arena)
            db.commit()
            db.refresh(arena)
        _test_arena = arena

        # Ensure memberships
        for u in [user_a, user_b]:
            m = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.user_id == u.id
            ).first()
            if not m:
                db.add(ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved"))
        db.commit()

        # Create a test submission
        sub = db.query(Submission).filter(
            Submission.arena_id == arena.id,
            Submission.proof_url == "https://tribely.test/comments_proof.jpg"
        ).first()
        if not sub:
            sub = Submission(
                arena_id=arena.id,
                user_id=user_a.id,
                proof_url="https://tribely.test/comments_proof.jpg",
                is_verified=True,
                is_absent=False
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)
        _test_submission = sub

    return _user_a, _user_b, _test_arena, _test_submission


@pytest.fixture(autouse=True)
def setup_comment_users():
    u_a, _, _, _ = get_or_create_comment_test_entities()
    app.dependency_overrides[get_current_user] = lambda: u_a
    app.dependency_overrides[get_current_user_optional] = lambda: u_a
    yield
    app.dependency_overrides.clear()


def test_post_and_get_submission_comments():
    u_a, u_b, arena, sub = get_or_create_comment_test_entities()

    # 1. Post comment as User A
    app.dependency_overrides[get_current_user] = lambda: u_a
    app.dependency_overrides[get_current_user_optional] = lambda: u_a
    resp1 = client.post(
        f"/api/activity/submissions/{sub.id}/comments",
        json={"content": "Crushed 10k steps before sunset!"}
    )
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()["data"]
    assert data1["comment"]["text"] == "Crushed 10k steps before sunset!"
    assert data1["comment"]["userName"] == "Alice Commenter"
    assert data1["comments_count"] >= 1

    # 2. Post comment as User B
    app.dependency_overrides[get_current_user] = lambda: u_b
    app.dependency_overrides[get_current_user_optional] = lambda: u_b
    resp2 = client.post(
        f"/api/activity/submissions/{sub.id}/comments",
        json={"text": "Savage pace! Keep it locked in 🔥"}
    )
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()["data"]
    assert data2["comment"]["text"] == "Savage pace! Keep it locked in 🔥"
    assert data2["comment"]["userName"] == "Bob Observer"

    # 3. Retrieve comments list
    get_resp = client.get(f"/api/activity/submissions/{sub.id}/comments")
    assert get_resp.status_code == 200, get_resp.text
    comments_data = get_resp.json()["data"]["comments"]
    assert len(comments_data) >= 2
    texts = [c["text"] for c in comments_data]
    assert "Crushed 10k steps before sunset!" in texts
    assert "Savage pace! Keep it locked in 🔥" in texts

    # 4. Verify validation on empty comments
    bad_resp = client.post(
        f"/api/activity/submissions/{sub.id}/comments",
        json={"content": "   "}
    )
    assert bad_resp.status_code == 400

    # 5. Verify 404 on non-existent submission
    not_found = client.get("/api/activity/submissions/9999999/comments")
    assert not_found.status_code == 404
