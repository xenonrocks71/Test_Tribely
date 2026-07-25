"""
Automated Arena Deadline Audit Task Worker.
Evaluates arena members against daily proof deadlines, calculates missing proofs, logs absent status,
and updates financial penalty ledger logs. Designed for high scale cron/task runners.
"""

import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Arena, ArenaMembership, Submission, DailyArenaSheet, ArenaLogbook
from app.core.database import SessionLocal


class DeadlineAuditWorker:
    """
    Object-oriented worker executing scheduled background audits for habit accountability arenas.
    """

    def execute_daily_arena_audit(self, arena_id: int, target_date_str: Optional[str] = None) -> Dict[str, Any]:
        """
        Audit all approved members of an arena for a specific calendar date.
        If a member failed to submit proof before the deadline, log them as absent
        and calculate penalty logbook records.

        :param arena_id: Target arena ID.
        :param target_date_str: ISO date string (e.g. "2026-07-24"). Defaults to today UTC.
        :return: Audit report dictionary containing metrics.
        """
        if not target_date_str:
            target_date_str = datetime.datetime.utcnow().date().isoformat()

        absent_count = 0
        present_count = 0

        with SessionLocal() as db:
            arena = db.query(Arena).filter(Arena.id == arena_id).first()
            if not arena:
                return {"status": "error", "message": "Arena not found"}

            memberships = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.status == "approved"
            ).all()

            for membership in memberships:
                # Check if submission exists for this user in arena today
                today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
                submission = db.query(Submission).filter(
                    Submission.arena_id == arena_id,
                    Submission.user_id == membership.user_id,
                    Submission.submitted_at >= today_start
                ).first()

                if submission and not submission.is_absent:
                    present_count += 1
                else:
                    absent_count += 1
                    # Record or update DailyArenaSheet absent status
                    sheet = db.query(DailyArenaSheet).filter(
                        DailyArenaSheet.arena_id == arena_id,
                        DailyArenaSheet.user_id == membership.user_id,
                        DailyArenaSheet.date_day == target_date_str
                    ).first()

                    if not sheet:
                        sheet = DailyArenaSheet(
                            arena_id=arena_id,
                            user_id=membership.user_id,
                            date_day=target_date_str,
                            status="absent",
                            proof_type=arena.proof_type
                        )
                        db.add(sheet)

                    # Log penalty event into ArenaLogbook audit trail
                    if arena.penalty_amount and float(arena.penalty_amount) > 0:
                        log_entry = ArenaLogbook(
                            arena_id=arena_id,
                            event_type="penalty_assessed",
                            details=f"User #{membership.user_id} missed deadline on {target_date_str}. Penalty: ${arena.penalty_amount}"
                        )
                        db.add(log_entry)

            db.commit()

        return {
            "status": "success",
            "arena_id": arena_id,
            "target_date": target_date_str,
            "present_members": present_count,
            "absent_members": absent_count
        }


# Global Singleton Instance for Deadline Worker
deadline_audit_worker = DeadlineAuditWorker()
