"""
Authentication & Identity Service Implementation.
Encapsulates user registration, password verification, JWT issuing, and profile handling.
Designed for high security, maintainability, and clean OOP principles.
"""

from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.models import User
from app.schemas.schemas import UserCreate, Token
from app.core.security import verify_password, create_access_token, get_password_hash
from app.repositories.user_repository import user_repository, UserRepository


class AuthService:
    """
    Business service managing user identity lifecycle and authentication workflows.
    """

    def __init__(self, user_repo: UserRepository = user_repository) -> None:
        """
        Initialize AuthService with injected UserRepository instance.

        :param user_repo: Data access repository for User entities.
        """
        self.user_repo = user_repo

    def register_user(self, db: Session, *, user_in: UserCreate) -> User:
        """
        Register a new user account with duplicate email validation and default profile creation.

        :param db: Active database session.
        :param user_in: Validated UserCreate request schema.
        :return: Persisted User model instance.
        :raises HTTPException: 400 Bad Request if email is already registered.
        """
        existing = self.user_repo.get_by_email(db, email=user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address already registered."
            )
        
        db_user = self.user_repo.create_user(db, user_in=user_in)
        # Initialize default user profile
        self.user_repo.get_or_create_profile(db, user_id=db_user.id)
        return db_user

    def authenticate_user(self, db: Session, *, email: str, password: str) -> Optional[User]:
        """
        Validate credentials against stored user password hash.

        :param db: Active database session.
        :param email: Login email address.
        :param password: Raw plaintext password.
        :return: Optional User instance if valid, else None.
        """
        user = self.user_repo.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def login(self, db: Session, *, email: str, password: str) -> Tuple[Token, User]:
        """
        Perform complete login workflow and issue a JWT access token.

        :param db: Active database session.
        :param email: User email string.
        :param password: User raw password.
        :return: Tuple containing Token schema and authenticated User instance.
        :raises HTTPException: 400 Bad Request on invalid credentials.
        """
        user = self.authenticate_user(db, email=email, password=password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect email or password."
            )

        access_token = create_access_token(data={"sub": str(user.id)})
        token = Token(access_token=access_token, token_type="bearer")
        return token, user

    def change_password(self, db: Session, *, user: User, current_password: str, new_password: str) -> bool:
        """
        Update user account password after validating current password.

        :param db: Active database session.
        :param user: Current authenticated User entity.
        :param current_password: Raw current password.
        :param new_password: Raw new password.
        :return: True if password updated successfully.
        :raises HTTPException: 400 Bad Request if current password validation fails.
        """
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password."
            )

        new_hash = get_password_hash(new_password)
        user.hashed_password = new_hash
        db.add(user)
        db.commit()
        return True


# Global Singleton Service Instance
auth_service = AuthService()
