import pytest
from datetime import datetime
from app.core.database import SessionLocal
from app.models.models import User, Arena, ArenaMembership, Submission
from app.services.kudos_service import tribes_service, CYCLE_DAYS

def test_seven_day_cycle_setting():
    assert CYCLE_DAYS == 7

def test_daily_stake_unlock():
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "staker@example.com").first()
        if not u:
            u = User(email="staker@example.com", hashed_password="pw", full_name="Daily Staker")
            db.add(u)
            db.commit()
            db.refresh(u)

        arena = db.query(Arena).filter(Arena.invite_code == "SPRINT7").first()
        if not arena:
            arena = Arena(name="7-Day Sprint Arena", invite_code="SPRINT7", creator_id=u.id, penalty_amount=70.0)
            db.add(arena)
            db.commit()
            db.refresh(arena)

        wallet = tribes_service.get_or_create_user_wallet(db, u.id)
        initial_balance = wallet.tribes_balance

        # Call daily stake unlock
        res = tribes_service.unlock_daily_stake_return(db, user_id=u.id, arena_id=arena.id)
        assert res["status"] in ["success", "already_unlocked"]

def test_tribe_multiplier_evaluation():
    with SessionLocal() as db:
        u1 = db.query(User).filter(User.email == "m1_phase4@example.com").first()
        if not u1:
            u1 = User(email="m1_phase4@example.com", hashed_password="pw", full_name="Member 1")
            db.add(u1)
        u2 = db.query(User).filter(User.email == "m2_phase4@example.com").first()
        if not u2:
            u2 = User(email="m2_phase4@example.com", hashed_password="pw", full_name="Member 2")
            db.add(u2)
        db.commit()
        db.refresh(u1)
        db.refresh(u2)

        arena = db.query(Arena).filter(Arena.invite_code == "MULT81").first()
        if not arena:
            arena = Arena(name="Multiplier Arena", invite_code="MULT81", creator_id=u1.id)
            db.add(arena)
            db.commit()
            db.refresh(arena)

        m1 = db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena.id, ArenaMembership.user_id == u1.id).first()
        if not m1:
            db.add(ArenaMembership(arena_id=arena.id, user_id=u1.id, status="approved"))
        m2 = db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena.id, ArenaMembership.user_id == u2.id).first()
        if not m2:
            db.add(ArenaMembership(arena_id=arena.id, user_id=u2.id, status="approved"))
        db.commit()

        # U1 and U2 submit today
        today_now = datetime.utcnow()
        db.add(Submission(arena_id=arena.id, user_id=u1.id, submitted_at=today_now, proof_url="Done"))
        db.add(Submission(arena_id=arena.id, user_id=u2.id, submitted_at=today_now, proof_url="Done"))
        db.commit()

        m_info = tribes_service.evaluate_tribe_multiplier(db, arena.id)
        assert m_info["multiplier_active"] == True
        assert m_info["multiplier"] == 1.5
        assert len(m_info["at_risk_users"]) == 0
