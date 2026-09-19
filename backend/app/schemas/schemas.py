import datetime
import re
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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
    phone_number: Optional[str] = None
    username: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")
    avatar_url: Optional[str] = None
    verification_token: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool = False
    avatar_url: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- OTP & VERIFICATION SCHEMAS ---
class OtpSendRequest(BaseModel):
    email: Optional[EmailStr] = None
    identifier: Optional[str] = None
    phone_number: Optional[str] = None
    purpose: Optional[str] = "registration"

    @model_validator(mode="after")
    def validate_contact_target(self) -> "OtpSendRequest":
        if not self.email and not self.identifier:
            raise ValueError("Either 'email' or 'identifier' must be provided.")
        if not self.email and self.identifier and "@" in self.identifier:
            self.email = self.identifier
        elif self.email and not self.identifier:
            self.identifier = self.email
        return self

class OtpRequestResponse(BaseModel):
    status: Literal["success"] = "success"
    message: str
    expires_in: int = 300

class OtpVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    identifier: Optional[str] = None
    email: Optional[EmailStr] = None
    purpose: Optional[str] = "registration"

    @model_validator(mode="after")
    def validate_verify_identifier(self) -> "OtpVerifyRequest":
        if not self.identifier and not self.email:
            raise ValueError("Either 'identifier' or 'email' must be provided.")
        if not self.identifier and self.email:
            self.identifier = self.email
        return self

class OtpVerifyResponse(BaseModel):
    status: Literal["success"] = "success"
    verification_token: str
    identifier: str
    message: Optional[str] = "Email verified successfully."
    reset_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

class UsernameCheckResponse(BaseModel):
    username: str
    available: bool
    message: str


# --- ARENA SCHEMAS ---
class ArenaBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default="Habit", description="Habit category tag")
    proof_type: str = Field(default="image", description="Allowed: image, text, or link")
    penalty_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    deadline_time: str = Field("11:59 PM", description="Deterministic 12-hour format: HH:MM AM/PM")
    is_private: bool = Field(default=False)
    icon_url: Optional[str] = None
    timezone: Optional[str] = Field(default="UTC", description="Timezone identifier")

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> str:
        if not value or not str(value).strip():
            return "Habit"
        return str(value).strip()

    @field_validator("proof_type")
    @classmethod
    def validate_proof_type(cls, value: Optional[str]) -> str:
        if not value or not str(value).strip():
            return "image"
        normalized = str(value).strip().lower()
        synonyms = {
            "photo": "image",
            "camera": "image",
            "picture": "image",
            "snapshot": "image",
            "url": "link",
            "website": "link",
            "web": "link",
            "reflection": "text",
            "journal": "text",
            "writing": "text",
            "note": "text",
        }
        normalized = synonyms.get(normalized, normalized)
        allowed = {"image", "text", "link"}
        if normalized not in allowed:
            raise ValueError("proof_type must be one of: image, text, link")
        return normalized

    @field_validator("deadline_time")
    @classmethod
    def validate_deadline_time(cls, value: Optional[str]) -> str:
        if not value or not str(value).strip():
            return "11:59 PM"
        normalized = str(value).strip().upper()
        # Add space between minute and AM/PM if omitted (e.g. 11:59PM -> 11:59 PM)
        normalized = re.sub(r"([0-9])([AP]M)", r"\1 \2", normalized)

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
    client_submitted_at: Optional[str] = None
    caption: Optional[str] = None
    telemetry_data: Optional[Dict[str, Any]] = None

class SubmissionResponse(BaseModel):
    id: int
    arena_id: int
    user_id: int
    proof_url: str
    is_verified: bool
    submitted_at: datetime.datetime
    ai_confidence_score: Optional[float] = 0.95
    ai_status: Optional[str] = "verified"
    ai_audit_notes: Optional[str] = None

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


# --- WALLET & TRIBES ECONOMY SCHEMAS ---
class UserWalletResponse(BaseModel):
    id: int
    user_id: int
    tribes_balance: float = Field(..., description="Current wallet balance in Tribes currency")
    is_frozen: bool = Field(..., description="Whether wallet is frozen due to negative balance")
    referral_count: int = Field(..., description="Total completed successful referrals")
    last_reward_won_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class ArenaPoolResponse(BaseModel):
    id: int
    arena_id: int
    reserve_pool_tribes: float
    reward_pool_tribes: float
    tribes_reserve_vault: float
    total_penalties_count: int
    cycle_days_count: int = 21
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


class EscrowLedgerResponse(BaseModel):
    id: int
    arena_id: int
    user_id: Optional[int] = None
    debit_account: str
    credit_account: str
    amount_tribes: float
    entry_type: str
    idempotency_key: str
    description: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- KUDOS ECONOMY SCHEMAS ---
class KudosTransactionResponse(BaseModel):
    id: int
    user_id: int
    arena_id: Optional[int] = None
    amount: int
    type: str
    description: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class KudosWalletResponse(BaseModel):
    user_id: int
    kudos_balance: int
    recent_transactions: List[KudosTransactionResponse] = []


class ArenaJoinStakeRequest(BaseModel):
    invite_code: Optional[str] = None


class ArenaJoinStakeResponse(BaseModel):
    status: str
    message: str
    arena_id: int
    entry_stake_deducted: int
    user_kudos_balance: int
    pool_balance: int


class PenaltyMissedResponse(BaseModel):
    status: str
    message: str
    arena_id: int
    user_id: int
    penalty_deducted: int
    user_kudos_balance: int
    pool_balance: int
    streak_reset_to: int = 0


class WeeklyDistributionWinner(BaseModel):
    user_id: int
    user_name: str
    avatar_url: Optional[str] = None
    rank: int
    streak_count: int
    reward_kudos: int


