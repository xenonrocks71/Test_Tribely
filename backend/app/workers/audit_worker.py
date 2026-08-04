"""
Distributed Arq Async Task Worker for Tribely Background Deadline Audits.
Handles scheduled cron triggers, Redis Redlock acquisition, idempotent penalty logging,
and non-blocking lock retention across distributed worker pods.
"""

import os
import sys
import datetime
import logging
from typing import Dict, Any, Optional

from arq import cron
from arq.connections import RedisSettings

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import Arena
from app.core.redis import get_redis_client, close_redis_client
from app.workers.locks import RedisDistributedLock
from app.services.audit_service import audit_service
from app.workers.outbox_worker import process_outbox_events_job
from app.workers.media_worker import process_proof_image_task
from app.workers.reminder_worker import send_deadline_warning_reminders_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_arena_deadline_audit(
    ctx: Dict[str, Any],
    arena_id: int,
    target_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Execute deadline audit for a single arena with non-blocking Redis Redlock protection.

    :param ctx: Arq context dictionary.
    :param arena_id: Target arena ID.
    :param target_date_str: YYYY-MM-DD date string. Defaults to today's UTC date.
    :return: Audit execution summary or lock yield status.
    """
    if not target_date_str:
        target_date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    redis = await get_redis_client()
    lock = RedisDistributedLock(redis, arena_id=arena_id, date_str=target_date_str, ttl_seconds=300)

    acquired = await lock.acquire()
    if not acquired:
        logger.info(f"Audit lock already active for arena {arena_id}. Skipping worker execution.")
        return {"status": "locked", "arena_id": arena_id, "target_date": target_date_str}

    try:
        logger.info(f"Starting deadline audit for Arena #{arena_id} on {target_date_str}")
        with SessionLocal() as db:
            result = audit_service.audit_arena_deadline(db, arena_id=arena_id, target_date_str=target_date_str)
        logger.info(f"Completed deadline audit for Arena #{arena_id}: {result}")
        return result
    finally:
        await lock.release()


async def cron_global_deadline_audit(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Scheduled cron job executing every 15 minutes to evaluate cutoff deadlines across active arenas.

    :param ctx: Arq context dictionary.
    :return: Dict summary of audited arenas.
    """
    now = datetime.datetime.utcnow()
    target_date_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M")

    logger.info(f"[CronAudit] Checking cutoff deadlines at UTC time {current_time_str}...")

    audited_arenas = []
    with SessionLocal() as db:
        arenas = db.query(Arena).all()
        for arena in arenas:
            # Enqueue audit task for each active arena
            await run_arena_deadline_audit(ctx, arena_id=arena.id, target_date_str=target_date_str)
            audited_arenas.append(arena.id)

    return {
        "status": "completed",
        "audited_count": len(audited_arenas),
        "arena_ids": audited_arenas
    }


async def startup(ctx: Dict[str, Any]) -> None:
    """Worker startup hook initializing Redis client pool."""
    logger.info("[ArqWorker] Launching Tribely Distributed Task Worker...")
    ctx["redis"] = await get_redis_client()


async def shutdown(ctx: Dict[str, Any]) -> None:
    """Worker shutdown hook closing Redis connections."""
    logger.info("[ArqWorker] Shutting down Tribely Task Worker...")
    await close_redis_client()


class WorkerSettings:
    """Arq Worker Settings configuration class."""
    functions = [
        run_arena_deadline_audit,
        process_outbox_events_job,
        process_proof_image_task,
    ]
    cron_jobs = [
        cron(cron_global_deadline_audit, minute={0, 15, 30, 45}),
        cron(process_outbox_events_job, second={0, 10, 20, 30, 40, 50}),
        cron(send_deadline_warning_reminders_task, minute={50}),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT
    )
