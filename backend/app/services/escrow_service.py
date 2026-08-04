"""
Automated Penalty Pool & Micro-Escrow Service.
Manages financial stakes, default penalty calculations, and weekly reward pool distributions.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import Arena, Submission, ArenaMembership, EscrowLedger


class EscrowService:
    """
    Escrow service managing penalty stakes, reward pools, and double-entry bookkeeping ledgers.
    """

    def record_double_entry_transaction(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        debit_account: str,
        credit_account: str,
        amount_rupees: float,
        idempotency_key: str,
        description: str = ""
    ) -> EscrowLedger:
        """
        Record an immutable double-entry transaction using integer Paise (1 INR = 100 Paise).
        Guarantees zero floating-point arithmetic errors and single-execution idempotency.
        """
        existing = db.query(EscrowLedger).filter(
            EscrowLedger.idempotency_key == idempotency_key
        ).first()
        if existing:
            return existing

        amount_paise = int(round(amount_rupees * 100))
        entry = EscrowLedger(
            arena_id=arena_id,
            user_id=user_id,
            debit_account=debit_account,
            credit_account=credit_account,
            amount_paise=amount_paise,
            idempotency_key=idempotency_key,
            description=description
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    def calculate_arena_pool_summary(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Calculate total penalty stake pool, active pool balance, and weekly reward distribution metrics.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :return: Dict summarizing pool balance, penalty slash totals, and eligible winners.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            return {
                "total_reward_pool": 0.0,
                "total_reward_pool_paise": 0,
                "penalty_per_miss": 0.0,
                "absent_misses_count": 0,
                "eligible_winners_count": 0,
                "estimated_payout_per_winner": 0.0,
            }

        penalty_amount = float(arena.penalty_amount) if arena.penalty_amount else 500.0
        penalty_paise = int(round(penalty_amount * 100))

        # Count total failed/absent habit submissions in arena
        absent_submissions_count = (
            db.query(Submission)
            .filter(Submission.arena_id == arena_id, Submission.is_absent == True)
            .count()
        )

        total_reward_pool_paise = absent_submissions_count * penalty_paise
        total_reward_pool = total_reward_pool_paise / 100.0

        # Count total active members
        total_members = (
            db.query(ArenaMembership)
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")
            .count()
        )

        eligible_winners_count = max(1, total_members)
        payout_per_winner_paise = total_reward_pool_paise // eligible_winners_count if eligible_winners_count > 0 else 0

        return {
            "total_reward_pool": total_reward_pool,
            "total_reward_pool_paise": total_reward_pool_paise,
            "penalty_per_miss": penalty_amount,
            "absent_misses_count": absent_submissions_count,
            "eligible_winners_count": eligible_winners_count,
            "estimated_payout_per_winner": payout_per_winner_paise / 100.0,
            "estimated_payout_per_winner_paise": payout_per_winner_paise,
        }


# Singleton instance
escrow_service = EscrowService()
