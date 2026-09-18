"""
Unit & Integration Tests for Phase 3: Strava Heatmap Matrix, Social Proof Feed, and Micro-Reactions.
"""

import pytest
import time
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.api.deps import get_current_user
from app.models.models import User, Arena, ArenaMembership, Submission, DailyArenaSheet, SubmissionVote

client = TestClient(app)

_shared_user = None
_shared_arena = None


def get_or_create_test_entities():
    global _shared_user, _shared_arena
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "phase3_tester@tribely.internal").first()
        if not user:
            user = User(
                email="phase3_tester@tribely.internal",
                full_name="Phase 3 Tester",
                hashed_password="hashedpassword123"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        _shared_user = user

        arena = db.query(Arena).filter(Arena.invite_code == "P3HEATMAP99").first()
        if not arena:
            arena = Arena(
                name="Phase 3 Arena",
                invite_code="P3HEATMAP99",
                creator_id=user.id
            )
            db.add(arena)
            db.commit()
            db.refresh(arena)
        _shared_arena = arena

    return _shared_user, _shared_arena


def mock_get_current_user():
    user, _ = get_or_create_test_entities()
    return user
 
@pytest.fixture(autouse=True)
def setup_teardown_heatmap_user():
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()


def test_heatmap_calculation():
    """Test Strava-style heatmap matrix calculation for past 30 days."""
    user, arena = get_or_create_test_entities()
    today = datetime.now(timezone.utc).date()
    yesterday_str = (today - timedelta(days=1)).isoformat()
    two_days_ago_str = (today - timedelta(days=2)).isoformat()

    with SessionLocal() as db:
        # Clean any prior sheets for clean test run
        db.query(DailyArenaSheet).filter(
            DailyArenaSheet.arena_id == arena.id,
            DailyArenaSheet.user_id == user.id
        ).delete()

        sheet1 = DailyArenaSheet(arena_id=arena.id, user_id=user.id, date_day=yesterday_str, status="present", proof_type="image")
        sheet2 = DailyArenaSheet(arena_id=arena.id, user_id=user.id, date_day=two_days_ago_str, status="present", proof_type="image")
        db.add(sheet1)
        db.add(sheet2)
        db.commit()

    response = client.get(f"/api/activity/arenas/{arena.id}/heatmap/{user.id}?days=30")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["arena_id"] == arena.id
    assert data["user_id"] == user.id
    assert data["days_count"] == 30
    assert len(data["matrix"]) == 30
    assert data["present_count"] >= 2
    assert data["consistency_percentage"] > 0


def test_social_proof_feed_and_micro_reactions():
    """Test Instagram/BeReal social proof feed and live micro-reactions."""
    user, arena = get_or_create_test_entities()

    with SessionLocal() as db:
        sub = Submission(
            arena_id=arena.id,
            user_id=user.id,
            proof_url="https://images.unsplash.com/photo-workout.jpg",
            ai_confidence_score=0.98,
            ai_status="verified",
            ai_audit_notes="Valid fitness workout proof verified",
            upvotes=0,
            downvotes=0
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id

    # 1. Fetch Feed
    feed_res = client.get(f"/api/activity/arenas/{arena.id}/feed?limit=10")
    assert feed_res.status_code == 200
    feed_data = feed_res.json()["data"]
    assert len(feed_data["feed"]) >= 1
    cards = [c for c in feed_data["feed"] if c["id"] == sub_id]
    assert len(cards) == 1
    assert cards[0]["ai_status"] == "verified"
    assert "fire" in cards[0]["reactions"]

    # 2. Add Fire reaction 🔥
    react_res = client.post(f"/api/activity/submissions/{sub_id}/react", json={"reaction_type": "fire"})
    assert react_res.status_code == 200
    react_data = react_res.json()["data"]
    assert react_data["reaction_type"] == "fire"
    assert react_data["action"] == "added"

    # 3. Toggle off Fire reaction
    toggle_res = client.post(f"/api/activity/submissions/{sub_id}/react", json={"reaction_type": "fire"})
    assert toggle_res.status_code == 200
    toggle_data = toggle_res.json()["data"]
    assert toggle_data["reaction_type"] is None
    assert toggle_data["action"] == "removed"

