"""
User Domain Repository Implementation.
Encapsulates all database operations, queries, and persistence rules for User and UserProfile entities.
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import User, UserProfile
from app.schemas.schemas import UserCreate
from app.core.security import get_password_hash
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User, UserCreate, UserCreate]):
    """
    Object-oriented repository managing User domain data access.
    Inherits generic CRUD functionality and adds domain-specific database queries.
    """

    def __init__(self) -> None:
        """Initialize UserRepository with User model."""
        super().__init__(User)

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        """
        Fetch a single User entity matching the given email address (case-insensitive & whitespace-trimmed).

        :param db: Active database session.
        :param email: Target user email address string.
        :return: Optional User instance if found, else None.
        """
        if not email:
            return None
        from sqlalchemy import func, or_
        clean_email = email.strip().lower()
        return db.query(User).filter(
            or_(
                func.lower(func.trim(User.email)) == clean_email,
                func.lower(User.email) == clean_email,
                User.email == clean_email,
                User.email == email
            )
        ).first()

    def get_by_phone(self, db: Session, phone_number: str) -> Optional[User]:
        """
        Fetch a single User entity matching the given phone number.

        :param db: Active database session.
        :param phone_number: Cleaned phone number string.
        :return: Optional User instance if found, else None.
        """
        if not phone_number:
            return None
        clean_phone = phone_number.strip()
        return db.query(User).filter(User.phone_number == clean_phone).first()

    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        """
        Fetch a single User entity matching the given username (case-insensitive).

        :param db: Active database session.
        :param username: Handle/username string.
        :return: Optional User instance if found, else None.
        """
        if not username:
            return None
        from sqlalchemy import func
        clean_username = username.strip().lower()
        return db.query(User).filter(func.lower(User.username) == clean_username).first()

    def create_user(self, db: Session, *, user_in: UserCreate) -> User:
        """
        Create and persist a new User entity along with Profile and Wallet in a single atomic batch transaction.

        :param db: Active database session.
        :param user_in: Validated UserCreate Pydantic schema.
        :return: Persisted User model instance.
        """
        from app.models.models import UserWallet, KudosTransaction, KudosTransactionType
        clean_email = user_in.email.strip().lower()
        clean_name = user_in.full_name.strip() if user_in.full_name else None
        clean_phone = user_in.phone_number.strip() if getattr(user_in, "phone_number", None) else None
        clean_username = user_in.username.strip().lower() if getattr(user_in, "username", None) else clean_email.split("@")[0]
        avatar_url = user_in.avatar_url.strip() if getattr(user_in, "avatar_url", None) else None
        is_verified = bool(getattr(user_in, "verification_token", None))

        hashed_pass = get_password_hash(user_in.password)
        db_user = User(
            email=clean_email,
            username=clean_username,
            phone_number=clean_phone,
            avatar_url=avatar_url,
            hashed_password=hashed_pass,
            full_name=clean_name,
            is_active=True,
            is_verified=is_verified,
            kudos_balance=1000,
            profile=UserProfile(profile_image_url=avatar_url),
            wallet=UserWallet(
                tribes_balance=1000.0,
                balance=1000.0,
                is_frozen=False,
                referral_count=0,
                streak_shields=0
            )
        )
        db.add(db_user)
        db.flush()

        # Log Welcome Kudos Transaction
        welcome_tx = KudosTransaction(
            user_id=db_user.id,
            arena_id=None,
            amount=1000,
            type=KudosTransactionType.SIGNUP_BONUS.value,
            description="Welcome registration bonus of 1,000 Kudos"
        )
        db.add(welcome_tx)
        db.commit()
        db.refresh(db_user)
        return db_user

    def get_or_create_profile(self, db: Session, *, user_id: int) -> UserProfile:
        """
        Fetch existing UserProfile for a user ID or auto-create a default profile if missing.

        :param db: Active database session.
        :param user_id: Primary key identifier of the user.
        :return: Associated UserProfile model instance.
        """
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            profile = UserProfile(user_id=user_id, profile_image_url=None)
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile


# Global Singleton Instance for Repository Access
user_repository = UserRepository()
