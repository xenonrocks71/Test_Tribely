"""
Comprehensive Unit & Integration Test Suite for SDE III Redis-Backed Email OTP Service.
Validates:
1. Cryptographic 6-digit code generation using secrets module.
2. Redis-first caching with 300s TTL (key: otp:<email>:<purpose>).
3. 60-second resend cooldown rate limit (HTTP 429).
4. Replay attack prevention: immediate atomic Redis key deletion on verify.
5. Max 5 failed attempts lockout in Redis.
6. Asynchronous email formatting & dispatch with HTML templates.
7. End-to-end FastAPI endpoint validation for /auth/request-otp, /auth/verify-otp,
   /api/auth/otp/send, and /api/auth/otp/verify.
"""

import json
import uuid
import pytest
import datetime
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, User
from app.schemas.schemas import OtpSendRequest, OtpVerifyRequest
from app.services.otp_service import OtpService, otp_service
from app.services.email_service import EmailService, email_service
from main import app

# In-memory test database
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class MockRedisStore:
    """In-memory thread-safe mock simulating Redis with TTL and string get/set/del/ttl."""
    def __init__(self):
        self.store = {}
        self.ttls = {}

    def set(self, key: str, value: str, ex: int = 300):
        self.store[key] = value
        self.ttls[key] = ex
        return True

    def get(self, key: str):
        return self.store.get(key)

    def delete(self, key: str):
        existed = key in self.store
        self.store.pop(key, None)
        self.ttls.pop(key, None)
        return 1 if existed else 0

    def ttl(self, key: str):
        if key not in self.store:
            return -2
        return self.ttls.get(key, -1)


def test_secrets_6_digit_generation():
    """Verify that generated OTP codes are strictly 6 digits and numeric."""
    service = OtpService()
    db = TestingSessionLocal()
    try:
        with patch("app.services.otp_service.get_sync_redis_client", return_value=None):
            code, expires_at = service.generate_otp(db, identifier="alice@tribely.app", purpose="registration", send_email=False)
            assert len(code) == 6
            assert code.isdigit()
            assert int(code) >= 100000 and int(code) <= 999999
            assert expires_at > datetime.datetime.now(datetime.timezone.utc)
    finally:
        db.close()


def test_redis_storage_with_300s_ttl():
    """Verify OTP state is stored in Redis under key 'otp:<email>:<purpose>' with 300s TTL."""
    service = OtpService()
    mock_redis = MockRedisStore()
    db = TestingSessionLocal()
    try:
        with patch("app.services.otp_service.get_sync_redis_client", return_value=mock_redis):
            code, _ = service.generate_otp(db, identifier="bob@tribely.app", purpose="registration", send_email=False)
            
            otp_key = "otp:bob@tribely.app:registration"
            cooldown_key = "otp_cooldown:bob@tribely.app:registration"

            # Check OTP payload in Redis
            raw_data = mock_redis.get(otp_key)
            assert raw_data is not None
            parsed = json.loads(raw_data)
            assert parsed["identifier"] == "bob@tribely.app"
            assert parsed["attempts"] == 0
            assert mock_redis.ttl(otp_key) == 300

            # Check Cooldown in Redis
            assert mock_redis.get(cooldown_key) == "1"
            assert mock_redis.ttl(cooldown_key) == 60
    finally:
        db.close()


def test_redis_cooldown_rate_limit_enforced():
    """Verify that requesting an OTP before the 60s cooldown expires raises HTTP 429."""
    service = OtpService()
    mock_redis = MockRedisStore()
    db = TestingSessionLocal()
    try:
        with patch("app.services.otp_service.get_sync_redis_client", return_value=mock_redis):
            service.generate_otp(db, identifier="cooldown@tribely.app", purpose="registration", send_email=False)
            
            # Immediate second request while cooldown TTL is active
            with pytest.raises(HTTPException) as exc_info:
                service.generate_otp(db, identifier="cooldown@tribely.app", purpose="registration", send_email=False)

            assert exc_info.value.status_code == 429
            assert "Please wait" in str(exc_info.value.detail)
    finally:
        db.close()


def test_replay_attack_prevention_via_redis_key_deletion():
    """Verify that once an OTP is verified, the Redis key is deleted and reuse is rejected."""
    service = OtpService()
    mock_redis = MockRedisStore()
    db = TestingSessionLocal()
    try:
        with patch("app.services.otp_service.get_sync_redis_client", return_value=mock_redis):
            code, _ = service.generate_otp(db, identifier="replay_victim@tribely.app", purpose="registration", send_email=False)
            otp_key = "otp:replay_victim@tribely.app:registration"
            assert mock_redis.get(otp_key) is not None

            # First verification should succeed
            token = service.verify_otp(db, identifier="replay_victim@tribely.app", code=code, purpose="registration")
            assert token is not None
            assert service.validate_verification_token(token, "replay_victim@tribely.app", purpose="registration") is True

            # Assert Redis key has been deleted immediately to prevent replay
            assert mock_redis.get(otp_key) is None

            # Second verification with identical code must fail (Replay Attack Blocked)
            with pytest.raises(HTTPException) as exc_info:
                service.verify_otp(db, identifier="replay_victim@tribely.app", code=code, purpose="registration")

            assert exc_info.value.status_code == 400
            assert "No pending verification found" in str(exc_info.value.detail)
    finally:
        db.close()


