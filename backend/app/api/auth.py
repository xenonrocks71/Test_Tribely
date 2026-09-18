from datetime import timedelta
from typing import Optional, Dict, Any
import re
from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile, BackgroundTasks
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
from app.core.storage.storage_factory import StorageFactory
from app.schemas.schemas import (
    UserCreate,
    UserResponse,
    OtpSendRequest,
    OtpRequestResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    UsernameCheckResponse
)
from app.services.auth_service import auth_service
from app.services.otp_service import otp_service
from app.services.email_service import email_service
from app.repositories.user_repository import user_repository

import time
import asyncio

router = APIRouter(prefix="/auth", tags=["Authentication"])


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


@router.post("/otp/send", response_model=OtpRequestResponse, dependencies=[Depends(RateLimiter(times=6, seconds=60))])
@router.post("/request-otp", response_model=OtpRequestResponse, dependencies=[Depends(RateLimiter(times=6, seconds=60))])
def send_verification_otp(
    payload: OtpSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Issues a cryptographically secure 6-digit OTP code.
    - Saves code temporarily to Redis with a 300s TTL (and DB fallback).
    - Enforces a 60-second cooldown rate limit.
    - Delivers an HTML email asynchronously via background tasks.
    """
    target_id = (payload.email or payload.identifier or "").strip().lower()
    purpose = payload.purpose or "registration"

    if purpose == "registration":
        if payload.email:
            existing_user = user_repository.get_by_email(db, target_id)
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address already registered."
                )

        if payload.phone_number:
            clean_phone = payload.phone_number.strip()
            existing_phone = user_repository.get_by_phone(db, clean_phone)
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered."
                )

    # Generate 6-digit OTP, store in Redis with 300s TTL
    code, expires_at = otp_service.generate_otp(
        db=db,
        identifier=target_id,
        purpose=purpose,
        send_email=False  # Handled asynchronously by BackgroundTasks below
    )

    # Asynchronous non-blocking email dispatch
    if "@" in target_id:
        background_tasks.add_task(
            email_service.send_otp_email_sync,
            target_id,
            code,
            max(1, settings.OTP_TTL_SECONDS // 60)
        )

    return {
        "status": "success",
        "message": f"Verification code sent to {target_id}.",
        "expires_in": settings.OTP_TTL_SECONDS
    }


@router.post("/otp/verify", response_model=OtpVerifyResponse, dependencies=[Depends(RateLimiter(times=12, seconds=60))])
@router.post("/verify-otp", response_model=OtpVerifyResponse, dependencies=[Depends(RateLimiter(times=12, seconds=60))])
def verify_verification_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies 6-digit OTP code against Redis temporary cache (or DB).
    - Implements constant-time HMAC check against timing attacks.
    - Deletes Redis key atomically upon success (Replay Attack Prevention).
    - Returns signed JWT verification token (or auth access_token for OTP login).
    """
    target_id = (payload.identifier or payload.email or "").strip().lower()
    purpose = payload.purpose or "registration"

    token = otp_service.verify_otp(
        db=db,
        identifier=target_id,
        code=payload.code,
        purpose=purpose
    )

    # If login flow, generate access token directly
    access_token = None
    if purpose == "login":
        existing_user = user_repository.get_by_email(db, target_id)
        if existing_user:
            access_token = create_access_token(
                existing_user.id,
                {"sub": str(existing_user.id), "email": existing_user.email, "role": existing_user.role}
            )

    reset_token = None
    if purpose in ["password_reset", "forgot_password"]:
        reset_token = create_password_reset_token(target_id, expires_minutes=15)

    return {
        "status": "success",
        "verification_token": token,
        "identifier": target_id,
        "message": "Code verified successfully.",
        "reset_token": reset_token or token,
        "access_token": access_token,
        "token_type": "bearer" if access_token else None
    }


@router.get("/check-username", response_model=UsernameCheckResponse)
def check_username_availability(username: str, db: Session = Depends(get_db)):
    """
    Real-time username availability probe. Validates 3-30 chars, alphanumeric + underscores.
    """
    clean_username = username.strip().lower()
    if not re.match(r"^[a-zA-Z0-9_]{3,30}$", clean_username):
        return {
            "username": clean_username,
            "available": False,
            "message": "Username must be 3-30 characters (letters, numbers, underscores only)."
        }

    existing = user_repository.get_by_username(db, clean_username)
    if existing:
        return {
            "username": clean_username,
            "available": False,
            "message": "Username is already taken."
        }

    return {
        "username": clean_username,
        "available": True,
        "message": "Username is available!"
    }


ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB limit for profile picture


@router.post("/upload-avatar", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def upload_registration_avatar(file: UploadFile = File(...)):
    """
    Unauthenticated public upload endpoint for user avatar during Instagram-style onboarding.
    Strictly validates MIME type, magic bytes, and enforces 5MB file cap.
    """
    content_type = (file.content_type or "application/octet-stream").lower().split(";")[0].strip()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type. Allowed: {', '.join(sorted(ALLOWED_AVATAR_TYPES))}"
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Profile picture exceeds maximum allowed size of 5MB."
        )

    # Magic byte verification
    is_valid = False
    if content_type in ["image/jpeg", "image/jpg"] and file_bytes.startswith(b"\xff\xd8\xff"):
        is_valid = True
    elif content_type == "image/png" and file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid = True
    elif content_type == "image/webp" and len(file_bytes) > 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match reported image format."
        )

    try:
        storage = StorageFactory.get_storage_engine()
        filename = file.filename or f"avatar_{int(time.time())}.jpg"
        public_url = storage.upload_file(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type
        )
        return {
            "status": "success",
            "url": public_url
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        )


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
        "username": user.username,
        "phone_number": user.phone_number,
        "avatar_url": user.avatar_url,
        "full_name": user.full_name,
        "is_verified": user.is_verified,
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
def request_password_reset(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Issues a cryptographically secure 6-digit OTP to the user's email for password reset.
    Generic response prevents user enumeration attacks. Never exposes OTP or reset token on screen.
    """
    clean_email = payload.email.strip().lower()
    user = auth_service.user_repo.get_by_email(db, email=clean_email)

    if user and user.is_active:
        code, expires_at = otp_service.generate_otp(
            db=db,
            identifier=clean_email,
            purpose="password_reset",
            send_email=False
        )
        background_tasks.add_task(
            email_service.send_otp_email_sync,
            clean_email,
            code,
            max(1, settings.OTP_TTL_SECONDS // 60)
        )

    return {
        "status": "success",
        "message": "If an active account exists with this email address, a 6-digit verification code has been sent to your email."
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
    if not token_email:
        # Also check OTP verified token with purpose password_reset
        if otp_service.validate_verification_token(payload.reset_token, clean_email, purpose="password_reset"):
            token_email = clean_email

    if not token_email or token_email != clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or mismatched password reset token. Please verify your code again."
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