class WeeklyDistributionResponse(BaseModel):
    status: str
    message: str
    arena_id: int
    total_pool_before: int
    payout_pool: int
    pool_balance_remaining: int
    winners: List[WeeklyDistributionWinner]


class LeaderboardMemberResponse(BaseModel):
    user_id: int
    user_name: str
    user_handle: str
    avatar_url: Optional[str] = None
    rank: int
    badge: str
    streak_count: int
    verified_submissions: int
    projected_weekly_kudos: int


class ArenaPoolDetailsResponse(BaseModel):
    arena_id: int
    title: str
    pool_balance: int
    entry_stake: int
    penalty_amount: int
    weekly_prize_pool: int
    active_members_count: int = 0
    cached_from_redis: bool = False
    recent_winners: List[WeeklyDistributionWinner] = []


# --- USER PROFILE & ACCOUNT SCHEMAS ---

class PasswordChangeRequest(BaseModel):
    """Payload for changing authenticated user account password."""
    current_password: str = Field(..., min_length=1, description="Current existing password")
    new_password: str = Field(..., min_length=6, description="New desired password (min 6 characters)")


class ProfileImageUpdateRequest(BaseModel):
    """Payload for updating user avatar / profile image URL."""
    profile_image_url: str = Field(..., description="Target image URL or data URI")


class ProfileDetailsUpdateRequest(BaseModel):
    """Payload for updating public profile display information."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=120, description="Display name")
    username: Optional[str] = Field(None, min_length=3, max_length=30, description="Unique username handle")
    phone_number: Optional[str] = Field(None, description="Contact phone number")
    profile_image_url: Optional[str] = Field(None, description="Profile avatar URL")
    avatar_url: Optional[str] = Field(None, description="Profile avatar URL alias")
    bio: Optional[str] = Field(None, max_length=500, description="Short user bio")


# --- ADMIN ARENA SCHEMAS ---

class MembershipActionRequest(BaseModel):
    """Payload for administrative membership moderation (kick, approve, reject)."""
    user_id: int = Field(..., description="Target member user ID")
    arena_id: int = Field(..., description="Target arena ID")

# Backward compatibility alias
MembershipAction = MembershipActionRequest


class UpdateProofTypeRequest(BaseModel):
    """Payload for updating arena verification proof type rule."""
    proof_type: str = Field(..., description="Required proof type: 'image', 'link', or 'text'")


class UpdateCutoffRequest(BaseModel):
    """Payload for changing arena daily cutoff deadline time."""
    cutoff_time: str = Field(..., description="Time string in 'HH:MM' or 'HH:MM AM/PM' format")


class UpdateArenaSettingsRequest(BaseModel):
    """Payload for administrative updates to arena configuration, rules, and visuals."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Squad / Arena title")
    description: Optional[str] = Field(None, max_length=1000, description="Arena habit instructions")
    icon_url: Optional[str] = Field(None, description="Arena visual icon / banner URL")
    proof_type: Optional[str] = Field(None, description="Required proof verification modality: 'image', 'link', 'text'")
    deadline_time: Optional[str] = Field(None, description="Daily cutoff time string")
    penalty_amount: Optional[float] = Field(None, ge=0.0, description="Absence penalty stake amount")



# --- ACTIVITY, PROOF & ENGAGEMENT SCHEMAS ---

class VoteRequest(BaseModel):
    """Payload for peer review voting on a habit submission."""
    vote_type: str = Field(..., description="Vote direction: 'up' or 'down'")


class PresignedUrlRequest(BaseModel):
    """Payload for requesting an S3 or local presigned upload URL."""
    filename: str = Field(..., min_length=1, description="Original filename with extension")
    content_type: Optional[str] = Field("image/jpeg", description="MIME type")
    file_type: Optional[str] = Field(None, description="Legacy MIME type alias")

    @model_validator(mode="after")
    def validate_content_type(self) -> "PresignedUrlRequest":
        if not self.content_type and self.file_type:
            self.content_type = self.file_type
        return self


class MessageCreatePayload(BaseModel):
    """Payload for posting a chat message into an arena chamber."""
    content: str = Field(..., min_length=1, max_length=2000, description="Message body text")
    message_type: str = Field("text", description="Message modality: 'text', 'image', or 'audio'")


class ReactionRequest(BaseModel):
    """Payload for toggling an emoji reaction on a proof."""
    reaction_type: Optional[str] = Field(None, description="Reaction type identifier")
    emoji: Optional[str] = Field(None, description="Reaction emoji alias")

    @model_validator(mode="after")
    def validate_reaction(self) -> "ReactionRequest":
        if not self.reaction_type and not self.emoji:
            raise ValueError("Either 'reaction_type' or 'emoji' must be provided.")
        if not self.reaction_type and self.emoji:
            self.reaction_type = self.emoji
        return self


class CommentCreateRequest(BaseModel):
    """Payload for creating a discussion comment on a submission."""
    content: Optional[str] = Field(None, max_length=1000, description="Comment body")
    text: Optional[str] = Field(None, max_length=1000, description="Alternative text body alias")


class NudgePayload(BaseModel):
    """Optional payload when sending a peer accountability nudge."""
    nudge_type: Optional[str] = Field("standard", description="Nudge category")
    message: Optional[str] = Field(None, max_length=280, description="Custom reminder message")


class DiscoveryJoinRequest(BaseModel):
    """Payload for requesting membership to an arena from discovery feed."""
    arena_id: int = Field(..., description="Target arena ID")


class PenalizeUserRequest(BaseModel):
    """Payload for executing a missed deadline absence penalty."""
    user_id: int = Field(..., description="Target user ID to penalize")