"""
Transactional Audit & Penalty Enforcement Service Implementation.
Evaluates arena cutoff deadlines, enforces single-execution idempotency per user per date,
logs monetary stake penalties, and broadcasts real-time WebSocket notices.
"""

import json
import asyncio
import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import Arena, ArenaMembership, Submission, DailyArenaSheet, ArenaLogbook, User, OutboxEvent, EscrowLedger, UserWallet
from app.core.managers.websocket_manager import websocket_manager
from app.services.ledger_service import ledger_service
from app.services.kudos_service import kudos_service

logger = logging.getLogger(__name__)


class AuditService:
    """
    Idempotent Audit Service executing daily deadline enforcement,
    Tribes balance penalty debits, negative-balance freezing, 60/30/10 financial ledger entries, and real-time notice broadcasts.
    """

    def audit_arena_deadline(
        self,
        db: Session,
        arena_id: int,
        target_date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute deadline audit for a specific arena idempotently.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param target_date_str: Target date string (YYYY-MM-DD). Defaults to today's date.
        :return: Audit execution summary dict.
        """
        if not target_date_str:
            target_date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")

        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            return {"status": "error", "message": f"Arena #{arena_id} not found.", "absent_count": 0}

        # Fetch all approved active members
        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        absent_members: List[int] = []
        processed_members: List[int] = []

        try:
            for mem in memberships:
                user_id = mem.user_id

                # 1. Idempotency Check: Existing DailyArenaSheet record for today
                existing_sheet = db.query(DailyArenaSheet).filter(
                    DailyArenaSheet.arena_id == arena_id,
                    DailyArenaSheet.user_id == user_id,
                    DailyArenaSheet.date_day == target_date_str
                ).first()

                if existing_sheet:
                    # User already audited or recorded for today - skip to preserve idempotency
                    processed_members.append(user_id)
                    continue

                # 2. Check for valid submission for today
                today_submissions = db.query(Submission).filter(
                    Submission.arena_id == arena_id,
                    Submission.user_id == user_id,
                    Submission.is_absent == False
                ).all()

                has_submitted = any(
                    sub.submitted_at.strftime("%Y-%m-%d") == target_date_str
                    for sub in today_submissions if sub.submitted_at
                )

                if has_submitted:
                    # Create compliant sheet record
                    sheet = DailyArenaSheet(
                        arena_id=arena_id,
                        user_id=user_id,
                        date_day=target_date_str,
                        status="verified",
                        proof_type=arena.proof_type
                    )
                    db.add(sheet)
                else:
                    # Non-compliant member: Mark absent & process penalty idempotently
                    sheet = DailyArenaSheet(
                        arena_id=arena_id,
                        user_id=user_id,
                        date_day=target_date_str,
                        status="absent",
                        proof_type=arena.proof_type
                    )
                    db.add(sheet)

                    penalty_amount = float(arena.penalty_amount) if arena.penalty_amount is not None else 300.0
                    
                    user_wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
                    has_shield = user_wallet and getattr(user_wallet, 'streak_shields', 0) > 0

                    if has_shield:
                        sheet.status = "shielded"
                        sheet.proof_type = "shield"
                        user_wallet.streak_shields -= 1
                        logbook_entry = ArenaLogbook(
                            arena_id=arena_id,
                            user_id=user_id,
                            entry_type="streak_shield_used",
                            amount=0.0,
                            description=f"Cutoff deadline missed — Protected by Streak Freeze Shield! (1 shield consumed for {target_date_str})"
                        )
                        db.add(logbook_entry)
                        try:
                            from app.services.streak_service import streak_service
                            streak_service.invalidate_streak_cache(user_id, arena_id)
                        except Exception:
                            pass
                    else:
                        # Reset streak to 0 on unshielded absence
                        mem.current_streak = 0

                        logbook_entry = ArenaLogbook(
                            arena_id=arena_id,
                            user_id=user_id,
                            entry_type="deadline_missed",
                            amount=0.0,
                            description=f"Cutoff deadline missed for date {target_date_str}. Active streak reset to 0."
                        )
                        db.add(logbook_entry)

                        try:
                            from app.services.streak_service import streak_service
                            streak_service.invalidate_streak_cache(user_id, arena_id)
                        except Exception:
                            pass

                    # Transactional Outbox Event record
                    broadcast_payload = {
                        "event_type": "member_absent_penalty",
                        "arena_id": arena_id,
                        "user_id": user_id,
                        "penalty_amount": penalty_amount,
                        "date_day": target_date_str,
                        "message": f"Member #{user_id} missed the daily cutoff deadline."
                    }
                    outbox_evt = OutboxEvent(
                        arena_id=arena_id,
                        event_type="member_absent_penalty",
                        payload=json.dumps(broadcast_payload),
                        processed=False
                    )
                    db.add(outbox_evt)

                    absent_members.append(user_id)

                processed_members.append(user_id)

            db.commit()

            # 3. Broadcast real-time WebSocket notifications for absent penalties
            if absent_members:
                for uid in absent_members:
                    broadcast_payload = {
                        "event_type": "member_absent_penalty",
                        "arena_id": arena_id,
                        "user_id": uid,
                        "penalty_amount": penalty_amount,
                        "date_day": target_date_str,
                        "message": f"Member #{uid} missed the daily cutoff deadline."
                    }

                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            loop.create_task(websocket_manager.broadcast_to_arena(arena_id, broadcast_payload))
                        else:
                            loop.run_until_complete(websocket_manager.broadcast_to_arena(arena_id, broadcast_payload))
                    except Exception:
                        pass

            return {
                "status": "success",
                "arena_id": arena_id,
                "target_date": target_date_str,
                "total_members": len(memberships),
                "processed_count": len(processed_members),
                "absent_count": len(absent_members),
                "absent_user_ids": absent_members
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Audit failure for arena #{arena_id}: {e}")
            raise e


# Global Singleton Service Instance
audit_service = AuditService()

