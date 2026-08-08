"""
Scratch script reproducing real user account deletion failure.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import User, UserProfile, UserWallet, Arena, ArenaMembership, DailyArenaSheet, Submission, Message, KudosLedger, EscrowLedger, ArenaPool
from app.services.auth_service import auth_service
from app.schemas.schemas import UserCreate
from app.api.profile import delete_user_account


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def test_real_account_deletion_with_arena_pool():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()

    try:
        print("1. Registering user...")
        u1_schema = UserCreate(email="real_user@tribely.com", password="Password123!", full_name="Real User")
        u1 = auth_service.register_user(db, user_in=u1_schema)
        db.commit()

        print("2. Creating arena, pool, membership, sheets, ledger...")
        arena = Arena(
            name="Sole Member Arena",
            description="Testing sole member arena deletion",
            invite_code="SOLE123",
            creator_id=u1.id,
            penalty_amount=500.0
        )
        db.add(arena)
        db.commit()

        pool = ArenaPool(arena_id=arena.id, reserve_pool_inr=0.0, reward_pool_inr=0.0, kudos_reserve_vault=100.0)
        db.add(pool)

        mem = ArenaMembership(user_id=u1.id, arena_id=arena.id, status="approved", role="admin")
        db.add(mem)

        sheet = DailyArenaSheet(arena_id=arena.id, user_id=u1.id, date_day="2026-08-08", status="verified")
        db.add(sheet)

        kudos_tx = KudosLedger(
            user_id=u1.id,
            arena_id=arena.id,
            transaction_type="PENALTY_DEDUCTION",
            amount_kudos=100.0,
            debit_account=f"user:{u1.id}:kudos",
            credit_account=f"arena:{arena.id}:kudos_vault",
            idempotency_key=f"kudos_pen_{arena.id}_{u1.id}"
        )
        db.add(kudos_tx)
        db.commit()

        print("3. Executing delete_user_account(db, u1)...")
        res = delete_user_account(db=db, current_user=u1)
        print(f"Result: {res}")

    except Exception as e:
        print(f"\nCaught Exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    test_real_account_deletion_with_arena_pool()
