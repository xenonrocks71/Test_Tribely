"""
Notification & Web Push Subscription Domain Models for Tribely.
Implements Meta/Instagram-scale Pub/Sub Notification tracking, PWA Push Subscriptions,
and Per-Member Arena Unread Counter Badges.
"""

import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Notification(Base):
    """
    User Notification Log Entity.
    Stores notification alerts dispatched to users across mobile PWA and desktop OS devices.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=True)
    event_type = Column(String, index=True, nullable=False)  # "chat_message", "proof_submission", "call_invite", "penalty_deducted", "kudos_reward"
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    data_json = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, index=True, server_default=func.now())

    user = relationship("User", backref="notifications")
    arena = relationship("Arena", backref="notifications")


class PushSubscription(Base):
    """
    PWA & WebPush Subscription Device Credentials.
    Stores VAPID endpoints and keys for browser PushManager.
    """
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    device_type = Column(String, default="web_pwa", nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="_user_push_endpoint_uc"),)

    user = relationship("User", backref="push_subscriptions")


class ArenaUnreadTracker(Base):
    """
    Per-Member Arena Unread Message & Event Counter.
    Powers in-app notification badges (e.g. 17 unread count on arena card) and auto-clearing upon view.
    """
    __tablename__ = "arena_unread_trackers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    arena_id = Column(Integer, ForeignKey("arenas.id", ondelete="CASCADE"), index=True, nullable=False)
    unread_count = Column(Integer, default=0, nullable=False)
    last_read_message_id = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, server_default=func.now())

    __table_args__ = (UniqueConstraint("user_id", "arena_id", name="_user_arena_unread_uc"),)

    user = relationship("User", backref="unread_trackers")
    arena = relationship("Arena", backref="unread_trackers")
