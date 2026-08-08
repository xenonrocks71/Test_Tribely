"""
Verification test for full user account deletion workflow.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import User, UserProfile, UserWallet, Arena, ArenaMembership, DailyArenaSheet, Submission, Message, KudosLedger, EscrowLedger
from app.services.auth_service import auth_service
from app.schemas.schemas import UserCreate
from app.api.profile import delete_user_account


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def test_full_account_deletion():
    print("=" * 60)
    print("RUNNING ACCOUNT DELETION VERIFICATION TEST")
    print("=" * 60)

    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()

    try:
        # Create user 1 (will be deleted)
        u1_schema = UserCreate(email="user1_del@tribely.com", password="Password123!", full_name="User One")
        u1 = auth_service.register_user(db, user_in=u1_schema)
        db.commit()

        # Create user 2 (will become successor admin of user 1's arena)
        u2_schema = UserCreate(email="user2_succ@tribely.com", password="Password123!", full_name="User Two")
        u2 = auth_service.register_user(db, user_in=u2_schema)
        db.commit()

        # Create arena created by User 1
        arena = Arena(
            name="Shared Deletion Arena",
            description="Testing ownership transfer on account delete",
            invite_code="DELROOM",
            creator_id=u1.id,
            penalty_amount=100.0
        )
        db.add(arena)
        db.commit()

        mem1 = ArenaMembership(user_id=u1.id, arena_id=arena.id, status="approved", role="admin")
        mem2 = ArenaMembership(user_id=u2.id, arena_id=arena.id, status="approved", role="member")
        db.add_all([mem1, mem2])
        db.commit()

        # Create user 1 ledger and sheet records
        k_ledger = KudosLedger(
            user_id=u1.id,
            arena_id=arena.id,
            transaction_type="WELCOME_BONUS",
            amount_kudos=1000.0,
            debit_account="system:welcome_bonus",
            credit_account=f"user:{u1.id}:kudos",
            idempotency_key=f"test_del_kudos_{u1.id}"
        )
        sheet = DailyArenaSheet(
            arena_id=arena.id,
            user_id=u1.id,
            date_day="2026-08-08",
            status="verified"
        )
        db.add_all([k_ledger, sheet])
        db.commit()

        print("\nExecuting delete_user_account for User 1...")
        res = delete_user_account(db=db, current_user=u1)
        assert res["status"] == "success"

        # Verify User 1 is deleted from DB
        deleted_u1 = db.query(User).filter(User.id == u1.id).first()
        assert deleted_u1 is None, "User 1 was not deleted from users table!"

        # Verify User 1 profile and wallet are deleted
        prof1 = db.query(UserProfile).filter(UserProfile.user_id == u1.id).first()
        wall1 = db.query(UserWallet).filter(UserWallet.user_id == u1.id).first()
        assert prof1 is None, "UserProfile 1 was not deleted!"
        assert wall1 is None, "UserWallet 1 was not deleted!"

        # Verify Arena ownership transferred to User 2
        db.refresh(arena)
        assert arena.creator_id == u2.id, f"Expected arena creator_id to be User 2 ({u2.id}), got {arena.creator_id}"

        mem2_updated = db.query(ArenaMembership).filter(ArenaMembership.user_id == u2.id, ArenaMembership.arena_id == arena.id).first()
        assert mem2_updated.role == "admin", f"Expected User 2 role to be admin, got {mem2_updated.role}"

        print("\n" + "=" * 60)
        print("[OK] ACCOUNT DELETION VERIFICATION TEST PASSED CLEANLY!")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    test_full_account_deletion()
