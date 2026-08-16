"""
Unit & Integration Tests for Streak Freeze Shields & AI Proof Verification Engine.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.models import User, UserWallet, Arena, ArenaMembership, ArenaLogbook, Submission
from app.services.audit_service import audit_service
from app.services.ai_verification_service import ai_verification_service


@pytest.fixture
def db_session():
    """Provides an in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def test_streak_shield_protects_user_from_penalty(db_session):
    """
    Test that when a user has a streak_shield > 0, missing a deadline consumes 1 shield,
    skips negative penalty deduction, and keeps balance intact.
    """
    u = User(id=50, email="shielduser@example.com", hashed_password="pw", full_name="Shield User")
    db_session.add(u)
    db_session.commit()

    wallet = UserWallet(user_id=u.id, tribes_balance=1000.0, is_frozen=False, streak_shields=1)
    db_session.add(wallet)
    db_session.commit()

    arena = Arena(id=77, name="Shield Arena", invite_code="SHIELD777", creator_id=u.id, penalty_amount=300.0)
    db_session.add(arena)

    membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved")
    db_session.add(membership)
    db_session.commit()

    # Run audit on arena with no proof submission present
    audit_res = audit_service.audit_arena_deadline(db_session, arena_id=arena.id, target_date_str="2026-08-16")
    assert audit_res["status"] == "success"

    db_session.refresh(wallet)
    # Shield consumed from 1 to 0
    assert wallet.streak_shields == 0
    # Balance remains intact at 1000.0 (no penalty slash)
    assert wallet.tribes_balance == 1000.0
    assert wallet.is_frozen == False

    # Verify logbook entry
    logbook_entry = db_session.query(ArenaLogbook).filter(
        ArenaLogbook.arena_id == arena.id,
        ArenaLogbook.user_id == u.id
    ).first()
    assert logbook_entry is not None
    assert logbook_entry.entry_type == "streak_shield_used"


def test_ai_verification_service_scoring():
    """
    Test AI verification heuristics for fitness and coding proof URLs.
    """
    fitness_res = ai_verification_service.analyze_submission_proof("https://strava.com/activity/12345_gym_workout.jpg")
    assert fitness_res["ai_confidence_score"] >= 0.90
    assert fitness_res["ai_status"] == "verified"

    coding_res = ai_verification_service.analyze_submission_proof("https://github.com/user/project/code_commit.png")
    assert coding_res["ai_confidence_score"] >= 0.90
    assert coding_res["ai_status"] == "verified"
