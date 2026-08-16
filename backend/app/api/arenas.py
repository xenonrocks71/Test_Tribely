from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import datetime
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, ArenaMembership, User, Message, Submission, UserWallet, ArenaPool, EscrowLedger

from typing import List, Dict, Any
from pydantic import BaseModel

from app.schemas.schemas import ApiSuccessResponse, ArenaCreate, ArenaResponse, MembershipCreate, MembershipResponse
from app.services.arena_service import arena_service
from app.repositories.arena_repository import arena_repository
from app.services.ledger_service import ledger_service

router = APIRouter(prefix="/api/arenas", tags=["Arenas"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}

class DiscoveryJoinRequest(BaseModel):
    arena_id: int

# ==========================================
#         NEW PUBLIC DISCOVERY ROUTES
# ==========================================

@router.get("/discovery/list", response_model=ApiSuccessResponse)
def discover_all_arenas(db: Session = Depends(get_db)):
    """
    Public Endpoint: Returns public and private arena information coupled 
    with real-time total member counts for landing page exploration.
    Delegates to ArenaRepository and ArenaService.
    """
    try:
        counts_query = db.query(
            ArenaMembership.arena_id, 
            func.count(ArenaMembership.id).label("total_members")
        ).filter(ArenaMembership.status == "approved").group_by(ArenaMembership.arena_id).all()
        
        counts_map = {row.arena_id: row.total_members for row in counts_query}
        arenas = arena_repository.get_multi(db, skip=0, limit=200)

        results = []
        for arena in arenas:
            results.append({
                "id": arena.id,
                "name": arena.name,
                "description": arena.description,
                "invite_code": arena.invite_code,
                "is_private": arena.is_private,
                "proof_type": arena.proof_type,
                "penalty_amount": float(arena.penalty_amount or 0.00),
                "deadline_time": arena.deadline_time,
                "member_count": counts_map.get(arena.id, 0)
            })
            
        return success_response(results)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Failed compiling room landing matrix: {str(e)}",
                "error_code": "ARENA_DISCOVERY_LIST_FAILED",
            },
        )


