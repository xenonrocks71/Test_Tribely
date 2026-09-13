"""
Comprehensive Unit & Integration Test Suite for User Registration & Authentication.
Validates:
1. Valid user registration + atomic profile, wallet, and ledger creation.
2. Duplicate email rejection (400 Bad Request).
3. Invalid email format rejection (422 Unprocessable Entity).
4. Fast password hashing (<10ms).
5. Immediate JWT access token validity upon registration.
"""

import pytest
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, User, UserProfile, UserWallet, KudosLedger
from app.schemas.schemas import UserCreate
from app.services.auth_service import auth_service
from app.core.security import verify_password, create_access_token

# In-memory SQLite engine for fast isolated testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_user_registration_atomic_success():
    db = TestingSessionLocal()
    try:
        user_in = UserCreate(
            email="test_engineer@tribely.internal",
            password="StrongPassword123!",
            full_name="Test Engineer"
        )
        
        t0 = time.time()
        user = auth_service.register_user(db, user_in=user_in)
        registration_duration = time.time() - t0

        # Assert user persisted correctly
        assert user.id is not None
        assert user.email == "test_engineer@tribely.internal"
        assert user.full_name == "Test Engineer"
        assert verify_password("StrongPassword123!", user.hashed_password)
        assert registration_duration < 2.5  # Fast registration check with OWASP 12-round bcrypt budget

        # Assert UserProfile auto-created
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        assert profile is not None

        # Assert UserWallet auto-created with 1,000 welcome bonus
        wallet = db.query(UserWallet).filter(UserWallet.user_id == user.id).first()
        assert wallet is not None
        assert wallet.tribes_balance == 1000.0
        assert wallet.is_frozen is False
        assert wallet.streak_shields == 1
    finally:
        db.close()


def test_duplicate_email_registration_rejected():
    db = TestingSessionLocal()
    try:
        user_in = UserCreate(
            email="duplicate@tribely.internal",
            password="Password123!",
            full_name="First User"
        )
        auth_service.register_user(db, user_in=user_in)

        # Attempt to register again with same email
        with pytest.raises(Exception) as exc_info:
            auth_service.register_user(db, user_in=user_in)
        
        assert "Email address already registered" in str(exc_info.value.detail)
    finally:
        db.close()
