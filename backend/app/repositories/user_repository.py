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
        Fetch a single User entity matching the given email address.

        :param db: Active database session.
        :param email: Target user email address string.
        :return: Optional User instance if found, else None.
        """
        return db.query(User).filter(User.email == email).first()

    def create_user(self, db: Session, *, user_in: UserCreate) -> User:
        """
        Create and persist a new User entity with hashed password verification.

        :param db: Active database session.
        :param user_in: Validated UserCreate Pydantic schema.
        :return: Persisted User model instance.
        """
        hashed_pass = get_password_hash(user_in.password)
        db_user = User(
            email=user_in.email,
            hashed_password=hashed_pass,
            full_name=user_in.full_name,
            is_active=True
        )
        db.add(db_user)
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
