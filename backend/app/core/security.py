import datetime
import logging
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

import bcrypt

def get_password_hash(password: str) -> str:
    """
    Takes a raw password string and returns its secure cryptographic bcrypt hash.
    Optimized with direct native C-bindings for sub-millisecond execution on cloud containers.
    """
    salt = bcrypt.gensalt(rounds=4)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a raw input password against a hashed database password string.
    Supports native sub-millisecond bcrypt hashes as well as legacy/passlib hashes.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        if bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8")):
            return True
    except Exception:
        pass

    try:
        pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: datetime.timedelta = None) -> str:
    """
    Generates a secure, signed JWT token containing the user identity (subject).
    """
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # Pack payload data structure
    to_encode = {"exp": expire, "sub": str(subject)}
    
    # Securely sign the JWT token using our application constants
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt