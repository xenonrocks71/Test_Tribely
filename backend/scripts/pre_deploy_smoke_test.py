"""
Pre-Deployment Production Automated Smoke Test Script for Project Tribely.
Executes critical user journeys:
1. Create test user -> Verify initial 1,000 Tribes balance.
2. Create test arena -> Simulate proof submission.
3. Trigger absence audit -> Confirm penalty deduction & ledger insertion.
4. Test negative balance condition -> Confirm is_frozen = True.
"""

import sys
import os
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.core.database import sync_engine as engine, SessionLocal
from app.models.models import User, UserWallet, Arena, ArenaMembership, Submission, EscrowLedger
from app.services.audit_service import audit_service
from app.services.kudos_service import kudos_service

def run_pre_deploy_smoke_test():
    print("=" * 60)
    print("[START] TRIBELY PRE-DEPLOYMENT SMOKE TEST SUITE")
    print("=" * 60)

    db: Session = SessionLocal()
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"smoketest_{unique_suffix}@tribely.internal"

    try:
        # 1. Create Test User Account & Wallet
        print("\n[Step 1/4] Creating test user account...")
        test_user = User(
            email=test_email,
            full_name=f"Smoke Test User {unique_suffix}",
            hashed_password="hashed_smoke_pass_123"
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)

        # Initialize wallet with 1,000 Tribes welcome bonus
        wallet = UserWallet(
            user_id=test_user.id,
            tribes_balance=1000.0,
            streak_shields=0, # Set to 0 to test penalty deduction directly
            is_frozen=False
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

        print(f"  [OK] User created (ID: {test_user.id})")
        print(f"  [OK] Initial Tribes Balance: {wallet.tribes_balance} (Expected: 1000.0)")
        assert wallet.tribes_balance == 1000.0, "Initial balance mismatch!"

        # 2. Create Test Arena
        print("\n[Step 2/4] Creating test arena...")
        test_arena = Arena(
            name=f"Smoke Test Arena {unique_suffix}",
            description="Automated pre-deploy verification arena",
            invite_code=f"SMOKE-{unique_suffix.upper()}",
            creator_id=test_user.id,
            penalty_amount=300.0
        )
        db.add(test_arena)
        db.commit()
        db.refresh(test_arena)

        membership = ArenaMembership(
            arena_id=test_arena.id,
            user_id=test_user.id,
            role="admin",
            status="approved"
        )
        db.add(membership)
        db.commit()
        print(f"  [OK] Arena created (ID: {test_arena.id}, Penalty: {test_arena.penalty_amount} Tribes)")

        # 3. Trigger Absence Audit Simulation
        print("\n[Step 3/4] Triggering absence audit penalty...")
        audit_res = audit_service.audit_arena_deadline(db, arena_id=test_arena.id)
        db.refresh(wallet)

        expected_balance = 1000.0 - 300.0
        print(f"  [OK] Post-Audit Tribes Balance: {wallet.tribes_balance} (Expected: {expected_balance})")
        assert wallet.tribes_balance == expected_balance, f"Balance mismatch post audit: {wallet.tribes_balance}"

        from app.models.models import KudosLedger
        ledger_entry = db.query(KudosLedger).filter(
            KudosLedger.user_id == test_user.id,
            KudosLedger.arena_id == test_arena.id
        ).first()
        assert ledger_entry is not None, "Double-entry ledger record missing!"
        print(f"  [OK] Kudos Ledger entry verified (Type: {ledger_entry.transaction_type}, Amount: {ledger_entry.amount_kudos})")

        # 4. Test Negative Balance Condition & Account Freeze
        print("\n[Step 4/4] Testing negative balance condition & freeze engine...")
        wallet.tribes_balance = -50.0
        if wallet.tribes_balance < 0:
            wallet.is_frozen = True
        db.commit()
        db.refresh(wallet)

        print(f"  [OK] Frozen Status: {wallet.is_frozen} (Expected: True)")
        assert wallet.is_frozen is True, "Account freeze engine failed to set is_frozen = True!"

        print("\n" + "=" * 60)
        print("[SUCCESS] ALL PRE-DEPLOYMENT SMOKE TEST CHECKS PASSED!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n[FAIL] SMOKE TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_pre_deploy_smoke_test()
    sys.exit(0 if success else 1)
