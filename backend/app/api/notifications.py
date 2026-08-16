"""
Notification API Controller (Meta/Instagram Standard).
Provides endpoints for WebPush subscription registration, dynamic unread counter badge fetching,
auto-clearing unread notification tags, and fetching notification logs.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.models.notification_models import Notification
from app.services.notification_service import notification_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications & Device Push"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


class PushSubscriptionSchema(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    device_type: str = "web_pwa"


class MarkReadRequest(BaseModel):
    last_read_message_id: Optional[int] = 0


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def register_push_subscription(
    payload: PushSubscriptionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registers browser PushManager subscription keys for mobile PWA & desktop OS native notifications.
    """
    sub = notification_service.register_push_subscription(
        db,
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
        device_type=payload.device_type
    )
    return success_response({"message": "Push notification device subscription registered successfully", "id": sub.id})


@router.get("/unread-counts")
def get_unread_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches map of unread counter badges per arena for the authenticated user.
    """
    counts = notification_service.get_user_unread_counts(db, user_id=current_user.id)
    return success_response({"unread_counts": counts})


@router.post("/arena/{arena_id}/read")
def mark_arena_as_read(
    arena_id: int,
    payload: MarkReadRequest = MarkReadRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks an arena as read, clearing the unread counter tag (badge count -> 0).
    """
    res = notification_service.mark_arena_as_read(
        db,
        user_id=current_user.id,
        arena_id=arena_id,
        last_message_id=payload.last_read_message_id or 0
    )
    return success_response(res)


@router.get("/history")
def get_notification_history(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches user's recent notification log history.
    """
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()

    return success_response({
        "notifications": [
            {
                "id": n.id,
                "arena_id": n.arena_id,
                "event_type": n.event_type,
                "title": n.title,
                "body": n.body,
                "is_read": n.is_read,
                "created_at": str(n.created_at)
            } for n in notifications
        ]
    })
