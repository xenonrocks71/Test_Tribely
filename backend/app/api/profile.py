"""
User Profile API Router.
Provides thin HTTP endpoints for profile retrieval, display information updates,
avatar mutations, password management, and account deactivation.
Delegates all business rules, authorization, and data access to ProfileService.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.services.profile_service import profile_service
from app.schemas.schemas import (
    PasswordChangeRequest,
    ProfileImageUpdateRequest,
    ProfileDetailsUpdateRequest,
    ApiSuccessResponse
)

router = APIRouter(prefix="/users", tags=["User Profiles"])


def success_response(data: Any) -> Dict[str, Any]:
    """Standardized API response envelope."""
    return {"status": "success", "data": data}


@router.get("/me")
@router.get("/profile/me")
def get_current_user_profile(
    arena_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves the authenticated user's own profile metadata and real habit statistics.
    """
    profile_data = profile_service.get_user_profile(
        db,
        user_id=current_user.id,
        current_user_id=current_user.id,
        arena_id=arena_id
    )
    return success_response(profile_data)


@router.get("/profile/{user_id}")
def get_user_profile(
    user_id: int,
    arena_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves user profile metadata with authentication and email privacy protection.
    """
    profile_data = profile_service.get_user_profile(
        db,
        user_id=user_id,
        current_user_id=current_user.id,
        arena_id=arena_id
    )
    return success_response(profile_data)


@router.put("/profile/image")
def update_profile_image(
    payload: ProfileImageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Updates authenticated user avatar / profile image URL.
    """
    result = profile_service.update_profile_image(
        db,
        user=current_user,
        profile_image_url=payload.profile_image_url
    )
    return success_response(result)


@router.patch("/profile/details")
def update_profile_details(
    payload: ProfileDetailsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Updates full name, username, phone number, and avatar image.
    Validates handle format and phone number uniqueness.
    """
    updated = profile_service.update_profile_details(
        db,
        user=current_user,
        payload=payload
    )
    return success_response(updated)


@router.post("/profile/change-password")
def change_user_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Validates existing password and commits new password hash.
    """
    result = profile_service.change_user_password(
        db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password
    )
    return success_response(result)


@router.delete("/profile")
def delete_user_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Safely deactivates and anonymizes account while preserving financial ledger invariants.
    """
    result = profile_service.delete_user_account(db, current_user=current_user)
    return success_response(result)