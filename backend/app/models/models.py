import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    memberships = relationship("ArenaMembership", back_populates="user", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    profile_image_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User")


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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    memberships = relationship("ArenaMembership", back_populates="arena", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="arena", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="arena", cascade="all, delete-orphan")
    logbook_entries = relationship("ArenaLogbook", back_populates="arena", cascade="all, delete-orphan")


class ArenaMembership(Base):
    __tablename__ = "arena_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(String, default="approved") 
    role = Column(String, default="member") 
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    arena = relationship("Arena", back_populates="memberships")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text") 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    arena = relationship("Arena", back_populates="messages")
    user = relationship("User", back_populates="messages")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    proof_url = Column(Text, nullable=False) 
    is_verified = Column(Boolean, default=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Core Metrics Trackers
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    is_absent = Column(Boolean, default=False, nullable=False)

    arena = relationship("Arena", back_populates="submissions")
    user = relationship("User", back_populates="submissions")


class SubmissionVote(Base):
    __tablename__ = "submission_votes"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote_type = Column(String, nullable=False)  # "up" or "down"
    voted_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('submission_id', 'user_id', name='_user_submission_vote_uc'),)


class DailyArenaSheet(Base):
    __tablename__ = "daily_arena_sheets"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date_day = Column(String, nullable=False)  
    status = Column(String, nullable=False)    
    proof_type = Column(String, nullable=True)  
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('arena_id', 'user_id', 'date_day', name='_arena_user_day_uc'),)


class ArenaLogbook(Base):
    __tablename__ = "arena_logbook"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entry_type = Column(String, nullable=False) 
    amount = Column(Numeric(10, 2), default=0.00) 
    description = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)

    arena = relationship("Arena", back_populates="logbook_entries")