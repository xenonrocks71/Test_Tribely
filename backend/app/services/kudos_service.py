"""
Tribes Digital Currency & Economy Service Implementation.
Enforces 1,000 Tribes Welcome Registration Bonus, Locked Arena Reserves,
Absence Penalties (-300 Tribes), Negative-Balance Freeze Engine, and 3-Referral Account Unfreeze.
"""

from datetime import datetime, timedelta
import logging
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import User, UserWallet, Arena, ArenaMembership, ArenaPool, DailyArenaSheet, Submission, KudosLedger

logger = logging.getLogger(__name__)

WELCOME_BONUS_TRIBES = 1000.0
DEFAULT_ABSENCE_PENALTY_TRIBES = 300.0
REFERRAL_UNFREEZE_THRESHOLD = 3
REFERRAL_BONUS_TRIBES = 200.0
CYCLE_DAYS = 21


class TribesService:
    """
    Business Service controlling the Tribely Economy System.
    """

    def get_or_create_user_wallet(self, db: Session, user_id: int) -> UserWallet:
        """
        Retrieves existing UserWallet or instantiates new wallet with 1,000 Tribes welcome bonus.
        """
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if not wallet:
            wallet = UserWallet(
                user_id=user_id,
                tribes_balance=WELCOME_BONUS_TRIBES,
                is_frozen=False,
                referral_count=0
            )
            db.add(wallet)
            db.commit()
            db.refresh(wallet)

            # Record Welcome Bonus in Ledger
            self._log_tribes_ledger(
                db=db,
                user_id=user_id,
                arena_id=None,
                transaction_type="WELCOME_BONUS",
                amount_kudos=WELCOME_BONUS_TRIBES,
                debit_account="system:welcome_bonus",
                credit_account=f"user:{user_id}:tribes",
                idempotency_key=f"welcome_bonus:user:{user_id}",
                description="Welcome registration bonus of 1,000 Tribes"
            )
            db.commit()
            db.refresh(wallet)
        return wallet

    def award_welcome_bonus(self, db: Session, user_id: int) -> UserWallet:
        """
        Awards initial 1,000 Tribes welcome balance to newly registered user.
        """
        return self.get_or_create_user_wallet(db, user_id)

    def get_or_create_arena_pool(self, db: Session, arena_id: int) -> ArenaPool:
        """
        Retrieves existing ArenaPool or initializes arena pool with zero vault balance.
        """
        pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
        if not pool:
            pool = ArenaPool(
                arena_id=arena_id,
                reserve_pool_tribes=0.0,
                reward_pool_tribes=0.0,
                total_penalties_count=0,
                tribes_reserve_vault=0.0,
                cycle_days_count=CYCLE_DAYS
            )
            db.add(pool)
            db.commit()
            db.refresh(pool)
        return pool

    def deduct_arena_creation_stake(self, db: Session, user_id: int, arena: Arena) -> Dict[str, Any]:
        """
        Deducts entry stake from creator's wallet and credits to ArenaPool.tribes_reserve_vault.
        Raises HTTPException 400 if user has insufficient balance or is frozen.
        """
        stake = float(arena.penalty_amount or 0.0)
        if stake <= 0:
            return {"status": "skipped", "staked_amount": 0.0}

        wallet = self.get_or_create_user_wallet(db, user_id)
        if wallet.is_frozen:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is frozen due to negative balance. Perform 3 referrals to unfreeze your account."
            )
        if wallet.tribes_balance < stake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient Tribes balance to create arena '{arena.name}'. Required entry stake is {stake} Tribes, but your current balance is {wallet.tribes_balance} Tribes."
            )

        wallet.tribes_balance -= stake
        pool = self.get_or_create_arena_pool(db, arena.id)
        pool.tribes_reserve_vault += stake
        pool.updated_at = datetime.utcnow()

        idempotency_key = f"arena_create_stake:arena:{arena.id}:user:{user_id}"
        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=arena.id,
            transaction_type="ARENA_CREATION_STAKE",
            amount_kudos=stake,
            debit_account=f"user:{user_id}:tribes",
            credit_account=f"arena:{arena.id}:tribes_vault",
            idempotency_key=idempotency_key,
            description=f"Entry stake deposit of {stake} Tribes for creating arena '{arena.name}'"
        )
        db.commit()
        db.refresh(wallet)
        db.refresh(pool)

        return {
            "status": "success",
            "staked_amount": stake,
            "user_kudos_balance": wallet.tribes_balance,
            "arena_kudos_vault": pool.tribes_reserve_vault
        }

    def deduct_arena_join_stake(self, db: Session, user_id: int, arena: Arena) -> Dict[str, Any]:
        """
        Deducts entry stake from joining user's wallet and credits to ArenaPool.tribes_reserve_vault.
        """
        stake = float(arena.penalty_amount or 0.0)
        if stake <= 0:
            return {"status": "skipped", "staked_amount": 0.0}

        idempotency_key = f"arena_join_stake:arena:{arena.id}:user:{user_id}"
        existing = db.query(KudosLedger).filter(
            KudosLedger.idempotency_key == idempotency_key
        ).first()
        if existing:
            wallet = self.get_or_create_user_wallet(db, user_id)
            pool = self.get_or_create_arena_pool(db, arena.id)
            return {
                "status": "already_staked",
                "staked_amount": stake,
                "user_kudos_balance": wallet.tribes_balance,
                "arena_kudos_vault": pool.tribes_reserve_vault
            }

        wallet = self.get_or_create_user_wallet(db, user_id)
        if wallet.is_frozen:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is frozen due to negative balance. Perform 3 referrals to unfreeze your account."
            )
        if wallet.tribes_balance < stake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient Tribes balance to join arena '{arena.name}'. Required entry stake is {stake} Tribes, but your current balance is {wallet.tribes_balance} Tribes."
            )

        wallet.tribes_balance -= stake
        pool = self.get_or_create_arena_pool(db, arena.id)
        pool.tribes_reserve_vault += stake
        pool.updated_at = datetime.utcnow()

        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=arena.id,
            transaction_type="ARENA_JOIN_STAKE",
            amount_kudos=stake,
            debit_account=f"user:{user_id}:tribes",
            credit_account=f"arena:{arena.id}:tribes_vault",
            idempotency_key=idempotency_key,
            description=f"Entry stake deposit of {stake} Tribes for joining arena '{arena.name}'"
        )
        db.commit()
        db.refresh(wallet)
        db.refresh(pool)

        return {
            "status": "success",
            "staked_amount": stake,
            "user_kudos_balance": wallet.tribes_balance,
            "arena_kudos_vault": pool.tribes_reserve_vault
        }

    def deduct_absent_penalty(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        penalty_kudos: float = DEFAULT_ABSENCE_PENALTY_TRIBES,
        target_date_str: str = ""
    ) -> Dict[str, Any]:
        """
        Deducts missed deadline penalty Tribes from UserWallet and deposits into ArenaPool.tribes_reserve_vault.
        If balance drops below 0, activates freeze engine: sets `is_frozen = True`.
        """
        if not target_date_str:
            target_date_str = datetime.utcnow().strftime("%Y-%m-%d")

        idempotency_key = f"tribes_penalty:arena:{arena_id}:user:{user_id}:date:{target_date_str}"

        existing = db.query(KudosLedger).filter(
            KudosLedger.idempotency_key == idempotency_key
        ).first()

        if existing:
            wallet = self.get_or_create_user_wallet(db, user_id)
            pool = self.get_or_create_arena_pool(db, arena_id)
            return {
                "status": "duplicate",
                "message": "Tribes penalty already processed for this date",
                "user_kudos_balance": wallet.tribes_balance,
                "is_frozen": wallet.is_frozen,
                "arena_kudos_vault": pool.tribes_reserve_vault
            }

        wallet = self.get_or_create_user_wallet(db, user_id)
        pool = self.get_or_create_arena_pool(db, arena_id)

        # Deduct penalty directly from wallet balance (allowing negative balance for freeze engine)
        wallet.tribes_balance -= penalty_kudos
        if wallet.tribes_balance < 0:
            wallet.is_frozen = True

        # Deposit penalty into arena reserve vault
        pool.tribes_reserve_vault += penalty_kudos
        pool.updated_at = datetime.utcnow()

        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=arena_id,
            transaction_type="PENALTY_DEDUCTION",
            amount_kudos=penalty_kudos,
            debit_account=f"user:{user_id}:tribes",
            credit_account=f"arena:{arena_id}:tribes_vault",
            idempotency_key=idempotency_key,
            description=f"Missed deadline penalty deduction of {penalty_kudos} Tribes for date {target_date_str}"
        )

        db.commit()
        db.refresh(wallet)
        db.refresh(pool)

        return {
            "status": "success",
            "message": f"Deducted {penalty_kudos} Tribes into arena vault",
            "user_kudos_balance": wallet.tribes_balance,
            "is_frozen": wallet.is_frozen,
            "arena_kudos_vault": pool.tribes_reserve_vault
        }

    def process_user_referral(self, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Increments user referral count. Upon reaching 3 referrals, unfreezes account and awards +200 Tribes bonus.
        """
        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet.referral_count += 1
        reward_given = False

        if wallet.referral_count >= REFERRAL_UNFREEZE_THRESHOLD and wallet.is_frozen:
            wallet.is_frozen = False
            wallet.tribes_balance += REFERRAL_BONUS_TRIBES
            reward_given = True
            self._log_tribes_ledger(
                db=db,
                user_id=user_id,
                arena_id=None,
                transaction_type="REFERRAL_UNFREEZE_BONUS",
                amount_kudos=REFERRAL_BONUS_TRIBES,
                debit_account="system:referral_reward",
                credit_account=f"user:{user_id}:tribes",
                idempotency_key=f"referral_unfreeze:user:{user_id}:{wallet.referral_count}",
                description="Account unfrozen and granted +200 Tribes bonus after 3 referrals"
            )

        db.commit()
        db.refresh(wallet)
        return {
            "status": "success",
            "referral_count": wallet.referral_count,
            "is_frozen": wallet.is_frozen,
            "reward_given": reward_given,
            "tribes_balance": wallet.tribes_balance
        }

    def distribute_21_day_consistency_rewards(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        21-Day Cycle Consistency Reward Engine.
        """
        pool = self.get_or_create_arena_pool(db, arena_id)
        total_vault = pool.tribes_reserve_vault

        if total_vault <= 0:
            return {
                "status": "empty_vault",
                "message": "No accumulated Tribes in arena vault for distribution",
                "distributed_kudos": 0.0,
                "cycle_days_remaining": self.get_cycle_days_remaining(pool)
            }

        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        if not memberships:
            return {
                "status": "no_members",
                "message": "No active approved members found in arena",
                "distributed_kudos": 0.0
            }

        member_scores = []
        for mem in memberships:
            uid = mem.user_id
            sub_count = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.user_id == uid,
                Submission.is_absent == False
            ).count()

            sheet_count = db.query(DailyArenaSheet).filter(
                DailyArenaSheet.arena_id == arena_id,
                DailyArenaSheet.user_id == uid,
                DailyArenaSheet.status.in_(["submitted", "verified"])
            ).count()

            verified_count = max(sub_count, sheet_count)
            compliance_rate = min(1.0, verified_count / float(CYCLE_DAYS))

            member_scores.append({
                "user_id": uid,
                "verified_days": verified_count,
                "compliance_rate": compliance_rate
            })

        qualifying_members = [m for m in member_scores if m["compliance_rate"] > 0]
        if not qualifying_members:
            qualifying_members = member_scores

        total_weight = sum(m["compliance_rate"] for m in qualifying_members)
        if total_weight <= 0:
            total_weight = float(len(qualifying_members))

        payout_results = []
        now_str = datetime.utcnow().strftime("%Y%m%d%H%M%S")

        for m in qualifying_members:
            uid = m["user_id"]
            user_share_tribes = round((m["compliance_rate"] / total_weight) * total_vault, 2)

            if user_share_tribes > 0:
                wallet = self.get_or_create_user_wallet(db, uid)
                wallet.tribes_balance += user_share_tribes

                self._log_tribes_ledger(
                    db=db,
                    user_id=uid,
                    arena_id=arena_id,
                    transaction_type="CONSISTENCY_PAYOUT",
                    amount_kudos=user_share_tribes,
                    debit_account=f"arena:{arena_id}:tribes_vault",
                    credit_account=f"user:{uid}:tribes",
                    idempotency_key=f"consistency_payout:arena:{arena_id}:user:{uid}:{now_str}",
                    description=f"21-Day consistency reward share of {user_share_tribes} Tribes ({m['verified_days']}/21 days compliant)"
                )

                payout_results.append({
                    "user_id": uid,
                    "reward_kudos": user_share_tribes,
                    "compliance_percentage": round(m["compliance_rate"] * 100, 1)
                })

        pool.tribes_reserve_vault = 0.0
        pool.cycle_start_date = datetime.utcnow()
        pool.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(pool)

        return {
            "status": "success",
            "message": f"Successfully distributed {total_vault} Tribes across {len(payout_results)} consistent members",
            "total_vault_distributed": total_vault,
            "payouts": payout_results,
            "next_cycle_start": pool.cycle_start_date.isoformat()
        }

    def get_cycle_days_remaining(self, pool: ArenaPool) -> int:
        start = pool.cycle_start_date or datetime.utcnow()
        elapsed = (datetime.utcnow() - start.replace(tzinfo=None)).days
        return max(0, CYCLE_DAYS - elapsed)

    def _log_tribes_ledger(
        self,
        db: Session,
        user_id: Optional[int],
        arena_id: Optional[int],
        transaction_type: str,
        amount_kudos: float,
        debit_account: str,
        credit_account: str,
        idempotency_key: str,
        description: str,
    ) -> KudosLedger:
        entry = KudosLedger(
            user_id=user_id,
            arena_id=arena_id,
            transaction_type=transaction_type,
            amount_kudos=amount_kudos,
            debit_account=debit_account,
            credit_account=credit_account,
            idempotency_key=idempotency_key,
            description=description
        )
        db.add(entry)
        return entry


# Singleton Service Instances
tribes_service = TribesService()
kudos_service = tribes_service
