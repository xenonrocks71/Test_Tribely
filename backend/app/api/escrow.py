"""
Automated Penalty Pool & Micro-Escrow API Router.
Exposes reward pool totals, penalty stake balances, and winner payout projections.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.services.escrow_service import escrow_service

router = APIRouter(prefix="/api/escrow", tags=["Penalty Pool & Micro-Escrow"])


@router.get("/{arena_id}", response_model=Dict[str, Any])
def get_arena_escrow_pool(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get live penalty pool balance, penalty stake rules, and projected winner payouts for an arena.

    :param arena_id: Target habit arena ID.
    :param db: Active database session.
    :param current_user: Authenticated user.
    :return: Dict containing pool breakdown.
    """
    try:
        data = escrow_service.calculate_arena_pool_summary(db, arena_id=arena_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate escrow pool: {str(e)}"
        )
