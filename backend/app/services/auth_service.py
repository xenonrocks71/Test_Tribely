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

    def register_user(self, db: Session, user_in: UserCreate = None, **kwargs) -> User:
        """
        Register a new user account with duplicate email, phone, and username validation.

        :param db: Active database session.
        :param user_in: Validated UserCreate request schema.
        :return: Persisted User model instance.
        :raises HTTPException: 400 Bad Request if email, phone, or username already exists.
        """
        if user_in is None:
            user_in = kwargs.get("user_in")
        from sqlalchemy.exc import IntegrityError
        from app.services.otp_service import otp_service

        # 1. Pre-validation checks for explicit conflicts
        if user_in.email:
            existing_email = self.user_repo.get_by_email(db, user_in.email)
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address already registered."
                )

        if user_in.phone_number:
            existing_phone = self.user_repo.get_by_phone(db, user_in.phone_number)
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered."
                )

        if user_in.username:
            existing_user = self.user_repo.get_by_username(db, user_in.username)
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken."
                )

        # 2. Token validation if provided
        if user_in.verification_token:
            clean_email = user_in.email.strip().lower()
            clean_phone = user_in.phone_number.strip() if user_in.phone_number else ""
            is_valid_email = otp_service.validate_verification_token(user_in.verification_token, clean_email)
            is_valid_phone = bool(clean_phone and otp_service.validate_verification_token(user_in.verification_token, clean_phone))
            if not is_valid_email and not is_valid_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired verification token."
                )

        try:
            db_user = self.user_repo.create_user(db, user_in=user_in)
            return db_user
        except IntegrityError as ie:
            db.rollback()
            orig_msg = str(getattr(ie, "orig", ie)).lower()
            if "phone_number" in orig_msg:
                detail = "Phone number already registered."
            elif "username" in orig_msg:
                detail = "Username already taken."
            else:
                detail = "Email address already registered."
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail
            )
        except Exception:
            db.rollback()
            raise


    def authenticate_user(self, db: Session, email: str = None, password: str = None, **kwargs) -> Optional[User]:
        """
        Validate credentials against stored user password hash.
        Supports both positional and keyword invocations.

        :param db: Active database session.
        :param email: Login email address.
        :param password: Raw plaintext password.
        :return: Optional User instance if valid, else None.
        """
        email = email or kwargs.get("email")
        password = password or kwargs.get("password")
        if not email or not password:
            return None
        clean_email = str(email).strip().lower()
        user = self.user_repo.get_by_email(db, email=clean_email)
        if not user:
            # Fallback to exact search if email wasn't normalized in legacy records
            user = self.user_repo.get_by_email(db, email=str(email))
        if not user:
            return None
        if not verify_password(str(password), user.hashed_password):
            return None
        return user

    def login(self, db: Session, email: str = None, password: str = None, **kwargs) -> Tuple[Token, User]:
        """
        Perform complete login workflow and issue a JWT access token.

        :param db: Active database session.
        :param email: User email string.
        :param password: User raw password.
        :return: Tuple containing Token schema and authenticated User instance.
        :raises HTTPException: 400 Bad Request on invalid credentials.
        """
        email = email or kwargs.get("email")
        password = password or kwargs.get("password")
        user = self.authenticate_user(db, email=email, password=password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect email or password."
            )

        access_token = create_access_token(data={"sub": str(user.id)})
        token = Token(access_token=access_token, token_type="bearer")
        return token, user

    def change_password(self, db: Session, user: User = None, current_password: str = None, new_password: str = None, **kwargs) -> bool:
        """
        Update user account password after validating current password.

        :param db: Active database session.
        :param user: Current authenticated User entity.
        :param current_password: Raw current password.
        :param new_password: Raw new password.
        :return: True if password updated successfully.
        :raises HTTPException: 400 Bad Request if current password validation fails.
        """
        user = user or kwargs.get("user")
        current_password = current_password or kwargs.get("current_password")
        new_password = new_password or kwargs.get("new_password")
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
