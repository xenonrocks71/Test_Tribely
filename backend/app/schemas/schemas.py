import datetime
import re
from decimal import Decimal
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# --- API RESPONSE ENVELOPE ---
class ApiSuccessResponse(BaseModel):
    status: Literal["success"] = "success"
    data: Any

# --- AUTH/TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    full_name: str

class TokenData(BaseModel):
    user_id: Optional[int] = None


# --- USER SCHEMAS ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- ARENA SCHEMAS ---
class ArenaBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    proof_type: str = Field(..., description="Allowed: image, text, or link")
    penalty_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    deadline_time: str = Field("12:00 AM", description="Deterministic 12-hour format: HH:MM AM/PM")
    is_private: bool = Field(default=False)
    icon_url: Optional[str] = None

    @field_validator("proof_type")
    @classmethod
    def validate_proof_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"image", "text", "link"}
        if normalized not in allowed:
            raise ValueError("proof_type must be one of: image, text, link")
        return normalized

    @field_validator("deadline_time")
    @classmethod
    def validate_deadline_time(cls, value: str) -> str:
        normalized = value.strip().upper()
        twelve_hour_pattern = r"^(0?[1-9]|1[0-2]):[0-5][0-9]\s[AP]M$"
        twenty_four_hour_pattern = r"^(?:[01]\d|2[0-3]):[0-5]\d$"

        if re.match(twelve_hour_pattern, normalized):
            parsed = datetime.datetime.strptime(normalized, "%I:%M %p")
        elif re.match(twenty_four_hour_pattern, normalized):
            parsed = datetime.datetime.strptime(normalized, "%H:%M")
        else:
            raise ValueError("deadline_time must use HH:MM AM/PM or legacy 24-hour HH:MM format")

        return parsed.strftime("%I:%M %p")

class ArenaCreate(ArenaBase):
    pass

class ArenaResponse(ArenaBase):
    id: int
    invite_code: str
    creator_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- ARENA MEMBERSHIP SCHEMAS ---
class MembershipBase(BaseModel):
    arena_id: Optional[int] = None

class MembershipCreate(BaseModel):
    invite_code: str
    arena_id: Optional[int] = None


class MembershipUpdate(BaseModel):
    status: str = Field(..., description="Must be 'approved' or 'rejected'")

class MembershipResponse(BaseModel):
    id: int
    user_id: int
    arena_id: int
    status: str
    role: str
    joined_at: datetime.datetime

    class Config:
        from_attributes = True


# --- SUBMISSION SCHEMAS ---
class SubmissionCreate(BaseModel):
    arena_id: int
    proof_url: str

class SubmissionResponse(BaseModel):
    id: int
    arena_id: int
    user_id: int
    proof_url: str
    is_verified: bool
    submitted_at: datetime.datetime

    class Config:
        from_attributes = True


# --- MESSAGE SCHEMAS ---
class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"

class MessageResponse(BaseModel):
    id: int
    arena_id: int
    user_id: int
    content: str
    message_type: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True