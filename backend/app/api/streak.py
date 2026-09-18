"""
Streak & Gamification API Router.
Exposes user habit streak counters and achievement badge tiers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.services.streak_service import streak_service

router = APIRouter(prefix="/api/activity/streak", tags=["Streaks & Gamification"])


@router.get("/{arena_id}", response_model=Dict[str, Any])
def get_user_arena_streak(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get current user habit streak and badge tier for an arena.

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