def test_redis_failed_attempt_tracking_and_max_5_lockout():
    """Verify that invalid code attempts increment the attempt counter and lockout at 5."""
    service = OtpService()
    mock_redis = MockRedisStore()
    db = TestingSessionLocal()
    try:
        with patch("app.services.otp_service.get_sync_redis_client", return_value=mock_redis):
            code, _ = service.generate_otp(db, identifier="lockout@tribely.app", purpose="registration", send_email=False)
            otp_key = "otp:lockout@tribely.app:registration"

            # 4 incorrect attempts
            for i in range(1, 5):
                with pytest.raises(HTTPException) as exc_info:
                    service.verify_otp(db, identifier="lockout@tribely.app", code="000000", purpose="registration")
                assert exc_info.value.status_code == 400
                assert f"{5 - i} attempt" in str(exc_info.value.detail)

            # 5th incorrect attempt causes max attempts reached
            with pytest.raises(HTTPException) as exc_info:
                service.verify_otp(db, identifier="lockout@tribely.app", code="000000", purpose="registration")
            assert exc_info.value.status_code == 400
            assert "Maximum attempts reached" in str(exc_info.value.detail)

            # Key should now be purged from Redis
            assert mock_redis.get(otp_key) is None
    finally:
        db.close()


def test_email_service_html_template_generation():
    """Verify that EmailService generates valid HTML template containing the OTP code."""
    email_svc = EmailService()
    html = email_svc._render_otp_html("784920", expires_in_minutes=5)
    assert "784920" in html
    assert "TRIBELY" in html
    assert "5 minutes" in html
    assert "Account Security" in html


def test_api_endpoints_request_otp_and_verify_otp_flow():
    """End-to-end test of /auth/request-otp, /auth/verify-otp, /api/auth/otp/send, /api/auth/otp/verify."""
    client = TestClient(app)
    mock_redis = MockRedisStore()

    email_1 = f"sde3_{uuid.uuid4().hex[:6]}@tribely.app"
    email_2 = f"api_{uuid.uuid4().hex[:6]}@tribely.app"

    sent_codes = []

    def capture_email(recipient, code, expires):
        sent_codes.append(code)
        return True

    with patch("app.services.otp_service.get_sync_redis_client", return_value=mock_redis), \
         patch("app.core.rate_limiter.SlidingWindowRateLimiter.check_rate_limit", return_value=(False, 10, 60)), \
         patch.object(email_service, "send_otp_email_sync", side_effect=capture_email):

        # 1. Request OTP via /auth/request-otp
        req_resp = client.post("/auth/request-otp", json={"email": email_1, "purpose": "registration"})
        assert req_resp.status_code == 200
        req_data = req_resp.json()
        assert req_data["status"] == "success"
        assert req_data["expires_in"] == 300
        assert req_data.get("dev_otp") is None, "Security: dev_otp must NOT be leaked in API response"

        # Code is securely delivered via email dispatch
        assert len(sent_codes) >= 1
        dev_code = sent_codes[-1]

        # 2. Verify OTP via /auth/verify-otp
        ver_resp = client.post("/auth/verify-otp", json={"email": email_1, "code": dev_code, "purpose": "registration"})
        assert ver_resp.status_code == 200
        ver_data = ver_resp.json()
        assert ver_data["status"] == "success"
        assert "verification_token" in ver_data
        assert ver_data["identifier"] == email_1

        # 3. Request OTP via /api/auth/otp/send
        mock_redis.store.clear()
        mock_redis.ttls.clear()
        send_resp = client.post("/api/auth/otp/send", json={"email": email_2, "purpose": "registration"})
        assert send_resp.status_code == 200
        assert send_resp.json().get("dev_otp") is None, "Security: dev_otp must NOT be leaked in API response"
        assert len(sent_codes) >= 2
        send_code = sent_codes[-1]

        # 4. Verify OTP via /api/auth/otp/verify
        verify_resp = client.post("/api/auth/otp/verify", json={"identifier": email_2, "code": send_code, "purpose": "registration"})
        assert verify_resp.status_code == 200
        assert verify_resp.json()["status"] == "success"
