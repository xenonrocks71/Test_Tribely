"""
Activity & Peer-Review Consensus Service Implementation.
Encapsulates proof submission workflows, voting engine calculations, and chat message processing.
"""

from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.models import Submission, Message, SubmissionVote, ArenaMembership
from app.schemas.schemas import SubmissionCreate, MessageCreate
from app.repositories.activity_repository import activity_repository, ActivityRepository
from app.repositories.arena_repository import arena_repository, ArenaRepository


class ActivityService:
    """
    Business service managing daily habit submissions, proof verification voting, and chat message delivery.
    """

    def __init__(
        self,
        activity_repo: ActivityRepository = activity_repository,
        arena_repo: ArenaRepository = arena_repository
    ) -> None:
        """
        Initialize ActivityService with injected repositories.

        :param activity_repo: Data access repository for Submissions and Messages.
        :param arena_repo: Data access repository for Arenas and Memberships.
        """
        self.activity_repo = activity_repo
        self.arena_repo = arena_repo

    def submit_daily_proof(self, db: Session, *, submission_in: SubmissionCreate, user_id: int) -> Submission:
        """
        Submit daily habit proof with single same-day constraint enforcement.

        :param db: Active database session.
        :param submission_in: Submission proof schema.
        :param user_id: Submitting user identifier.
        :return: Persisted Submission instance.
        :raises HTTPException: 403 Forbidden if not an arena member, or 400 Bad Request if already submitted today.
        """
        # 1. Verify active membership in the target arena
        if not self.activity_repo.is_user_in_arena(db, user_id=user_id, arena_id=submission_in.arena_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be an approved member of this arena to submit proof."
            )

        # 2. Check same-day single submission constraint
        existing = self.activity_repo.get_user_today_submission(
            db, user_id=user_id, arena_id=submission_in.arena_id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Proof already submitted for today."
            )

        return self.activity_repo.create_submission(db, submission_in=submission_in, user_id=user_id)

    def vote_on_submission(self, db: Session, *, submission_id: int, user_id: int, vote_type: str) -> Dict[str, Any]:
        """
        Cast or update a peer review vote (upvote/downvote) on a submission and recalculate consensus thresholds.

        Consensus Threshold:
        Downvote Threshold = max(2, floor(0.4 * Total Active Arena Members))
        If downvotes reach or exceed threshold, submission is automatically marked as absent (is_absent = True).

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :param user_id: Voting user ID.
        :param vote_type: "upvote" or "downvote".
        :return: Dict containing updated upvotes, downvotes, and is_absent status.
        :raises HTTPException: 404 if submission not found, 400 for invalid vote type.
        """
        if vote_type not in ["upvote", "downvote"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vote type must be 'upvote' or 'downvote'."
            )

        submission = self.activity_repo.get_by_id(db, id=submission_id)
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Submission not found."
            )

        # Check existing vote record for this user and submission
        existing_vote = db.query(SubmissionVote).filter(
            SubmissionVote.submission_id == submission_id,
            SubmissionVote.user_id == user_id
        ).first()

        if existing_vote:
            if existing_vote.vote_type == vote_type:
                # Remove vote if toggling same vote type (Undo)
                db.delete(existing_vote)
                if vote_type == "upvote":
                    submission.upvotes = max(0, submission.upvotes - 1)
                else:
                    submission.downvotes = max(0, submission.downvotes - 1)
            else:
                # Switch vote type
                old_vote = existing_vote.vote_type
                existing_vote.vote_type = vote_type
                db.add(existing_vote)

                if vote_type == "upvote":
                    submission.upvotes += 1
                    submission.downvotes = max(0, submission.downvotes - 1)
                else:
                    submission.downvotes += 1
                    submission.upvotes = max(0, submission.upvotes - 1)
        else:
            # Create new vote
            new_vote = SubmissionVote(
                submission_id=submission_id,
                user_id=user_id,
                vote_type=vote_type
            )

            db.add(new_vote)
            if vote_type == "upvote":
                submission.upvotes += 1
            else:
                submission.downvotes += 1

        # Recalculate Consensus for Automated Absence Flagging
        total_members = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == submission.arena_id,
            ArenaMembership.status == "approved"
        ).count()

        threshold = max(2, int(0.4 * total_members))
        submission.is_absent = (submission.downvotes >= threshold)

        db.add(submission)
        db.commit()
        db.refresh(submission)

        return {
            "submission_id": submission.id,
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes,
            "is_absent": submission.is_absent,
            "threshold": threshold
        }

    def get_arena_history(self, db: Session, *, arena_id: int, user_id: int) -> Dict[str, Any]:
        """
        Fetch historical submissions and room chat messages combined into a unified room timeline.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param user_id: Requesting user ID.
        :return: Dict containing submissions, messages, and membership metadata.
        :raises HTTPException: 403 Forbidden if user is not a member of the arena.
        """
        if not self.activity_repo.is_user_in_arena(db, user_id=user_id, arena_id=arena_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Active arena membership required."
            )

        submissions = self.activity_repo.get_arena_submissions(db, arena_id=arena_id)
        messages = self.activity_repo.get_arena_messages(db, arena_id=arena_id)

        return {
            "arena_id": arena_id,
            "submissions": submissions,
            "messages": messages
        }


# Global Singleton Service Instance
activity_service = ActivityService()
