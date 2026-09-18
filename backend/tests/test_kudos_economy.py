"""
Unit and Integration Tests for the Kudos Virtual Currency & Gamified Staking Economy.
Validates ACID atomic transactions, signup bonus (+1,000 Kudos), entry staking on join,
insufficient balance rejection (400), duplicate join prevention (409), missed-deadline
penalties (-50 Kudos) with streak reset, and weekly 50% reward redistribution to top 3.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.core.database import Base
from app.models.models import (
    User, Arena, ArenaMembership, KudosTransaction, KudosTransactionType, UserWallet
)
from app.services.kudos_service import kudos_service
from app.repositories.user_repository import user_repository
from app.schemas.schemas import UserCreate


@pytest.fixture
def db_session():
    """Provides an isolated in-memory SQLite database session for Kudos economy tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def test_signup_bonus_1000_kudos(db_session):
    """
    Test that user registration atomically credits +1,000 Kudos to user.kudos_balance
    and records an immutable SIGNUP_BONUS KudosTransaction.
    """
    user_in = UserCreate(
        email="kudos_tester@example.com",
        full_name="Kudos Champion",
        password="SecurePassword123!",
        username="kudos_champ"
    )
    user = user_repository.create_user(db_session, user_in=user_in)
    assert user.id is not None
    assert user.kudos_balance == 1000

    # Verify KudosTransaction entry
    tx = db_session.query(KudosTransaction).filter(
        KudosTransaction.user_id == user.id,
        KudosTransaction.type == KudosTransactionType.SIGNUP_BONUS.value
    ).first()
    assert tx is not None
    assert tx.amount == 1000
    assert tx.arena_id is None


def test_arena_join_with_stake_success(db_session):
    """
    Test joining an arena with entry stake:
    - Atomically deducts entry_stake from user.kudos_balance
    - Adds entry_stake to arena.pool_balance
    - Logs ARENA_STAKE KudosTransaction
    - Creates approved membership with streak_count = 0
    """
    user = User(
        id=101,
        email="staker@tribely.test",
        username="staker",
        full_name="Staker User",
        hashed_password="hashed_pw",
        kudos_balance=1000
    )
    db_session.add(user)

    arena = Arena(
        id=501,
        name="100 Days of Code",
        title="100 Days of Code",
        invite_code="CODE100",
        creator_id=user.id,
        entry_stake=100,
        penalty_amount=50,
        pool_balance=0
    )
    db_session.add(arena)
    db_session.commit()

    res = kudos_service.join_arena_with_stake(
        db=db_session,
        user_id=user.id,
        arena_id=arena.id
    )

    assert res["status"] == "success"
    assert res["entry_stake_deducted"] == 100
    assert res["user_kudos_balance"] == 900
    assert res["pool_balance"] == 100

    # Verify DB state
    db_session.refresh(user)
    db_session.refresh(arena)
    assert user.kudos_balance == 900
    assert arena.pool_balance == 100

    tx = db_session.query(KudosTransaction).filter(
        KudosTransaction.user_id == user.id,
        KudosTransaction.arena_id == arena.id,
        KudosTransaction.type == KudosTransactionType.ARENA_STAKE.value
    ).first()
    assert tx is not None
    assert tx.amount == -100

    membership = db_session.query(ArenaMembership).filter(
        ArenaMembership.user_id == user.id,
        ArenaMembership.arena_id == arena.id
    ).first()
    assert membership is not None
    assert membership.status == "approved"
    assert membership.streak_count == 0


def test_arena_join_insufficient_balance(db_session):
    """
    Test that an insufficient Kudos balance raises HTTP 400 Bad Request.
    """
    user = User(
        id=102,
        email="broke@tribely.test",
        username="broke_user",
        full_name="Broke User",
        hashed_password="pw",
        kudos_balance=25  # Only 25 Kudos
    )
    arena = Arena(
        id=502,
        name="High Stakes Arena",
        title="High Stakes Arena",
        invite_code="HIGHSTAKE",
        creator_id=user.id,
        entry_stake=100,
        pool_balance=0
    )
    db_session.add_all([user, arena])
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        kudos_service.join_arena_with_stake(
            db=db_session,
            user_id=user.id,
            arena_id=arena.id
        )

    assert exc_info.value.status_code == 400
    assert "Insufficient Kudos balance" in str(exc_info.value.detail)


