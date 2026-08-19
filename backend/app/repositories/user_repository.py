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
        Create and persist a new User entity along with Profile, Wallet, and Welcome Bonus in a single atomic transaction.

        :param db: Active database session.
        :param user_in: Validated UserCreate Pydantic schema.
        :return: Persisted User model instance.
        """
        try:
            hashed_pass = get_password_hash(user_in.password)
            db_user = User(
                email=user_in.email,
                hashed_password=hashed_pass,
                full_name=user_in.full_name,
                is_active=True
            )
            db.add(db_user)
            db.flush()

            # Batch UserProfile creation
            profile = UserProfile(user_id=db_user.id, profile_image_url=None)
            db.add(profile)

            # Batch UserWallet creation with 1,000 Tribes welcome bonus
            try:
                from app.models.models import UserWallet, KudosLedger
                wallet = UserWallet(
                    user_id=db_user.id,
                    tribes_balance=1000.0,
                    is_frozen=False,
                    referral_count=0,
                    streak_shields=1
                )
                db.add(wallet)

                # Record Welcome Bonus in Ledger
                ledger = KudosLedger(
                    user_id=db_user.id,
                    arena_id=None,
                    transaction_type="WELCOME_BONUS",
                    amount_kudos=1000.0,
                    debit_account="system:welcome_bonus",
                    credit_account=f"user:{db_user.id}:tribes",
                    idempotency_key=f"welcome_bonus:user:{db_user.id}",
                    description="Welcome registration bonus of 1,000 Tribes"
                )
                db.add(ledger)
            except Exception as _e:
                import logging
                logging.warning(f"Wallet/Ledger batch notice: {_e}")

            db.commit()
            return db_user
        except Exception:
            db.rollback()
            raise

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
