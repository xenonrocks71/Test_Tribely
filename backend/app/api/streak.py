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
    Atomically deducts a shield from the user's wallet, records the protection
    in DailyArenaSheet and ArenaLogbook, and broadcasts the event live to the arena.
    """
    import datetime
    from app.models.models import UserWallet, DailyArenaSheet, ArenaLogbook
    from app.api.websocket import manager as websocket_manager

    # 1. Lock user wallet to prevent race condition
    wallet = db.query(UserWallet).filter(UserWallet.user_id == current_user.id).with_for_update().first()
    if not wallet or wallet.streak_shields <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Streak Shields available in your wallet to freeze your streak."
        )

    # 2. Check if today is already shielded
    today_str = datetime.date.today().isoformat()
    existing_sheet = db.query(DailyArenaSheet).filter(
        DailyArenaSheet.arena_id == payload.arena_id,
        DailyArenaSheet.user_id == current_user.id,
        DailyArenaSheet.date_day == today_str
    ).first()

    if existing_sheet and existing_sheet.status == "shielded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your streak for today is already protected by an active shield."
        )

    # 3. Deduct shield and record protection
    wallet.streak_shields -= 1

    if existing_sheet:
        existing_sheet.status = "shielded"
        existing_sheet.proof_type = "shield"
    else:
        new_sheet = DailyArenaSheet(
            arena_id=payload.arena_id,
            user_id=current_user.id,
            date_day=today_str,
            status="shielded",
            proof_type="shield"
        )
        db.add(new_sheet)

    # 4. Record audit entry in Arena Logbook
    logbook_entry = ArenaLogbook(
        arena_id=payload.arena_id,
        user_id=current_user.id,
        entry_type="streak_shield_used",
        description="Emergency streak shield activated: protected from today's deadline slash."
    )
    db.add(logbook_entry)
    db.commit()

    # 5. Invalidate streak cache
    streak_service.invalidate_streak_cache(current_user.id, payload.arena_id)

    # 6. Real-time broadcast to arena members
    try:
        websocket_manager.safe_broadcast_to_arena(payload.arena_id, {
            "event_type": "streak_shield_activated",
            "arena_id": payload.arena_id,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "date_day": today_str
        })
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Streak Shield activated! Your streak is protected for today.",
        "remaining_shields": wallet.streak_shields,
        "shield_active": True,
    }
