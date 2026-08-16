"""
Transactional Outbox Event Worker for Tribely.
Reads unprocessed outbox events from the database and publishes them to Redis Pub/Sub,
guaranteeing at-least-once real-time event delivery across micro-services.
"""

import json
import logging
from typing import Dict, Any
from app.core.database import SessionLocal
from app.models.models import OutboxEvent
from app.core.managers.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


async def process_outbox_events_job(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process unprocessed transactional outbox events using FOR UPDATE SKIP LOCKED.
    """
    processed_count = 0
    with SessionLocal() as db:
        unprocessed_events = db.query(OutboxEvent).filter(
            OutboxEvent.processed == False
        ).order_by(OutboxEvent.created_at.asc()).with_for_update(skip_locked=True).limit(50).all()

        for event in unprocessed_events:
            try:
                payload_dict = json.loads(event.payload)
                await websocket_manager.broadcast_to_arena(event.arena_id, payload_dict)
                event.processed = True
                processed_count += 1
            except Exception as e:
                logger.error(f"Failed to process outbox event #{event.id}: {e}")

        if processed_count > 0:
            db.commit()

    return {"status": "completed", "processed_events": processed_count}

