import datetime
import logging
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Silence the noisy internal passlib version warning regarding bcrypt __about__
logging.getLogger("passlib").setLevel(logging.ERROR)

# Explicitly setup passlib with optimized bcrypt rounds (rounds=10 for ultra-fast <30ms response)
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=10, deprecated="auto")

def get_password_hash(password: str) -> str:
    """
    Takes a raw password string and returns its secure cryptographic bcrypt hash.
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a raw input password against a hashed database password string.
    Returns True if they match, otherwise False.
    """
    return pwd_context.verify(plain_password, hashed_password)

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