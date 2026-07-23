import secrets
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, ArenaMembership, User

router = APIRouter(prefix="/api/admin/arenas", tags=["Admin Arena Management"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}

class MembershipAction(BaseModel):
    user_id: int
    arena_id: int

class UpdateProofTypeRequest(BaseModel):
    proof_type: str

@router.get("/{arena_id}/requests")
def get_pending_arena_requests(arena_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetches pending membership requests and eagerly loads user full names.
    """
    try:
        arena = db.query(Arena).filter(
            Arena.id == arena_id, 
            (Arena.creator_id == current_user.id)
        ).first()
        if not arena:
            raise HTTPException(
                status_code=403,
                detail={
                    "status": "error",
                    "message": "Unauthorized Admin access.",
                    "error_code": "ADMIN_ARENA_FORBIDDEN",
                },
            )

        requests = db.query(ArenaMembership)\
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "pending")\
            .options(joinedload(ArenaMembership.user))\
            .all()
            
        return success_response([
            {
                "id": req.id,
                "user_id": req.user_id,
                "arena_id": req.arena_id,
                "status": req.status,
                # Safe lookups to fall back cleanly if user record is missing
                "user_name": req.user.full_name if (req.user and getattr(req.user, 'full_name', None)) else f"Member #{req.user_id}"
            } for req in requests
        ])
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": str(e),
                "error_code": "ADMIN_ARENA_REQUESTS_FAILED",
            },
        )

@router.patch("/{arena_id}/proof-type")
def update_arena_proof_type(
    arena_id: int,
    payload: UpdateProofTypeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the strictly required proof verification type for an arena.
    """
    try:
        # Check admin privileges via Arena creator or explicit admin membership
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

        admin_membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id,
            ArenaMembership.role == "admin"
        ).first()

        if arena.creator_id != current_user.id and not admin_membership:
            raise HTTPException(
                status_code=403,
                detail={
                    "status": "error",
                    "message": "Unauthorized Admin access.",
                    "error_code": "ADMIN_ARENA_FORBIDDEN"
                }
            )

        if payload.proof_type not in ["text", "link", "image"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "message": "Invalid proof type specified. Choose 'text', 'link', or 'image'.",
                    "error_code": "INVALID_PROOF_TYPE"
                }
            )

        arena.proof_type = payload.proof_type
        db.commit()

        return success_response({
            "message": "Arena proof verification type updated successfully.",
            "proof_type": arena.proof_type
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Failed updating proof type: {str(e)}",
                "error_code": "UPDATE_PROOF_TYPE_FAILED"
            }
        )

@router.post("/approve")
def approve_member(action: MembershipAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    arena = db.query(Arena).filter(Arena.id == action.arena_id, Arena.creator_id == current_user.id).first()
    if not arena:
        raise HTTPException(status_code=403, detail="Unauthorized Admin access.")
        
    membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == action.arena_id, 
        ArenaMembership.user_id == action.user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail={"status": "error", "message": "Membership token record not found.", "error_code": "ADMIN_MEMBERSHIP_NOT_FOUND"})
        
    membership.status = "approved"
    db.commit()
    return success_response({"detail": "Member approved successfully."})

@router.post("/reject")
def reject_member(action: MembershipAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    arena = db.query(Arena).filter(Arena.id == action.arena_id, Arena.creator_id == current_user.id).first()
    if not arena:
        raise HTTPException(status_code=403, detail="Unauthorized Admin access.")
        
    membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == action.arena_id, 
        ArenaMembership.user_id == action.user_id
    ).first()
    
    if membership:
        db.delete(membership)
        db.commit()
    return success_response({"detail": "Membership request rejected successfully."})

@router.post("/remove")
def remove_existing_member(
    action: MembershipAction, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Removes a member from an arena. If an admin removes themselves or another admin,
    the next oldest member is promoted automatically.
    """
    arena = db.query(Arena).filter(Arena.id == action.arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=404, 
            detail={"status": "error", "message": "Arena room not found.", "error_code": "ARENA_NOT_FOUND"}
        )

    # Verify authorization
    admin_membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == action.arena_id,
        ArenaMembership.user_id == current_user.id,
        ArenaMembership.role == "admin"
    ).first()

    if arena.creator_id != current_user.id and not admin_membership:
        raise HTTPException(
            status_code=403, 
            detail={"status": "error", "message": "Unauthorized Admin access.", "error_code": "ADMIN_ARENA_FORBIDDEN"}
        )

    target_membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == action.arena_id, 
        ArenaMembership.user_id == action.user_id
    ).first()
    
    if not target_membership:
        raise HTTPException(
            status_code=404, 
            detail={"status": "error", "message": "Target member not found.", "error_code": "MEMBER_NOT_FOUND"}
        )

    is_creator_removed = (arena.creator_id == action.user_id)

    db.delete(target_membership)
    db.flush()

    if is_creator_removed:
        next_successor = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == action.arena_id,
            ArenaMembership.status == "approved"
        ).order_by(ArenaMembership.id.asc()).first()

        if next_successor:
            next_successor.role = "admin"
            arena.creator_id = next_successor.user_id
        else:
            db.delete(arena)

    db.commit()
    return success_response({"detail": "Member removed and admin roles adjusted seamlessly."})

@router.get("/{arena_id}/invite-assets")
def generate_invite_assets(arena_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generates cryptographically structured links and QR data mapping blocks for frontend compilation.
    """
    arena = db.query(Arena).filter(Arena.id == arena_id, Arena.creator_id == current_user.id).first()
    if not arena:
        raise HTTPException(status_code=403, detail={"status": "error", "message": "Unauthorized Admin access.", "error_code": "ADMIN_ARENA_FORBIDDEN"})
        
    base_url = "http://localhost:3000/arena/join"
    invite_link = f"{base_url}?code={arena.invite_code}"
    
    # QR code structures are passed as structured raw values to be generated on the frontend
    return success_response({
        "invite_code": arena.invite_code,
        "invite_link": invite_link,
        "qr_payload_string": f"TRIBELY_INVITE:{arena.invite_code}"
    })