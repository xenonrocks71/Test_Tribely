"""
Wallet Repository for Atomic Balance Mutations & Ledger Record Tracking.
Implements ACID-compliant row-level locks (SELECT ... FOR UPDATE) to prevent
double-spends, race conditions, and ledger divergence.
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import UserWallet, KudosLedger
import uuid
import datetime


class WalletRepository:
    """
    Data Access Layer for User Wallets & Double-Entry Ledger.
    """

    def get_wallet_for_update(self, db: Session, user_id: int) -> Optional[UserWallet]:
        """
        Fetches user wallet with an exclusive row-level write lock (SELECT ... FOR UPDATE).
        Blocks concurrent transactions until the current transaction commits or rolls back.
        """
        return (
            db.query(UserWallet)
            .filter(UserWallet.user_id == user_id)
            .with_for_update()
            .first()
        )

    def get_or_create_wallet_for_update(self, db: Session, user_id: int, initial_balance: float = 1000.0) -> UserWallet:
        """
        Retrieves or creates a user wallet wrapped under a row-level lock.
        """
        wallet = self.get_wallet_for_update(db, user_id)
        if not wallet:
            wallet = UserWallet(
                user_id=user_id,
                tribes_balance=initial_balance,
                balance=initial_balance,
                version=1,
                is_frozen=False,
                streak_shields=0,
            )
            db.add(wallet)
            db.flush()
            # Lock the newly inserted row
            wallet = self.get_wallet_for_update(db, user_id)
        return wallet

    def record_ledger_entry(
        self,
        db: Session,
        user_id: Optional[int],
        amount: float,
        transaction_type: str,
        reference_id: Optional[str] = None,
        arena_id: Optional[int] = None,
        debit_account: str = "user_wallet",
        credit_account: str = "arena_vault",
        description: Optional[str] = None,
    ) -> KudosLedger:
        """
        Creates an immutable double-entry ledger record for any balance transfer or escrow.
        """
        idempotency_key = reference_id or f"ledger_{transaction_type}_{user_id}_{arena_id}_{uuid.uuid4().hex[:12]}"
        
        entry = KudosLedger(
            user_id=user_id,
            arena_id=arena_id,
            transaction_type=transaction_type,
            amount=amount,
            amount_kudos=amount,
            debit_account=debit_account,
            credit_account=credit_account,
            idempotency_key=idempotency_key,
            reference_id=idempotency_key,
            description=description,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(entry)
        db.flush()
        return entry


wallet_repository = WalletRepository()
