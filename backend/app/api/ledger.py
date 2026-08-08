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
    Returns current authenticated user wallet balance in INR and last reward won timestamp.
    """
    try:
        wallet = ledger_service.get_or_create_user_wallet(db, current_user.id)
        return success_response({
            "balance_inr": float(wallet.balance_inr or 0.0),
            "last_reward_won_at": wallet.last_reward_won_at.isoformat() if wallet.last_reward_won_at else None
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed retrieving user wallet summary: {str(e)}"
        )
