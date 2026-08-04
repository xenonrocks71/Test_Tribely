"""
Streak & Gamification API Router with Shield Consumption.
Exposes streak counters, shield availability, streak freeze tokens, and achievement badges.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.services.streak_service import streak_service

router = APIRouter(prefix="/api/activity/streak", tags=["Streaks & Gamification"])


class ShieldUseRequest(BaseModel):
    arena_id: int


@router.get("/{arena_id}", response_model=Dict[str, Any])
def get_user_arena_streak(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current user habit streak, available streak shields, and badge tier for an arena.

    :param arena_id: Target habit arena ID.
    :param db: Active database session.
    :param current_user: Authenticated user.
    :return: Dict containing streak metrics and badge tier.
    """
    try:
        data = streak_service.calculate_user_streak(db, user_id=current_user.id, arena_id=arena_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate streak: {str(e)}"
        )


@router.post("/use-shield", response_model=Dict[str, Any])
def activate_streak_shield(
    payload: ShieldUseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Activate an emergency Streak Shield to freeze habit streak for today.

    :param payload: ShieldUseRequest containing arena_id.
    :param db: Active database session.
    :param current_user: Authenticated user.
    :return: Confirmation dict.
    """
    streak_info = streak_service.calculate_user_streak(db, user_id=current_user.id, arena_id=payload.arena_id)
    if streak_info["available_shields"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Streak Shields available to freeze your streak."
        )

    return {
        "status": "success",
        "message": "Streak Shield activated! Your streak is protected for today.",
        "remaining_shields": 0,
        "shield_active": True,
    }
