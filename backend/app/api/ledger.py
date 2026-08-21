"""
Financial Ledger & User Wallet API Router.
Exposes arena reserve/reward pools, recent ledger transaction records, and user wallet summaries.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, EscrowLedger
from app.services.ledger_service import ledger_service

router = APIRouter(prefix="/api", tags=["Financial Ledger & Wallets"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


@router.get("/arenas/{arena_id}/ledger")
def get_arena_ledger_summary(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns arena financial pool summary (reserve pool, reward pool) and recent ledger transactions.
    """
    try:
        pool = ledger_service.get_or_create_arena_pool(db, arena_id)
        
        recent_txs = db.query(EscrowLedger).filter(
            EscrowLedger.arena_id == arena_id
        ).order_by(EscrowLedger.created_at.desc()).limit(50).all()

        tx_list = []
        for tx in recent_txs:
            tx_list.append({
                "id": tx.id,
                "arena_id": tx.arena_id,
                "user_id": tx.user_id,
                "debit_account": tx.debit_account,
                "credit_account": tx.credit_account,
                "amount_inr": float(tx.amount_inr or 0.0),
                "entry_type": tx.entry_type,
                "idempotency_key": tx.idempotency_key,
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else None
            })

        return success_response({
            "arena_id": arena_id,
            "reserve_pool_inr": float(pool.reserve_pool_inr or 0.0),
            "reward_pool_inr": float(pool.reward_pool_inr or 0.0),
            "recent_transactions": tx_list
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving arena ledger summary: {str(e)}"
        )


@router.get("/wallet/summary")
def get_user_wallet_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns current authenticated user wallet balance, frozen status, and last reward won timestamp.
    """
    try:
        wallet = ledger_service.get_or_create_user_wallet(db, current_user.id)
        kudos_val = getattr(wallet, "kudos_balance", None)
        if kudos_val is None:
            kudos_val = getattr(wallet, "tribes_balance", 1000.0) or 0.0

        is_seized = getattr(wallet, "is_frozen", False) or kudos_val < 0

        return success_response({
            "user_id": current_user.id,
            "kudos_balance": float(kudos_val),
            "tribes_balance": float(getattr(wallet, "tribes_balance", kudos_val) or 0.0),
            "is_frozen": is_seized,
            "is_seized": is_seized,
            "last_reward_won_at": wallet.last_reward_won_at.isoformat() if wallet.last_reward_won_at else None
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving user wallet summary: {str(e)}"
        )


@router.get("/arenas/{arena_id}/21day-status")
def get_arena_21day_status(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns the 21-day cycle consistency ledger statistics, reward pot, and member compliance.
    """
    try:
        status_info = ledger_service.get_21_day_arena_ledger_status(db, arena_id)
        return success_response(status_info)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving 21-day ledger status: {str(e)}"
        )


@router.post("/arenas/{arena_id}/distribute-21day-rewards")
def trigger_21day_reward_distribution(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Distributes the 21-day accumulated arena penalty revenue equally among consistent members.
    """
    try:
        res = ledger_service.distribute_21_day_consistency_rewards(db, arena_id)
        return success_response(res)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed distributing 21-day rewards: {str(e)}"
        )


class RechargePayload:
    amount: float


from pydantic import BaseModel
class WalletRechargeRequest(BaseModel):
    amount: float = 100.0


@router.post("/wallet/recharge")
def recharge_user_wallet(
    payload: WalletRechargeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Credits coins to user wallet and unfreezes seized accounts.
    """
    try:
        from app.services.kudos_service import kudos_service
        res = kudos_service.recharge_wallet(db, current_user.id, payload.amount)
        return success_response(res)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

