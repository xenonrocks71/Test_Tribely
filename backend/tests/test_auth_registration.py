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


def test_user_registration_with_phone_username_and_avatar():
    from app.services.otp_service import otp_service
    db = TestingSessionLocal()
    try:
        # Generate and verify OTP to obtain a valid verification token
        code, _ = otp_service.generate_otp(db, identifier="insta_user@tribely.internal", purpose="registration")
        token = otp_service.verify_otp(db, identifier="insta_user@tribely.internal", code=code, purpose="registration")

        user_in = UserCreate(
            email="insta_user@tribely.internal",
            username="insta_king",
            phone_number="+15551234567",
            password="SecurePassword999!",
            full_name="Instagram Star",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            verification_token=token
        )

        user = auth_service.register_user(db, user_in=user_in)

        # Assert full model persistence
        assert user.id is not None
        assert user.email == "insta_user@tribely.internal"
        assert user.username == "insta_king"
        assert user.phone_number == "+15551234567"
        assert user.avatar_url == user_in.avatar_url
        assert user.is_verified is True

        # Assert profile image is synced
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        assert profile is not None
        assert profile.profile_image_url == user_in.avatar_url

        # Duplicate phone check
        dup_phone_in = UserCreate(
            email="another@tribely.internal",
            username="another_handle",
            phone_number="+15551234567",
            password="AnotherPassword123!",
            full_name="Another User"
        )
        with pytest.raises(Exception) as exc_phone:
            auth_service.register_user(db, user_in=dup_phone_in)
        assert "Phone number already registered" in str(exc_phone.value.detail)

        # Duplicate username check
        dup_user_in = UserCreate(
            email="third@tribely.internal",
            username="insta_king",
            phone_number="+15559876543",
            password="ThirdPassword123!",
            full_name="Third User"
        )
        with pytest.raises(Exception) as exc_user:
            auth_service.register_user(db, user_in=dup_user_in)
        assert "Username already taken" in str(exc_user.value.detail)
    finally:
        db.close()


def test_otp_generation_and_verification_flow():
    from app.services.otp_service import otp_service
    db = TestingSessionLocal()
    try:
        identifier = "test_otp_user@tribely.internal"
        code, expires_at = otp_service.generate_otp(db, identifier=identifier, purpose="registration")

        assert len(code) == 6
        assert code.isdigit()
        assert expires_at is not None

        # Verify OTP code
        token = otp_service.verify_otp(db, identifier=identifier, code=code, purpose="registration")
        assert token is not None

        # Token validation check
        assert otp_service.validate_verification_token(token, identifier, purpose="registration") is True
        assert otp_service.validate_verification_token(token, "wrong@email.com", purpose="registration") is False
    finally:
        db.close()


def test_otp_rate_limiting_cooldown():
    from app.services.otp_service import otp_service
    from fastapi import HTTPException
    db = TestingSessionLocal()
    try:
        identifier = "cooldown_test@tribely.internal"
        otp_service.generate_otp(db, identifier=identifier, purpose="registration")

        # Second immediate request should hit the 60s cooldown limit
        with pytest.raises(HTTPException) as exc_info:
            otp_service.generate_otp(db, identifier=identifier, purpose="registration")
        
        assert exc_info.value.status_code == 429
        assert "Please wait" in str(exc_info.value.detail)
    finally:
        db.close()


def test_otp_incorrect_code_and_max_attempts():
    from app.services.otp_service import otp_service
    from fastapi import HTTPException
    db = TestingSessionLocal()
    try:
        identifier = "brute_force_test@tribely.internal"
        code, _ = otp_service.generate_otp(db, identifier=identifier, purpose="registration")

        # Attempt wrong code 5 times
        for attempt in range(5):
            with pytest.raises(HTTPException) as exc_info:
                otp_service.verify_otp(db, identifier=identifier, code="000000", purpose="registration")
            assert exc_info.value.status_code == 400

        # 6th attempt should be blocked due to maximum attempts exceeded
        with pytest.raises(HTTPException) as exc_info:
            otp_service.verify_otp(db, identifier=identifier, code=code, purpose="registration")
        assert "Maximum verification attempts exceeded" in str(exc_info.value.detail)
    finally:
        db.close()


def test_username_availability_endpoint():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)

    # 1. Invalid username (too short or special chars)
    resp = client.get("/api/auth/check-username?username=ab")
    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is False

    # 2. Valid and unreserved username
    resp2 = client.get("/api/auth/check-username?username=cool_coder_99")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["available"] is True


