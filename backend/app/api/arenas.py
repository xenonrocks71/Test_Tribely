"""
Arena & Squad Chamber API Router.
Provides thin HTTP endpoints for community discovery, room creation,
drill-down details, ledger room inspection, member lists, and join/leave workflows.
Delegates all business orchestration, access checks, and data queries to ArenaService.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.services.arena_service import arena_service
from app.services.audit_service import audit_service
from app.schemas.schemas import (
    ApiSuccessResponse,
    ArenaCreate,
    ArenaResponse,
    DiscoveryJoinRequest
)

router = APIRouter(prefix="/api/arenas", tags=["Arenas"])


def success_response(data: Any) -> Dict[str, Any]:
    """Standardized API response envelope."""
    return {"status": "success", "data": data}


@router.get("/discovery/list", response_model=ApiSuccessResponse)
def discover_all_arenas(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Public Endpoint: Returns discoverable arenas with aggregated active member counts.
    """
    arenas = arena_service.get_discovery_arenas(db)
    return success_response(arenas)


@router.get("/{arena_id}", response_model=ApiSuccessResponse)
def get_arena_details(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dedicated Squad Detail Endpoint for /arenas/[id] Drill-Down View.
    Returns status ribbon metrics (deadline, current user status, sprint vault pot, multiplier)
    and member stories tray list with today's proof submission status.
    """
    details = arena_service.get_arena_details(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(details)


@router.get("/{arena_id}/ledger-room", response_model=ApiSuccessResponse)
def get_arena_ledger_room(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Real-Time Ledger Room Maintenance Endpoint.
    Returns 24-hour cycle timeline, enrolled member roster with timestamps,
    and verified double-entry ledger transactions.
    """
    ledger_room = arena_service.get_arena_ledger_room(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(ledger_room)


@router.post("/discovery/join")
def request_membership_gatekeeper(
    payload: DiscoveryJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Processes discovery feed join request.
    Instantly approves public arenas; holds private arenas pending admin approval.
    """
    result = arena_service.request_discovery_join(
        db,
        user=current_user,
        arena_id=payload.arena_id
    )
    return success_response(result)


@router.post("/", response_model=ApiSuccessResponse, status_code=status.HTTP_201_CREATED)
def create_new_arena(
    arena_in: ArenaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Creates a new micro-arena room configuration and maps authenticated user as Owner/Admin.
    """
    created_arena = arena_service.create_arena(db, arena_in=arena_in, creator_id=current_user.id)
    return success_response(ArenaResponse.model_validate(created_arena, from_attributes=True).model_dump())


@router.get("/", response_model=ApiSuccessResponse)
def list_my_arenas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves all accountability arenas the authenticated user has joined or created,
    sorted by recent activity (chat messages, proof submissions, join dates) descending.
    """
    arenas = arena_service.list_user_arenas_with_activity(db, user_id=current_user.id)
    return success_response(arenas)


@router.post("/join", response_model=ApiSuccessResponse)
@router.post("/join-by-code", response_model=ApiSuccessResponse)
def join_arena_by_code(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Looks up an arena by invite code or ID and creates an approved membership record.
    Supports /api/arenas/join and /api/arenas/join-by-code.
    """
    result = arena_service.join_by_code_or_id(db, user=current_user, payload=payload)
    return success_response(result)


@router.get("/{arena_id}/members", response_model=ApiSuccessResponse)
def get_arena_members_list(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Fetches all approved active members inside an arena alongside pre-calculated overlap metrics.
    """
    members = arena_service.get_arena_members_list(
        db,
        arena_id=arena_id,
        current_user_id=current_user.id
    )
    return success_response(members)


@router.post("/{arena_id}/leave")
def leave_arena(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Allows a user or admin to exit an arena room, auto-transferring ownership if admin.
    """
    result = arena_service.leave_arena(db, arena_id=arena_id, current_user_id=current_user.id)
    return success_response(result)


@router.post("/{arena_id}/join", response_model=ApiSuccessResponse)
def join_arena_direct(
    arena_id: int,
    payload: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Direct endpoint for joining an arena by ID, optionally validating an invite code.
    """
    merged_payload = {"arena_id": arena_id, **(payload or {})}
    result = arena_service.join_by_code_or_id(db, user=current_user, payload=merged_payload)
    return success_response(result)


@router.post("/{arena_id}/process-deadline", response_model=ApiSuccessResponse)
def process_arena_deadline(
    arena_id: int,
    target_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Triggers automated deadline processing for the specified Arena.
    Evaluates members who missed the daily submission, marks them absent,
    resets streaks to 0, and broadcasts WebSocket notices.
    Authorized for Arena Creator or Admins.
    """
    arena_service.verify_admin_access(db, arena_id=arena_id, user_id=current_user.id)
    summary = audit_service.audit_arena_deadline(db, arena_id=arena_id, target_date_str=target_date)
    return success_response(summary)