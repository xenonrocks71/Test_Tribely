"""
Notification Service Implementation (Meta/Instagram Standard).
Encapsulates Web Push registration, real-time arena unread counter badges,
and Pub/Sub notification dispatching across mobile PWA and desktop OS devices.
"""

import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import User, Arena, ArenaMembership
from app.models.notification_models import Notification, PushSubscription, ArenaUnreadTracker
from app.core.managers.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


class NotificationService:
    """
    High-Scale Notification & Unread Tracking Service.
    Manages non-blocking pub/sub notifications, device push subscriptions, and dynamic unread badge tags.
    """

    def register_push_subscription(
        self,
        db: Session,
        *,
        user_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        device_type: str = "web_pwa"
    ) -> PushSubscription:
        """
        Register or update browser WebPush subscription credentials for native PWA / Desktop OS alerts.
        """
        existing = db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint
        ).first()

        if existing:
            existing.p256dh = p256dh
            existing.auth = auth
            existing.device_type = device_type
            db.commit()
            db.refresh(existing)
            return existing

        new_sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            device_type=device_type
        )
        db.add(new_sub)
        db.commit()
        db.refresh(new_sub)
        return new_sub

    def mark_arena_as_read(self, db: Session, *, user_id: int, arena_id: int, last_message_id: int = 0) -> Dict[str, Any]:
        """
        Marks an arena as read for a user, resetting unread_count to 0 and removing the unread badge tag.
        """
        tracker = db.query(ArenaUnreadTracker).filter(
            ArenaUnreadTracker.user_id == user_id,
            ArenaUnreadTracker.arena_id == arena_id
        ).first()

        if not tracker:
            tracker = ArenaUnreadTracker(
                user_id=user_id,
                arena_id=arena_id,
                unread_count=0,
                last_read_message_id=last_message_id
            )
            db.add(tracker)
        else:
            tracker.unread_count = 0
            if last_message_id > tracker.last_read_message_id:
                tracker.last_read_message_id = last_message_id
            tracker.updated_at = datetime.utcnow()

        db.commit()

        # Broadcast instant unread cleared update over WebSocket
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(websocket_manager.broadcast_to_arena(arena_id, {
                "event_type": "unread_cleared",
                "arena_id": arena_id,
                "user_id": user_id,
                "unread_count": 0
            }))
        except Exception:
            pass

        return {"status": "success", "arena_id": arena_id, "user_id": user_id, "unread_count": 0}

    def get_user_unread_counts(self, db: Session, *, user_id: int) -> Dict[int, int]:
        """
        Fetch map of unread counts per arena for the user.
        :return: Dict[arena_id, unread_count]
        """
        trackers = db.query(ArenaUnreadTracker).filter(
            ArenaUnreadTracker.user_id == user_id
        ).all()
        return {t.arena_id: t.unread_count for t in trackers}

    def increment_unread_for_arena_members(self, db: Session, *, arena_id: int, sender_id: int) -> List[int]:
        """
        Increments unread count for all approved arena members except the sender.
        Returns list of recipient user IDs.
        """
        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        recipient_ids = []
        for mem in memberships:
            if mem.user_id == sender_id:
                continue

            recipient_ids.append(mem.user_id)
            tracker = db.query(ArenaUnreadTracker).filter(
                ArenaUnreadTracker.user_id == mem.user_id,
                ArenaUnreadTracker.arena_id == arena_id
            ).first()

            if not tracker:
                tracker = ArenaUnreadTracker(
                    user_id=mem.user_id,
                    arena_id=arena_id,
                    unread_count=1
                )
                db.add(tracker)
            else:
                tracker.unread_count += 1
                tracker.updated_at = datetime.utcnow()

        db.commit()
        return recipient_ids

    def publish_arena_event_notification(
        self,
        db: Session,
        *,
        arena_id: int,
        sender_id: int,
        event_type: str,
        title: str,
        body: str,
        data_json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Pub/Sub event notification dispatcher:
        1. Increments per-member unread counters in DB.
        2. Logs Notification records.
        3. Dispatches WebSockets unread badge update.
        4. Triggers background PWA Web Push notification worker.
        """
        recipient_ids = self.increment_unread_for_arena_members(db, arena_id=arena_id, sender_id=sender_id)

        # Log Notification records
        payload_str = json.dumps(data_json or {})
        for r_id in recipient_ids:
            notif = Notification(
                user_id=r_id,
                arena_id=arena_id,
                event_type=event_type,
                title=title,
                body=body,
                data_json=payload_str
            )
            db.add(notif)
        db.commit()

        # Broadcast live unread_update via WebSockets for instant in-app badge tag rendering
        try:
            loop = asyncio.get_running_loop()
            for r_id in recipient_ids:
                # Fetch updated unread_count
                tracker = db.query(ArenaUnreadTracker).filter(
                    ArenaUnreadTracker.user_id == r_id,
                    ArenaUnreadTracker.arena_id == arena_id
                ).first()
                count = tracker.unread_count if tracker else 1
                
                payload = {
                    "event_type": "unread_update",
                    "arena_id": arena_id,
                    "target_user_id": r_id,
                    "unread_count": count,
                    "notification": {
                        "title": title,
                        "body": body,
                        "event_type": event_type,
                        "data_json": data_json or {}
                    }
                }
                loop.create_task(websocket_manager.broadcast_to_arena(arena_id, payload))
                loop.create_task(websocket_manager.broadcast_to_user(r_id, payload))
        except Exception as e:
            logger.warning(f"WebSocket unread broadcast warning: {e}")


        # Trigger PWA Web Push Notification Worker in background
        from app.workers.notification_worker import dispatch_web_push_notifications_task
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(dispatch_web_push_notifications_task(
                recipient_ids=recipient_ids,
                title=title,
                body=body,
                data_json=data_json or {"arena_id": arena_id}
            ))
        except Exception as e:
            logger.warning(f"WebPush worker task dispatch error: {e}")

        return {
            "status": "published",
            "arena_id": arena_id,
            "recipients_count": len(recipient_ids)
        }


# Singleton instance
notification_service = NotificationService()
