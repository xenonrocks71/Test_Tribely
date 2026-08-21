"""
Tribely Financial Ledger Service.
Enforces 60% Arena Reserve, 30% Single-Winner Reward Pool, and 10% Platform Commission allocation model in Tribes currency.
Manages top performer selection with 90-day win cooldown filters and handles zero-penalty cycles cleanly.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import Arena, ArenaMembership, Submission, EscrowLedger, ArenaPool, UserWallet, User
from app.services.streak_service import streak_service


COMMISSION_PCT = 0.10  # 10%
RESERVE_PCT = 0.60     # 60%
REWARD_PCT = 0.30      # 30%


class LedgerService:
    """
    Core Business Service for Tribely Financial Ledger & Allocation Engine.
    """

    def record_penalty_accrual(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        penalty_amount_inr: float,
        target_date_str: str,
    ) -> Dict[str, Any]:
        """
        Record penalty accrual and split penalty into:
          - Commission: 10%
          - Reserve: 60%
          - Reward: 30%
        Guarantees single execution via base idempotency key check.
        """
        penalty_amount_tribes = penalty_amount_inr
        base_idempotency_key = f"penalty:{arena_id}:{user_id}:{target_date_str}"
        
        # Check if already processed
        existing = db.query(EscrowLedger).filter(
            EscrowLedger.idempotency_key.like(f"{base_idempotency_key}%")
        ).first()

        commission = round(penalty_amount_tribes * COMMISSION_PCT, 2)
        reserve = round(penalty_amount_tribes * RESERVE_PCT, 2)
        reward = round(penalty_amount_tribes * REWARD_PCT, 2)

        if existing:
            pool = self.get_or_create_arena_pool(db, arena_id)
            return {
                "status": "duplicate",
                "message": "Penalty already recorded for this target date",
                "commission": commission,
                "reserve": reserve,
                "reward": reward,
                "arena_pool": {
                    "reserve_pool_inr": pool.reserve_pool_tribes,
                    "reward_pool_inr": pool.reward_pool_tribes,
                    "total_penalties_count": pool.total_penalties_count
                }
            }

        # 1. Double-entry ledger insertions
        entry_comm = EscrowLedger(
            arena_id=arena_id,
            user_id=user_id,
            debit_account=f"user:{user_id}:penalty",
            credit_account="platform:commission",
            amount_tribes=commission,
            entry_type="penalty_accrual",
            idempotency_key=f"{base_idempotency_key}:commission",
            description=f"Platform 10% commission slash for user {user_id} on {target_date_str}"
        )
        entry_res = EscrowLedger(
            arena_id=arena_id,
            user_id=user_id,
            debit_account=f"user:{user_id}:penalty",
            credit_account=f"arena:{arena_id}:reserve",
            amount_tribes=reserve,
            entry_type="penalty_accrual",
            idempotency_key=f"{base_idempotency_key}:reserve",
            description=f"Arena 60% reserve allocation for user {user_id} on {target_date_str}"
        )
        entry_rew = EscrowLedger(
            arena_id=arena_id,
            user_id=user_id,
            debit_account=f"user:{user_id}:penalty",
            credit_account=f"arena:{arena_id}:reward",
            amount_tribes=reward,
            entry_type="penalty_accrual",
            idempotency_key=f"{base_idempotency_key}:reward",
            description=f"Reward pool 30% allocation for user {user_id} on {target_date_str}"
        )

        db.add_all([entry_comm, entry_res, entry_rew])

        # 2. Update ArenaPool
        pool = self.get_or_create_arena_pool(db, arena_id)
        pool.reserve_pool_tribes += reserve
        pool.reward_pool_tribes += reward
        pool.total_penalties_count += 1
        pool.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(pool)

        return {
            "status": "success",
            "message": "Penalty accrual processed successfully",
            "commission": commission,
            "reserve": reserve,
            "reward": reward,
            "arena_pool": {
                "reserve_pool_inr": pool.reserve_pool_tribes,
                "reward_pool_inr": pool.reward_pool_tribes,
                "total_penalties_count": pool.total_penalties_count
            }
        }

    def get_or_create_arena_pool(self, db: Session, arena_id: int) -> ArenaPool:
        pool = db.query(ArenaPool).filter(ArenaPool.arena_id == arena_id).first()
        if not pool:
            pool = ArenaPool(arena_id=arena_id, reserve_pool_tribes=0.0, reward_pool_tribes=0.0, total_penalties_count=0)
            db.add(pool)
            db.commit()
            db.refresh(pool)
        return pool

    def get_or_create_user_wallet(self, db: Session, user_id: int) -> UserWallet:
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if not wallet:
            wallet = UserWallet(user_id=user_id, tribes_balance=1000.0, is_frozen=False, referral_count=0, last_reward_won_at=None)
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
        return wallet

    def select_and_award_top_performer(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Select single top performer using upvotes & streak history.
        Filters out members who won within the last 90 days IF an eligible competitor exists.
        Awards reward_pool_tribes, credits winner's UserWallet, and resets reward_pool_tribes to 0.0.
        """
        pool = self.get_or_create_arena_pool(db, arena_id)
        accumulated_reward = pool.reward_pool_tribes

        # Get all approved members of the arena
        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        if not memberships:
            return {
                "status": "no_members",
                "message": "No active members found in arena",
                "winner_id": None,
                "awarded_amount_inr": 0.0
            }

        candidate_metrics = []
        for m in memberships:
            uid = m.user_id
            
            # Check upvotes count across non-absent submissions in arena
            upvotes_sum = db.query(func.coalesce(func.sum(Submission.upvotes), 0)).filter(
                Submission.arena_id == arena_id,
                Submission.user_id == uid,
                Submission.is_absent == False
            ).scalar() or 0

            # Calculate current streak
            streak_info = streak_service.calculate_user_streak(db, uid, arena_id)
            current_streak = streak_info.get("current_streak", 0)

            # Check wallet last_reward_won_at
            wallet = self.get_or_create_user_wallet(db, uid)
            last_won_at = wallet.last_reward_won_at if wallet else None

            candidate_metrics.append({
                "user_id": uid,
                "upvotes": int(upvotes_sum),
                "streak": int(current_streak),
                "last_reward_won_at": last_won_at
            })

        now = datetime.utcnow()
        ninety_days_ago = now - timedelta(days=90)

        # Separate candidates into cooldowned (won within last 90 days) and eligible (not won in last 90 days)
        eligible_candidates = []
        cooldowned_candidates = []

        for c in candidate_metrics:
            if c["last_reward_won_at"] and c["last_reward_won_at"] > ninety_days_ago:
                cooldowned_candidates.append(c)
            else:
                eligible_candidates.append(c)

        # Filter rule: Use eligible candidates if any exist; otherwise fallback to cooldowned candidates
        target_pool = eligible_candidates if eligible_candidates else cooldowned_candidates

        # Rank by upvotes DESC, current_streak DESC
        target_pool.sort(key=lambda x: (x["upvotes"], x["streak"]), reverse=True)

        winner = target_pool[0]
        winner_id = winner["user_id"]

        if accumulated_reward > 0:
            winner_wallet = self.get_or_create_user_wallet(db, winner_id)
            winner_wallet.tribes_balance += accumulated_reward
            winner_wallet.last_reward_won_at = now

            # Record reward payout in ledger
            idempotency_key = f"reward:{arena_id}:{winner_id}:{now.strftime('%Y%m%d%H%M%S')}"
            reward_entry = EscrowLedger(
                arena_id=arena_id,
                user_id=winner_id,
                debit_account=f"arena:{arena_id}:reward",
                credit_account=f"user:{winner_id}:wallet",
                amount_tribes=accumulated_reward,
                entry_type="reward_payout",
                idempotency_key=idempotency_key,
                description=f"Single-winner reward payout of {accumulated_reward} Tribes to user {winner_id}"
            )
            db.add(reward_entry)

            # Reset reward_pool_tribes = 0.0
            pool.reward_pool_tribes = 0.0
            pool.updated_at = now
            db.commit()

        return {
            "status": "success",
            "message": f"Winner selected: User #{winner_id}",
            "winner_id": winner_id,
            "awarded_amount_inr": accumulated_reward,
            "winner_upvotes": winner["upvotes"],
            "winner_streak": winner["streak"],
            "was_cooldown_applied": len(eligible_candidates) > 0 and len(cooldowned_candidates) > 0
        }

    def handle_zero_penalty_cycle(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Handle cycle when zero penalties were accrued:
          - Compute 10% platform commission from baseline arena stake.
          - Deduct commission from ArenaPool.reserve_pool_tribes.
          - Record ledger entry debiting arena reserve and crediting platform:commission.
          - Skip reward allocation.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            return {"status": "error", "message": "Arena not found"}

        baseline_stake = float(arena.penalty_amount or 300.0)
        commission = round(baseline_stake * COMMISSION_PCT, 2)

        pool = self.get_or_create_arena_pool(db, arena_id)
        
        # Deduct commission from reserve pool
        pool.reserve_pool_tribes = max(0.0, pool.reserve_pool_tribes - commission)
        pool.updated_at = datetime.utcnow()

        target_date_str = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        idempotency_key = f"zero_penalty_commission:{arena_id}:{target_date_str}"

        ledger_entry = EscrowLedger(
            arena_id=arena_id,
            user_id=None,
            debit_account=f"arena:{arena_id}:reserve",
            credit_account="platform:commission",
            amount_tribes=commission,
            entry_type="zero_penalty_commission",
            idempotency_key=idempotency_key,
            description=f"Zero-penalty cycle 10% platform commission of {commission} Tribes drawn from reserve pool"
        )
        db.add(ledger_entry)
        db.commit()
        db.refresh(pool)

        return {
            "status": "success",
            "message": f"Deducted {commission} Tribes platform commission from arena reserve pool",
            "commission_deducted_inr": commission,
            "remaining_reserve_pool_inr": pool.reserve_pool_tribes
        }


    def get_21_day_arena_ledger_status(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Calculates the 21-day cycle consistency metrics, accumulated arena income,
        and projected equal reward shares for all active members.
        """
        pool = self.get_or_create_arena_pool(db, arena_id)
        now = datetime.utcnow()
        twenty_one_days_ago = now - timedelta(days=21)

        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        members_consistency = []
        for m in memberships:
            uid = m.user_id
            user_obj = db.query(User).filter(User.id == uid).first()
            user_name = user_obj.full_name if user_obj else f"Member #{uid}"
            user_avatar = user_obj.profile.profile_image_url if (user_obj and user_obj.profile) else None

            # Submissions in last 21 days
            verified_count = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.user_id == uid,
                Submission.is_absent == False,
                Submission.submitted_at >= twenty_one_days_ago
            ).count()

            streak_info = streak_service.calculate_user_streak(db, uid, arena_id)
            current_streak = streak_info.get("current_streak", 0)

            wallet = self.get_or_create_user_wallet(db, uid)
            is_seized = getattr(wallet, "is_frozen", False) or getattr(wallet, "kudos_balance", 0.0) < 0

            consistency_pct = min(100.0, round((verified_count / 21.0) * 100.0, 1))

            members_consistency.append({
                "user_id": uid,
                "user_name": user_name,
                "user_avatar_url": user_avatar,
                "verified_days_21": verified_count,
                "consistency_pct": consistency_pct,
                "current_streak": current_streak,
                "is_seized": is_seized,
                "kudos_balance": getattr(wallet, "kudos_balance", 0.0) or getattr(wallet, "tribes_balance", 0.0)
            })

        # Sort by consistency percentage descending
        members_consistency.sort(key=lambda x: (x["consistency_pct"], x["current_streak"]), reverse=True)

        # Consistent qualifiers: members with >= 70% attendance or top performers
        qualifiers = [m for m in members_consistency if m["verified_days_21"] >= 15 or m["consistency_pct"] >= 70.0]
        if not qualifiers and members_consistency:
            # If early in cycle or lower compliance, qualify top 30% consistent performers with > 0 submissions
            top_threshold = max([m["verified_days_21"] for m in members_consistency], default=0)
            if top_threshold > 0:
                qualifiers = [m for m in members_consistency if m["verified_days_21"] == top_threshold]

        total_accumulated = pool.reward_pool_tribes
        total_treasury = pool.reserve_pool_tribes + pool.reward_pool_tribes
        estimated_payout_per_user = round(total_accumulated / len(qualifiers), 2) if qualifiers and total_accumulated > 0 else 0.0

        return {
            "arena_id": arena_id,
            "total_arena_revenue": total_treasury,
            "reward_pot_21_days": total_accumulated,
            "reserve_treasury": pool.reserve_pool_tribes,
            "total_penalties_count": pool.total_penalties_count,
            "qualifying_members_count": len(qualifiers),
            "estimated_payout_per_user": estimated_payout_per_user,
            "qualifiers": qualifiers,
            "members": members_consistency,
            "cycle_days": 21
        }

    def distribute_21_day_consistency_rewards(self, db: Session, arena_id: int) -> Dict[str, Any]:
        """
        Executes the 21-Day Consistency Reward Distribution:
          - Gathers all consistent members from the last 21 days.
          - Divides the accumulated arena revenue from penalties EQUALLY among them.
          - Credits each consistent member's personal wallet atomically.
          - Creates EscrowLedger audit records.
          - Resets the 21-day reward pool to 0.0 for the next cycle.
          - Broadcasts celebratory event over WebSocket.
        """
        status_info = self.get_21_day_arena_ledger_status(db, arena_id)
        pool = self.get_or_create_arena_pool(db, arena_id)
        accumulated_reward = pool.reward_pool_tribes

        if accumulated_reward <= 0:
            return {
                "status": "empty_pot",
                "message": "No accumulated penalty revenue in reward pot to distribute.",
                "distributed_amount": 0.0,
                "winners": []
            }

        qualifiers = status_info.get("qualifiers") or []
        if not qualifiers:
            members = status_info["members"]
            max_days = max([m["verified_days_21"] for m in members], default=0)
            qualifiers = [m for m in members if m["verified_days_21"] >= 15 or (max_days > 0 and m["verified_days_21"] == max_days)]

        if not qualifiers:
            return {
                "status": "no_qualifiers",
                "message": "No members met consistency requirements in this 21-day cycle.",
                "distributed_amount": 0.0,
                "winners": []
            }

        equal_share = round(accumulated_reward / len(qualifiers), 2)
        now = datetime.utcnow()
        now_str = now.strftime("%Y%m%d%H%M%S")

        winners_list = []
        for q in qualifiers:
            uid = q["user_id"]
            wallet = self.get_or_create_user_wallet(db, uid)
            wallet.tribes_balance += equal_share
            wallet.last_reward_won_at = now

            idempotency_key = f"consistency_reward_21d:{arena_id}:{uid}:{now_str}"
            reward_entry = EscrowLedger(
                arena_id=arena_id,
                user_id=uid,
                debit_account=f"arena:{arena_id}:reward",
                credit_account=f"user:{uid}:wallet",
                amount_tribes=equal_share,
                entry_type="consistency_reward_payout",
                idempotency_key=idempotency_key,
                description=f"21-day consistency equal reward payout of {equal_share} coins to user #{uid}"
            )
            db.add(reward_entry)
            winners_list.append({
                "user_id": uid,
                "user_name": q["user_name"],
                "payout_amount": equal_share,
                "consistency_pct": q["consistency_pct"],
                "streak": q["current_streak"]
            })

        # Reset reward pot for next 21-day cycle
        pool.reward_pool_tribes = 0.0
        pool.updated_at = now
        db.commit()

        # Broadcast real-time celebratory event
        try:
            from app.core.managers.websocket_manager import websocket_manager
            websocket_manager.safe_broadcast_to_arena(arena_id, {
                "event_type": "21day_reward_distributed",
                "arena_id": arena_id,
                "total_distributed": accumulated_reward,
                "equal_share": equal_share,
                "winners_count": len(qualifiers),
                "winners": winners_list,
                "message": f"🎉 21-Day Consistency Rewards Distributed! {len(qualifiers)} members each won {equal_share} coins!"
            })
        except Exception as be:
            print(f"Non-critical reward broadcast error: {be}")

        return {
            "status": "success",
            "message": f"Successfully distributed {accumulated_reward} coins equally among {len(qualifiers)} consistent members.",
            "total_distributed": accumulated_reward,
            "equal_share_per_winner": equal_share,
            "winners": winners_list
        }


# Singleton Instance
ledger_service = LedgerService()

