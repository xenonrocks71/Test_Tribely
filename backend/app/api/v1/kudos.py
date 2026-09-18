"""
Kudos Virtual Currency & Wallet Endpoints (API v1).
Exposes authenticated wallet balance, double-entry transaction history,
and paginated ledger inspection.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.services.kudos_service import kudos_service
from app.schemas.schemas import KudosWalletResponse, KudosTransactionResponse

router = APIRouter(prefix="/kudos", tags=["Kudos Virtual Currency (v1)"])


@router.get("/wallet", response_model=KudosWalletResponse)
def get_user_kudos_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> KudosWalletResponse:
    """
    Retrieves the current authenticated user's Kudos wallet balance and recent transactions.
    """
    summary = kudos_service.get_user_wallet_summary(db=db, user_id=current_user.id)
    return KudosWalletResponse(
        user_id=summary["user_id"],
        kudos_balance=summary["kudos_balance"],
        recent_transactions=summary["recent_transactions"]
    )


@router.get("/transactions", response_model=List[KudosTransactionResponse])
def get_user_kudos_transactions(
    limit: int = Query(50, ge=1, le=100, description="Number of transactions to return"),
    offset: int = Query(0, ge=0, description="Offset index for pagination"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[KudosTransactionResponse]:
    """
    Retrieves a paginated list of double-entry Kudos transactions for the authenticated user.
    """
    txs = kudos_service.get_user_kudos_transactions(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    return [KudosTransactionResponse.model_validate(tx) for tx in txs]
