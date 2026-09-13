import datetime
import logging
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings
import bcrypt

logger = logging.getLogger(__name__)

BCRYPT_ROUNDS = 12


def get_password_hash(password: str) -> str:
    """
    Takes a raw password string and returns its secure cryptographic bcrypt hash
    using OWASP-compliant 12-round work factor.
    """
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a raw input password against a hashed database password string.
    Enforces strict constant-time cryptographic verification without plaintext bypass.
    """
    if not plain_password or not hashed_password:
        return False

    clean_hashed = hashed_password.strip()

    # 1. Native constant-time bcrypt verification
    try:
        plain_bytes = plain_password.encode("utf-8")
        hashed_bytes = clean_hashed.encode("utf-8")
        if bcrypt.checkpw(plain_bytes, hashed_bytes):
            return True
        # Handle 72-byte bcrypt input boundary if password exceeds 72 bytes
        if len(plain_bytes) > 72 and bcrypt.checkpw(plain_bytes[:72], hashed_bytes):
            return True
    except Exception:
        pass

    # 2. Legacy passlib fallback for pre-existing database hashes
    try:
        pwd_context = CryptContext(
            schemes=["bcrypt", "pbkdf2_sha256", "sha256_crypt"],
            deprecated="auto"
        )
        if pwd_context.verify(plain_password, clean_hashed):
            return True
    except Exception:
        pass

    return False


def create_access_token(subject: Union[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    """
    Generates a secure, signed JWT token containing the user identity (subject).
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": now,
        "scope": "access_token"
    }

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_password_reset_token(email: str, expires_minutes: int = 15) -> str:
    """
    Generates a short-lived, single-purpose cryptographically signed password reset token.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    expire = now + datetime.timedelta(minutes=expires_minutes)
    payload = {
        "sub": email.strip().lower(),
        "exp": expire,
        "iat": now,
        "scope": "password_reset"
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verifies a password reset token and returns the associated email if valid.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("scope") != "password_reset":
            return None
        email = payload.get("sub")
        return str(email).strip().lower() if email else None
    except (JWTError, Exception):
        return None