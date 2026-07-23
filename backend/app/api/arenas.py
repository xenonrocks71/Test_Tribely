from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, ArenaMembership, User

from typing import List, Dict, Any
from pydantic import BaseModel

from app.schemas.schemas import ApiSuccessResponse, ArenaCreate, ArenaResponse, MembershipCreate, MembershipResponse
from app.crud import crud_arena

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
    """
    try:
        counts_query = db.query(
            ArenaMembership.arena_id, 
            func.count(ArenaMembership.id).label("total_members")
        ).filter(ArenaMembership.status == "approved").group_by(ArenaMembership.arena_id).all()
        
        counts_map = {row.arena_id: row.total_members for row in counts_query}
        arenas = db.query(Arena).all()

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
    """
    try:
        arena = db.query(Arena).filter(Arena.id == payload.arena_id).first()
        if not arena:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "message": "Target arena room layout missing.",
                    "error_code": "ARENA_NOT_FOUND",
                },
            )

        existing = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == payload.arena_id,
            ArenaMembership.user_id == current_user.id
        ).first()

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

        assigned_status = "pending" if arena.is_private else "approved"
        
        new_member = ArenaMembership(
            user_id=current_user.id,
            arena_id=payload.arena_id,
            status=assigned_status,
            role="member"
        )
        
        db.add(new_member)
        db.commit()

        return success_response({
            "room_state": assigned_status,
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
    Creates a new micro-arena room configuration and maps the authenticated user as Owner/Admin.
    """
    created_arena = crud_arena.create_arena(db, arena_in=arena_in, creator_id=current_user.id)
    return success_response(ArenaResponse.model_validate(created_arena, from_attributes=True).model_dump())

@router.post("/join", response_model=ApiSuccessResponse)
def join_arena_by_invite(payload: MembershipCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Joins an existing arena using its auto-generated 6-character alphanumeric invite code.
    """
    arena = crud_arena.get_arena_by_invite_code(db, invite_code=payload.invite_code)
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "error",
                "message": "The invite code provided does not match any active Arena.",
                "error_code": "ARENA_INVITE_NOT_FOUND",
            },
        )
    
    membership = crud_arena.join_arena_by_code(db, user_id=current_user.id, arena_id=arena.id)
    return success_response(MembershipResponse.model_validate(membership, from_attributes=True).model_dump())

@router.get("/", response_model=ApiSuccessResponse)
def list_my_arenas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves all accountability arenas the authenticated user has joined or created,
    including their membership status and role.
    """
    memberships = db.query(ArenaMembership).filter(ArenaMembership.user_id == current_user.id).all()
    membership_map = {m.arena_id: m for m in memberships}
    
    arena_ids = list(membership_map.keys())
    arenas = db.query(Arena).filter(Arena.id.in_(arena_ids)).all() if arena_ids else []
    
    arena_payload = []
    for arena in arenas:
        item = ArenaResponse.model_validate(arena, from_attributes=True).model_dump()
        mem = membership_map.get(arena.id)
        item["membership_status"] = mem.status if mem else "approved"
        item["user_role"] = mem.role if mem else ("admin" if arena.creator_id == current_user.id else "member")
        arena_payload.append(item)

    return success_response(arena_payload)

@router.post("/join-by-code", response_model=ApiSuccessResponse)
def join_arena_by_code(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Looks up an arena by its 6-character invite code and creates a membership record.
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
        
    arena = db.query(Arena).filter(Arena.invite_code == invite_code).first()
    if not arena:
        raise HTTPException(
            status_code=404,
            detail={
                "status": "error",
                "message": "No active Arena room matches this invitation key.",
                "error_code": "ARENA_INVITE_NOT_FOUND",
            },
        )
        
    existing_membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == arena.id,
        ArenaMembership.user_id == current_user.id
    ).first()
    
    if existing_membership:
        if existing_membership.status == "approved":
            return success_response({"detail": "You are already an approved member of this arena.", "arena_id": arena.id, "membership_status": "approved"})
        return success_response({"detail": "Your join request is still pending admin approval.", "arena_id": arena.id, "membership_status": "pending"})
        
    initial_status = "pending" if arena.is_private else "approved"
    new_membership = ArenaMembership(
        arena_id=arena.id,
        user_id=current_user.id,
        status=initial_status,
        role="member"
    )
    db.add(new_membership)
    db.commit()
    
    msg = "Join request submitted successfully. Awaiting admin approval." if initial_status == "pending" else "Joined arena successfully."
    return success_response({"detail": msg, "arena_id": arena.id, "membership_status": initial_status})

@router.get("/{arena_id}/members", response_model=ApiSuccessResponse)
def get_arena_members_list(arena_id: int, db: Session = Depends(get_db)):
    """
    Fetches all approved active members inside an arena room alongside 
    pre-calculated total arena room overlap metrics (Common Arenas count).
    """
    try:
        memberships = db.query(ArenaMembership)\
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")\
            .options(joinedload(ArenaMembership.user))\
            .all()

        results = []
        for member in memberships:
            if not member.user:
                continue
                
            common_count = db.query(ArenaMembership)\
                .filter(ArenaMembership.user_id == member.user_id, ArenaMembership.status == "approved")\
                .count()

            results.append({
                "user_id": member.user_id,
                "full_name": member.user.full_name,
                "email": member.user.email,
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
    If the leaving user is an admin/creator, ownership automatically transfers 
    to the next oldest member who joined the room.
    """
    try:
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "message": "Arena room not found.",
                    "error_code": "ARENA_NOT_FOUND"
                }
            )

        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id
        ).first()

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

        # Delete outgoing user's membership
        db.delete(membership)
        db.flush()

        if is_leaving_admin:
            # Find the next oldest approved member who joined right after
            next_successor = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.status == "approved",
                ArenaMembership.user_id != current_user.id
            ).order_by(ArenaMembership.id.asc()).first()

            if next_successor:
                # Transfer primary admin rights & creator ownership seamlessly
                next_successor.role = "admin"
                arena.creator_id = next_successor.user_id
                message = f"You exited the arena. Admin ownership transferred to User #{next_successor.user_id}."
            else:
                # If no members remain, delete the arena room cleanly
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