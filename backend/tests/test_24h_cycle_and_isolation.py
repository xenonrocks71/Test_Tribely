"""
Automated Test Suite for 24-Hour Habit Cycle Engine, Submission Locking,
Multi-Arena Isolation, and Keyset Enrolled Feed.
"""

import pytest
import datetime
import zoneinfo
from app.core.database import SessionLocal
from app.models.models import Arena, ArenaMembership, User, Submission, Proof, UserWallet
from app.services.cycle_service import cycle_service
from app.services.proof_service import proof_service
from app.core.security import get_password_hash


def test_24h_cycle_calculation_for_10pm_deadline():
    """
    Verify that an arena with 10:00 PM (22:00) deadline defines a 24-hour cycle
    running from yesterday 22:00:00 until today 21:59:59.
    """
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "coach_cycle@tribely.test").first()
        if not u:
            u = User(
                email="coach_cycle@tribely.test",
                full_name="Coach Cycle",
                username="coach_cycle",
                hashed_password="pw"
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        arena = db.query(Arena).filter(Arena.invite_code == "CYC10P").first()
        if not arena:
            arena = Arena(
                name="Night Workout Squad",
                category="Athletics",
                invite_code="CYC10P",
                creator_id=u.id,
                deadline_time="22:00",
                daily_cutoff_time="22:00",
                timezone="UTC",
                penalty_amount=50.0,
                proof_type="image",
                is_private=False
            )
            db.add(arena)
            db.commit()
            db.refresh(arena)

        # Reference time: 2026-09-13 14:30:00 UTC (2:30 PM, before 10 PM)
        ref_dt = datetime.datetime(2026, 9, 13, 14, 30, 0, tzinfo=datetime.timezone.utc)
        cycle = cycle_service.calculate_arena_cycle(arena, reference_dt=ref_dt)

        assert cycle.cycle_date == datetime.date(2026, 9, 13)
        assert cycle.cycle_start_utc == datetime.datetime(2026, 9, 12, 22, 0, 0, tzinfo=datetime.timezone.utc)
        assert cycle.cycle_cutoff_utc == datetime.datetime(2026, 9, 13, 21, 59, 59, tzinfo=datetime.timezone.utc)
        assert cycle.cycle_deadline_utc == datetime.datetime(2026, 9, 13, 22, 0, 0, tzinfo=datetime.timezone.utc)
        assert cycle.seconds_remaining > 0


def test_submission_locks_user_until_10pm():
    """
    Verify that dropping a proof at 9:00 AM locks the user from submitting
    again in the same arena until 10:00 PM.
    """
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "athlete_lock@tribely.test").first()
        if not u:
            u = User(
                email="athlete_lock@tribely.test",
                full_name="Athlete Locked",
                username="athlete_lock",
                hashed_password="pw"
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        arena = db.query(Arena).filter(Arena.invite_code == "LOCK22").first()
        if not arena:
            arena = Arena(
                name="Night Workout Squad 2",
                category="Athletics",
                invite_code="LOCK22",
                creator_id=u.id,
                deadline_time="22:00",
                daily_cutoff_time="22:00",
                timezone="UTC",
                penalty_amount=50.0,
                proof_type="image",
                is_private=False
            )
            db.add(arena)
            db.commit()
            db.refresh(arena)

        m = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena.id,
            ArenaMembership.user_id == u.id
        ).first()
        if not m:
            db.add(ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved", role="admin"))
            db.commit()

        # Clean existing submissions for this test arena
        db.query(Submission).filter(Submission.arena_id == arena.id, Submission.user_id == u.id).delete()
        db.query(Proof).filter(Proof.arena_id == arena.id, Proof.user_id == u.id).delete()
        db.commit()

        ref_dt = datetime.datetime.now(datetime.timezone.utc)
        is_locked, _, _, _ = cycle_service.is_user_locked_in_cycle(db, arena.id, u.id, arena, ref_dt)
        assert is_locked is False

        # Submit proof in active window
        res = proof_service.submit_proof(
            db=db,
            arena_id=arena.id,
            user_id=u.id,
            media_url="https://images.unsplash.com/photo-1517838277536-f5f99be501cd",
            proof_type="image",
            caption="Morning gym session completed!"
        )
        assert res["status"] == "success"

        # User is now locked
        is_locked, unlock_time, sub, proof = cycle_service.is_user_locked_in_cycle(
            db, arena.id, u.id, arena, ref_dt
        )
        assert is_locked is True
        assert unlock_time is not None

        # Subsequent submission within the same cycle is rejected as locked
        duplicate_res = proof_service.submit_proof(
            db=db,
            arena_id=arena.id,
            user_id=u.id,
            media_url="https://images.unsplash.com/photo-1517838277536-f5f99be501cd",
            proof_type="image"
        )
        assert duplicate_res["status"] == "conflict"
        assert duplicate_res["error_code"] == "DAILY_SUBMISSION_LOCKED"


def test_cycle_rollover_after_10pm():
    """
    Verify that once the clock passes 10:00:00 PM (e.g. 10:05 PM),
    the active cycle rolls over to the NEXT day's cycle ending tomorrow at 09:59:59 PM.
    """
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "coach_cycle@tribely.test").first()
        arena = db.query(Arena).filter(Arena.invite_code == "CYC10P").first()

        past_dt = datetime.datetime(2026, 9, 13, 22, 5, 0, tzinfo=datetime.timezone.utc)
        cycle = cycle_service.calculate_arena_cycle(arena, reference_dt=past_dt)

        assert cycle.cycle_date == datetime.date(2026, 9, 14)
        assert cycle.cycle_start_utc == datetime.datetime(2026, 9, 13, 22, 0, 0, tzinfo=datetime.timezone.utc)
        assert cycle.cycle_cutoff_utc == datetime.datetime(2026, 9, 14, 21, 59, 59, tzinfo=datetime.timezone.utc)
        assert cycle.cycle_deadline_utc == datetime.datetime(2026, 9, 14, 22, 0, 0, tzinfo=datetime.timezone.utc)


