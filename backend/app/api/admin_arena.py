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

@router.get("/arenas/{arena_id}/requests")
def get_pending_arena_requests(arena_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetches pending membership requests and eagerly loads user full names.
    """
    try:
        arena = db.query(Arena).filter(Arena.id == arena_id, Arena.creator_id == current_user.id).first()
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
def remove_existing_member(action: MembershipAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    arena = db.query(Arena).filter(Arena.id == action.arena_id, Arena.creator_id == current_user.id).first()
    if not arena:
        raise HTTPException(status_code=403, detail={"status": "error", "message": "Unauthorized Admin access.", "error_code": "ADMIN_ARENA_FORBIDDEN"})
        
    if action.user_id == current_user.id:
        raise HTTPException(status_code=400, detail={"status": "error", "message": "Admins cannot remove themselves from their own arena.", "error_code": "ADMIN_SELF_REMOVE_FORBIDDEN"})

    membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == action.arena_id, 
        ArenaMembership.user_id == action.user_id
    ).first()
    
    if membership:
        db.delete(membership)
        db.commit()
    return success_response({"detail": "Member removed from Arena successfully."})

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