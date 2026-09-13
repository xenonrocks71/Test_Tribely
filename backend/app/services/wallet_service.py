"""
ACID-Compliant Wallet & Escrow Ledger Service for Tribely.
Guarantees double-entry bookkeeping, eliminates double deductions via
database row-level locks (SELECT ... FOR UPDATE), and prevents race conditions.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import datetime
import logging

from app.models.models import UserWallet, KudosLedger, Arena, ArenaPool
from app.repositories.wallet_repository import wallet_repository

logger = logging.getLogger(__name__)


class WalletService:
    """
    Core Financial & Ledger Service.
    Enforces atomic balance operations, version incrementation, and immutable audit logs.
    """

    def lock_arena_escrow(
        self,
        db: Session,
        user_id: int,
        arena_id: int,
        amount: float,
        reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Locks an entry deposit or stake in escrow when a user joins an arena.
        Acquires row-level write lock (SELECT ... FOR UPDATE) to prevent concurrency race conditions.
        """
        if amount <= 0:
            return {"status": "success", "amount_locked": 0.0, "message": "Zero escrow required."}

        try:
            wallet = wallet_repository.get_or_create_wallet_for_update(db, user_id)

            current_bal = float(wallet.tribes_balance)
            if current_bal < amount:
                raise ValueError(
                    f"Insufficient funds: user #{user_id} has balance {current_bal} Tribes, "
                    f"requires {amount} Tribes for arena #{arena_id} escrow."
                )

            # Atomic balance decrement & optimistic version bump
            wallet.tribes_balance = current_bal - amount
            wallet.balance = current_bal - amount
            wallet.version = (wallet.version or 1) + 1
            wallet.updated_at = datetime.datetime.utcnow()

            # Increment Arena Reserve Pool
            pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
            if not pool:
                pool = ArenaPool(arena_id=arena_id, reserve_pool_tribes=amount, reward_pool_tribes=0.0)
                db.add(pool)
            else:
                pool.reserve_pool_tribes = float(pool.reserve_pool_tribes) + amount
                pool.updated_at = datetime.datetime.utcnow()

            # Record immutable ledger entry
            ref_id = reference_id or f"escrow_lock_{arena_id}_{user_id}_{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            ledger_entry = wallet_repository.record_ledger_entry(
                db=db,
                user_id=user_id,
                arena_id=arena_id,
                amount=amount,
                transaction_type="ESCROW_LOCK",
                reference_id=ref_id,
                debit_account="user_wallet",
                credit_account="arena_escrow",
                description=f"Locked {amount} Tribes escrow for joining Arena #{arena_id}"
            )

            db.commit()
            db.refresh(wallet)

            return {
                "status": "success",
                "user_id": user_id,
                "arena_id": arena_id,
                "amount_locked": amount,
                "new_balance": float(wallet.tribes_balance),
                "ledger_id": ledger_entry.id,
                "version": wallet.version
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[WalletService] Error locking escrow for user {user_id}, arena {arena_id}: {e}")
            raise e

    def refund_arena_escrow(
        self,
        db: Session,
        user_id: int,
        arena_id: int,
        amount: Optional[float] = None,
        reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refunds escrow back to the user upon approved exit or challenge completion.
        """
        try:
            wallet = wallet_repository.get_or_create_wallet_for_update(db, user_id)

            refund_amt = amount
            if refund_amt is None:
                arena = db.query(Arena).filter(Arena.id == arena_id).first()
                refund_amt = float(arena.penalty_amount if arena else 0.0)

            if refund_amt <= 0:
                return {"status": "success", "amount_refunded": 0.0, "message": "No escrow to refund."}

            current_bal = float(wallet.tribes_balance)
            wallet.tribes_balance = current_bal + refund_amt
            wallet.balance = current_bal + refund_amt
            wallet.version = (wallet.version or 1) + 1
            wallet.updated_at = datetime.datetime.utcnow()

            # Decrement from Arena Reserve Pool if exists
            pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
            if pool and float(pool.reserve_pool_tribes) >= refund_amt:
                pool.reserve_pool_tribes = float(pool.reserve_pool_tribes) - refund_amt
                pool.updated_at = datetime.datetime.utcnow()

            ref_id = reference_id or f"escrow_refund_{arena_id}_{user_id}_{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            ledger_entry = wallet_repository.record_ledger_entry(
                db=db,
                user_id=user_id,
                arena_id=arena_id,
                amount=refund_amt,
                transaction_type="ESCROW_REFUND",
                reference_id=ref_id,
                debit_account="arena_escrow",
                credit_account="user_wallet",
                description=f"Refunded {refund_amt} Tribes escrow from Arena #{arena_id}"
            )

            db.commit()
            db.refresh(wallet)

            return {
                "status": "success",
                "user_id": user_id,
                "arena_id": arena_id,
                "amount_refunded": refund_amt,
                "new_balance": float(wallet.tribes_balance),
                "ledger_id": ledger_entry.id,
                "version": wallet.version
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[WalletService] Error refunding escrow for user {user_id}, arena {arena_id}: {e}")
            raise e

    def deduct_daily_penalty(
        self,
        db: Session,
        user_id: int,
        arena_id: int,
        penalty_amount: float,
        reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deducts daily absence penalty within an atomic transaction.
        Freezes wallet if balance becomes negative.
        Splits collected penalty into the weekly arena vault pool.
        """
        if penalty_amount <= 0:
            return {"status": "skipped", "penalty_deducted": 0.0, "message": "Zero penalty arena."}

        try:
            wallet = wallet_repository.get_or_create_wallet_for_update(db, user_id)

            current_bal = float(wallet.tribes_balance)
            new_bal = current_bal - penalty_amount
            wallet.tribes_balance = new_bal
            wallet.balance = new_bal
            wallet.version = (wallet.version or 1) + 1
            wallet.updated_at = datetime.datetime.utcnow()

            # Account freeze policy: negative balance locks wallet from actions
            is_newly_frozen = False
            if new_bal < 0 and not wallet.is_frozen:
                wallet.is_frozen = True
                is_newly_frozen = True

            # Deposit into Arena Pool (Weekly Vault Pool)
            pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
            if not pool:
                pool = ArenaPool(
                    arena_id=arena_id,
                    reserve_pool_tribes=0.0,
                    reward_pool_tribes=penalty_amount,
                    total_penalties_count=1
                )
                db.add(pool)
            else:
                pool.reward_pool_tribes = float(pool.reward_pool_tribes) + penalty_amount
                pool.total_penalties_count = (pool.total_penalties_count or 0) + 1
                pool.updated_at = datetime.datetime.utcnow()

            ref_id = reference_id or f"penalty_{arena_id}_{user_id}_{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            ledger_entry = wallet_repository.record_ledger_entry(
                db=db,
                user_id=user_id,
                arena_id=arena_id,
                amount=penalty_amount,
                transaction_type="PENALTY_DEDUCT",
                reference_id=ref_id,
                debit_account="user_wallet",
                credit_account="arena_vault",
                description=f"Daily missed deadline penalty of {penalty_amount} Tribes in Arena #{arena_id}"
            )

            db.commit()
            db.refresh(wallet)

            return {
                "status": "success",
                "user_id": user_id,
                "arena_id": arena_id,
                "penalty_deducted": penalty_amount,
                "new_balance": float(wallet.tribes_balance),
                "is_frozen": wallet.is_frozen,
                "is_newly_frozen": is_newly_frozen,
                "ledger_id": ledger_entry.id,
                "version": wallet.version
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[WalletService] Error deducting penalty for user {user_id}, arena {arena_id}: {e}")
            raise e


wallet_service = WalletService()
