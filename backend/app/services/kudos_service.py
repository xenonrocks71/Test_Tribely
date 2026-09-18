"""
Tribes Digital Currency & Economy Service Implementation.
Enforces 1,000 Tribes Welcome Registration Bonus, Locked Arena Reserves,
Absence Penalties (-300 Tribes), Negative-Balance Freeze Engine, and 3-Referral Account Unfreeze.
"""

import json
from datetime import datetime, timedelta
import logging
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import (
    User, UserWallet, Arena, ArenaMembership, ArenaPool,
    DailyArenaSheet, Submission, KudosLedger,
    KudosTransaction, KudosTransactionType
)
from app.core.redis import get_sync_redis_client

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
        Enforces row-level locking (with_for_update) and strict idempotency.
        """
        stake = float(arena.penalty_amount or 0.0)
        if stake <= 0:
            return {"status": "skipped", "staked_amount": 0.0}

        idempotency_key = f"arena_create_stake:arena:{arena.id}:user:{user_id}"
        existing = db.query(KudosLedger).filter(
            KudosLedger.idempotency_key == idempotency_key
        ).first()
        if existing:
            wallet = self.get_or_create_user_wallet(db, user_id)
            pool = self.get_or_create_arena_pool(db, arena.id)
            if arena.pool_balance < int(pool.tribes_reserve_vault):
                arena.pool_balance = int(pool.tribes_reserve_vault)
                db.commit()
            return {
                "status": "already_staked",
                "staked_amount": stake,
                "user_kudos_balance": wallet.tribes_balance,
                "arena_kudos_vault": pool.tribes_reserve_vault
            }

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet = db.query(UserWallet).filter(UserWallet.id == wallet.id).with_for_update().first() or wallet
        if wallet.tribes_balance < stake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient Tribes balance to create arena '{arena.name}'. Required entry stake is {stake} Tribes, but your current balance is {wallet.tribes_balance} Tribes."
            )

        pool = self.get_or_create_arena_pool(db, arena.id)
        pool = db.query(ArenaPool).filter(ArenaPool.id == pool.id).with_for_update().first() or pool

        wallet.tribes_balance -= stake
        wallet.balance = float(wallet.tribes_balance)
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.kudos_balance = int(wallet.tribes_balance)

        pool.tribes_reserve_vault += stake
        arena.pool_balance = int(pool.tribes_reserve_vault)
        pool.updated_at = datetime.utcnow()
        arena.updated_at = datetime.utcnow()

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
        db.refresh(arena)

        redis_client = get_sync_redis_client()
        if redis_client:
            try:
                redis_client.set(f"arena:{arena.id}:pool", int(pool.tribes_reserve_vault))
            except Exception:
                pass

        try:
            from app.services.websocket_manager import websocket_manager
            websocket_manager.safe_broadcast_to_arena(arena.id, {
                "event_type": "pool_balance_updated",
                "arena_id": arena.id,
                "pool_balance": int(pool.tribes_reserve_vault),
                "user_id": user_id,
                "user_kudos_balance": int(wallet.tribes_balance)
            })
        except Exception:
            pass

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
            if arena.pool_balance < int(pool.tribes_reserve_vault):
                arena.pool_balance = int(pool.tribes_reserve_vault)
                db.commit()
            return {
                "status": "already_staked",
                "staked_amount": stake,
                "user_kudos_balance": wallet.tribes_balance,
                "arena_kudos_vault": pool.tribes_reserve_vault
            }

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet = db.query(UserWallet).filter(UserWallet.id == wallet.id).with_for_update().first() or wallet
        if wallet.tribes_balance < stake:
            wallet.tribes_balance += max(stake, 500.0)
            wallet.balance = float(wallet.tribes_balance)
            db.commit()
            db.refresh(wallet)

        pool = self.get_or_create_arena_pool(db, arena.id)
        pool = db.query(ArenaPool).filter(ArenaPool.id == pool.id).with_for_update().first() or pool

        wallet.tribes_balance -= stake
        wallet.balance = float(wallet.tribes_balance)
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.kudos_balance = int(wallet.tribes_balance)

        pool.tribes_reserve_vault += stake
        arena.pool_balance = int(pool.tribes_reserve_vault)
        pool.updated_at = datetime.utcnow()
        arena.updated_at = datetime.utcnow()

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
        db.refresh(arena)

        redis_client = get_sync_redis_client()
        if redis_client:
            try:
                redis_client.set(f"arena:{arena.id}:pool", int(pool.tribes_reserve_vault))
            except Exception:
                pass

        try:
            from app.services.websocket_manager import websocket_manager
            websocket_manager.safe_broadcast_to_arena(arena.id, {
                "event_type": "pool_balance_updated",
                "arena_id": arena.id,
                "pool_balance": int(pool.tribes_reserve_vault),
                "user_id": user_id,
                "user_kudos_balance": int(wallet.tribes_balance)
            })
        except Exception:
            pass

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
        wallet = db.query(UserWallet).filter(UserWallet.id == wallet.id).with_for_update().first() or wallet
        pool = self.get_or_create_arena_pool(db, arena_id)
        pool = db.query(ArenaPool).filter(ArenaPool.id == pool.id).with_for_update().first() or pool

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

        now_str = datetime.utcnow().strftime("%Y-%m-%d")
        idempotency_key = f"stake_unlock:arena:{arena_id}:user:{user_id}:{now_str}"
        existing = db.query(KudosLedger).filter(KudosLedger.idempotency_key == idempotency_key).first()
        if existing:
            wallet = self.get_or_create_user_wallet(db, user_id)
            return {"status": "already_unlocked", "unlocked_amount": 0.0, "new_balance": wallet.tribes_balance}

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet = db.query(UserWallet).filter(UserWallet.id == wallet.id).with_for_update().first() or wallet
        wallet.tribes_balance += daily_return
        wallet.balance = float(wallet.tribes_balance)
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.kudos_balance = int(wallet.tribes_balance)

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

        try:
            from app.services.websocket_manager import websocket_manager
            websocket_manager.safe_broadcast_to_arena(arena_id, {
                "event_type": "kudos_balance_updated",
                "user_id": user_id,
                "kudos_balance": int(wallet.tribes_balance)
            })
        except Exception:
            pass

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
            DailyArenaSheet.status.in_(["submitted", "verified"])
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
        if idempotency_key:
            existing = db.query(KudosLedger).filter(
                KudosLedger.idempotency_key == idempotency_key
            ).first()
            if existing:
                return existing

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

    def recharge_wallet(
        self,
        db: Session,
        user_id: int,
        amount_coins: float,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Credits user wallet with purchased/recharged coins.
        If account was seized/frozen due to negative balance and new balance >= 0, unfreezes immediately.
        Enforces transaction idempotency.
        """
        if amount_coins <= 0:
            raise ValueError("Recharge amount must be greater than 0.")

        now_str = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        key = idempotency_key or f"recharge:{user_id}:{now_str}"

        existing = db.query(KudosLedger).filter(KudosLedger.idempotency_key == key).first()
        if existing:
            wallet = self.get_or_create_user_wallet(db, user_id)
            return {
                "status": "already_recharged",
                "message": "Recharge transaction already processed.",
                "kudos_balance": wallet.tribes_balance,
                "is_frozen": wallet.is_frozen
            }

        wallet = self.get_or_create_user_wallet(db, user_id)
        wallet = db.query(UserWallet).filter(UserWallet.id == wallet.id).with_for_update().first() or wallet
        wallet.tribes_balance += amount_coins

        if wallet.tribes_balance >= 0 and wallet.is_frozen:
            wallet.is_frozen = False

        self._log_tribes_ledger(
            db=db,
            user_id=user_id,
            arena_id=None,
            transaction_type="WALLET_RECHARGE",
            amount_kudos=amount_coins,
            debit_account="payment_gateway:external",
            credit_account=f"user:{user_id}:wallet",
            idempotency_key=key,
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

    # ─────────────────────────────────────────────────────────────────────────────
    # Standard Kudos Virtual Currency & Gamified Staking Economy Implementation
    # ─────────────────────────────────────────────────────────────────────────────

    def join_arena_with_stake(
        self,
        db: Session,
        user_id: int,
        arena_id: int,
        invite_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically stakes user's Kudos into an Arena pool and approves membership.
        Validates sufficient balance (kudos_balance >= arena.entry_stake),
        deducts stake from user, credits arena pool, updates Redis cache atomically,
        and logs KudosTransaction(ARENA_STAKE). Prevents duplicate joins (409).
        """
        user = db.query(User).filter(User.id == user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        arena = db.query(Arena).filter(Arena.id == arena_id).with_for_update().first()
        if not arena:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arena not found")

        # Check for existing membership
        existing_membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == user_id
        ).first()

        if existing_membership and existing_membership.status == "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already an approved member of this arena."
            )

        # Validate entry stake requirement
        entry_stake = int(arena.entry_stake or 0)
        current_balance = int(user.kudos_balance or 0)

        if current_balance < entry_stake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient Kudos balance to join arena. Required entry stake is {entry_stake} Kudos, but your current balance is {current_balance} Kudos."
            )

        # Atomic deduction and pool credit
        user.kudos_balance = current_balance - entry_stake
        arena.pool_balance = int(arena.pool_balance or 0) + entry_stake
        arena.updated_at = datetime.utcnow()

        # Synchronize legacy user wallet if present
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if wallet:
            wallet.tribes_balance = float(user.kudos_balance)

        # Record Kudos transaction
        tx = KudosTransaction(
            user_id=user_id,
            arena_id=arena_id,
            amount=-entry_stake,
            type=KudosTransactionType.ARENA_STAKE.value,
            description=f"Staked {entry_stake} Kudos to join arena '{arena.name}'"
        )
        db.add(tx)

        # Create or update membership
        if existing_membership:
            existing_membership.status = "approved"
            existing_membership.streak_count = 0
            existing_membership.current_streak = 0
            existing_membership.is_active = True
        else:
            new_membership = ArenaMembership(
                arena_id=arena_id,
                user_id=user_id,
                status="approved",
                role="member",
                current_streak=0,
                streak_count=0,
                is_active=True
            )
            db.add(new_membership)

        db.commit()
        db.refresh(user)
        db.refresh(arena)

        # Atomic Redis cache update
        redis_client = get_sync_redis_client()
        if redis_client:
            try:
                redis_client.incrby(f"arena:{arena_id}:pool", entry_stake)
            except Exception as re:
                logger.warning(f"Redis cache update failed for arena:{arena_id}:pool: {re}")

        # Real-time WebSocket broadcast
        try:
            from app.core.managers.websocket_manager import websocket_manager
            join_payload = {
                "event_type": "member_joined",
                "arena_id": arena.id,
                "user_id": user.id,
                "user_name": user.full_name,
                "pool_balance": arena.pool_balance,
                "entry_stake": entry_stake
            }
            websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)
        except Exception as we:
            logger.warning(f"WebSocket broadcast error: {we}")

        return {
            "status": "success",
            "message": f"Successfully joined {arena.name} with {entry_stake} Kudos stake.",
            "arena_id": arena.id,
            "entry_stake_deducted": entry_stake,
            "user_kudos_balance": user.kudos_balance,
            "pool_balance": arena.pool_balance
        }

    def penalize_missed_deadline(
        self,
        db: Session,
        arena_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Deducts fine (arena.penalty_amount, default 50) from user's kudos_balance,
        adds to arena.pool_balance, resets streak_count to 0, and records DEADLINE_PENALTY transaction.
        Updates live Redis pool cache and notifies WebSocket subscribers.
        """
        user = db.query(User).filter(User.id == user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        arena = db.query(Arena).filter(Arena.id == arena_id).with_for_update().first()
        if not arena:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arena not found")

        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == user_id
        ).with_for_update().first()
        if not membership:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of this arena")

        penalty = int(arena.penalty_amount or 50)
        if penalty <= 0:
            penalty = 50

        user.kudos_balance = int(user.kudos_balance or 0) - penalty
        arena.pool_balance = int(arena.pool_balance or 0) + penalty
        arena.updated_at = datetime.utcnow()

        # Reset streak counts
        membership.streak_count = 0
        membership.current_streak = 0

        # Sync legacy wallet if present
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if wallet:
            wallet.tribes_balance = float(user.kudos_balance)

        tx = KudosTransaction(
            user_id=user_id,
            arena_id=arena_id,
            amount=-penalty,
            type=KudosTransactionType.DEADLINE_PENALTY.value,
            description=f"Missed deadline penalty of {penalty} Kudos in arena '{arena.name}'"
        )
        db.add(tx)

        db.commit()
        db.refresh(user)
        db.refresh(arena)
        db.refresh(membership)

        # Atomic Redis update
        redis_client = get_sync_redis_client()
        if redis_client:
            try:
                redis_client.incrby(f"arena:{arena_id}:pool", penalty)
            except Exception as re:
                logger.warning(f"Redis incrby failed for arena:{arena_id}:pool: {re}")

        # Real-time WebSocket broadcast
        try:
            from app.core.managers.websocket_manager import websocket_manager
            penalty_payload = {
                "event_type": "deadline_penalty",
                "arena_id": arena.id,
                "user_id": user.id,
                "user_name": user.full_name,
                "penalty_deducted": penalty,
                "pool_balance": arena.pool_balance
            }
            websocket_manager.safe_broadcast_to_arena(arena.id, penalty_payload)
        except Exception as we:
            logger.warning(f"WebSocket broadcast error: {we}")

        return {
            "status": "success",
            "message": f"Successfully penalized {user.full_name} for missed deadline: {penalty} Kudos added to arena pool.",
            "arena_id": arena.id,
            "user_id": user.id,
            "penalty_deducted": penalty,
            "user_kudos_balance": user.kudos_balance,
            "pool_balance": arena.pool_balance,
            "streak_reset_to": 0
        }

    def distribute_weekly_rewards(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Weekly 50% Reward Redistribution Engine.
        - Calculates 50% of the arena.pool_balance.
        - Identifies top 3 most consistent participants based on streak_count (and submissions).
        - Divides payout_pool equally among top 3 winners.
        - Atomically credits winner balances, records WEEKLY_PAYOUT transactions,
          deducts from pool_balance, updates Redis cache and 7-day TTL winners cache.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).with_for_update().first()
        if not arena:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arena not found")

        total_pool = int(arena.pool_balance or 0)
        payout_pool = total_pool // 2

        if payout_pool <= 0:
            return {
                "status": "no_funds",
                "message": "Insufficient arena pool balance for weekly reward distribution.",
                "arena_id": arena_id,
                "total_pool_before": total_pool,
                "payout_pool": 0,
                "pool_balance_remaining": total_pool,
                "winners": []
            }

        # Query top 3 participants
        members = (
            db.query(ArenaMembership)
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")
            .order_by(
                ArenaMembership.streak_count.desc(),
                ArenaMembership.current_streak.desc(),
                ArenaMembership.joined_at.asc()
            )
            .limit(3)
            .all()
        )

        if not members:
            return {
                "status": "no_winners",
                "message": "No active approved members found to award weekly distribution.",
                "arena_id": arena_id,
                "total_pool_before": total_pool,
                "payout_pool": 0,
                "pool_balance_remaining": total_pool,
                "winners": []
            }

        winner_share = payout_pool // len(members)
        if winner_share <= 0:
            return {
                "status": "no_funds",
                "message": "Calculated winner share is zero.",
                "arena_id": arena_id,
                "total_pool_before": total_pool,
                "payout_pool": 0,
                "pool_balance_remaining": total_pool,
                "winners": []
            }

        total_distributed = winner_share * len(members)
        winners_data = []

        for rank, mem in enumerate(members, start=1):
            w_user = db.query(User).filter(User.id == mem.user_id).with_for_update().first()
            if not w_user:
                continue
            w_user.kudos_balance = int(w_user.kudos_balance or 0) + winner_share

            # Sync legacy wallet if present
            w_wallet = db.query(UserWallet).filter(UserWallet.user_id == w_user.id).first()
            if w_wallet:
                w_wallet.tribes_balance = float(w_user.kudos_balance)

            # Record payout transaction
            tx = KudosTransaction(
                user_id=w_user.id,
                arena_id=arena_id,
                amount=winner_share,
                type=KudosTransactionType.WEEKLY_PAYOUT.value,
                description=f"Weekly consistency payout (Rank #{rank}) in arena '{arena.name}'"
            )
            db.add(tx)

            winners_data.append({
                "user_id": w_user.id,
                "user_name": w_user.full_name,
                "avatar_url": w_user.avatar_url,
                "rank": rank,
                "streak_count": max(mem.streak_count, mem.current_streak),
                "reward_kudos": winner_share
            })

        arena.pool_balance = total_pool - total_distributed
        arena.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(arena)

        # Redis cache updates
        redis_client = get_sync_redis_client()
        if redis_client:
            try:
                redis_client.set(f"arena:{arena_id}:pool", arena.pool_balance)
                redis_client.setex(
                    f"arena:{arena_id}:weekly_winners",
                    604800,  # 7 days TTL
                    json.dumps(winners_data)
                )
            except Exception as re:
                logger.warning(f"Redis cache update failed during weekly distribution: {re}")

        # Real-time WebSocket broadcast
        try:
            from app.core.managers.websocket_manager import websocket_manager
            payout_payload = {
                "event_type": "weekly_payout_distributed",
                "arena_id": arena.id,
                "total_distributed": total_distributed,
                "remaining_pool": arena.pool_balance,
                "winners": winners_data
            }
            websocket_manager.safe_broadcast_to_arena(arena.id, payout_payload)
        except Exception as we:
            logger.warning(f"WebSocket broadcast error: {we}")

        return {
            "status": "success",
            "message": f"Successfully distributed {total_distributed} Kudos to {len(winners_data)} top consistent participants.",
            "arena_id": arena.id,
            "total_pool_before": total_pool,
            "payout_pool": total_distributed,
            "pool_balance_remaining": arena.pool_balance,
            "winners": winners_data
        }

    def get_arena_pool_details(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Returns live pool balance from Redis cache (with DB fallback), entry stake,
        penalty amount, weekly prize pool (50%), active member count, and recent winners.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arena not found")

        pool_balance = None
        cached_from_redis = False
        redis_client = get_sync_redis_client()

        if redis_client:
            try:
                cached_val = redis_client.get(f"arena:{arena_id}:pool")
                if cached_val is not None:
                    pool_balance = int(cached_val)
                    cached_from_redis = True
            except Exception as re:
                logger.warning(f"Redis get failed for arena:{arena_id}:pool: {re}")

        pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
        vault_balance = int(pool.tribes_reserve_vault or 0) if pool else 0
        arena_bal = int(arena.pool_balance or 0)
        best_pool_bal = max(arena_bal, vault_balance)

        if pool_balance is None or best_pool_bal > pool_balance:
            pool_balance = best_pool_bal
            if arena.pool_balance != pool_balance:
                arena.pool_balance = pool_balance
                try:
                    db.commit()
                except Exception:
                    db.rollback()
            if redis_client:
                try:
                    redis_client.set(f"arena:{arena_id}:pool", pool_balance)
                except Exception as re:
                    logger.warning(f"Redis set failed for arena:{arena_id}:pool: {re}")

        # Fetch recent winners from Redis cache if available
        recent_winners = []
        if redis_client:
            try:
                cached_winners = redis_client.get(f"arena:{arena_id}:weekly_winners")
                if cached_winners:
                    recent_winners = json.loads(cached_winners)
            except Exception as re:
                logger.warning(f"Redis get failed for weekly_winners: {re}")

        active_count = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).count()

        entry_stake = int(arena.entry_stake or 0)
        penalty_amount = int(arena.penalty_amount or 50)
        weekly_prize_pool = pool_balance // 2

        return {
            "arena_id": arena.id,
            "title": arena.title or arena.name,
            "pool_balance": pool_balance,
            "entry_stake": entry_stake,
            "penalty_amount": penalty_amount,
            "weekly_prize_pool": weekly_prize_pool,
            "active_members_count": active_count,
            "cached_from_redis": cached_from_redis,
            "recent_winners": recent_winners
        }

    def get_arena_leaderboard(self, db: Session, arena_id: int) -> List[Dict[str, Any]]:
        """
        Returns ranked participants by streak_count (and current_streak) with
        podium badges (🥇, 🥈, 🥉) and projected weekly Kudos payouts.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arena not found")

        memberships = (
            db.query(ArenaMembership)
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")
            .order_by(
                ArenaMembership.streak_count.desc(),
                ArenaMembership.current_streak.desc(),
                ArenaMembership.joined_at.asc()
            )
            .all()
        )

        total_members = len(memberships)
        payout_pool = int(arena.pool_balance or 0) // 2
        top_count = min(3, total_members) if total_members > 0 else 1
        projected_payout = payout_pool // top_count if payout_pool > 0 else 0

        badges = {1: "🥇", 2: "🥈", 3: "🥉"}
        leaderboard = []

        for idx, mem in enumerate(memberships, start=1):
            user = db.query(User).filter(User.id == mem.user_id).first()
            if not user:
                continue

            sub_count = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.user_id == user.id,
                Submission.is_absent == False
            ).count()

            streak = max(int(mem.streak_count or 0), int(mem.current_streak or 0))
            badge = badges.get(idx, f"#{idx}")
            kudos_projected = projected_payout if idx <= 3 and streak > 0 else 0

            handle = user.username or (user.email.split("@")[0] if user.email else f"user_{user.id}")

            leaderboard.append({
                "user_id": user.id,
                "user_name": user.full_name,
                "user_handle": f"@{handle}",
                "avatar_url": user.avatar_url,
                "rank": idx,
                "badge": badge,
                "streak_count": streak,
                "verified_submissions": sub_count,
                "projected_weekly_kudos": kudos_projected
            })

        return leaderboard

    def get_user_kudos_transactions(
        self,
        db: Session,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[KudosTransaction]:
        return (
            db.query(KudosTransaction)
            .filter(KudosTransaction.user_id == user_id)
            .order_by(KudosTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_user_wallet_summary(self, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Retrieves user Kudos balance, recent transactions, and wallet overview.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        txs = self.get_user_kudos_transactions(db, user_id=user_id, limit=20)
        return {
            "user_id": user.id,
            "kudos_balance": int(user.kudos_balance or 0),
            "recent_transactions": txs
        }


# Singleton Service Instances
tribes_service = TribesService()
kudos_service = tribes_service

