"""
Kudos Digital Currency System API Router.
Exposes Kudos wallet balance, Buy Kudos via Razorpay, Withdraw Kudos via RazorpayX UPI,
Arena Locked Kudos Reserve Vault view, and 21-Day Consistency Reward Distribution.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session


from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, UserWallet, Arena, ArenaMembership, DailyArenaSheet, KudosLedger
from app.services.kudos_service import (
    kudos_service,
    KUDOS_PER_INR,
    MIN_PURCHASE_INR,
    MIN_WITHDRAWAL_KUDOS,
    CYCLE_DAYS
)

router = APIRouter(prefix="/api/kudos", tags=["Kudos Digital Currency Ecosystem"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


class BuyKudosRequest(BaseModel):
    inr_amount: float = 50.0


class VerifyBuyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    inr_amount: float = 50.0


class WithdrawKudosRequest(BaseModel):
    kudos_amount: float = 20000.0
    upi_vpa: str


@router.get("/wallet")
def get_user_kudos_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns current authenticated user Kudos balance, INR equivalent, and recent Kudos ledger log.
    """
    try:
        wallet = kudos_service.get_or_create_user_wallet(db, current_user.id)
        
        recent_txs = db.query(KudosLedger).filter(
            KudosLedger.user_id == current_user.id
        ).order_by(KudosLedger.created_at.desc()).limit(50).all()

        tx_list = []
        for tx in recent_txs:
            tx_list.append({
                "id": tx.id,
                "transaction_type": tx.transaction_type,
                "amount_kudos": float(tx.amount_kudos or 0.0),
                "debit_account": tx.debit_account,
                "credit_account": tx.credit_account,
                "razorpay_payment_id": tx.razorpay_payment_id,
                "razorpay_payout_id": tx.razorpay_payout_id,
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else None
            })

        kudos_bal = float(wallet.kudos_balance or 0.0)
        inr_val = round(kudos_bal / KUDOS_PER_INR, 2)

        return success_response({
            "user_id": current_user.id,
            "kudos_balance": kudos_bal,
            "inr_value": inr_val,
            "upi_vpa": wallet.upi_vpa,
            "mandate_status": wallet.mandate_status,
            "min_withdrawal_kudos": MIN_WITHDRAWAL_KUDOS,
            "min_purchase_inr": MIN_PURCHASE_INR,
            "recent_transactions": tx_list
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving Kudos wallet: {str(e)}"
        )


@router.get("/arena/{arena_id}/vault")
def get_arena_kudos_vault(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Public View for Arena Locked Kudos Vault: Returns accumulated vault balance,
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
        days_remaining = kudos_service.get_cycle_days_remaining(pool)

        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        leaderboard = []
        for mem in memberships:
            uid = mem.user_id
            u_name = mem.user.full_name if (mem.user and getattr(mem.user, 'full_name', None)) else f"Member #{uid}"
            
            verified_count = db.query(DailyArenaSheet).filter(
                DailyArenaSheet.arena_id == arena_id,
                DailyArenaSheet.user_id == uid,
                DailyArenaSheet.status == "verified"
            ).count()

            comp_rate = min(100.0, round((verified_count / float(CYCLE_DAYS)) * 100, 1))

            leaderboard.append({
                "user_id": uid,
                "user_name": u_name,
                "verified_days": verified_count,
                "cycle_days": CYCLE_DAYS,
                "consistency_percentage": comp_rate
            })

        leaderboard.sort(key=lambda x: (x["consistency_percentage"], x["verified_days"]), reverse=True)

        return success_response({
            "arena_id": arena_id,
            "arena_name": arena.name,
            "kudos_reserve_vault": float(pool.kudos_reserve_vault or 0.0),
            "cycle_days_remaining": days_remaining,
            "cycle_days_total": CYCLE_DAYS,
            "vault_locked_notice": "Vault is locked by Tribely ACID Ledger protocol. Vault Kudos will be automatically distributed at the end of the 21-day cycle based purely on member submission consistency.",
            "leaderboard": leaderboard
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving arena Kudos vault: {str(e)}"
        )


@router.post("/buy")
def buy_kudos_initiate(
    payload: BuyKudosRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Online payment top-ups are disabled for MVP rollout.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Online payment top-ups are disabled for MVP rollout. Every registered user receives a free 1,000 Kudos welcome bonus!"
    )


@router.post("/buy/verify")
def verify_kudos_buy_payment(
    payload: VerifyBuyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Verifies Razorpay payment signature - Disabled for MVP rollout.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Payment gateway verification is disabled for MVP rollout."
    )


@router.post("/withdraw")
def withdraw_kudos_to_upi(
    payload: WithdrawKudosRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    UPI withdrawals are disabled for MVP rollout.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="UPI cashouts are disabled for MVP rollout. Real-money payouts will be unlocked in the next release update!"
    )



@router.post("/arena/{arena_id}/distribute-21-days")
def trigger_21_day_consistency_distribution(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Triggers 21-Day Cycle Consistency Reward Engine audit and vault distribution.
    """
    try:
        res = kudos_service.distribute_21_day_consistency_rewards(db=db, arena_id=arena_id)
        return success_response(res)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
