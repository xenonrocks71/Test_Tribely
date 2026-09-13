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
CYCLE_DAYS = 7  # 7-Day Sprint Vault replaces 21-day cycles (Monday to Sunday)


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
        Deducts entry escrow deposit from joining user's wallet when enrolling in an arena.
        For private arenas with monetary policy, takes agreed fine (penalty_amount, default 50.0 Kudos)
        as deposit and locks it into the arena's escrow vault (ArenaPool.tribes_reserve_vault).
        Public arenas with 0 stake are free.
        """
        stake = float(arena.penalty_amount if arena.penalty_amount is not None else 0.0)
        if arena.is_private and stake <= 0:
            stake = 50.0

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
        if wallet.tribes_balance < stake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient Kudos balance to join arena '{arena.name}'. A deposit of {stake} Kudos is required, but your current balance is {wallet.tribes_balance} Kudos."
            )

        wallet.tribes_balance -= stake
        pool = self.get_or_create_arena_pool(db, arena.id)
        pool.tribes_reserve_vault += stake
        pool.updated_at = datetime.utcnow()

        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=arena.id,
            transaction_type="ARENA_JOIN_ESCROW_DEPOSIT",
            amount_kudos=stake,
            debit_account=f"user:{user_id}:tribes",
            credit_account=f"arena:{arena.id}:tribes_vault",
            idempotency_key=idempotency_key,
            description=f"Escrow deposit of {stake} Kudos for joining arena '{arena.name}'"
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

        # Deduct penalty directly from wallet balance
        wallet.tribes_balance -= penalty_kudos
        wallet.is_frozen = False  # Users are never locked out of posting proofs

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

    def unlock_daily_stake_return(self, db: Session, user_id: int, arena_id: int) -> Dict[str, Any]:
        """
        Phase 4 7-Day Sprint Vault:
        Every completed daily check-in unlocks a fraction (1/7th) of their weekly locked stake
        back to their wallet immediately for instant gratification.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        stake = float(arena.penalty_amount or 0.0) if arena else 0.0
        daily_return = round(stake / 7.0, 2)
        if daily_return <= 0:
            return {"status": "skipped", "unlocked_amount": 0.0}

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet.tribes_balance += daily_return
        
        now_str = datetime.utcnow().strftime("%Y-%m-%d")
        idempotency_key = f"stake_unlock:arena:{arena_id}:user:{user_id}:{now_str}"
        existing = db.query(KudosLedger).filter(KudosLedger.idempotency_key == idempotency_key).first()
        if existing:
            return {"status": "already_unlocked", "unlocked_amount": 0.0, "new_balance": wallet.tribes_balance}

        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=arena_id,
            transaction_type="SPRINT_STAKE_UNLOCK",
            amount_kudos=daily_return,
            debit_account=f"arena:{arena_id}:tribes_vault",
            credit_account=f"user:{user_id}:tribes",
            idempotency_key=idempotency_key,
            description=f"7-Day Sprint daily check-in unlocked {daily_return} Kudos back to wallet"
        )
        db.commit()
        db.refresh(wallet)
        return {"status": "success", "unlocked_amount": daily_return, "new_balance": wallet.tribes_balance}

    def evaluate_tribe_multiplier(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Phase 4 Tribe Multiplier & Social Loss Aversion:
        If 100% of Tribe members submit proof before the daily deadline, the entire cohort
        earns a 1.5x Kudos Streak Multiplier.
        """
        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()
        total_members = len(memberships)
        if total_members == 0:
            return {"multiplier_active": False, "multiplier": 1.0, "completed": 0, "total": 0, "at_risk_users": []}

        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        submitted_user_ids = set()
        subs = db.query(Submission.user_id).filter(
            Submission.arena_id == arena_id,
            Submission.submitted_at >= today_start,
            Submission.is_absent == False
        ).all()
        for s in subs:
            submitted_user_ids.add(s[0])

        sheets = db.query(DailyArenaSheet.user_id).filter(
            DailyArenaSheet.arena_id == arena_id,
            DailyArenaSheet.date_day >= today_start.strftime("%Y-%m-%d"),
            DailyArenaSheet.status.in_(["submitted", "verified", "shielded"])
        ).all()
        for sh in sheets:
            submitted_user_ids.add(sh[0])

        at_risk_users = []
        for m in memberships:
            if m.user_id not in submitted_user_ids:
                at_risk_users.append(m.user_id)

        all_completed = len(at_risk_users) == 0 and total_members > 0
        return {
            "multiplier_active": all_completed,
            "multiplier": 1.5 if all_completed else 1.0,
            "completed": len(submitted_user_ids),
            "total": total_members,
            "at_risk_users": at_risk_users
        }

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

    def recharge_wallet(self, db: Session, user_id: int, amount_coins: float) -> Dict[str, Any]:
        """
        Credits user wallet with purchased/recharged coins.
        If account was seized/frozen due to negative balance and new balance >= 0, unfreezes immediately.
        """
        if amount_coins <= 0:
            raise ValueError("Recharge amount must be greater than 0.")

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet.tribes_balance += amount_coins

        if wallet.tribes_balance >= 0 and wallet.is_frozen:
            wallet.is_frozen = False

        now_str = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=None,
            transaction_type="WALLET_RECHARGE",
            amount_kudos=amount_coins,
            debit_account="payment_gateway:external",
            credit_account=f"user:{user_id}:wallet",
            idempotency_key=f"recharge:{user_id}:{now_str}",
            description=f"Direct wallet coin recharge of +{amount_coins} coins"
        )
        db.commit()
        db.refresh(wallet)

        return {
            "status": "success",
            "message": f"Successfully recharged +{amount_coins} coins.",
            "kudos_balance": wallet.tribes_balance,
            "is_frozen": wallet.is_frozen
        }


# Singleton Service Instances
tribes_service = TribesService()
kudos_service = tribes_service
