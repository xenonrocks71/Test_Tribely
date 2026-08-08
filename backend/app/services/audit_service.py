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
from app.services.razorpay_service import razorpay_service

logger = logging.getLogger(__name__)


class AuditService:
    """
    Idempotent Audit Service executing daily deadline enforcement,
    Razorpay off-session penalty debits, 60/30/10 financial ledger entries, and real-time notice broadcasts.
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

                    penalty_amount = float(arena.penalty_amount) if arena.penalty_amount else 500.0
                    
                    # Retrieve UserWallet & active mandate ID
                    wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
                    mandate_id = wallet.mandate_id if wallet else None

                    idempotency_key = f"penalty:{arena_id}:{user_id}:{target_date_str}"

                    # Execute off-session Razorpay recurring penalty debit
                    success, payment_id, err_msg = razorpay_service.charge_off_session_penalty(
                        mandate_id=mandate_id,
                        amount_inr=penalty_amount,
                        idempotency_key=idempotency_key
                    )

                    if success and payment_id:
                        # Record 60/30/10 ledger splits with razorpay_payment_id
                        ledger_service.record_penalty_accrual(
                            db=db,
                            arena_id=arena_id,
                            user_id=user_id,
                            penalty_amount_inr=penalty_amount,
                            target_date_str=target_date_str,
                            razorpay_payment_id=payment_id
                        )

                        logbook_entry = ArenaLogbook(
                            arena_id=arena_id,
                            user_id=user_id,
                            entry_type="penalty",
                            amount=penalty_amount,
                            description=f"Cutoff deadline missed penalty for date {target_date_str} (Razorpay ID: {payment_id})"
                        )
                        db.add(logbook_entry)
                        if wallet:
                            wallet.pending_penalty = False

                    # Deduct Kudos digital currency penalty into Arena locked vault
                    try:
                        from app.services.kudos_service import kudos_service
                        kudos_service.deduct_absent_penalty(
                            db=db,
                            arena_id=arena_id,
                            user_id=user_id,
                            penalty_kudos=penalty_amount,
                            target_date_str=target_date_str
                        )
                    except Exception as ke:
                        logger.warning(f"Kudos penalty deduction error: {ke}")

                    else:
                        # Off-session payment failed: flag pending penalty on wallet
                        logger.warning(f"Off-session debit failed for user #{user_id}: {err_msg}")
                        if wallet:
                            wallet.pending_penalty = True

                    # Transactional Outbox Event record
                    broadcast_payload = {
                        "event_type": "member_absent_penalty",
                        "arena_id": arena_id,
                        "user_id": user_id,
                        "penalty_amount": penalty_amount,
                        "date_day": target_date_str,
                        "razorpay_payment_id": payment_id if success else None,
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
                        "penalty_amount": float(arena.penalty_amount) if arena.penalty_amount else 0.0,
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