def test_multi_arena_isolation():
    """
    Verify strict arena action isolation:
    User submits proof in 'Night Workout Squad' (deadline 10 PM) -> locked in Workout.
    User's status in 'Morning Run Squad' (deadline 8 AM) remains OPEN (unlocked).
    """
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "iso_user@tribely.test").first()
        if not u:
            u = User(
                email="iso_user@tribely.test",
                full_name="Iso User",
                username="iso_user",
                hashed_password="pw"
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        a1 = db.query(Arena).filter(Arena.invite_code == "A1_10P").first()
        if not a1:
            a1 = Arena(
                name="A1 Workout Squad",
                invite_code="A1_10P",
                creator_id=u.id,
                deadline_time="22:00",
                timezone="UTC"
            )
            db.add(a1)
            db.commit()
            db.refresh(a1)

        a2 = db.query(Arena).filter(Arena.invite_code == "A2_08A").first()
        if not a2:
            a2 = Arena(
                name="A2 Morning Run",
                invite_code="A2_08A",
                creator_id=u.id,
                deadline_time="08:00",
                timezone="UTC"
            )
            db.add(a2)
            db.commit()
            db.refresh(a2)

        for a in [a1, a2]:
            m = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == a.id,
                ArenaMembership.user_id == u.id
            ).first()
            if not m:
                db.add(ArenaMembership(arena_id=a.id, user_id=u.id, status="approved"))
            db.commit()

        # Clean prior submissions
        db.query(Submission).filter(Submission.user_id == u.id).delete()
        db.query(Proof).filter(Proof.user_id == u.id).delete()
        db.commit()

        # Submit in arena 1
        proof_service.submit_proof(
            db=db,
            arena_id=a1.id,
            user_id=u.id,
            media_url="https://images.unsplash.com/photo-1517838277536-f5f99be501cd",
            proof_type="image"
        )

        ref_dt = datetime.datetime.now(datetime.timezone.utc)
        a1_locked, _, _, _ = cycle_service.is_user_locked_in_cycle(db, a1.id, u.id, a1, ref_dt)
        assert a1_locked is True

        # Completely unlocked in arena 2
        a2_locked, _, _, _ = cycle_service.is_user_locked_in_cycle(db, a2.id, u.id, a2, ref_dt)
        assert a2_locked is False


def test_arena_roster_cycle_status():
    """
    Verify that the ledger room roster contains real timestamps, on-time status,
    and member lock states.
    """
    with SessionLocal() as db:
        u1 = db.query(User).filter(User.email == "roster1@tribely.test").first()
        if not u1:
            u1 = User(email="roster1@tribely.test", full_name="Roster One", username="roster1", hashed_password="pw")
            db.add(u1)
        u2 = db.query(User).filter(User.email == "roster2@tribely.test").first()
        if not u2:
            u2 = User(email="roster2@tribely.test", full_name="Roster Two", username="roster2", hashed_password="pw")
            db.add(u2)
        db.commit()
        db.refresh(u1)
        db.refresh(u2)

        arena = db.query(Arena).filter(Arena.invite_code == "ROST22").first()
        if not arena:
            arena = Arena(
                name="Roster Test Squad",
                invite_code="ROST22",
                creator_id=u1.id,
                deadline_time="22:00",
                timezone="UTC"
            )
            db.add(arena)
            db.commit()
            db.refresh(arena)

        for u in [u1, u2]:
            m = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.user_id == u.id
            ).first()
            if not m:
                db.add(ArenaMembership(arena_id=arena.id, user_id=u.id, status="approved"))
            db.commit()

        # Clean prior submissions
        db.query(Submission).filter(Submission.arena_id == arena.id).delete()
        db.query(Proof).filter(Proof.arena_id == arena.id).delete()
        db.commit()

        # User 1 submits on time
        proof_service.submit_proof(
            db=db,
            arena_id=arena.id,
            user_id=u1.id,
            media_url="https://images.unsplash.com/photo-1517838277536-f5f99be501cd",
            proof_type="image"
        )

        ref_dt = datetime.datetime.now(datetime.timezone.utc)
        status_data = cycle_service.get_arena_roster_cycle_status(db, arena, ref_dt)

        assert status_data["summary"]["total_members"] == 2
        assert status_data["summary"]["submitted_count"] == 1
        assert status_data["summary"]["pending_count"] == 1

        roster = status_data["roster"]
        u1_entry = next(r for r in roster if r["user_id"] == u1.id)
        u2_entry = next(r for r in roster if r["user_id"] == u2.id)

        assert u1_entry["status"] == "submitted"
        assert u1_entry["is_locked"] is True
        assert u1_entry["is_on_time"] is True
        assert u1_entry["submitted_at"] is not None

        assert u2_entry["status"] == "pending"
        assert u2_entry["is_locked"] is False
