from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.models import User
from app.repositories.user_repository import user_repository

# Directs FastAPI's Swagger UI to know where to request tokens from
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """
    Decodes the incoming Bearer JWT token, validates structural fields, 
    and checks if the underlying User database entity exists.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or your login session expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject = payload.get("sub")

        if subject is None:
            raise credentials_exception

        user_id = int(subject)

    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    user = user_repository.get_by_id(db, id=user_id)
    if user is None:
        raise credentials_exception

    return user


oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user_optional(db: Session = Depends(get_db), token: str | None = Depends(oauth2_scheme_optional)) -> User | None:
    """
    Decodes the incoming Bearer JWT token if present. Returns None if absent or invalid,
    allowing endpoints to serve public read/guest interactions gracefully without 401 exceptions.
    """
    if not token:
        return None
    token_str = token.strip()
    if token_str.startswith("Bearer "):
        token_str = token_str[7:].strip()
    try:
        payload = jwt.decode(token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            return None
        return user_repository.get_by_id(db, id=int(subject))
    except Exception:
        return None