@router.post("/discovery/join")
def request_membership_gatekeeper(
    payload: DiscoveryJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Binds visitors to arenas. Instantly approves public entry,
    while holding private room entries as 'pending' for admin approval.
    Delegates validation and persistence to ArenaService.
    """
    try:
        arena = arena_service.get_arena_by_id(db, arena_id=payload.arena_id)
        existing = arena_repository.get_membership(db, user_id=current_user.id, arena_id=payload.arena_id)

        if existing:
            if existing.status == "approved":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "message": "You are already an approved member inside this arena.",
                        "error_code": "ARENA_MEMBERSHIP_ALREADY_APPROVED",
                    },
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "message": "Your join authorization is currently pending evaluation.",
                        "error_code": "ARENA_MEMBERSHIP_PENDING",
                    },
                )

        membership = arena_service.join_arena(db, user_id=current_user.id, arena_id=payload.arena_id)

        # Broadcast real-time WebSocket notification so admin sees pending join request instantly
        from app.core.managers.websocket_manager import websocket_manager
        join_payload = {
            "event_type": "join_request_created",
            "arena_id": arena.id,
            "user_id": current_user.id,
            "user_name": current_user.full_name or f"Member #{current_user.id}",
            "status": membership.status,
            "is_private": arena.is_private,
        }
        websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)

        return success_response({
            "room_state": membership.status,
            "is_private": arena.is_private,
            "message": "Access request logged cleanly under rule frameworks.",
        })

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Gatekeeper core tracking script execution failed: {str(e)}",
                "error_code": "ARENA_DISCOVERY_JOIN_FAILED",
            },
        )


# ==========================================
#         EXISTING WORKING ROUTES
# ==========================================

@router.post("/", response_model=ApiSuccessResponse, status_code=status.HTTP_201_CREATED)
def create_new_arena(arena_in: ArenaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Creates a new micro-arena room configuration and maps authenticated user as Owner/Admin.
    Delegates domain creation to ArenaService.
    """
    created_arena = arena_service.create_arena(db, arena_in=arena_in, creator_id=current_user.id)
    return success_response(ArenaResponse.model_validate(created_arena, from_attributes=True).model_dump())

@router.post("/join", response_model=ApiSuccessResponse)
def join_arena_by_invite(payload: MembershipCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Joins an existing arena using auto-generated 6-character alphanumeric invite code.
    Delegates to ArenaService.
    """
    membership = arena_service.join_by_invite_code(db, user_id=current_user.id, invite_code=payload.invite_code)
    arena = arena_service.get_arena_by_id(db, arena_id=membership.arena_id)
    return success_response({
        "membership": MembershipResponse.model_validate(membership, from_attributes=True).model_dump(),
        "arena": ArenaResponse.model_validate(arena, from_attributes=True).model_dump(),
        "id": arena.id,
        "detail": f"Successfully joined {arena.name}!"
    })


@router.get("/", response_model=ApiSuccessResponse)
def list_my_arenas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves all accountability arenas the authenticated user has joined or created,
    sorted by recent activity (chat messages, proof submissions, join dates) descending (WhatsApp order).
    Optimized to O(1) query complexity to prevent N+1 query bottlenecks.
    """
    memberships = db.query(ArenaMembership).filter(ArenaMembership.user_id == current_user.id).all()
    membership_map = {m.arena_id: m for m in memberships}
    
    arena_ids = list(membership_map.keys())
    arenas = db.query(Arena).filter(Arena.id.in_(arena_ids)).all() if arena_ids else []
    
    # Efficient O(1) batch query optimization to eliminate N+1 loop queries
    latest_messages: Dict[int, Message] = {}
    latest_submissions: Dict[int, Submission] = {}
    
    if arena_ids:
        all_msgs = (
            db.query(Message)
            .filter(Message.arena_id.in_(arena_ids))
            .options(joinedload(Message.user))
            .order_by(Message.arena_id, Message.created_at.desc())
            .all()
        )
        for msg in all_msgs:
            if msg.arena_id not in latest_messages:
                latest_messages[msg.arena_id] = msg

        all_subs = (
            db.query(Submission)
            .filter(Submission.arena_id.in_(arena_ids))
            .options(joinedload(Submission.user))
            .order_by(Submission.arena_id, Submission.submitted_at.desc())
            .all()
        )
        for sub in all_subs:
            if sub.arena_id not in latest_submissions:
                latest_submissions[sub.arena_id] = sub

    arena_payload = []
    for arena in arenas:
        item = ArenaResponse.model_validate(arena, from_attributes=True).model_dump()
        mem = membership_map.get(arena.id)
        item["membership_status"] = mem.status if mem else "approved"
        item["user_role"] = mem.role if mem else ("admin" if arena.creator_id == current_user.id else "member")

        latest_msg = latest_messages.get(arena.id)
        latest_sub = latest_submissions.get(arena.id)

        msg_time = latest_msg.created_at if latest_msg else None
        sub_time = latest_sub.submitted_at if latest_sub else None
        mem_time = mem.joined_at if (mem and getattr(mem, 'joined_at', None)) else arena.created_at

        # Calculate latest activity timestamp
        valid_times = [t for t in [msg_time, sub_time, mem_time, arena.created_at] if t is not None]
        last_activity_dt = max(valid_times) if valid_times else arena.created_at

        # Formulate last activity preview snippet (WhatsApp style)
        snippet = "No recent activity"
        if latest_msg and (not sub_time or latest_msg.created_at >= sub_time):
            sender_name = latest_msg.user.full_name.split()[0] if (latest_msg.user and getattr(latest_msg.user, 'full_name', None)) else "Member"
            snippet = f"💬 {sender_name}: {latest_msg.content[:36]}{'...' if len(latest_msg.content) > 36 else ''}"
        elif latest_sub:
            sub_name = latest_sub.user.full_name.split()[0] if (latest_sub.user and getattr(latest_sub.user, 'full_name', None)) else "Member"
            snippet = f"📸 {sub_name} submitted daily proof"
        elif mem:
            snippet = "Active in chamber"

        item["last_activity_at"] = last_activity_dt.isoformat() if last_activity_dt else None
        item["last_activity_snippet"] = snippet
        arena_payload.append(item)

    # Sort WhatsApp-style: most recent activity at the top!
    arena_payload.sort(key=lambda x: x.get("last_activity_at") or "", reverse=True)

    return success_response(arena_payload)

@router.post("/join-by-code", response_model=ApiSuccessResponse)
def join_arena_by_code(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Looks up an arena by code and creates a membership record.
    """
    invite_code = payload.get("invite_code", "").strip().upper()
    if not invite_code:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "message": "Invite code is required.",
                "error_code": "ARENA_INVITE_CODE_REQUIRED",
            },
        )
        
    arena = arena_repository.get_by_invite_code(db, invite_code=invite_code)
    if not arena:
        raise HTTPException(
            status_code=404,
            detail={
                "status": "error",
                "message": "No active Arena room matches this invitation key.",
                "error_code": "ARENA_INVITE_NOT_FOUND",
            },
        )
        
    existing_membership = arena_repository.get_membership(db, user_id=current_user.id, arena_id=arena.id)
    
    if existing_membership:
        if existing_membership.status == "approved":
            return success_response({"detail": "You are already an approved member of this arena.", "arena_id": arena.id, "membership_status": "approved"})
        return success_response({"detail": "Your join request is still pending admin approval.", "arena_id": arena.id, "membership_status": "pending"})
        
    membership = arena_service.join_arena(db, user_id=current_user.id, arena_id=arena.id)
    
    # Broadcast real-time join_request event safely
    from app.core.managers.websocket_manager import websocket_manager
    join_payload = {
        "event_type": "join_request",
        "arena_id": arena.id,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "status": membership.status
    }
    websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)

    msg = "Join request submitted successfully. Awaiting admin approval." if membership.status == "pending" else "Joined arena successfully."
    return success_response({"detail": msg, "arena_id": arena.id, "membership_status": membership.status})

@router.get("/{arena_id}/members", response_model=ApiSuccessResponse)
def get_arena_members_list(arena_id: int, db: Session = Depends(get_db)):
    """
    Fetches all approved active members inside an arena room alongside 
    pre-calculated total arena room overlap metrics.
    Optimized with SQL group-by aggregation to prevent loop queries.
    """
    try:
        memberships = db.query(ArenaMembership)\
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")\
            .options(joinedload(ArenaMembership.user))\
            .all()

        arena_obj = db.query(Arena).filter(Arena.id == arena_id).first()
        creator_id = arena_obj.creator_id if arena_obj else None

        user_ids = [member.user_id for member in memberships if member.user]
        counts_map = {}
        if user_ids:
            counts_query = (
                db.query(
                    ArenaMembership.user_id,
                    func.count(ArenaMembership.id).label("cnt")
                )
                .filter(
                    ArenaMembership.user_id.in_(user_ids),
                    ArenaMembership.status == "approved"
                )
                .group_by(ArenaMembership.user_id)
                .all()
            )
            counts_map = {row.user_id: row.cnt for row in counts_query}

        results = []
        for member in memberships:
            if not member.user:
                continue
                
            common_count = counts_map.get(member.user_id, 1)

            results.append({
                "user_id": member.user_id,
                "user_name": member.user.full_name,
                "full_name": member.user.full_name,
                "email": member.user.email,
                "role": member.role or ("admin" if member.user_id == creator_id else "member"),
                "common_arenas_count": common_count
            })

        return success_response(results)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": str(e),
                "error_code": "ARENA_MEMBERS_LIST_FAILED",
            },
        )

@router.post("/{arena_id}/leave")
def leave_arena(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows a user/admin to leave an arena room. 
    Transfers ownership if leaving user is admin/creator.
    """
    try:
        arena = arena_service.get_arena_by_id(db, arena_id=arena_id)

        membership = arena_repository.get_membership(db, user_id=current_user.id, arena_id=arena_id)

        if not membership:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "message": "No active membership record found for this user.",
                    "error_code": "MEMBERSHIP_NOT_FOUND"
                }
            )

        is_leaving_admin = (arena.creator_id == current_user.id or membership.role == "admin")

        db.delete(membership)
        db.flush()

        if is_leaving_admin:
            next_successor = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.status == "approved",
                ArenaMembership.user_id != current_user.id
            ).order_by(ArenaMembership.id.asc()).first()

            if next_successor:
                next_successor.role = "admin"
                arena.creator_id = next_successor.user_id
                message = f"You exited the arena. Admin ownership transferred to User #{next_successor.user_id}."
            else:
                db.delete(arena)
                message = "You exited the arena. Room deleted as no members remained."
        else:
            message = "Successfully exited the arena room."

        db.commit()

        return success_response({
            "message": message
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Failed leaving the arena room: {str(e)}",
                "error_code": "LEAVE_ARENA_FAILED"
            }
        )