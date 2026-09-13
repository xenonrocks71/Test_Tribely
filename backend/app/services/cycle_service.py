"""
Timezone-Aware 24-Hour Cycle Management Service for Tribely.
Implements strict 24-hour habit cycles (e.g. 10:00 PM cutoff, valid till 09:59:59 PM),
user submission locking until deadline reset, and isolated per-arena state.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
import datetime
import zoneinfo
import logging

from app.models.models import Arena, ArenaMembership, Proof, Submission, User, UserProfile

logger = logging.getLogger(__name__)


@dataclass
class CycleInfo:
    arena_id: int
    timezone_name: str
    deadline_time_str: str
    cycle_date: datetime.date
    cycle_start_utc: datetime.datetime
    cycle_cutoff_utc: datetime.datetime
    cycle_deadline_utc: datetime.datetime
    cycle_start_local: datetime.datetime
    cycle_cutoff_local: datetime.datetime
    cycle_deadline_local: datetime.datetime
    seconds_remaining: int
    is_active: bool
    formatted_deadline: str
    formatted_cutoff: str


class CycleService:
    """
    Authoritative cycle and submission-locking engine.
    """

    def get_arena_timezone(self, arena: Arena) -> zoneinfo.ZoneInfo:
        tz_name = getattr(arena, "timezone", None) or "UTC"
        try:
            return zoneinfo.ZoneInfo(tz_name)
        except Exception:
            return zoneinfo.ZoneInfo("UTC")

    def parse_deadline_time(self, deadline_str: Optional[str]) -> datetime.time:
        if not deadline_str:
            return datetime.time(22, 0, 0)
        normalized = deadline_str.strip().upper()
        for fmt in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p"):
            try:
                return datetime.datetime.strptime(normalized, fmt).time()
            except ValueError:
                continue
        # Fallback default 10:00 PM (22:00)
        return datetime.time(22, 0, 0)

    def calculate_arena_cycle(
        self,
        arena: Arena,
        reference_dt: Optional[datetime.datetime] = None
    ) -> CycleInfo:
        """
        Calculates the active 24-hour cycle window for an arena.
        If reference_dt is None, current UTC time is used.
        """
        arena_tz = self.get_arena_timezone(arena)
        now_utc = reference_dt or datetime.datetime.now(datetime.timezone.utc)
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=datetime.timezone.utc)

        now_local = now_utc.astimezone(arena_tz)
        deadline_time_obj = self.parse_deadline_time(
            getattr(arena, "deadline_time", None) or getattr(arena, "daily_cutoff_time", None)
        )

        today_deadline_local = datetime.datetime.combine(
            now_local.date(),
            deadline_time_obj,
            tzinfo=arena_tz
        )

        # 24-hour window logic:
        # If now_local < today_deadline_local (e.g. 09:00 AM or 21:59:59 PM):
        #   Window started yesterday at deadline_time (e.g. yesterday 22:00:00)
        #   Window cutoff is today at deadline_time - 1 second (e.g. today 21:59:59)
        #   Cycle date is today's date
        # If now_local >= today_deadline_local (e.g. 22:00:00 PM):
        #   Today's deadline passed. Next 24h cycle has begun!
        #   Window starts today at deadline_time (e.g. today 22:00:00)
        #   Window cutoff is tomorrow at deadline_time - 1 second (e.g. tomorrow 21:59:59)
        #   Cycle date is tomorrow's date
        if now_local < today_deadline_local:
            cycle_start_local = today_deadline_local - datetime.timedelta(days=1)
            cycle_deadline_local = today_deadline_local
            cycle_date = now_local.date()
        else:
            cycle_start_local = today_deadline_local
            cycle_deadline_local = today_deadline_local + datetime.timedelta(days=1)
            cycle_date = now_local.date() + datetime.timedelta(days=1)

        cycle_cutoff_local = cycle_deadline_local - datetime.timedelta(seconds=1)

        cycle_start_utc = cycle_start_local.astimezone(datetime.timezone.utc)
        cycle_cutoff_utc = cycle_cutoff_local.astimezone(datetime.timezone.utc)
        cycle_deadline_utc = cycle_deadline_local.astimezone(datetime.timezone.utc)

        seconds_remaining = max(0, int((cycle_cutoff_utc - now_utc).total_seconds()))

        formatted_deadline = cycle_deadline_local.strftime("%I:%M %p").lstrip("0")
        formatted_cutoff = cycle_cutoff_local.strftime("%I:%M:%S %p").lstrip("0")

        return CycleInfo(
            arena_id=arena.id,
            timezone_name=getattr(arena, "timezone", None) or "UTC",
            deadline_time_str=deadline_time_obj.strftime("%H:%M"),
            cycle_date=cycle_date,
            cycle_start_utc=cycle_start_utc,
            cycle_cutoff_utc=cycle_cutoff_utc,
            cycle_deadline_utc=cycle_deadline_utc,
            cycle_start_local=cycle_start_local,
            cycle_cutoff_local=cycle_cutoff_local,
            cycle_deadline_local=cycle_deadline_local,
            seconds_remaining=seconds_remaining,
            is_active=True,
            formatted_deadline=formatted_deadline,
            formatted_cutoff=formatted_cutoff,
        )

    def is_user_locked_in_cycle(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        arena: Optional[Arena] = None,
        reference_dt: Optional[datetime.datetime] = None
    ) -> Tuple[bool, Optional[datetime.datetime], Optional[Submission], Optional[Proof]]:
        """
        Evaluates whether a user has already submitted proof for the current 24-hour cycle.
        Returns:
            (is_locked, unlock_time_utc, submission_record, proof_record)
        """
        if not arena:
            arena = db.query(Arena).filter(Arena.id == arena_id).first()
            if not arena:
                return False, None, None, None

        cycle_info = self.calculate_arena_cycle(arena, reference_dt)

        # Check Submission table within cycle window [cycle_start_utc, cycle_deadline_utc)
        sub = (
            db.query(Submission)
            .filter(
                Submission.arena_id == arena_id,
                Submission.user_id == user_id,
                Submission.is_absent == False,
                Submission.submitted_at >= cycle_info.cycle_start_utc.replace(tzinfo=None),
                Submission.submitted_at < cycle_info.cycle_deadline_utc.replace(tzinfo=None),
            )
            .order_by(Submission.submitted_at.desc())
            .first()
        )

        # Also check Proof table by date or created_at within window
        proof = (
            db.query(Proof)
            .filter(
                Proof.arena_id == arena_id,
                Proof.user_id == user_id,
                or_(
                    Proof.submission_date == cycle_info.cycle_date,
                    and_(
                        Proof.created_at >= cycle_info.cycle_start_utc.replace(tzinfo=None),
                        Proof.created_at < cycle_info.cycle_deadline_utc.replace(tzinfo=None),
                    ),
                ),
            )
            .order_by(Proof.created_at.desc())
            .first()
        )

        if sub or proof:
            return True, cycle_info.cycle_deadline_utc, sub, proof

        return False, None, None, None

    def get_arena_roster_cycle_status(
        self,
        db: Session,
        arena: Arena,
        reference_dt: Optional[datetime.datetime] = None
    ) -> Dict[str, Any]:
        """
        Generates real-time ledger room roster showing:
        - Current cycle timeline and countdown
        - Each member's submission timestamp, on-time flag, proof preview, and lock status
        """
        cycle_info = self.calculate_arena_cycle(arena, reference_dt)

        memberships = (
            db.query(ArenaMembership)
            .filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.status == "approved"
            )
            .all()
        )

        user_ids = [m.user_id for m in memberships]
        users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        user_map = {u.id: u for u in users}

        # Fetch submissions within active cycle window
        submissions = (
            db.query(Submission)
            .filter(
                Submission.arena_id == arena.id,
                Submission.user_id.in_(user_ids),
                Submission.is_absent == False,
                Submission.submitted_at >= cycle_info.cycle_start_utc.replace(tzinfo=None),
                Submission.submitted_at < cycle_info.cycle_deadline_utc.replace(tzinfo=None),
            )
            .order_by(Submission.submitted_at.desc())
            .all()
        ) if user_ids else []

        sub_map = {}
        for s in submissions:
            if s.user_id not in sub_map:
                sub_map[s.user_id] = s

        # Fetch proofs for preview
        proofs = (
            db.query(Proof)
            .filter(
                Proof.arena_id == arena.id,
                Proof.user_id.in_(user_ids),
                Proof.submission_date == cycle_info.cycle_date
            )
            .all()
        ) if user_ids else []
        proof_map = {p.user_id: p for p in proofs}

        roster = []
        submitted_count = 0

        arena_tz = self.get_arena_timezone(arena)

        for m in memberships:
            u = user_map.get(m.user_id)
            sub = sub_map.get(m.user_id)
            prf = proof_map.get(m.user_id)

            avatar_url = (
                u.profile.profile_image_url
                if (u and u.profile and u.profile.profile_image_url)
                else (u.avatar_url if u else None)
            )

            is_submitted = sub is not None or prf is not None
            if is_submitted:
                submitted_count += 1

            sub_time_utc = None
            sub_time_local_str = None
            is_on_time = False

            if sub and sub.submitted_at:
                sub_time_utc = sub.submitted_at.replace(tzinfo=datetime.timezone.utc)
                sub_time_local = sub_time_utc.astimezone(arena_tz)
                sub_time_local_str = sub_time_local.strftime("%b %d, %I:%M %p")
                is_on_time = sub_time_local <= cycle_info.cycle_cutoff_local
            elif prf and prf.created_at:
                sub_time_utc = prf.created_at.replace(tzinfo=datetime.timezone.utc)
                sub_time_local = sub_time_utc.astimezone(arena_tz)
                sub_time_local_str = sub_time_local.strftime("%b %d, %I:%M %p")
                is_on_time = sub_time_local <= cycle_info.cycle_cutoff_local

            proof_url = (prf.media_url if prf else None) or (sub.proof_url if sub else None)
            proof_type = (prf.proof_type.lower() if prf and prf.proof_type else None) or (arena.proof_type or "image")

            roster.append({
                "user_id": m.user_id,
                "user_name": u.full_name if u else f"Member #{m.user_id}",
                "user_handle": f"@{u.username}" if (u and u.username) else f"@user{m.user_id}",
                "user_avatar": avatar_url,
                "role": m.role,
                "current_streak": m.current_streak or 0,
                "status": "submitted" if is_submitted else "pending",
                "is_locked": is_submitted,
                "unlock_time": cycle_info.cycle_deadline_utc.isoformat() if is_submitted else None,
                "submitted_at": sub_time_utc.isoformat() if sub_time_utc else None,
                "submitted_at_formatted": sub_time_local_str,
                "is_on_time": is_on_time if is_submitted else None,
                "proof_url": proof_url,
                "proof_type": proof_type,
                "caption": (prf.caption if prf else None) or "Daily habit proof drop.",
            })

        # Sort roster: submitted members first (by submission time descending), then pending members
        roster.sort(
            key=lambda x: (
                0 if x["status"] == "submitted" else 1,
                -(datetime.datetime.fromisoformat(x["submitted_at"]).timestamp()) if x["submitted_at"] else 0,
                x["user_name"],
            )
        )

        return {
            "arena_id": arena.id,
            "arena_name": arena.name,
            "cycle": {
                "cycle_date": cycle_info.cycle_date.isoformat(),
                "cycle_start_utc": cycle_info.cycle_start_utc.isoformat(),
                "cycle_cutoff_utc": cycle_info.cycle_cutoff_utc.isoformat(),
                "cycle_deadline_utc": cycle_info.cycle_deadline_utc.isoformat(),
                "cycle_cutoff_local_str": cycle_info.cycle_cutoff_local.strftime("%I:%M:%S %p"),
                "deadline_time_local_str": cycle_info.formatted_deadline,
                "seconds_remaining": cycle_info.seconds_remaining,
                "timezone": cycle_info.timezone_name,
            },
            "summary": {
                "total_members": len(memberships),
                "submitted_count": submitted_count,
                "pending_count": len(memberships) - submitted_count,
                "is_squad_100_percent": len(memberships) > 0 and submitted_count == len(memberships),
            },
            "roster": roster,
        }


# Global Singleton Service
cycle_service = CycleService()
