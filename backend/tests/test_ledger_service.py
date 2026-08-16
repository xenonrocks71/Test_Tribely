"""
Unit & Ledger Tests for Tribely 60/30/10 Financial Allocation Engine.
"""

import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.models import User, UserWallet, Arena, ArenaMembership, Submission, ArenaPool, EscrowLedger
from app.services.ledger_service import ledger_service


@pytest.fixture
def db_session():
    """Provides an in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def test_penalty_accrual_60_30_10_splits(db_session):
    """
    Test penalty accrual and verify exact 60/30/10 splits across arena reserve (60%),
    top-performer reward pool (30%), and platform commission (10%).
    """
    arena = Arena(name="Test Arena", invite_code="TEST603010", creator_id=1, penalty_amount=300.0)
    db_session.add(arena)
    db_session.commit()

    penalty_amount = 300.0
    res = ledger_service.record_penalty_accrual(
        db=db_session,
        arena_id=arena.id,
        user_id=1,
        penalty_amount_inr=penalty_amount,
        target_date_str="2026-08-16"
    )

    assert res["status"] == "success"
    assert res["commission"] == 30.0   # 10% of 300
    assert res["reserve"] == 180.0     # 60% of 300
    assert res["reward"] == 90.0       # 30% of 300

    pool = ledger_service.get_or_create_arena_pool(db_session, arena.id)
    assert pool.reserve_pool_tribes == 180.0
    assert pool.reward_pool_tribes == 90.0
    assert pool.total_penalties_count == 1

    # Verify double-entry ledger records
    ledger_entries = db_session.query(EscrowLedger).filter(EscrowLedger.arena_id == arena.id).all()
    assert len(ledger_entries) == 3


def test_idempotency_key_enforcement(db_session):
    """
    Test idempotency_key enforcement: calling penalty accrual twice with identical parameters
    must not duplicate ledger entries or double-count pool amounts.
    """
    arena = Arena(name="Idempotency Arena", invite_code="IDEM123", creator_id=1)
    db_session.add(arena)
    db_session.commit()

    target_date = "2026-08-16"

    res1 = ledger_service.record_penalty_accrual(
        db=db_session,
        arena_id=arena.id,
        user_id=1,
        penalty_amount_inr=300.0,
        target_date_str=target_date
    )
    assert res1["status"] == "success"

    # Second call with identical parameters
    res2 = ledger_service.record_penalty_accrual(
        db=db_session,
        arena_id=arena.id,
        user_id=1,
        penalty_amount_inr=300.0,
        target_date_str=target_date
    )
    assert res2["status"] == "duplicate"

    pool = ledger_service.get_or_create_arena_pool(db_session, arena.id)
    assert pool.reserve_pool_tribes == 180.0
    assert pool.reward_pool_tribes == 90.0
    assert pool.total_penalties_count == 1


def test_top_performer_candidate_selection_and_cooldown(db_session):
    """
    Test top-performer candidate selection algorithm:
    Ranks by upvotes DESC, streak DESC, and applies 90-day win cooldown tie-breakers.
    """
    arena = Arena(name="Reward Arena", invite_code="REWARD999", creator_id=1)
    db_session.add(arena)
    db_session.commit()

    u1 = User(email="u1@example.com", hashed_password="pw", full_name="User One")
    u2 = User(email="u2@example.com", hashed_password="pw", full_name="User Two")
    db_session.add_all([u1, u2])
    db_session.commit()

    m1 = ArenaMembership(arena_id=arena.id, user_id=u1.id, status="approved")
    m2 = ArenaMembership(arena_id=arena.id, user_id=u2.id, status="approved")
    db_session.add_all([m1, m2])

    w1 = UserWallet(user_id=u1.id, tribes_balance=1000.0)
    w2 = UserWallet(user_id=u2.id, tribes_balance=1000.0)
    db_session.add_all([w1, w2])
    db_session.commit()

    # User 1 has 5 upvotes; User 2 has 10 upvotes
    s1 = Submission(arena_id=arena.id, user_id=u1.id, proof_url="p1", upvotes=5, is_absent=False)
    s2 = Submission(arena_id=arena.id, user_id=u2.id, proof_url="p2", upvotes=10, is_absent=False)
    db_session.add_all([s1, s2])

    # Accrue reward pool of 300 Tribes
    pool = ledger_service.get_or_create_arena_pool(db_session, arena.id)
    pool.reward_pool_tribes = 300.0
    db_session.commit()

    # Select winner - User 2 has higher upvotes
    res = ledger_service.select_and_award_top_performer(db_session, arena.id)
    assert res["status"] == "success"
    assert res["winner_id"] == u2.id
    assert res["awarded_amount_inr"] == 300.0

    # User 2 wallet credited, pool reset to 0
    db_session.refresh(w2)
    assert w2.tribes_balance == 1300.0
    db_session.refresh(pool)
    assert pool.reward_pool_tribes == 0.0


def test_zero_penalty_cycle_reserve_drawdown(db_session):
    """
    Test zero-penalty cycle reserve drawdown:
    10% platform commission is drawn from reserve pool when no penalties were accrued.
    """
    arena = Arena(name="Clean Arena", invite_code="CLEAN777", creator_id=1, penalty_amount=300.0)
    db_session.add(arena)
    db_session.commit()

    pool = ledger_service.get_or_create_arena_pool(db_session, arena.id)
    pool.reserve_pool_tribes = 500.0
    db_session.commit()

    res = ledger_service.handle_zero_penalty_cycle(db_session, arena.id)
    assert res["status"] == "success"
    assert res["commission_deducted_inr"] == 30.0  # 10% of 300
    assert res["remaining_reserve_pool_inr"] == 470.0  # 500 - 30
