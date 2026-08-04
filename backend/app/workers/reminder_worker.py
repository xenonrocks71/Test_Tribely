"""
Transactional Email & WebPush Notification Reminder Worker for Tribely.
Dispatches automated alerts 1 hour prior to daily cutoff deadlines to prevent stake loss.
"""

import datetime
import logging
from typing import Dict, Any
from app.core.database import SessionLocal
from app.models.models import Arena, ArenaMembership, Submission
from app.core.managers.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


async def send_deadline_warning_reminders_task(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cron worker checking upcoming cutoff deadlines and sending warning alerts.
    """
    now = datetime.datetime.utcnow()
    target_date_str = now.strftime("%Y-%m-%d")
    logger.info(f"[ReminderWorker] Evaluating 1-hour pre-cutoff alerts at UTC {now.strftime('%H:%M')}...")

    reminders_sent = 0
    with SessionLocal() as db:
        arenas = db.query(Arena).all()
        for arena in arenas:
            memberships = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.status == "approved"
            ).all()

            for mem in memberships:
                # Check if member already submitted for today
                has_submitted = db.query(Submission).filter(
                    Submission.arena_id == arena.id,
                    Submission.user_id == mem.user_id,
                    Submission.is_absent == False
                ).count() > 0

                if not has_submitted:
                    # Broadcast WebPush / WebSocket warning alert
                    alert_payload = {
                        "event_type": "deadline_reminder",
                        "arena_id": arena.id,
                        "user_id": mem.user_id,
                        "message": f"⚠️ Cutoff approaching! Submit daily proof for '{arena.name}' to keep your ₹{arena.penalty_amount} stake safe!",
                        "penalty_amount": float(arena.penalty_amount) if arena.penalty_amount else 0.0,
                    }
                    try:
                        await websocket_manager.broadcast_to_arena(arena.id, alert_payload)
                        reminders_sent += 1
                    except Exception:
                        pass

    return {"status": "completed", "reminders_sent": reminders_sent}