def test_arena_join_duplicate_rejected(db_session):
    """
    Test that an already approved member cannot re-stake or join again (409 Conflict).
    """
    user = User(
        id=103,
        email="duplicate@tribely.test",
        username="dup_user",
        full_name="Duplicate Tester",
        hashed_password="pw",
        kudos_balance=500
    )
    arena = Arena(
        id=503,
        name="Consistency Squad",
        title="Consistency Squad",
        invite_code="CONSQ1",
        creator_id=user.id,
        entry_stake=50,
        pool_balance=50
    )
    db_session.add_all([user, arena])
    db_session.commit()

    # First join
    kudos_service.join_arena_with_stake(db=db_session, user_id=user.id, arena_id=arena.id)

    # Second join should raise 409
    with pytest.raises(HTTPException) as exc_info:
        kudos_service.join_arena_with_stake(db=db_session, user_id=user.id, arena_id=arena.id)

    assert exc_info.value.status_code == 409
    assert "already an approved member" in str(exc_info.value.detail)


def test_penalize_missed_deadline(db_session):
    """
    Test missed-deadline penalty audit:
    - Deducts fine (50 Kudos) from user
    - Adds fine (50 Kudos) to arena pool
    - Resets user's streak_count to 0
    - Records DEADLINE_PENALTY KudosTransaction
    """
    user = User(
        id=104,
        email="slacker@tribely.test",
        username="slacker",
        full_name="Slacker User",
        hashed_password="pw",
        kudos_balance=300
    )
    arena = Arena(
        id=504,
        name="Early Birds",
        title="Early Birds",
        invite_code="EARLY1",
        creator_id=user.id,
        penalty_amount=50,
        pool_balance=100
    )
    db_session.add_all([user, arena])
    db_session.commit()

    membership = ArenaMembership(
        arena_id=arena.id,
        user_id=user.id,
        status="approved",
        streak_count=7,
        current_streak=7
    )
    db_session.add(membership)
    db_session.commit()

    res = kudos_service.penalize_missed_deadline(
        db=db_session,
        arena_id=arena.id,
        user_id=user.id
    )

    assert res["status"] == "success"
    assert res["penalty_deducted"] == 50
    assert res["user_kudos_balance"] == 250
    assert res["pool_balance"] == 150
    assert res["streak_reset_to"] == 0

    # Verify DB persistence
    db_session.refresh(user)
    db_session.refresh(arena)
    db_session.refresh(membership)
    assert user.kudos_balance == 250
    assert arena.pool_balance == 150
    assert membership.streak_count == 0
    assert membership.current_streak == 0

    # Verify transaction
    tx = db_session.query(KudosTransaction).filter(
        KudosTransaction.user_id == user.id,
        KudosTransaction.arena_id == arena.id,
        KudosTransaction.type == KudosTransactionType.DEADLINE_PENALTY.value
    ).first()
    assert tx is not None
    assert tx.amount == -50


