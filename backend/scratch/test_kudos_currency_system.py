"""
Automated Verification Script for Kudos Digital Currency System.
Tests:
1. Registration 1,000 Kudos Welcome Bonus.
2. Missed cutoff penalty deduction from UserWallet into Arena locked Kudos vault.
3. 21-Day Consistency Reward Distribution Engine.
4. Buy Kudos via Razorpay (INR 50 = 5,000 Kudos).
5. Withdraw Kudos via RazorpayX (>=20,000 Kudos = INR 200 UPI payout).
"""

import sys
import os
from datetime import datetime, timedelta

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import User, Arena, ArenaMembership, DailyArenaSheet, Submission, UserWallet, ArenaPool, KudosLedger
from app.services.kudos_service import kudos_service
from app.services.auth_service import auth_service
from app.schemas.schemas import UserCreate


def run_kudos_verification_tests():
    print("=" * 60)
    print("RUNNING KUDOS DIGITAL CURRENCY SYSTEM VERIFICATION TESTS")
    print("=" * 60)

    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()

    try:
        # ----------------------------------------------------
        # TEST 1: Registration Welcome Bonus (1,000 Kudos)
        # ----------------------------------------------------
        print("\n[TEST 1] Testing User Registration & 1,000 Kudos Welcome Bonus...")
        user_schema = UserCreate(email="kudos_new@tribely.com", password="Password123!", full_name="Kudos Tester")

        user1 = auth_service.register_user(db, user_in=user_schema)
        db.commit()

        wallet1 = db.query(UserWallet).filter(UserWallet.user_id == user1.id).first()
        assert wallet1 is not None, "UserWallet was not created!"
        assert wallet1.kudos_balance == 1000.0, f"Expected 1,000 Kudos welcome balance, got {wallet1.kudos_balance}"

        welcome_tx = db.query(KudosLedger).filter(
            KudosLedger.user_id == user1.id,
            KudosLedger.transaction_type == "WELCOME_BONUS"
        ).first()
        assert welcome_tx is not None, "Welcome bonus transaction log missing from KudosLedger!"
        assert welcome_tx.amount_kudos == 1000.0

        print("[OK] TEST 1 PASSED: New user registered and automatically awarded 1,000 Kudos welcome bonus.")

        # ----------------------------------------------------
        # TEST 2: Penalty Deduction into Locked Arena Vault
        # ----------------------------------------------------
        print("\n[TEST 2] Testing Missed Deadline Penalty Slash into Locked Arena Vault...")
        arena = Arena(
            name="Kudos Habit Arena",
            description="21-Day Habit Challenge",
            invite_code="KUDOS1",
            creator_id=user1.id,
            penalty_amount=200.0,
            proof_type="image",
            deadline_time="20:00"
        )
        db.add(arena)
        db.commit()

        # Deduct 200 Kudos penalty for missed deadline
        pen_res = kudos_service.deduct_absent_penalty(
            db=db,
            arena_id=arena.id,
            user_id=user1.id,
            penalty_kudos=200.0,
            target_date_str="2026-08-08"
        )

        assert pen_res["status"] == "success"
        assert pen_res["user_kudos_balance"] == 800.0, f"Expected 800 Kudos remaining, got {pen_res['user_kudos_balance']}"
        assert pen_res["arena_kudos_vault"] == 200.0, f"Expected 200 Kudos in vault, got {pen_res['arena_kudos_vault']}"

        pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena.id).first()
        assert pool.kudos_reserve_vault == 200.0

        print("[OK] TEST 2 PASSED: 200 Kudos deducted from User 1 and deposited into Arena locked vault.")

        # ----------------------------------------------------
        # TEST 3: 21-Day Consistency Reward Distribution
        # ----------------------------------------------------
        print("\n[TEST 3] Testing 21-Day Consistency Reward Distribution Engine...")
        user2_schema = UserCreate(email="kudos_user2@tribely.com", password="Password123!", full_name="Consistent Bob")

        user2 = auth_service.register_user(db, user_in=user2_schema)
        db.commit()

        mem2 = ArenaMembership(user_id=user2.id, arena_id=arena.id, status="approved", role="member")
        db.add(mem2)
        db.commit()

        # Add 15 verified daily sheets for User 2 (high consistency: 15/21)
        for i in range(15):
            sheet = DailyArenaSheet(
                arena_id=arena.id,
                user_id=user2.id,
                date_day=f"2026-08-{i+1:02d}",
                status="verified",
                proof_type="image"
            )
            db.add(sheet)
        db.commit()

        dist_res = kudos_service.distribute_21_day_consistency_rewards(db=db, arena_id=arena.id)
        print(f"Distribution Result: {dist_res}")

        assert dist_res["status"] == "success"
        assert dist_res["total_vault_distributed"] == 200.0

        db.refresh(pool)
        assert pool.kudos_reserve_vault == 0.0, "Vault balance was not reset to 0.0!"

        wallet2 = db.query(UserWallet).filter(UserWallet.user_id == user2.id).first()
        assert wallet2.kudos_balance == 1200.0, f"Expected 1,200 Kudos (1,000 welcome + 200 vault share), got {wallet2.kudos_balance}"

        print("[OK] TEST 3 PASSED: 200 Kudos vault distributed to consistent member. Vault reset to 0.")

        # ----------------------------------------------------
        # TEST 4: Buy Kudos via Razorpay (INR 50 = 5,000 Kudos)
        # ----------------------------------------------------
        print("\n[TEST 4] Testing Buy Kudos (INR 50 = 5,000 Kudos)...")
        buy_res = kudos_service.initiate_kudos_purchase(db=db, user=user1, inr_amount=50.0)
        assert buy_res["kudos_to_credit"] == 5000.0
        assert buy_res["inr_amount"] == 50.0

        verify_res = kudos_service.verify_and_credit_kudos_purchase(
            db=db,
            user_id=user1.id,
            razorpay_order_id=buy_res["order_id"],
            razorpay_payment_id="pay_rzp_mock_buy_001",
            razorpay_signature="mock_sig",
            inr_amount=50.0
        )
        assert verify_res["status"] == "success"
        assert verify_res["kudos_credited"] == 5000.0

        db.refresh(wallet1)
        assert wallet1.kudos_balance == 5800.0, f"Expected 5,800 Kudos (800 + 5,000), got {wallet1.kudos_balance}"

        print("[OK] TEST 4 PASSED: INR 50 purchase credited 5,000 Kudos to User 1 wallet (Total: 5,800 Kudos).")

        # ----------------------------------------------------
        # TEST 5: Withdraw Kudos via RazorpayX (>=20,000 Kudos threshold)
        # ----------------------------------------------------
        print("\n[TEST 5] Testing Withdraw Kudos Threshold & RazorpayX Payout...")
        # Top-up User 1 to >= 20,000 Kudos to test withdrawal
        wallet1.kudos_balance = 25000.0
        db.commit()

        # Attempt invalid withdrawal below threshold
        try:
            kudos_service.withdraw_kudos_to_upi(db=db, user_id=user1.id, kudos_amount=10000.0, upi_vpa="user1@upi")
            assert False, "Should have thrown ValueError for withdrawal below 20,000 threshold!"
        except ValueError as ve:
            print(f"Correctly caught threshold error: {ve}")

        # Execute valid 20,000 Kudos withdrawal (20,000 Kudos = INR 200)
        with_res = kudos_service.withdraw_kudos_to_upi(
            db=db,
            user_id=user1.id,
            kudos_amount=20000.0,
            upi_vpa="user1@upi"
        )

        assert with_res["status"] == "success"
        assert with_res["kudos_withdrawn"] == 20000.0
        assert with_res["inr_disbursed"] == 200.0
        assert with_res["new_kudos_balance"] == 5000.0

        db.refresh(wallet1)
        assert wallet1.kudos_balance == 5000.0

        print("[OK] TEST 5 PASSED: 20,000 Kudos withdrawn as INR 200 UPI payout via RazorpayX. Balance remaining: 5,000 Kudos.")

        print("\n" + "=" * 60)
        print("ALL KUDOS SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_kudos_verification_tests()
