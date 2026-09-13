"""
Timezone-Aware Distributed Task Worker for Tribely Background Deadline Audits.
Handles:
1. Scheduled cron triggers evaluating cutoff deadlines converted from UTC to arena local IANA timezones.
2. Redis Redlock acquisition preventing concurrent executions.
3. Member absence penalty deduction via wallet_service into weekly arena vault.
4. Sunday midnight dividend distribution to consistent finishers.
"""

import os
import sys
import datetime
import zoneinfo
import logging
from typing import Dict, Any, Optional

from arq import cron
from arq.connections import RedisSettings

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import Arena, ArenaMembership, UserWallet, DailyArenaSheet
from app.core.redis import get_redis_client, close_redis_client
from app.workers.locks import RedisDistributedLock
from app.services.audit_service import audit_service
from app.services.wallet_service import wallet_service
from app.services.ledger_service import ledger_service
from app.workers.outbox_worker import process_outbox_events_job
from app.workers.media_worker import process_proof_image_task
from app.workers.reminder_worker import send_deadline_warning_reminders_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_arena_timezone(tz_name: Optional[str]) -> zoneinfo.ZoneInfo:
    try:
        return zoneinfo.ZoneInfo(tz_name or "UTC")
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def parse_cutoff_time(cutoff_str: Optional[str]) -> datetime.time:
    if not cutoff_str:
        return datetime.time(23, 59, 59)
    normalized = cutoff_str.strip().upper()
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            return datetime.datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    return datetime.time(23, 59, 59)


async def run_arena_deadline_audit(
    ctx: Dict[str, Any],
    arena_id: int,
    target_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Execute deadline audit for a single arena with non-blocking Redis Redlock protection.
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
    Timezone-aware audit worker running periodically.
    Converts server UTC time to each arena's IANA timezone and executes audits
    only for arenas where current local time has crossed the daily_cutoff_time.
    """
    logger.info("[CronAudit] Evaluating timezone-aware cutoff deadlines across all active arenas...")

    audited_arenas = []
    with SessionLocal() as db:
        arenas = db.query(Arena).all()
        for arena in arenas:
            tz = get_arena_timezone(arena.timezone)
            now_local = datetime.datetime.now(tz)
            cutoff_time = parse_cutoff_time(arena.daily_cutoff_time or arena.deadline_time)

            # Trigger audit if local time has passed cutoff time
            if now_local.time() >= cutoff_time:
                target_date_str = now_local.date().isoformat()
                await run_arena_deadline_audit(ctx, arena_id=arena.id, target_date_str=target_date_str)
                audited_arenas.append({"arena_id": arena.id, "timezone": str(tz), "local_date": target_date_str})

    return {
        "status": "completed",
        "audited_count": len(audited_arenas),
        "audited_arenas": audited_arenas
    }


async def cron_sunday_vault_distribution(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Weekly consistency dividend orchestrator:
    Runs on Sunday midnight to distribute accumulated vault penalties to consistent finishers.
    """
    logger.info("[SundayVault] Running weekly consistency dividend distribution...")
    distributed_arenas = []
    with SessionLocal() as db:
        arenas = db.query(Arena).all()
        for arena in arenas:
            try:
                # Distribute weekly vault rewards
                res = ledger_service.distribute_consistency_rewards(db, arena_id=arena.id)
                distributed_arenas.append({"arena_id": arena.id, "result": res})
            except Exception as e:
                logger.error(f"[SundayVault] Error distributing vault for arena #{arena.id}: {e}")

    return {"status": "completed", "distributed_arenas": distributed_arenas}


async def startup(ctx: Dict[str, Any]) -> None:
    logger.info("[ArqWorker] Launching Tribely Distributed Task Worker...")
    ctx["redis"] = await get_redis_client()


async def shutdown(ctx: Dict[str, Any]) -> None:
    logger.info("[ArqWorker] Shutting down Tribely Task Worker...")
    await close_redis_client()


class WorkerSettings:
    functions = [
        run_arena_deadline_audit,
        process_outbox_events_job,
        process_proof_image_task,
    ]
    cron_jobs = [
        cron(cron_global_deadline_audit, minute={0, 15, 30, 45}),
        cron(cron_sunday_vault_distribution, weekday="sun", hour=23, minute=59),
        cron(process_outbox_events_job, second={0, 10, 20, 30, 40, 50}),
        cron(send_deadline_warning_reminders_task, minute={50}),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT
    )
