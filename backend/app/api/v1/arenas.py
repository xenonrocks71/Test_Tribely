"""
Arena Kudos Economy & Gamified Staking Endpoints (API v1).
Provides high-scale atomic staking upon join, missed-deadline penalties,
weekly 50% reward redistribution, live Redis-cached prize pools, and consistency leaderboards.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.services.kudos_service import kudos_service
from app.schemas.schemas import (
    ArenaJoinStakeRequest,
    ArenaJoinStakeResponse,
    PenaltyMissedResponse,
    WeeklyDistributionResponse,
    LeaderboardMemberResponse,
    ArenaPoolDetailsResponse
)

router = APIRouter(prefix="/arenas", tags=["Arena Kudos Staking & Economy (v1)"])


class PenalizeUserRequest(BaseModel):
    user_id: int = Field(..., description="ID of the user to penalize for missed deadline")


@router.post("/{arena_id}/join", response_model=ArenaJoinStakeResponse)
def join_arena_with_stake(
    arena_id: int,
    payload: Optional[ArenaJoinStakeRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ArenaJoinStakeResponse:
    """
    Stakes required Kudos from user's balance into the arena pool and enrolls the user.
    Enforces atomic ACID isolation via database row locks and updates Redis live cache.
    Returns 400 if user balance is insufficient.
    Returns 409 if user is already an approved member.
    """
    invite_code = payload.invite_code if payload else None
    result = kudos_service.join_arena_with_stake(
        db=db,
        user_id=current_user.id,
        arena_id=arena_id,
        invite_code=invite_code
    )
    return ArenaJoinStakeResponse(**result)


@router.post("/{arena_id}/penalize-missed", response_model=PenaltyMissedResponse)
def penalize_missed_deadline(
    arena_id: int,
    payload: PenalizeUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> PenaltyMissedResponse:
    """
    Automated audit / admin endpoint to penalize a user for a missed deadline.
    Deducts the arena penalty fine from the user, credits it to the arena prize pool,
    resets the user's consecutive streak count to 0, and logs a DEADLINE_PENALTY transaction.
    """
    result = kudos_service.penalize_missed_deadline(
        db=db,
        arena_id=arena_id,
        user_id=payload.user_id
    )
    return PenaltyMissedResponse(**result)


@router.post("/{arena_id}/distribute-weekly", response_model=WeeklyDistributionResponse)
def distribute_weekly_rewards(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> WeeklyDistributionResponse:
    """
    Automated weekly cron trigger (executed Sunday midnight).
    Calculates 50% of the current arena prize pool and distributes it equally among
    the top 3 most consistent participants based on active streak and verified submissions.
    Caches winners in Redis with a 7-day TTL and emits real-time WebSocket notifications.
    """
    result = kudos_service.distribute_weekly_rewards(
        db=db,
        arena_id=arena_id
    )
    return WeeklyDistributionResponse(**result)


@router.get("/{arena_id}/pool", response_model=ArenaPoolDetailsResponse)
def get_arena_pool_details(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ArenaPoolDetailsResponse:
    """
    Retrieves live arena pool balance, entry stake, penalty amount, weekly prize pool (50%),
    and recent winners. Reads directly from Redis cache with automatic DB fallback.
    """
    result = kudos_service.get_arena_pool_details(
        db=db,
        arena_id=arena_id
    )
    return ArenaPoolDetailsResponse(**result)


@router.get("/{arena_id}/leaderboard", response_model=List[LeaderboardMemberResponse])
def get_arena_consistency_leaderboard(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[LeaderboardMemberResponse]:
    """
    Retrieves consistency leaderboard ranked by streak count and verified submissions.
    Includes podium badges (🥇, 🥈, 🥉) and projected weekly Kudos payouts for top performers.
    """
    result = kudos_service.get_arena_leaderboard(
        db=db,
        arena_id=arena_id
    )
    return [LeaderboardMemberResponse(**m) for m in result]
