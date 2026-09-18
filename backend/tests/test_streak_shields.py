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


def test_deadline_missed_strictly_resets_streak(db_session):
    """
    Test that when a user misses a daily deadline, their streak is strictly reset to 0
    without any shield forgiveness or buffer, and a deadline_missed logbook entry is created.
    """
    u = User(id=50, email="strictuser@example.com", hashed_password="pw", full_name="Strict User")
    db_session.add(u)
    db_session.commit()

    wallet = UserWallet(user_id=u.id, tribes_balance=1000.0, is_frozen=False)
    db_session.add(wallet)
    db_session.commit()

    arena = Arena(id=77, name="Strict Arena", invite_code="STRICT777", creator_id=u.id, penalty_amount=300.0)
    db_session.add(arena)

    membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved", current_streak=5)
    db_session.add(membership)
    db_session.commit()

    # Run audit on arena with no proof submission present
    audit_res = audit_service.audit_arena_deadline(db_session, arena_id=arena.id, target_date_str="2026-08-16")
    assert audit_res["status"] == "success"

    db_session.refresh(membership)
    # Streak strictly reset to 0
    assert membership.current_streak == 0

    # Verify DailyArenaSheet marked absent
    from app.models.models import DailyArenaSheet
    sheet = db_session.query(DailyArenaSheet).filter(
        DailyArenaSheet.arena_id == arena.id,
        DailyArenaSheet.user_id == u.id,
        DailyArenaSheet.date_day == "2026-08-16"
    ).first()
    assert sheet is not None
    assert sheet.status == "absent"

    # Verify logbook entry
    logbook_entry = db_session.query(ArenaLogbook).filter(
        ArenaLogbook.arena_id == arena.id,
        ArenaLogbook.user_id == u.id
    ).first()
    assert logbook_entry is not None
    assert logbook_entry.entry_type == "deadline_missed"


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
