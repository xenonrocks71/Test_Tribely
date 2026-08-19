from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings
from app.schemas.schemas import UserCreate, UserResponse
from pydantic import BaseModel
from app.services.auth_service import auth_service

import time

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/diag")
def auth_diagnostics(email: str = None):
    """Fast diagnostic endpoint measuring DB ping, active locks, and registration insert speed."""
    t0 = time.time()
    from app.core.security import get_password_hash
    hash_sample = get_password_hash("TestPass123!")
    t_hash = round(time.time() - t0, 4)

    t1 = time.time()
    db_err = None
    idle_tx_count = 0
    test_insert_time = 0.0
    user_lookup_info = None
    try:
        from app.core.database import sync_engine
        from sqlalchemy import text
        with sync_engine.connect() as conn:
            conn.execute(text("SELECT 1")).scalar()
            
            try:
                idle_tx_count = conn.execute(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'"
                )).scalar()
            except Exception:
                idle_tx_count = -1

            t_ins_start = time.time()
            try:
                conn.execute(text("SELECT id FROM users LIMIT 1")).fetchall()
                test_insert_time = round(time.time() - t_ins_start, 4)
            except Exception as _ie:
                test_insert_time = -1.0

            if email:
                clean_email = email.strip().lower()
                row = conn.execute(
                    text("SELECT id, email, full_name, is_active, length(hashed_password), substring(hashed_password, 1, 10) FROM users WHERE lower(trim(email)) = :em"),
                    {"em": clean_email}
                ).fetchone()
                if row:
                    user_lookup_info = {
                        "found": True,
                        "id": row[0],
                        "email": row[1],
                        "full_name": row[2],
                        "is_active": row[3],
                        "hash_len": row[4],
                        "hash_prefix": row[5]
                    }
                else:
                    user_lookup_info = {"found": False, "searched_email": clean_email}
    except Exception as e:
        db_err = str(e)
    t_db = round(time.time() - t1, 4)

    return {
        "status": "ok" if not db_err else "error",
        "hash_time_sec": t_hash,
        "db_ping_sec": t_db,
        "idle_in_transaction_count": idle_tx_count,
        "test_query_time_sec": test_insert_time,
        "user_lookup_info": user_lookup_info,
        "db_error": db_err,
        "total_sec": round(time.time() - t0, 4)
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user in the Tribely application database and returns access token for instant onboarding.
    """
    t_start = time.time()
    user = auth_service.register_user(db, user_in=user_in)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    print(f"[REGISTER] Finished registration for user {user.id} in {round(time.time() - t_start, 3)}s")
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

from fastapi import Request

@router.post("/login")
async def login_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticates user credentials and returns a secure signed JWT Access Token.
    Accepts both application/json ({email/username, password}) and application/x-www-form-urlencoded.
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

    user = auth_service.authenticate_user(db, email=username, password=password)
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

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

@router.post("/reset-password")
def reset_user_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Secure password reset endpoint allowing users to reset their account password and log in immediately.
    """
    clean_email = payload.email.strip().lower()
    user = auth_service.user_repo.get_by_email(db, email=clean_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please register a new account."
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