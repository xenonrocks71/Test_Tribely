from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.config import settings
from app.schemas.schemas import UserCreate, UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user in the Tribely application database and returns access token for instant onboarding.
    """
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

@router.post("/login")
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticates user credentials and returns a secure signed JWT Access Token with user metadata.
    Delegates authentication checks to AuthService.
    """
    user = auth_service.authenticate_user(db, email=form_data.username, password=form_data.password)
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
        "full_name": user.full_name
    }