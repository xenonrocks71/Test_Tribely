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
from app.models.models import User, Arena, ArenaMembership
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


@router.post("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks all notifications for the authenticated user as read.
    """
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return success_response({"message": "All notifications marked as read."})


@router.get("/history")
def get_notification_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches user's recent notification log history.
    Dynamically aggregates:
    1. Pending join requests for private arenas where current_user is creator or admin.
    2. Proof submissions, new member joins, chat notices, and gamification rewards.
    """
    import json

    # 1. Identify arenas where current_user has administrative ownership
    admin_arenas = db.query(Arena).filter(
        (Arena.creator_id == current_user.id) | (Arena.created_by == current_user.id)
    ).all()
    admin_arena_map = {a.id: a for a in admin_arenas}

    admin_mems = db.query(ArenaMembership).filter(
        ArenaMembership.user_id == current_user.id,
        ArenaMembership.role.in_(["admin", "owner"]),
        ArenaMembership.status == "approved"
    ).all()
    for m in admin_mems:
        if m.arena_id not in admin_arena_map:
            arena_obj = db.query(Arena).filter(Arena.id == m.arena_id).first()
            if arena_obj:
                admin_arena_map[m.arena_id] = arena_obj

    admin_arena_ids = set(admin_arena_map.keys())

    # 2. Query active pending join requests for arenas owned by current_user
    pending_items = []
    seen_pending_keys = set()
    if admin_arena_ids:
        pending_memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id.in_(admin_arena_ids),
            ArenaMembership.status == "pending"
        ).order_by(ArenaMembership.joined_at.desc()).all()

        for pm in pending_memberships:
            arena_name = pm.arena.name if pm.arena else admin_arena_map.get(pm.arena_id, Arena(name="Habit Squad")).name
            applicant_name = pm.user.full_name if (pm.user and pm.user.full_name) else f"Member #{pm.user_id}"
            applicant_avatar = pm.user.profile.profile_image_url if (pm.user and pm.user.profile) else None
            key = (pm.arena_id, pm.user_id)
            seen_pending_keys.add(key)

            pending_items.append({
                "id": f"pending-{pm.arena_id}-{pm.user_id}",
                "arena_id": pm.arena_id,
                "arena_name": arena_name,
                "event_type": "join_request",
                "title": f"Join Request: {applicant_name}",
                "body": f"{applicant_name} requested to join {arena_name}.",
                "is_read": False,
                "created_at": pm.joined_at.isoformat() if pm.joined_at else str(datetime.utcnow()),
                "target_user_id": pm.user_id,
                "target_user_name": applicant_name,
                "target_user_avatar": applicant_avatar,
                "status": "pending",
                "is_admin_actionable": True,
                "data": {
                    "arena_id": pm.arena_id,
                    "arena_name": arena_name,
                    "user_id": pm.user_id,
                    "user_name": applicant_name,
                    "action_type": "join_request",
                    "status": "pending"
                }
            })

    # 3. Query logged notification history
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()

    notif_items = []
    for n in notifications:
        data_obj = {}
        if n.data_json:
            try:
                data_obj = json.loads(n.data_json)
            except Exception:
                data_obj = {}

        target_uid = data_obj.get("user_id")
        target_name = data_obj.get("user_name")
        status_val = data_obj.get("status", "approved")
        is_actionable = False

        # If this is a join_request notification for an admin
        if n.event_type == "join_request" and n.arena_id in admin_arena_ids:
            if target_uid and (n.arena_id, target_uid) in seen_pending_keys:
                # Already captured above in pending_items
                continue
            # Check current status in DB
            if target_uid:
                mem = db.query(ArenaMembership).filter(
                    ArenaMembership.arena_id == n.arena_id,
                    ArenaMembership.user_id == target_uid
                ).first()
                if mem and mem.status == "pending":
                    is_actionable = True
                    status_val = "pending"
                elif mem and mem.status == "approved":
                    status_val = "approved"
                else:
                    status_val = "rejected"

        arena_title = n.arena.name if n.arena else data_obj.get("arena_name")

        notif_items.append({
            "id": n.id,
            "arena_id": n.arena_id,
            "arena_name": arena_title,
            "event_type": n.event_type,
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else str(datetime.utcnow()),
            "target_user_id": target_uid,
            "target_user_name": target_name,
            "status": status_val,
            "is_admin_actionable": is_actionable,
            "data": data_obj
        })

    # Combined list: pending join requests first, followed by chronological notifications
    combined = pending_items + notif_items

    return success_response({
        "notifications": combined,
        "unread_count": sum(1 for item in combined if not item.get("is_read"))
    })
