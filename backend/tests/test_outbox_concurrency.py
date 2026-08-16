"""
Stream & Concurrency Tests for Outbox Pattern & Distributed Redlock Engine.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.models import User, UserWallet, Arena, ArenaMembership, OutboxEvent, EscrowLedger
from app.services.audit_service import audit_service
from app.workers.outbox_worker import process_outbox_events_job
from app.workers.locks import RedisDistributedLock


@pytest.fixture
def db_session():
    """Provides an in-memory SQLite database session for unit testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    yield session
    session.close()


def test_atomic_ledger_and_outbox_creation(db_session):
    """
    Test atomic creation of ledger entries + OutboxEvent records in a single transaction.
    """
    u = User(id=100, email="outboxuser@example.com", hashed_password="pw", full_name="Outbox User")
    db_session.add(u)
    db_session.commit()

    arena = Arena(id=10, name="Outbox Arena", invite_code="OUTBOX100", creator_id=u.id, penalty_amount=300.0)
    db_session.add(arena)

    membership = ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved")
    db_session.add(membership)
    db_session.commit()

    # Execute deadline audit which atomically creates Ledger entries + OutboxEvent
    audit_res = audit_service.audit_arena_deadline(db_session, arena_id=arena.id, target_date_str="2026-08-16")
    assert audit_res["status"] == "success"

    # Verify atomic creation of OutboxEvent in the same database session
    outbox_events = db_session.query(OutboxEvent).filter(OutboxEvent.arena_id == arena.id).all()
    assert len(outbox_events) == 1
    event = outbox_events[0]
    assert event.event_type == "member_absent_penalty"
    assert event.processed == False

    # Verify EscrowLedger entries created in same transaction
    ledger_entries = db_session.query(EscrowLedger).filter(EscrowLedger.arena_id == arena.id).all()
    assert len(ledger_entries) == 3


def test_redis_distributed_lock_prevents_double_audits():
    """
    Simulate concurrent audit runs on the same arena to confirm Redis distributed locking (Redlock)
    prevents double audits across worker nodes.
    """
    async def run_lock_test():
        mock_redis = AsyncMock()

        # First acquire returns True (acquired), second acquire returns False (locked out)
        mock_redis.set = AsyncMock(side_effect=[True, False])
        mock_redis.eval = AsyncMock(return_value=1)

        lock1 = RedisDistributedLock(redis_client=mock_redis, arena_id=42, date_str="2026-08-16", ttl_seconds=300)
        lock2 = RedisDistributedLock(redis_client=mock_redis, arena_id=42, date_str="2026-08-16", ttl_seconds=300)

        # Worker 1 acquires lock
        acquired1 = await lock1.acquire()
        assert acquired1 is True
        assert lock1.acquired is True

        # Worker 2 attempts to acquire lock on the same arena & date concurrently
        acquired2 = await lock2.acquire()
        assert acquired2 is False
        assert lock2.acquired is False

        # Worker 1 releases lock cleanly
        released1 = await lock1.release()
        assert released1 is True

    asyncio.run(run_lock_test())

