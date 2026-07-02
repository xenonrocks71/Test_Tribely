from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.models import User, Arena, UserProfile # Ensure Arena model is imported here

router = APIRouter(prefix="/users", tags=["User Profiles"])


def success_response(data):
    return {"status": "success", "data": data}

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileImageUpdateRequest(BaseModel):
    profile_image_url: str


def get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.get("/profile/{user_id}")
def get_user_profile(user_id: int, arena_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retrieves the logged-in user's profile metadata and dynamically computes 
    their access tier role (Admin vs Member) based on an optional context arena_id.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail={"status": "error", "message": "User target not found.", "error_code": "USER_NOT_FOUND"})

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
    role = "Member"
    if arena_id:
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if arena and arena.creator_id == user_id:
            role = "Admin"

    return success_response({
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "profile_image_url": profile.profile_image_url if profile else None,
        "contextual_role": role
    })


@router.put("/profile/image")
def update_profile_image(
    payload: ProfileImageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_or_create_profile(db, current_user.id)
    profile.profile_image_url = payload.profile_image_url.strip() or None
    db.commit()
    db.refresh(profile)
    return success_response({"profile_image_url": profile.profile_image_url})

@router.post("/profile/change-password")
def change_user_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Handles secure password update mutations.
    """
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail={"status": "error", "message": "Current credential password mismatch verification.", "error_code": "PASSWORD_CURRENT_MISMATCH"})

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return success_response({"message": "Password changed flawlessly."})


@router.delete("/profile")
def delete_user_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    return success_response({"message": "Account deleted successfully.", "user_id": user_id})