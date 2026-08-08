import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text, UniqueConstraint, MetaData, Float
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

# Explicit PostgreSQL Naming Convention to prevent Alembic auto-naming collisions
POSTGRES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

Base.metadata.naming_convention = POSTGRES_NAMING_CONVENTION


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    wallet = relationship("UserWallet", back_populates="user", uselist=False, cascade="all, delete-orphan")
    memberships = relationship("ArenaMembership", back_populates="user", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    profile_image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, server_default=func.now())

    user = relationship("User", back_populates="profile")



class Arena(Base):
    __tablename__ = "arenas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    invite_code = Column(String, unique=True, index=True, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    proof_type = Column(String, default="image") 
    penalty_amount = Column(Numeric(10, 2), default=0.00)
    deadline_time = Column(String, default="00:00") 
    is_private = Column(Boolean, default=False)
    icon_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    memberships = relationship("ArenaMembership", back_populates="arena", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="arena", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="arena", cascade="all, delete-orphan")
    logbook_entries = relationship("ArenaLogbook", back_populates="arena", cascade="all, delete-orphan")


class ArenaMembership(Base):
    __tablename__ = "arena_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    
    status = Column(String, default="approved", index=True) 
    role = Column(String, default="member") 
    joined_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    user = relationship("User", back_populates="memberships")
    arena = relationship("Arena", back_populates="memberships")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text") 
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True, server_default=func.now())

    arena = relationship("Arena", back_populates="messages")
    user = relationship("User", back_populates="messages")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    proof_url = Column(Text, nullable=False) 
    is_verified = Column(Boolean, default=True)
    submitted_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True, server_default=func.now())

    # Core Metrics Trackers
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    is_absent = Column(Boolean, default=False, index=True, nullable=False)

    arena = relationship("Arena", back_populates="submissions")
    user = relationship("User", back_populates="submissions")


class SubmissionVote(Base):
    __tablename__ = "submission_votes"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    vote_type = Column(String, nullable=False)  # "up" or "down"
    voted_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    __table_args__ = (UniqueConstraint('submission_id', 'user_id', name='_user_submission_vote_uc'),)


class DailyArenaSheet(Base):
    __tablename__ = "daily_arena_sheets"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date_day = Column(String, index=True, nullable=False)  
    status = Column(String, nullable=False)    
    proof_type = Column(String, nullable=True)  
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    __table_args__ = (UniqueConstraint('arena_id', 'user_id', 'date_day', name='_arena_user_day_uc'),)


class ArenaLogbook(Base):
    __tablename__ = "arena_logbook"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    entry_type = Column(String, nullable=False) 
    amount = Column(Numeric(10, 2), default=0.00) 
    description = Column(Text, nullable=True)
    logged_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    arena = relationship("Arena", back_populates="logbook_entries")


class OutboxEvent(Base):
    """
    Transactional Outbox Pattern table.
    Guarantees at-least-once event delivery for WebSockets and background tasks.
    """
    __tablename__ = "outbox_events"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, index=True, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    payload = Column(Text, nullable=False)
    processed = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True, server_default=func.now())


class EscrowLedger(Base):
    """
    Double-Entry Bookkeeping Ledger schema enforcing direct INR currency tracking.
    Columns: id, arena_id, user_id, debit_account, credit_account, amount_inr, entry_type, idempotency_key, created_at.
    """
    __tablename__ = "escrow_ledger"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    debit_account = Column(String, nullable=False)
    credit_account = Column(String, nullable=False)
    amount_inr = Column(Float, default=0.0, nullable=False)
    entry_type = Column(String, nullable=False, default="penalty_accrual")
    razorpay_payment_id = Column(String, nullable=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())


class ArenaPool(Base):
    """
    Accumulated reserve pool, reward pool, and locked Kudos reserve vault for an Arena.
    Columns: id, arena_id, reserve_pool_inr, reward_pool_inr, total_penalties_count, kudos_reserve_vault, cycle_start_date, cycle_days_count, updated_at.
    """
    __tablename__ = "arena_pools"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    reserve_pool_inr = Column(Float, default=0.0, nullable=False)
    reward_pool_inr = Column(Float, default=0.0, nullable=False)
    total_penalties_count = Column(Integer, default=0, nullable=False)
    kudos_reserve_vault = Column(Float, default=0.0, nullable=False)
    cycle_start_date = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())
    cycle_days_count = Column(Integer, default=21, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, server_default=func.now())

    arena = relationship("Arena")


class UserWallet(Base):
    """
    User accumulated wallet balance, Kudos digital currency, UPI AutoPay mandate, and RazorpayX payout tracking.
    Columns: id, user_id, balance_inr, kudos_balance, last_reward_won_at, razorpay_customer_id, mandate_id, mandate_status, upi_vpa, pending_penalty.
    """
    __tablename__ = "user_wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    balance_inr = Column(Float, default=0.0, nullable=False)
    kudos_balance = Column(Float, default=1000.0, nullable=False)
    last_reward_won_at = Column(DateTime(timezone=True), nullable=True)
    razorpay_customer_id = Column(String, nullable=True)
    mandate_id = Column(String, nullable=True, index=True)
    mandate_status = Column(String, default="active", nullable=False)
    upi_vpa = Column(String, nullable=True)
    pending_penalty = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="wallet")



class KudosLedger(Base):
    """
    Double-Entry Ledger tracking all Kudos digital currency transactions.
    Types: WELCOME_BONUS, PENALTY_DEDUCTION, ARENA_VAULT_DEPOSIT, CONSISTENCY_PAYOUT, KUDOS_PURCHASE, KUDOS_WITHDRAWAL.
    """
    __tablename__ = "kudos_ledger"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=True)
    transaction_type = Column(String, nullable=False, index=True)
    amount_kudos = Column(Float, nullable=False)
    debit_account = Column(String, nullable=False)
    credit_account = Column(String, nullable=False)
    razorpay_payment_id = Column(String, nullable=True, index=True)
    razorpay_payout_id = Column(String, nullable=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

