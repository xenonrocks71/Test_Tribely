"""
OTP Generation, Storage & Verification Service Implementation.
Provides secure 6-digit OTP code lifecycle management with Redis-first caching (300s TTL),
atomic anti-replay key deletion, 60s cooldown rate limiting, attempt bounds,
and signed verification claims.
"""

import json
import secrets
import hashlib
import hmac
import datetime
import logging
from typing import Tuple, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.models.models import VerificationOTP
from app.core.config import settings
from app.core.redis import get_sync_redis_client
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

RESEND_COOLDOWN_SECONDS = getattr(settings, "OTP_COOLDOWN_SECONDS", 60)
OTP_TTL_SECONDS = getattr(settings, "OTP_TTL_SECONDS", 300)
OTP_VALIDITY_MINUTES = max(1, OTP_TTL_SECONDS // 60)
MAX_ATTEMPTS = getattr(settings, "OTP_MAX_ATTEMPTS", 5)
VERIFICATION_TOKEN_EXPIRE_MINUTES = 20


class OtpService:
    """
    SDE III Enterprise Service managing OTP lifecycle:
    - Cryptographic 6-digit generation (secrets module)
    - Redis-first caching with 300s TTL (key: otp:<email>:<purpose>)
    - Atomic anti-replay protection (DEL on verify)
    - Rate-limiting cooldowns (60s in Redis / DB)
    - Failed attempt tracking & lockout (max 5)
    - Signed JWT verification tokens
    """

    def __init__(self) -> None:
        pass

    def _hash_otp(self, code: str) -> str:
        """Computes HMAC-SHA256 hash of the plain OTP code using server secret key."""
        return hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            code.strip().encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

    def _redis_otp_key(self, identifier: str, purpose: str) -> str:
        """Formats the Redis storage key for OTP state."""
        return f"otp:{identifier.strip().lower()}:{purpose.strip().lower()}"

    def _redis_cooldown_key(self, identifier: str, purpose: str) -> str:
        """Formats the Redis storage key for resend cooldown rate limiting."""
        return f"otp_cooldown:{identifier.strip().lower()}:{purpose.strip().lower()}"

    def generate_otp(
        self,
        db: Optional[Session] = None,
        identifier: str = "",
        purpose: str = "registration",
        send_email: bool = True
    ) -> Tuple[str, datetime.datetime]:
        """
        Generates a cryptographically secure 6-digit numeric OTP code.
        Enforces a 60-second cooldown rate limit per identifier to prevent spam.
        Saves temporarily to Redis with a 300-second TTL (and falls back to DB).

        :param db: Optional active database session.
        :param identifier: Contact address (normalized email or phone number).
        :param purpose: Context purpose string ('registration', 'login', etc.).
        :param send_email: Whether to trigger email dispatch immediately.
        :return: Tuple of (plain_otp_code, expires_at).
        :raises HTTPException: 429 if requested within the cooldown period.
        """
        clean_id = identifier.strip().lower()
        now = datetime.datetime.now(datetime.timezone.utc)
        expires_at = now + datetime.timedelta(seconds=OTP_TTL_SECONDS)

        redis_client = get_sync_redis_client()

        # 1. Check Cooldown Rate Limiting (Redis first, fallback to DB)
        if redis_client:
            try:
                cooldown_key = self._redis_cooldown_key(clean_id, purpose)
                ttl = redis_client.ttl(cooldown_key)
                if ttl and ttl > 0:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {ttl} seconds before requesting a new verification code."
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"[OtpService] Redis cooldown check error: {e}")

        # Fallback DB cooldown check if DB is available
        if db is not None:
            latest_otp = (
                db.query(VerificationOTP)
                .filter(
                    VerificationOTP.identifier == clean_id,
                    VerificationOTP.purpose == purpose
                )
                .order_by(VerificationOTP.created_at.desc())
                .first()
            )
            if latest_otp and latest_otp.created_at:
                created_at_dt = (
                    latest_otp.created_at.replace(tzinfo=datetime.timezone.utc)
                    if latest_otp.created_at.tzinfo is None
                    else latest_otp.created_at
                )
                elapsed = (now - created_at_dt).total_seconds()
                if elapsed < RESEND_COOLDOWN_SECONDS:
                    remaining = int(RESEND_COOLDOWN_SECONDS - elapsed)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {remaining} seconds before requesting a new verification code."
                    )

        # 2. Generate 6-digit cryptographically secure code
        code = f"{secrets.randbelow(900000) + 100000:06d}"
        otp_hash = self._hash_otp(code)

        # 3. Store in Redis with TTL (300 seconds) & set cooldown key (60 seconds)
        if redis_client:
            try:
                otp_key = self._redis_otp_key(clean_id, purpose)
                cooldown_key = self._redis_cooldown_key(clean_id, purpose)

                payload = {
                    "identifier": clean_id,
                    "otp_hash": otp_hash,
                    "purpose": purpose,
                    "attempts": 0,
                    "created_at": now.isoformat(),
                    "expires_at": expires_at.isoformat()
                }
                # Save OTP payload with 300s TTL
                redis_client.set(otp_key, json.dumps(payload), ex=OTP_TTL_SECONDS)
                # Set resend cooldown with 60s TTL
                redis_client.set(cooldown_key, "1", ex=RESEND_COOLDOWN_SECONDS)
            except Exception as e:
                logger.warning(f"[OtpService] Redis storage failed ({e}). Proceeding with DB fallback.")

        # 4. Persistence in Database (if session provided)
        if db is not None:
            try:
                otp_record = VerificationOTP(
                    identifier=clean_id,
                    otp_hash=otp_hash,
                    purpose=purpose,
                    attempts=0,
                    is_verified=False,
                    expires_at=expires_at,
                    created_at=now
                )
                db.add(otp_record)
                db.commit()
                db.refresh(otp_record)
            except Exception as e:
                db.rollback()
                logger.warning(f"[OtpService] DB write error for OTP: {e}")

        # 5. Dispatch email if requested and target is an email address
        if send_email and "@" in clean_id:
            self.send_email_otp(clean_id, code)

        logger.info(f"[OtpService] Generated OTP for identifier={clean_id} purpose={purpose} (TTL={OTP_TTL_SECONDS}s)")
        return code, expires_at

    def send_email_otp(self, to_email: str, code: str) -> bool:
        """
        Dispatches the 6-digit OTP code to the recipient email address.
        """
        return email_service.send_otp_email_sync(
            to_email=to_email,
            code=code,
            expires_in_minutes=OTP_VALIDITY_MINUTES
        )

    def verify_otp(
        self,
        db: Optional[Session] = None,
        identifier: str = "",
        code: str = "",
        purpose: str = "registration"
    ) -> str:
        """
        Validates the provided 6-digit OTP code against Redis (or fallback DB).
        Implements:
        - Constant-time comparison to prevent timing side-channel attacks
        - Attempt counter tracking and max attempts lockout
        - ATOMIC ANTI-REPLAY: Deletes the Redis key immediately upon successful verification
        - Signed verification token generation

        :param db: Optional database session.
        :param identifier: Contact address.
        :param code: 6-digit code provided by user.
        :param purpose: Context purpose.
        :return: Signed verification token on success.
        :raises HTTPException: 400 for expired, exceeded attempts, or invalid codes.
        """
        clean_id = identifier.strip().lower()
        clean_code = code.strip()
        now = datetime.datetime.now(datetime.timezone.utc)
        input_hash = self._hash_otp(clean_code)

        redis_client = get_sync_redis_client()
        otp_key = self._redis_otp_key(clean_id, purpose)

        # -------------------------------------------------------------
        # Path A: Verify via Redis
        # -------------------------------------------------------------
        if redis_client:
            try:
                cached_raw = redis_client.get(otp_key)
                if cached_raw:
                    cached_data = json.loads(cached_raw)
                    attempts = cached_data.get("attempts", 0)

                    # 1. Check max attempts
                    if attempts >= MAX_ATTEMPTS:
                        redis_client.delete(otp_key)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Maximum verification attempts exceeded. Please request a new code."
                        )

                    stored_hash = cached_data.get("otp_hash", "")

                    # 2. Timing-safe comparison
                    if not hmac.compare_digest(stored_hash, input_hash):
                        attempts += 1
                        cached_data["attempts"] = attempts
                        # Preserve remaining TTL
                        remaining_ttl = redis_client.ttl(otp_key)
                        if remaining_ttl and remaining_ttl > 0:
                            redis_client.set(otp_key, json.dumps(cached_data), ex=remaining_ttl)

                        remaining_attempts = MAX_ATTEMPTS - attempts
                        if remaining_attempts > 0:
                            detail_msg = f"Incorrect verification code. {remaining_attempts} attempt{'s' if remaining_attempts > 1 else ''} remaining."
                        else:
                            redis_client.delete(otp_key)
                            detail_msg = "Incorrect verification code. Maximum attempts reached. Please request a new code."

                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=detail_msg
                        )

                    # 3. SUCCESS! Anti-Replay: Atomically delete the Redis key
                    redis_client.delete(otp_key)

                    # Also update DB record if DB is provided
                    if db is not None:
                        try:
                            record = (
                                db.query(VerificationOTP)
                                .filter(
                                    VerificationOTP.identifier == clean_id,
                                    VerificationOTP.purpose == purpose,
                                    VerificationOTP.is_verified == False
                                )
                                .order_by(VerificationOTP.created_at.desc())
                                .first()
                            )
                            if record:
                                record.is_verified = True
                                db.commit()
                        except Exception as e:
                            logger.warning(f"[OtpService] DB update on Redis verify success: {e}")

                    # Issue signed verification token
                    return self.create_verification_token(clean_id, purpose=purpose)
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"[OtpService] Redis verification error ({e}). Checking DB fallback.")

        # -------------------------------------------------------------
        # Path B: Fallback DB Verification (if Redis empty or offline)
        # -------------------------------------------------------------
        if db is not None:
            record = (
                db.query(VerificationOTP)
                .filter(
                    VerificationOTP.identifier == clean_id,
                    VerificationOTP.purpose == purpose,
                    VerificationOTP.is_verified == False
                )
                .order_by(VerificationOTP.created_at.desc())
                .first()
            )

            if not record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No pending verification found. Please request a new code."
                )

            # Check expiration
            expires_at_dt = (
                record.expires_at.replace(tzinfo=datetime.timezone.utc)
                if record.expires_at.tzinfo is None
                else record.expires_at
            )
            if expires_at_dt < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired. Please request a new one."
                )

            # Check maximum attempts
            if record.attempts >= MAX_ATTEMPTS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Maximum verification attempts exceeded. Please request a new code."
                )

            # Constant-time comparison
            if not hmac.compare_digest(record.otp_hash, input_hash):
                record.attempts += 1
                db.commit()
                remaining_attempts = MAX_ATTEMPTS - record.attempts
                if remaining_attempts > 0:
                    detail_msg = f"Incorrect verification code. {remaining_attempts} attempt{'s' if remaining_attempts > 1 else ''} remaining."
                else:
                    detail_msg = "Incorrect verification code. Maximum attempts reached. Please request a new code."
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=detail_msg
                )

            # Mark verified in DB
            record.is_verified = True
            db.commit()

            return self.create_verification_token(clean_id, purpose=purpose)

        # Neither Redis nor DB found a pending verification
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending verification found. Please request a new code."
        )

    def create_verification_token(self, identifier: str, purpose: str = "registration") -> str:
        """
        Creates a short-lived signed JWT proving that the identifier was verified via OTP.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        expire = now + datetime.timedelta(minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": identifier.strip().lower(),
            "scope": f"otp_verified:{purpose}",
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp())
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def validate_verification_token(
        self, token: str, identifier: str, purpose: str = "registration"
    ) -> bool:
        """
        Validates the signed verification token matches the identifier and purpose.
        """
        if not token:
            return False
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            expected_scope = f"otp_verified:{purpose}"
            if payload.get("scope") != expected_scope:
                return False
            sub = payload.get("sub", "")
            return sub.strip().lower() == identifier.strip().lower()
        except (JWTError, Exception):
            return False


# Global Singleton Instance for OTP Service
otp_service = OtpService()
