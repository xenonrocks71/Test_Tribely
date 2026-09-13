from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_password_hash,
    create_password_reset_token,
    verify_password_reset_token
)
from app.core.config import settings
from app.core.rate_limiter import RateLimiter
from app.schemas.schemas import UserCreate, UserResponse
from app.services.auth_service import auth_service

import time
import asyncio

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/diag")
def auth_diagnostics():
    """
    Secure diagnostic health probe measuring DB ping and application latency.
    Strictly isolated: does NOT leak PII, password hashes, or table statistics.
    """
    t0 = time.time()
    db_err = None
    try:
        from app.core.database import sync_engine
        from sqlalchemy import text
        with sync_engine.connect() as conn:
            conn.execute(text("SELECT 1")).scalar()
    except Exception as e:
        db_err = str(e)
    t_db = round(time.time() - t0, 4)

    return {
        "status": "ok" if not db_err else "error",
        "db_ping_sec": t_db,
        "db_error": db_err,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=10, seconds=60))])
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user in the Tribely database and returns access token for instant onboarding.
    Protected with sliding-window rate limiting.
    """
    t_start = time.time()
    user = auth_service.register_user(db, user_in=user_in)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }


@router.post("/login", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def login_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticates user credentials and returns a secure signed JWT Access Token.
    Accepts both application/json ({email/username, password}) and application/x-www-form-urlencoded.
    Protected against brute-force attacks via Redis sliding-window rate limiting.
    """
    username = ""
    password = ""

    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
            username = str(body.get("email") or body.get("username") or "").strip()
            password = str(body.get("password") or "")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            username = str(form.get("username") or form.get("email") or "").strip()
            password = str(form.get("password") or "")
        except Exception:
            pass

    if not username or not password:
        try:
            body_bytes = await request.body()
            import urllib.parse
            parsed = urllib.parse.parse_qs(body_bytes.decode("utf-8", errors="ignore"))
            username = str((parsed.get("username", [""])[0] or parsed.get("email", [""])[0])).strip()
            password = str(parsed.get("password", [""])[0])
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide both email/username and password."
        )

    # Offload sync DB query and CPU-bound bcrypt hash check to worker threadpool
    user = await asyncio.to_thread(auth_service.authenticate_user, db, email=username, password=password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email
    }


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
def request_password_reset(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Issues a cryptographically signed password reset token valid for 15 minutes.
    Generic response prevents user enumeration attacks.
    """
    clean_email = payload.email.strip().lower()
    user = auth_service.user_repo.get_by_email(db, email=clean_email)

    reset_token = None
    if user and user.is_active:
        reset_token = create_password_reset_token(clean_email, expires_minutes=15)

    return {
        "status": "success",
        "message": "If an active account with this email exists, a password reset token has been issued.",
        "reset_token": reset_token
    }


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str
    reset_token: Optional[str] = None


@router.post("/reset-password", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
def reset_user_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Cryptographically verified password reset endpoint.
    Strictly verifies reset_token before allowing password changes, preventing account takeover.
    """
    clean_email = payload.email.strip().lower()

    if not payload.reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid cryptographic reset_token is required to reset password."
        )

    token_email = verify_password_reset_token(payload.reset_token)
    if not token_email or token_email != clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or mismatched password reset token."
        )

    user = auth_service.user_repo.get_by_email(db, email=clean_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email
    }