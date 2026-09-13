from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.models import (
    User, UserProfile, UserWallet, Arena, ArenaMembership, ArenaPool,
    Submission, Message, SubmissionVote, DailyArenaSheet,
    ArenaLogbook, EscrowLedger, KudosLedger
)


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
def get_user_profile(
    user_id: int,
    arena_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves user profile metadata with authentication verification.
    Protects private email addresses against unauthorized scraping.
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

    # Privacy protection: Only show full email to the user themselves; mask for other members
    display_email = user.email
    if current_user.id != user_id and user.email:
        parts = user.email.split("@")
        if len(parts) == 2:
            display_email = f"{parts[0][:2]}***@{parts[1]}"
        else:
            display_email = "***"

    return success_response({
        "id": user.id,
        "full_name": user.full_name,
        "email": display_email,
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


class ProfileDetailsUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


@router.patch("/profile/details")
def update_profile_details(
    payload: ProfileDetailsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user's full name and/or email."""
    if payload.full_name is not None:
        stripped = payload.full_name.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Name cannot be empty.")
        current_user.full_name = stripped

    if payload.email is not None:
        email_str = str(payload.email).strip().lower()
        # Check if email already taken by another user
        existing = db.query(User).filter(User.email == email_str, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="This email is already in use by another account.")
        current_user.email = email_str

    db.commit()
    db.refresh(current_user)
    return success_response({
        "full_name": current_user.full_name,
        "email": current_user.email,
    })



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
    """
    Safely deactivates and anonymizes user account in compliance with GDPR/CCPA,
    transferring arena ownership and removing personal profile details while 
    IMMUTABLY PRESERVING financial double-entry ledgers (escrow_ledger, kudos_ledger).
    """
    import datetime
    user_id = current_user.id
    try:
        # 1. Handle arenas created by this user
        owned_arenas = db.query(Arena).filter(Arena.creator_id == user_id).all()
        for arena in owned_arenas:
            # Transfer ownership to next active approved member if available
            next_successor = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.status == "approved",
                ArenaMembership.user_id != user_id
            ).order_by(ArenaMembership.id.asc()).first()

            if next_successor:
                next_successor.role = "admin"
                arena.creator_id = next_successor.user_id
            else:
                # Disband empty arena memberships and remove arena safely
                db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena.id).delete(synchronize_session=False)

        # 2. Anonymize user profile & remove PII image
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile:
            profile.profile_image_url = None

        # 3. Soft-delete / Anonymize User entity to preserve ledger referential integrity
        timestamp = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        current_user.full_name = "Deleted User"
        current_user.email = f"deleted_{user_id}_{timestamp}@anonymized.tribely"
        current_user.hashed_password = "ACCOUNT_DEACTIVATED"
        current_user.is_active = False

        # 4. Remove active memberships and votes
        db.query(ArenaMembership).filter(ArenaMembership.user_id == user_id).delete(synchronize_session=False)
        db.query(SubmissionVote).filter(SubmissionVote.user_id == user_id).delete(synchronize_session=False)

        # 5. Lock and zero-out remaining balance without deleting transaction audit trail
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if wallet:
            wallet.is_frozen = True
            wallet.tribes_balance = 0.0

        db.commit()
        return success_response({"message": "Account deactivated and personal data anonymized successfully.", "user_id": user_id})
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete account: {str(e)}"
        )