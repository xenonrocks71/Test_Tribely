"""
Activity & Messaging Domain Repository Implementation.
Encapsulates database access for Submissions, Proof Votes, Messages, and Timeline Aggregations.
Designed for high scalability and clean maintainability.
"""

import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.models import Submission, Message, ArenaMembership, SubmissionVote
from app.schemas.schemas import SubmissionCreate, MessageCreate
from app.repositories.base import BaseRepository


class ActivityRepository(BaseRepository[Submission, SubmissionCreate, SubmissionCreate]):
    """
    Object-oriented repository managing daily habit proof submissions, voting consensus, and room chat logs.
    """

    def __init__(self) -> None:
        """Initialize ActivityRepository with Submission model."""
        super().__init__(Submission)

    def create_submission(self, db: Session, *, submission_in: SubmissionCreate, user_id: int) -> Submission:
        """
        Persist a daily habit proof record.

        :param db: Active database session.
        :param submission_in: Validated SubmissionCreate schema.
        :param user_id: User primary key identifier.
        :return: Persisted Submission instance.
        """
        db_submission = Submission(
            arena_id=submission_in.arena_id,
            user_id=user_id,
            proof_url=submission_in.proof_url,
            is_verified=True
        )
        db.add(db_submission)
        db.commit()
        db.refresh(db_submission)
        return db_submission

    def get_user_today_submission(self, db: Session, *, user_id: int, arena_id: int) -> Optional[Submission]:
        """
        Fetch submission for user in arena created on the current calendar day (UTC).

        :param db: Active database session.
        :param user_id: User identifier.
        :param arena_id: Arena identifier.
        :return: Optional Submission if posted today.
        """
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        return db.query(Submission).filter(
            Submission.user_id == user_id,
            Submission.arena_id == arena_id,
            Submission.submitted_at >= today_start
        ).first()

    def get_arena_submissions(self, db: Session, arena_id: int, limit: int = 100) -> List[Submission]:
        """
        Retrieve proof submissions uploaded inside a specific arena ordered by timestamp desc.

        :param db: Active database session.
        :param arena_id: Arena identifier.
        :param limit: Maximum records to return.
        :return: List of Submission models.
        """
        return db.query(Submission).filter(
            Submission.arena_id == arena_id
        ).order_by(Submission.submitted_at.desc()).limit(limit).all()

    def create_message(self, db: Session, *, message_in: MessageCreate, arena_id: int, user_id: int) -> Message:
        """
        Persist a chat message or system alert in the database logs.

        :param db: Active database session.
        :param message_in: Message payload schema.
        :param arena_id: Target arena.
        :param user_id: Sender user ID.
        :return: Persisted Message instance.
        """
        db_message = Message(
            arena_id=arena_id,
            user_id=user_id,
            content=message_in.content,
            message_type=message_in.message_type
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message

    def get_arena_messages(self, db: Session, arena_id: int, limit: int = 50) -> List[Message]:
        """
        Fetch chat room messages for an arena sorted chronologically desc.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param limit: Result limit.
        :return: List of Message models.
        """
        return db.query(Message).filter(
            Message.arena_id == arena_id
        ).order_by(Message.created_at.desc()).limit(limit).all()

    def is_user_in_arena(self, db: Session, user_id: int, arena_id: int) -> bool:
        """
        Security verification check ensuring active approved membership.

        :param db: Active database session.
        :param user_id: Target user ID.
        :param arena_id: Target arena ID.
        :return: True if active member, else False.
        """
        membership = db.query(ArenaMembership).filter(
            ArenaMembership.user_id == user_id,
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).first()
        return membership is not None


# Global Singleton Instance for Activity Repository
activity_repository = ActivityRepository()
