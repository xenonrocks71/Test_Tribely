"""
Unit & Integration Tests for Phase 2 High-Concurrency SRE & Performance Optimizations.
Tests Redlock token ownership, Lua script release, true max_streak calculation,
WebSocket scatter-gather timeout isolation, and database unique constraint integrity.
"""

import pytest
import asyncio
from datetime import datetime, date, timedelta
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.core.database import Base
from app.models.models import User, UserWallet, Arena, ArenaMembership, Submission, DailyArenaSheet
from app.core.redis import acquire_distributed_lock, release_distributed_lock, LUA_RELEASE_LOCK_SCRIPT
from app.services.streak_service import streak_service
from app.core.managers.websocket_manager import RoomConnectionPool


@pytest.fixture
def db_session():
    """Provides an in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


# ── 1. Redlock Token Ownership & Safe Lua Release ──────────────────────────

def test_distributed_lock_acquire_and_safe_lua_release():
    """
    Verify that distributed lock acquires with token, and only the owner
    of the token can release it via the atomic Lua script.
    """
    mock_redis = MagicMock()
    mock_redis.set.return_value = True

    lock_key = "lock:submit:10:99"
    token_a = "token_aaa_111"
    token_b = "token_bbb_222"

    # 1. Acquire lock with token_a
    acquired = acquire_distributed_lock(mock_redis, lock_key, token_a, ttl_seconds=5)
    assert acquired is True
    mock_redis.set.assert_called_once_with(lock_key, token_a, nx=True, ex=5)

    # 2. Releasing with matching token executes Lua script and succeeds
    mock_redis.eval.return_value = 1
    released = release_distributed_lock(mock_redis, lock_key, token_a)
    assert released is True
    mock_redis.eval.assert_called_once_with(LUA_RELEASE_LOCK_SCRIPT, 1, lock_key, token_a)

    # 3. If token does not match (e.g. expired lock acquired by another request),
    # Lua script returns 0 and release_distributed_lock returns False
    mock_redis.eval.return_value = 0
    wrong_token_release = release_distributed_lock(mock_redis, lock_key, token_b)
    assert wrong_token_release is False


def test_distributed_lock_circuit_breaker_when_redis_none():
    """Verify graceful fallback when Redis is unreachable (None)."""
    assert acquire_distributed_lock(None, "key", "tok") is False
    assert release_distributed_lock(None, "key", "tok") is False


# ── 2. True Maximum Consecutive Streak Calculation ────────────────────────

def test_true_max_consecutive_streak_calculation(db_session):
    """
    Verify that max_streak calculates true consecutive days instead of total non-consecutive count.
    User active on:
    Run 1: Aug 1, Aug 2 (2 days)
    [8 days gap]
    Run 2: Aug 11, Aug 12, Aug 13 (3 days)
    Max streak must be 3 (not 5).
    """
    u = User(id=80, email="streakmaster@example.com", hashed_password="pw", full_name="Streak Master")
    db_session.add(u)
    wallet = UserWallet(user_id=80, tribes_balance=1000.0, is_frozen=False)
    db_session.add(wallet)
    arena = Arena(id=88, name="Run Arena", invite_code="RUN888", creator_id=80, deadline_time="23:59")
    db_session.add(arena)
    db_session.commit()

    # Add Run 1 (2 days)
    s1 = Submission(arena_id=88, user_id=80, proof_url="p1", submitted_at=datetime(2026, 8, 1, 10, 0, 0), is_absent=False)
    s2 = Submission(arena_id=88, user_id=80, proof_url="p2", submitted_at=datetime(2026, 8, 2, 10, 0, 0), is_absent=False)

    # Add Run 2 (3 days)
    s3 = Submission(arena_id=88, user_id=80, proof_url="p3", submitted_at=datetime(2026, 8, 11, 10, 0, 0), is_absent=False)
    s4 = Submission(arena_id=88, user_id=80, proof_url="p4", submitted_at=datetime(2026, 8, 12, 10, 0, 0), is_absent=False)
    s5 = Submission(arena_id=88, user_id=80, proof_url="p5", submitted_at=datetime(2026, 8, 13, 10, 0, 0), is_absent=False)

    db_session.add_all([s1, s2, s3, s4, s5])
    db_session.commit()

    # Disable Redis cache during this unit test to test raw algorithmic calculation
    streak_service._redis_client = False
    result = streak_service.calculate_user_streak(db_session, user_id=80, arena_id=88)

    # Total submissions = 5, but maximum consecutive streak is 3
    assert result["max_streak"] == 3


# ── 3. WebSocket Scatter-Gather Timeout Isolation ──────────────────────────

def test_websocket_room_pool_scatter_gather_pruning():
    """
    Verify that RoomConnectionPool broadcasts concurrently and automatically prunes
    broken/stuck sockets without halting delivery to healthy sockets.
    """
    async def _test():
        pool = RoomConnectionPool(room_id=99)

        # Healthy client socket
        healthy_ws = AsyncMock()
        healthy_ws.send_text = AsyncMock(return_value=None)

        # Broken client socket that raises an exception
        broken_ws = AsyncMock()
        broken_ws.send_text = AsyncMock(side_effect=RuntimeError("Connection reset by peer"))

        pool.add(healthy_ws)
        pool.add(broken_ws)
        assert len(pool.active_connections) == 2

        test_msg = {"event_type": "test_broadcast", "data": "hello"}
        await pool.broadcast(test_msg)

        # Healthy WS received the payload
        healthy_ws.send_text.assert_called_once()

        # Broken WS failed and was cleanly pruned from active connections
        assert broken_ws not in pool.active_connections
        assert healthy_ws in pool.active_connections
        assert len(pool.active_connections) == 1

    asyncio.run(_test())


# ── 4. Database Unique Constraint & Idempotency Safeguards ─────────────────

def test_daily_arena_sheet_unique_constraint_prevents_duplicate_records(db_session):
    """
    Verify that DailyArenaSheet strictly enforces unique constraint on (arena_id, user_id, date_day).
    Attempting duplicate insertion raises IntegrityError, safeguarding atomic commits.
    """
    u = User(id=90, email="dupuser@example.com", hashed_password="pw", full_name="Dup User")
    db_session.add(u)
    arena = Arena(id=99, name="Dup Arena", invite_code="DUP999", creator_id=90)
    db_session.add(arena)
    db_session.commit()

    sheet1 = DailyArenaSheet(arena_id=99, user_id=90, date_day="2026-09-06", status="present", proof_type="text")
    db_session.add(sheet1)
    db_session.commit()

    # Attempting duplicate row for the same date must fail
    sheet2 = DailyArenaSheet(arena_id=99, user_id=90, date_day="2026-09-06", status="present", proof_type="text")
    db_session.add(sheet2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
