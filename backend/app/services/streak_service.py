"""
Streak Shield & Gamification Engine Implementation.
Manages user habit streaks, streak freeze shields, and achievement level badges.
"""

from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from app.models.models import Submission


class StreakService:
    """
    Gamification service managing habit streaks, emergency freeze shields, and activity badges.
    """

    def calculate_user_streak(self, db: Session, user_id: int, arena_id: int) -> Dict[str, Any]:
        """
        Calculate current consecutive habit streak and available streak shields for a user.

        :param db: Active database session.
        :param user_id: User identifier.
        :param arena_id: Target habit arena ID.
        :return: Dict with current_streak, max_streak, available_shields, and badge_tier.
        """
        submissions = (
            db.query(Submission)
            .filter(
                Submission.user_id == user_id,
                Submission.arena_id == arena_id,
                Submission.is_absent == False
            )
            .order_by(Submission.submitted_at.desc())
            .all()
        )

        if not submissions:
            return {
                "current_streak": 0,
                "max_streak": 0,
                "available_shields": 1,
                "badge_tier": "Novice Builder 🥉",
            }

        # Extract unique submission dates
        submission_dates = sorted(
            list({s.submitted_at.date() if isinstance(s.submitted_at, datetime) else date.today() for s in submissions}),
            reverse=True
        )

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

        badge_tier = (
            "Legendary Titan 🏆" if current_streak >= 30 else
            "Unstoppable Master 👑" if current_streak >= 14 else
            "Habit Warrior 🔥" if current_streak >= 7 else
            "Consistent Builder ⚡" if current_streak >= 3 else
            "Novice Builder 🥉"
        )

        # Rule: Earn 1 Streak Shield for every 7 consecutive days of proof consistency
        earned_shields = current_streak // 7

        return {
            "current_streak": current_streak,
            "max_streak": max(current_streak, len(submission_dates)),
            "available_shields": earned_shields,
            "badge_tier": badge_tier,
            "days_until_next_shield": 7 - (current_streak % 7) if current_streak % 7 != 0 else 7,
            "rule": "1 Shield = 1 Absent Day protected with ZERO monetary penalty slash"
        }


# Singleton instance
streak_service = StreakService()
