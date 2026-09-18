"""
Streak & Gamification Engine Implementation.
Manages user habit streaks and achievement level badges.
Optimized with Redis TTL caching and sub-millisecond query evaluation.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, date, timedelta
import json
import logging
from sqlalchemy.orm import Session
from app.models.models import Submission
from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1800  # 30 minutes cache


class StreakService:
    """
    Gamification service managing habit streaks and activity badges.
    """

    def __init__(self):
        self._redis_client = None

    def _get_redis(self):
        if self._redis_client is None:
            try:
                import redis
                if settings.REDIS_URL:
                    self._redis_client = redis.Redis.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_timeout=2.0,
                        socket_connect_timeout=2.0,
                        retry_on_timeout=True
                    )
                else:
                    self._redis_client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        password=settings.REDIS_PASSWORD,
                        decode_responses=True,
                        socket_timeout=2.0,
                        socket_connect_timeout=2.0,
                        retry_on_timeout=True
                    )
                self._redis_client.ping()
            except Exception:
                self._redis_client = False
        return self._redis_client if self._redis_client is not False else None

    def invalidate_streak_cache(self, user_id: int, arena_id: int) -> None:
        """Evicts cached streak calculations upon proof submission or status change."""
        redis_c = self._get_redis()
        if redis_c:
            try:
                redis_c.delete(f"streak:{user_id}:{arena_id}")
            except Exception as e:
                logger.debug(f"[StreakService] Redis cache invalidation error: {e}")

    def calculate_user_streak(self, db: Session, user_id: int, arena_id: int) -> Dict[str, Any]:
        """
        Calculate current consecutive habit streak and badge tier for a user.
        Uses Redis caching to avoid O(N) database scans on hot read paths.
        """
        cache_key = f"streak:{user_id}:{arena_id}"
        redis_c = self._get_redis()

        if redis_c:
            try:
                cached = redis_c.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        # Query recent submissions limited to latest 100 entries for sub-millisecond calculation
        submissions = (
            db.query(Submission)
            .filter(
                Submission.user_id == user_id,
                Submission.arena_id == arena_id,
                Submission.is_absent == False
            )
            .order_by(Submission.submitted_at.desc())
            .limit(100)
            .all()
        )

        # Extract unique dates from valid submissions
        active_dates = {
            s.submitted_at.date() if isinstance(s.submitted_at, datetime) else date.today()
            for s in submissions if s.submitted_at
        }

        # Include verified / present daily sheets
        from app.models.models import DailyArenaSheet
        valid_sheets = (
            db.query(DailyArenaSheet)
            .filter(
                DailyArenaSheet.user_id == user_id,
                DailyArenaSheet.arena_id == arena_id,
                DailyArenaSheet.status.in_(["present", "verified"])
            )
            .order_by(DailyArenaSheet.date_day.desc())
            .limit(100)
            .all()
        )
        for sh in valid_sheets:
            try:
                active_dates.add(datetime.strptime(sh.date_day, "%Y-%m-%d").date())
            except Exception:
                pass

        if not active_dates:
            result = {
                "current_streak": 0,
                "max_streak": 0,
                "badge_tier": "Novice Builder 🥉",
                "rule": "Daily verified proof maintains active streak and sprint multiplier"
            }
            if redis_c:
                try:
                    redis_c.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(result))
                except Exception:
                    pass
            return result

        submission_dates = sorted(list(active_dates), reverse=True)

        current_streak = 0
        today = date.today()
        check_date = today

        # Account for today or yesterday as starting point
        if submission_dates and (submission_dates[0] == today or submission_dates[0] == today - timedelta(days=1)):
            check_date = submission_dates[0]
            for s_date in submission_dates:
                if s_date == check_date:
                    current_streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break

        # Compute true historical maximum consecutive streak
        chronological_dates = sorted(list(active_dates))
        max_consecutive_streak = 0
        current_run = 0
        prev_date = None

        for d in chronological_dates:
            if prev_date is None:
                current_run = 1
            elif d == prev_date + timedelta(days=1):
                current_run += 1
            elif d == prev_date:
                pass
            else:
                current_run = 1
            prev_date = d
            if current_run > max_consecutive_streak:
                max_consecutive_streak = current_run

        max_streak = max(current_streak, max_consecutive_streak)

        badge_tier = (
            "Legendary Titan 🏆" if current_streak >= 30 else
            "Unstoppable Master 👑" if current_streak >= 14 else
            "Habit Warrior 🔥" if current_streak >= 7 else
            "Consistent Builder ⚡" if current_streak >= 3 else
            "Novice Builder 🥉"
        )

        result = {
            "current_streak": current_streak,
            "max_streak": max_streak,
            "badge_tier": badge_tier,
            "rule": "Daily verified proof maintains active streak and sprint multiplier"
        }

        if redis_c:
            try:
                redis_c.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(result))
            except Exception:
                pass

        return result


# Singleton instance
streak_service = StreakService()