def test_weekly_rewards_distribution_50_percent(db_session):
    """
    Test weekly 50% reward redistribution engine:
    - 50% of pool_balance (1000 // 2 = 500) divided among top 3 consistent members
    - Each top member receives 500 // 3 = 166 Kudos
    - Remaining pool is 1000 - (166 * 3) = 502
    - Each winner balance incremented and logged as WEEKLY_PAYOUT
    """
    arena = Arena(
        id=505,
        name="Champions Guild",
        title="Champions Guild",
        invite_code="CHAMP1",
        creator_id=1,
        pool_balance=1000
    )
    db_session.add(arena)

    # Create 4 participants with different streaks
    users = []
    for i in range(1, 5):
        u = User(
            id=200 + i,
            email=f"champ_{i}@tribely.test",
            username=f"champ_{i}",
            full_name=f"Champion #{i}",
            hashed_password="pw",
            kudos_balance=500
        )
        users.append(u)
        db_session.add(u)
    db_session.commit()

    # User 1: 10 day streak (Rank 1)
    # User 2: 7 day streak (Rank 2)
    # User 3: 5 day streak (Rank 3)
    # User 4: 1 day streak (Rank 4, not in top 3)
    streaks = [10, 7, 5, 1]
    for u, s in zip(users, streaks):
        mem = ArenaMembership(
            arena_id=arena.id,
            user_id=u.id,
            status="approved",
            streak_count=s,
            current_streak=s
        )
        db_session.add(mem)
    db_session.commit()

    res = kudos_service.distribute_weekly_rewards(db=db_session, arena_id=arena.id)

    assert res["status"] == "success"
    assert res["total_pool_before"] == 1000
    assert res["payout_pool"] == 498  # 166 * 3
    assert res["pool_balance_remaining"] == 502
    assert len(res["winners"]) == 3

    # Check winners list
    assert res["winners"][0]["user_id"] == users[0].id
    assert res["winners"][0]["reward_kudos"] == 166
    assert res["winners"][1]["user_id"] == users[1].id
    assert res["winners"][2]["user_id"] == users[2].id

    # Verify DB balance updates for top 3
    db_session.refresh(users[0])
    db_session.refresh(users[1])
    db_session.refresh(users[2])
    db_session.refresh(users[3])
    assert users[0].kudos_balance == 666  # 500 + 166
    assert users[1].kudos_balance == 666
    assert users[2].kudos_balance == 666
    assert users[3].kudos_balance == 500  # Untouched

    # Verify WEEKLY_PAYOUT transactions
    payout_txs = db_session.query(KudosTransaction).filter(
        KudosTransaction.arena_id == arena.id,
        KudosTransaction.type == KudosTransactionType.WEEKLY_PAYOUT.value
    ).all()
    assert len(payout_txs) == 3


def test_weekly_rewards_distribution_empty_pool(db_session):
    """
    Test that distribute_weekly_rewards returns gracefully when pool balance is 0.
    """
    arena = Arena(
        id=506,
        name="Empty Pool Arena",
        title="Empty Pool Arena",
        invite_code="EMPTY1",
        creator_id=1,
        pool_balance=0
    )
    db_session.add(arena)
    db_session.commit()

    res = kudos_service.distribute_weekly_rewards(db=db_session, arena_id=arena.id)
    assert res["status"] == "no_funds"
    assert res["payout_pool"] == 0
    assert len(res["winners"]) == 0


def test_arena_pool_details_and_leaderboard(db_session):
    """
    Test pool details and leaderboard projection queries.
    """
    creator = User(id=301, email="creator@tribely.test", username="creator", full_name="Creator", hashed_password="pw", kudos_balance=1000)
    member = User(id=302, email="runner@tribely.test", username="runner", full_name="Runner", hashed_password="pw", kudos_balance=800)
    db_session.add_all([creator, member])

    arena = Arena(
        id=601,
        name="Morning Joggers",
        title="Morning Joggers",
        invite_code="JOGGERS1",
        creator_id=creator.id,
        entry_stake=100,
        penalty_amount=50,
        pool_balance=400
    )
    db_session.add(arena)
    db_session.commit()

    db_session.add(ArenaMembership(arena_id=arena.id, user_id=creator.id, status="approved", streak_count=12, current_streak=12))
    db_session.add(ArenaMembership(arena_id=arena.id, user_id=member.id, status="approved", streak_count=8, current_streak=8))
    db_session.commit()

    details = kudos_service.get_arena_pool_details(db=db_session, arena_id=arena.id)
    assert details["arena_id"] == arena.id
    assert details["pool_balance"] == 400
    assert details["weekly_prize_pool"] == 200
    assert details["active_members_count"] == 2

    leaderboard = kudos_service.get_arena_leaderboard(db=db_session, arena_id=arena.id)
    assert len(leaderboard) == 2
    assert leaderboard[0]["user_id"] == creator.id
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["badge"] == "🥇"
    assert leaderboard[0]["projected_weekly_kudos"] > 0
