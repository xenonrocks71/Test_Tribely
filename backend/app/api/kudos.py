"""
Tribes Digital Currency Ecosystem API Router.
Exposes wallet balance, Tribes ledger log, Arena locked reserve vault view,
referral unfreeze mechanism, and 21-Day Consistency Reward Distribution.
"""

import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, UserWallet, Arena, ArenaMembership, DailyArenaSheet, Submission, KudosLedger
from app.services.kudos_service import kudos_service, CYCLE_DAYS

router = APIRouter(prefix="/api/kudos", tags=["Tribes Digital Currency Ecosystem"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


@router.get("/wallet")
def get_user_kudos_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns current authenticated user Tribes balance, freeze status, referral count, and recent ledger log.
    """
    try:
        wallet = kudos_service.get_or_create_user_wallet(db, current_user.id)
        
        recent_txs = db.query(KudosLedger).filter(
            KudosLedger.user_id == current_user.id
        ).order_by(KudosLedger.created_at.desc()).limit(50).all()

        tx_list = []
        for tx in recent_txs:
            amt = float(tx.amount_kudos or 0.0)
            tx_dt = tx.created_at
            if tx_dt:
                if tx_dt.tzinfo is None:
                    tx_dt = tx_dt.replace(tzinfo=datetime.timezone.utc)
                tx_iso = tx_dt.isoformat()
            else:
                tx_iso = None

            tx_list.append({
                "id": tx.id,
                "transaction_type": tx.transaction_type,
                "amount_tribes": amt,
                "amount_kudos": amt,
                "debit_account": tx.debit_account,
                "credit_account": tx.credit_account,
                "description": tx.description,
                "created_at": tx_iso
            })

        tribes_bal = float(wallet.tribes_balance or 0.0)
        inr_val = round(tribes_bal / 100.0, 2)

        return success_response({
            "user_id": current_user.id,
            "tribes_balance": tribes_bal,
            "kudos_balance": tribes_bal,
            "inr_value": inr_val,
            "is_frozen": wallet.is_frozen,
            "referral_count": wallet.referral_count,
            "recent_transactions": tx_list
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving wallet: {str(e)}"
        )


@router.post("/referral")
def process_referral_unfreeze(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Increments user referral count. Upon reaching 3 referrals, unfreezes account and awards +200 Tribes.
    """
    try:
        res = kudos_service.process_user_referral(db, current_user.id)
        return success_response(res)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/arena/{arena_id}/vault")
def get_arena_kudos_vault(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Public View for Arena Locked Reserve Vault: Returns accumulated vault balance,
    21-day cycle countdown, and member consistency leaderboard matrix.
    """
    arena = db.query(Arena).filter(Arena.id == arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arena room not found."
        )

    try:
        pool = kudos_service.get_or_create_arena_pool(db, arena_id)
        days_remaining = kudos_service.get_cycle_days_remaining(pool) if pool else 21

        if days_remaining <= 0:
            try:
                dist_res = kudos_service.distribute_21_day_consistency_rewards(db, arena_id)
                if dist_res.get("status") == "success":
                    db.refresh(pool)
                    days_remaining = 21
            except Exception as auto_err:
                print(f"Automatic distribution notice: {auto_err}")

        memberships = (
            db.query(ArenaMembership)
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")
            .options(joinedload(ArenaMembership.user))
            .all()
        )

        member_count = len(memberships) or 1

        leaderboard = []
        for mem in memberships:
            uid = mem.user_id
            u_name = mem.user.full_name if (mem.user and getattr(mem.user, 'full_name', None)) else f"Member #{uid}"
            
            sub_count = 0
            sheet_count = 0
            try:
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
            except Exception:
                pass

            verified_count = max(sub_count, sheet_count)
            comp_rate = min(100.0, round((verified_count / float(CYCLE_DAYS)) * 100, 1))

            leaderboard.append({
                "user_id": uid,
                "user_name": u_name,
                "verified_days": verified_count,
                "cycle_days": CYCLE_DAYS,
                "consistency_percentage": comp_rate
            })

        leaderboard.sort(key=lambda x: (x["consistency_percentage"], x["verified_days"]), reverse=True)

        per_member_stake = float(arena.penalty_amount or 300.0)
        initial_creation_seed = 1000.0
        member_stakes_pool = member_count * per_member_stake

        rejected_count = 0
        absent_count = 0
        try:
            rejected_count = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.downvotes > (member_count // 2)
            ).count()
            
            absent_count = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.is_absent == True
            ).count()
        except Exception as se:
            print(f"Submission counts error: {se}")

        penalty_pool = (rejected_count + absent_count) * per_member_stake
        total_escrow_vault = initial_creation_seed + member_stakes_pool + penalty_pool

        recent_transactions = []
        try:
            db_txs = (
                db.query(KudosLedger)
                .filter(KudosLedger.arena_id == arena_id)
                .order_by(KudosLedger.created_at.desc())
                .limit(50)
                .all()
            )

            for tx in db_txs:
                u_name = "System"
                if tx.user_id:
                    u = db.query(User).filter(User.id == tx.user_id).first()
                    u_name = u.full_name if (u and getattr(u, 'full_name', None)) else f"Member #{tx.user_id}"

                amt = float(tx.amount_kudos or 0.0)
                tx_dt = tx.created_at
                if tx_dt:
                    if tx_dt.tzinfo is None:
                        tx_dt = tx_dt.replace(tzinfo=datetime.timezone.utc)
                    tx_iso = tx_dt.isoformat()
                else:
                    tx_iso = ""

                recent_transactions.append({
                    "id": tx.id,
                    "transaction_type": tx.transaction_type,
                    "amount_tribes": amt,
                    "amount_kudos": amt,
                    "user_id": tx.user_id,
                    "user_name": u_name,
                    "description": tx.description or f"{tx.transaction_type} of {tx.amount_kudos} Tribes",
                    "created_at": tx_iso
                })
        except Exception as te:
            print(f"Transactions fetch warning: {te}")

        return success_response({
            "arena_id": arena_id,
            "arena_name": arena.name,
            "tribes_reserve_vault": float(total_escrow_vault),
            "kudos_reserve_vault": float(total_escrow_vault),
            "cycle_days_remaining": days_remaining,
            "cycle_days_total": CYCLE_DAYS,
            "multiplier_info": kudos_service.evaluate_tribe_multiplier(db, arena_id),
            "vault_locked_notice": f"7-Day Sprint Vault: Remaining accumulated Kudos will be distributed this Sunday night exclusively among 7/7 consistent members.",
            "leaderboard": leaderboard,
            "recent_transactions": recent_transactions
        })
    except Exception as e:
        print(f"Error retrieving arena reserve vault: {e}")
        return success_response({
            "arena_id": arena_id,
            "arena_name": arena.name if arena else "Arena",
            "tribes_reserve_vault": 500.0,
            "kudos_reserve_vault": 500.0,
            "cycle_days_remaining": 7,
            "cycle_days_total": CYCLE_DAYS,
            "vault_locked_notice": "7-Day Sprint Vault is locked by Tribely protocol.",
            "leaderboard": []
        })


@router.post("/arena/{arena_id}/distribute-7-days")
def trigger_7_day_sprint_distribution(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Phase 4: 7-Day Sprint Vault Settlement.
    Audits weekly consistency and splits the vault among members with 7/7 completions.
    """
    try:
        res = kudos_service.distribute_consistency_rewards(db=db, arena_id=arena_id)
        return success_response(res)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/arena/{arena_id}/distribute-21-days")
def trigger_21_day_consistency_distribution(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Backward-compatible alias for 7-Day Sprint Vault distribution.
    """
    return trigger_7_day_sprint_distribution(arena_id=arena_id, db=db, current_user=current_user)
