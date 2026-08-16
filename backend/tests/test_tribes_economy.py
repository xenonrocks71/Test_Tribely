"""
Tribes Currency & Freeze Logic Tests.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.models import User, UserWallet, Arena, ArenaMembership, DailyArenaSheet
from app.services.kudos_service import tribes_service
from app.services.audit_service import audit_service


@pytest.fixture
def db_session():
    """Provides an in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def test_user_registration_welcome_bonus(db_session):
    """
    Test user registration welcome credit (+1,000 Tribes).
    """
    u = User(id=10, email="newuser@example.com", hashed_password="hashed_pw", full_name="New User")
    db_session.add(u)
    db_session.commit()

    wallet = tribes_service.award_welcome_bonus(db_session, user_id=u.id)
    assert wallet.tribes_balance == 1000.0
    assert wallet.is_frozen == False
    assert wallet.referral_count == 0


def test_absence_penalty_and_freeze_trigger(db_session):
    """
    Test absence penalty: balance drops, and is_frozen toggles to True when balance < 0.
    """
    u = User(id=20, email="absentuser@example.com", hashed_password="pw", full_name="Absent User")
    db_session.add(u)
    db_session.commit()

    # Set user initial low balance of 100 Tribes and 0 streak shields
    wallet = tribes_service.get_or_create_user_wallet(db_session, user_id=u.id)
    wallet.tribes_balance = 100.0
    wallet.streak_shields = 0
    db_session.commit()

    arena = Arena(id=5, name="Audit Arena", invite_code="AUDIT555", creator_id=u.id, penalty_amount=300.0)
    db_session.add(arena)

    membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved")
    db_session.add(membership)
    db_session.commit()

    # Run deadline audit with no submission present
    audit_res = audit_service.audit_arena_deadline(db_session, arena_id=arena.id, target_date_str="2026-08-16")
    assert audit_res["status"] == "success"
    assert audit_res["absent_count"] == 1

    db_session.refresh(wallet)
    # Balance dropped from 100 to -200
    assert wallet.tribes_balance == -200.0
    # Freeze engine toggles is_frozen = True
    assert wallet.is_frozen == True


def test_referral_unfreeze_mechanism(db_session):
    """
    Test referral unfreeze mechanism: 3 successful referrals unfreeze account and award bonus.
    """
    u = User(id=30, email="frozenuser@example.com", hashed_password="pw", full_name="Frozen User")
    db_session.add(u)
    db_session.commit()

    wallet = tribes_service.get_or_create_user_wallet(db_session, user_id=u.id)
    wallet.tribes_balance = -100.0
    wallet.is_frozen = True
    db_session.commit()

    # 1st referral
    res1 = tribes_service.process_user_referral(db_session, u.id)
    assert res1["referral_count"] == 1
    assert res1["is_frozen"] == True
    assert res1["reward_given"] == False

    # 2nd referral
    res2 = tribes_service.process_user_referral(db_session, u.id)
    assert res2["referral_count"] == 2
    assert res2["is_frozen"] == True
    assert res2["reward_given"] == False

    # 3rd referral - threshold reached! Unfreezes account and awards +200 Tribes bonus
    res3 = tribes_service.process_user_referral(db_session, u.id)
    assert res3["referral_count"] == 3
    assert res3["is_frozen"] == False
    assert res3["reward_given"] == True

    db_session.refresh(wallet)
    assert wallet.is_frozen == False
    assert wallet.tribes_balance == 100.0  # -100 + 200 = 100

def test_custom_arena_penalty_amount(db_session):
    """
    Test that missed proof penalty uses the exact set penalty_amount of that particular arena (e.g., 500.0 Tribes).
    """
    u = User(id=40, email="customarenauser@example.com", hashed_password="pw", full_name="Custom Arena User")
    db_session.add(u)
    db_session.commit()

    wallet = tribes_service.get_or_create_user_wallet(db_session, user_id=u.id)
    wallet.tribes_balance = 1000.0
    wallet.streak_shields = 0
    db_session.commit()

    # Create arena with custom penalty amount of 500 Tribes
    custom_penalty = 500.0
    arena = Arena(id=99, name="High Stake Arena", invite_code="HIGH500", creator_id=u.id, penalty_amount=custom_penalty)
    db_session.add(arena)

    membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved")
    db_session.add(membership)
    db_session.commit()

    audit_res = audit_service.audit_arena_deadline(db_session, arena_id=arena.id, target_date_str="2026-08-16")
    assert audit_res["status"] == "success"

    db_session.refresh(wallet)
    # 1000 - 500 = 500
    assert wallet.tribes_balance == 500.0
    assert wallet.is_frozen == False
