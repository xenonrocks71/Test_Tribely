"""
Admin Arena Management API Router.
Exposes thin HTTP endpoints for administrative membership requests moderation,
proof modality configuration, member kick, invite asset generation, settings updates,
and cascade arena deallocations.
Delegates all business policies, authorization, and data access to ArenaService.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.services.arena_service import arena_service
from app.schemas.schemas import (
    MembershipAction,
    UpdateProofTypeRequest,
    UpdateArenaSettingsRequest,
    ApiSuccessResponse
)

router = APIRouter(prefix="/api/admin/arenas", tags=["Admin Arena Management"])


def success_response(data: Any) -> Dict[str, Any]:
    """Standardized API response envelope."""
    return {"status": "success", "data": data}


@router.get("/{arena_id}/requests")
def get_pending_arena_requests(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Fetches pending membership requests for an arena room. Requires Admin privileges.
    """
    requests = arena_service.get_pending_arena_requests(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(requests)


@router.patch("/{arena_id}/proof-type")
def update_arena_proof_type(
    arena_id: int,
    payload: UpdateProofTypeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates the required proof verification modality ('text', 'link', or 'image').
    """
    result = arena_service.update_arena_proof_type(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id,
        proof_type=payload.proof_type
    )
    return success_response(result)


@router.post("/approve")
def approve_member(
    action: MembershipAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Approves a pending membership request and broadcasts a real-time event.
    """
    result = arena_service.approve_member(
        db,
        arena_id=action.arena_id,
        current_user_id=current_user.id,
        target_user_id=action.user_id
    )
    return success_response(result)


@router.post("/reject")
def reject_member(
    action: MembershipAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Rejects a pending membership request.
    """
    result = arena_service.reject_member(
        db,
        arena_id=action.arena_id,
        current_user_id=current_user.id,
        target_user_id=action.user_id
    )
    return success_response(result)


@router.post("/remove")
def remove_existing_member(
    action: MembershipAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Removes a member from an arena, promoting the next oldest member if the creator leaves.
    """
    result = arena_service.remove_member(
        db,
        arena_id=action.arena_id,
        current_user_id=current_user.id,
        target_user_id=action.user_id
    )
    return success_response(result)


@router.get("/{arena_id}/invite-assets")
def generate_invite_assets(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generates structured links and QR payload blocks for frontend presentation.
    """
    result = arena_service.generate_invite_assets(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(result)


@router.delete("/{arena_id}")
def delete_arena(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Permanently deletes an arena and cascades all associated activity records.
    """
    result = arena_service.delete_arena(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(result)


@router.patch("/{arena_id}/settings")
def update_arena_settings(
    arena_id: int,
    payload: UpdateArenaSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates general arena settings including DP icon URL, description, and habit cutoff.
    """
    result = arena_service.update_arena_settings(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id,
        payload=payload
    )
    return success_response(result)