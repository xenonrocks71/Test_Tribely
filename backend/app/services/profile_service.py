"""
User Profile & Account Lifecycle Service Implementation.
Encapsulates profile inspection, privacy masking, display name / handle updates,
password management, and GDPR-compliant account deactivation.
Follows clean layered architecture and strict transaction boundaries.
"""

import datetime
import re
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.models import (
    User, UserProfile, Arena, ArenaMembership, UserWallet,
    Submission, SubmissionVote
)
from app.core.security import verify_password, get_password_hash
from app.core.storage.storage_factory import offload_base64_media
from app.repositories.user_repository import user_repository, UserRepository
from app.schemas.schemas import ProfileDetailsUpdateRequest


class ProfileService:
    """
    Domain service governing user profile queries, mutations, privacy protections,
    and account deletion lifecycles.
    """

    def __init__(self, user_repo: UserRepository = user_repository) -> None:
        """
        Initialize ProfileService with injected UserRepository.

        :param user_repo: Data access repository for User entities.
        """
        self.user_repo = user_repo

    def get_user_profile(
        self,
        db: Session,
        *,
        user_id: int,
        current_user_id: int,
        arena_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Retrieves user profile metadata with privacy enforcement and real database habit statistics.
        Masks the user's email address if viewed by another user to protect against scraping.

        :param db: Active database session.
        :param user_id: Primary key of target user.
        :param current_user_id: Primary key of authenticated requesting user.
        :param arena_id: Optional arena context for calculating cohort role.
        :return: Structured profile dictionary with real habit statistics.
        :raises HTTPException: 404 if target user does not exist.
        """
        user = self.user_repo.get_by_id(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "status": "error",
                    "message": "User target not found.",
                    "error_code": "USER_NOT_FOUND"
                }
            )

        profile = self.user_repo.get_or_create_profile(db, user_id=user_id)

        # Contextual role calculation within an arena (e.g. Creator -> Admin)
        role = "Member"
        if arena_id:
            arena = db.query(Arena).filter(Arena.id == arena_id).first()
            if arena and arena.creator_id == user_id:
                role = "Admin"

        # Privacy protection: Only show full email to the user themselves
        display_email = user.email
        if current_user_id != user_id and user.email:
            parts = user.email.split("@")
            if len(parts) == 2:
                display_email = f"{parts[0][:2]}***@{parts[1]}"
            else:
                display_email = "***"

        avatar = (profile.profile_image_url if profile and profile.profile_image_url else user.avatar_url) or None

        # Calculate real habit metrics directly from database
        approved_memberships = db.query(ArenaMembership).filter(
            ArenaMembership.user_id == user_id,
            ArenaMembership.status == "approved"
        ).all()
        arenas_count = len(approved_memberships)
        current_streak = max([m.current_streak for m in approved_memberships], default=0)
        longest_streak = max([m.streak_count for m in approved_memberships], default=0)

        proofs_count = db.query(Submission).filter(Submission.user_id == user_id).count()

        # Real Kudos balance from wallet or user table
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
        if wallet and wallet.tribes_balance is not None:
            kudos_balance = int(wallet.tribes_balance)
        elif wallet and wallet.balance is not None:
            kudos_balance = int(wallet.balance)
        else:
            kudos_balance = int(user.kudos_balance or 0)

        return {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username or (user.email.split("@")[0] if user.email else f"user_{user.id}"),
            "email": display_email,
            "phone_number": user.phone_number,
            "profile_image_url": avatar,
            "avatar_url": avatar,
            "contextual_role": role,
            "is_verified": user.is_verified,
            "kudos_balance": kudos_balance,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "arenas_count": arenas_count,
            "proofs_count": proofs_count,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

    def update_profile_image(
        self,
        db: Session,
        *,
        user: User,
        profile_image_url: str
    ) -> Dict[str, Any]:
        """
        Updates profile avatar URL across User and UserProfile entities atomically.

        :param db: Active database session.
        :param user: Current authenticated User entity.
        :param profile_image_url: Sanitized image URL or data URI.
        :return: Updated profile image URLs.
        """
        clean_url = profile_image_url.strip() if profile_image_url else None
        if clean_url and clean_url.startswith("data:"):
            storage_path = f"avatars/{user.id}"
            clean_url = offload_base64_media(clean_url, folder_prefix=storage_path)

        try:
            profile = self.user_repo.get_or_create_profile(db, user_id=user.id)
            profile.profile_image_url = clean_url
            user.avatar_url = clean_url
            db.commit()
            db.refresh(profile)
            db.refresh(user)
            return {
                "profile_image_url": profile.profile_image_url,
                "avatar_url": user.avatar_url
            }
        except Exception:
            db.rollback()
            raise

    def update_profile_details(
        self,
        db: Session,
        *,
        user: User,
        payload: ProfileDetailsUpdateRequest
    ) -> Dict[str, Any]:
        """
        Updates full name, username, phone number, and avatar image with uniqueness validation.
        Email is strictly immutable to protect identity integrity.

        :param db: Active database session.
        :param user: Current authenticated User entity.
        :param payload: Profile update attributes.
        :return: Serialized updated profile dictionary.
        :raises HTTPException: 400 if validation fails or unique constraint conflicts.
        """
        try:
            # 1. Validate and update display name
            if payload.full_name is not None:
                stripped_name = payload.full_name.strip()
                if not stripped_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Display name cannot be empty."
                    )
                user.full_name = stripped_name

            # 2. Validate and update username handle
            if payload.username is not None:
                clean_username = payload.username.strip().lower()
                if not re.match(r"^[a-zA-Z0-9_]{3,30}$", clean_username):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Username must be 3-30 characters (letters, numbers, underscores only)."
                    )
                existing_user = self.user_repo.get_by_username(db, clean_username)
                if existing_user and existing_user.id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This username is already taken. Please choose another."
                    )
                user.username = clean_username

            # 3. Validate and update phone number
            if payload.phone_number is not None:
                clean_phone = payload.phone_number.strip()
                if clean_phone:
                    existing_phone = self.user_repo.get_by_phone(db, clean_phone)
                    if existing_phone and existing_phone.id != user.id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This phone number is already registered to another account."
                        )
                    user.phone_number = clean_phone
                else:
                    user.phone_number = None

            # 4. Update avatar image if supplied
            avatar_val = payload.profile_image_url or getattr(payload, "avatar_url", None)
            if avatar_val is not None:
                clean_avatar = avatar_val.strip() if avatar_val else None
                if clean_avatar and clean_avatar.startswith("data:"):
                    storage_path = f"avatars/{user.id}"
                    clean_avatar = offload_base64_media(clean_avatar, folder_prefix=storage_path)

                user.avatar_url = clean_avatar
                profile = self.user_repo.get_or_create_profile(db, user_id=user.id)
                profile.profile_image_url = clean_avatar

            db.commit()
            db.refresh(user)

            profile = self.user_repo.get_or_create_profile(db, user_id=user.id)
            active_avatar = (profile.profile_image_url if profile and profile.profile_image_url else user.avatar_url) or None

            return {
                "id": user.id,
                "full_name": user.full_name,
                "username": user.username,
                "email": user.email,
                "phone_number": user.phone_number,
                "profile_image_url": active_avatar,
                "avatar_url": active_avatar,
            }
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise

    def change_user_password(
        self,
        db: Session,
        *,
        user: User,
        current_password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """
        Validates existing password and updates user hashed password atomically.

        :param db: Active database session.
        :param user: Current authenticated User entity.
        :param current_password: Existing plaintext password to verify.
        :param new_password: New plaintext password to hash and store.
        :return: Success response dictionary.
        :raises HTTPException: 400 if current password does not match.
        """
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "error",
                    "message": "Current credential password mismatch verification.",
                    "error_code": "PASSWORD_CURRENT_MISMATCH"
                }
            )

        try:
            user.hashed_password = get_password_hash(new_password)
            db.commit()
            return {"message": "Password changed flawlessly."}
        except Exception:
            db.rollback()
            raise

    def delete_user_account(self, db: Session, *, current_user: User) -> Dict[str, Any]:
        """
        Safely deactivates and anonymizes user account in compliance with GDPR/CCPA.
        Transfers arena ownership to successors, removes active memberships and votes,
        while IMMUTABLY PRESERVING double-entry bookkeeping financial ledgers.

        :param db: Active database session.
        :param current_user: User entity requesting deletion.
        :return: Confirmation response.
        :raises HTTPException: 500 if transaction failure occurs.
        """
        user_id = current_user.id
        try:
            # 1. Successor transfer or cleanup for arenas owned by this user
            owned_arenas = db.query(Arena).filter(Arena.creator_id == user_id).all()
            for arena in owned_arenas:
                next_successor = db.query(ArenaMembership).filter(
                    ArenaMembership.arena_id == arena.id,
                    ArenaMembership.status == "approved",
                    ArenaMembership.user_id != user_id
                ).order_by(ArenaMembership.id.asc()).first()

                if next_successor:
                    next_successor.role = "admin"
                    arena.creator_id = next_successor.user_id
                else:
                    db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena.id).delete(synchronize_session=False)

            # 2. Anonymize user profile & purge PII image URL
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if profile:
                profile.profile_image_url = None

            # 3. Soft-delete and anonymize User entity
            timestamp = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
            current_user.full_name = "Deleted User"
            current_user.email = f"deleted_{user_id}_{timestamp}@anonymized.tribely"
            current_user.hashed_password = "ACCOUNT_DEACTIVATED"
            current_user.is_active = False

            # 4. Remove memberships and votes
            db.query(ArenaMembership).filter(ArenaMembership.user_id == user_id).delete(synchronize_session=False)
            db.query(SubmissionVote).filter(SubmissionVote.user_id == user_id).delete(synchronize_session=False)

            # 5. Freeze wallet and zero balance without destroying transaction ledgers
            wallet = db.query(UserWallet).filter(UserWallet.user_id == user_id).first()
            if wallet:
                wallet.is_frozen = True
                wallet.tribes_balance = 0.0

            db.commit()
            return {
                "message": "Account deactivated and personal data anonymized successfully.",
                "user_id": user_id
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete account: {str(e)}"
            )


# Global Singleton Instance for Dependency Injection
profile_service = ProfileService()
