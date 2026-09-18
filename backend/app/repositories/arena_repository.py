"""
Arena Domain Repository Implementation.
Encapsulates database access for Arenas, Memberships, and Admin configurations.
Designed for high maintainability and system modularity.
"""

import random
import string
from typing import Optional, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import Arena, ArenaMembership
from app.schemas.schemas import ArenaCreate
from app.repositories.base import BaseRepository


class ArenaRepository(BaseRepository[Arena, ArenaCreate, ArenaCreate]):
    """
    Object-oriented repository managing Arena and ArenaMembership persistence.
    Provides methods for public discovery, invite codes, membership joins, and role querying.
    """

    def __init__(self) -> None:
        """Initialize ArenaRepository with Arena model."""
        super().__init__(Arena)

    def generate_unique_invite_code(self, db: Session) -> str:
        """
        Generate a guaranteed unique 6-character uppercase alphanumeric invite code.

        :param db: Active database session.
        :return: Unique string code.
        """
        while True:
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            exists = db.query(Arena).filter(Arena.invite_code == code).first()
            if not exists:
                return code

    def create_arena(self, db: Session, *, arena_in: ArenaCreate, creator_id: int) -> Arena:
        """
        Create a new Arena container, assign an invite code, and bind creator as an approved Admin member.

        :param db: Active database session.
        :param arena_in: Validated ArenaCreate schema.
        :param creator_id: User ID of creator.
        :return: Persisted Arena model instance.
        """
        invite_code = self.generate_unique_invite_code(db)
        db_arena = Arena(
            name=arena_in.name,
            description=arena_in.description,
            category=arena_in.category or "Habit",
            icon_url=arena_in.icon_url,
            timezone=arena_in.timezone or "UTC",
            invite_code=invite_code,
            creator_id=creator_id,
            proof_type=arena_in.proof_type,
            penalty_amount=arena_in.penalty_amount,
            deadline_time=arena_in.deadline_time,
            is_private=arena_in.is_private
        )
        db.add(db_arena)
        db.commit()
        db.refresh(db_arena)

        # Deduct entry stake from creator wallet and credit to arena vault
        from app.services.kudos_service import kudos_service
        kudos_service.deduct_arena_creation_stake(db, creator_id, db_arena)

        creator_membership = ArenaMembership(
            user_id=creator_id,
            arena_id=db_arena.id,
            status="approved",
            role="admin"
        )
        db.add(creator_membership)
        db.commit()
        return db_arena


    def get_by_invite_code(self, db: Session, invite_code: str) -> Optional[Arena]:
        """
        Lookup Arena by its unique invite code.
        Supports standard 6-character code, case-insensitive match,
        TRIB-{code} or TRIB-{id} prefix variants, and raw numeric ID fallback.

        :param db: Active database session.
        :param invite_code: Code string or ID.
        :return: Optional Arena entity.
        """
        if not invite_code or not isinstance(invite_code, str):
            return None
        code_clean = invite_code.strip().upper()

        # 1. Direct match
        arena = db.query(Arena).filter(func.upper(Arena.invite_code) == code_clean).first()
        if arena:
            return arena

        # 2. If code has "TRIB-" prefix, strip it and check invite_code or ID
        if code_clean.startswith("TRIB-"):
            raw_part = code_clean.replace("TRIB-", "").strip()
            arena = db.query(Arena).filter(func.upper(Arena.invite_code) == raw_part).first()
            if arena:
                return arena
            if raw_part.isdigit():
                arena = db.query(Arena).filter(Arena.id == int(raw_part)).first()
                if arena:
                    return arena

        # 3. Direct numeric ID fallback
        if code_clean.isdigit():
            arena = db.query(Arena).filter(Arena.id == int(code_clean)).first()
            if arena:
                return arena

        return None


    def get_membership(self, db: Session, *, user_id: int, arena_id: int) -> Optional[ArenaMembership]:
        """
        Fetch membership association between a user and an arena.

        :param db: Active database session.
        :param user_id: User identifier.
        :param arena_id: Arena identifier.
        :return: Optional ArenaMembership instance.
        """
        return db.query(ArenaMembership).filter(
            ArenaMembership.user_id == user_id,
            ArenaMembership.arena_id == arena_id
        ).first()

    def join_arena(self, db: Session, *, user_id: int, arena_id: int, status: str = "approved", role: str = "member") -> ArenaMembership:
        """
        Add or update membership for a user in an arena.

        :param db: Active database session.
        :param user_id: User identifier.
        :param arena_id: Arena identifier.
        :param status: Initial membership status ("approved" or "pending").
        :param role: Member role ("admin" or "member").
        :return: ArenaMembership instance.
        """
        existing = self.get_membership(db, user_id=user_id, arena_id=arena_id)
        if existing:
            if status == "approved" and existing.status != "approved":
                existing.status = "approved"
                db.commit()
                db.refresh(existing)
            return existing

        db_membership = ArenaMembership(
            user_id=user_id,
            arena_id=arena_id,
            status=status,
            role=role
        )
        db.add(db_membership)
        db.commit()
        db.refresh(db_membership)
        return db_membership


    def get_user_arenas(self, db: Session, user_id: int) -> List[Arena]:
        """
        Fetch all arenas where the specified user has an approved membership.

        :param db: Active database session.
        :param user_id: Primary key of user.
        :return: List of Arena instances.
        """
        return db.query(Arena).join(ArenaMembership).filter(
            ArenaMembership.user_id == user_id,
            ArenaMembership.status == "approved"
        ).all()

    def get_public_arenas(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Arena]:
        """
        Fetch public non-private arenas for discovery feed.

        :param db: Active database session.
        :param skip: Query offset.
        :param limit: Result cap.
        :return: List of public Arena instances.
        """
        return db.query(Arena).filter(Arena.is_private == False).offset(skip).limit(limit).all()

    def get_pending_requests(self, db: Session, arena_id: int) -> List[ArenaMembership]:
        """
        Fetches pending membership requests eagerly loading associated user records.
        """
        from sqlalchemy.orm import joinedload
        return db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "pending"
        ).options(joinedload(ArenaMembership.user)).all()

    def get_approved_members(self, db: Session, arena_id: int) -> List[ArenaMembership]:
        """
        Fetches approved members for an arena eagerly loading user profile entities.
        """
        from sqlalchemy.orm import joinedload
        from app.models.models import User
        return db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).options(joinedload(ArenaMembership.user).joinedload(User.profile)).all()

    def approve_membership(self, db: Session, membership: ArenaMembership) -> ArenaMembership:
        """
        Transitions membership status to approved.
        """
        membership.status = "approved"
        db.commit()
        db.refresh(membership)
        return membership

    def delete_membership(self, db: Session, membership: ArenaMembership) -> None:
        """
        Removes a membership record.
        """
        db.delete(membership)
        db.commit()

    def update_proof_type(self, db: Session, arena: Arena, proof_type: str) -> Arena:
        """
        Updates required proof verification modality for an arena.
        """
        arena.proof_type = proof_type
        db.commit()
        db.refresh(arena)
        return arena

    def update_arena_settings(self, db: Session, arena: Arena, **kwargs) -> Arena:
        """
        Updates arena visual, rule, or configuration fields.
        """
        for key, value in kwargs.items():
            if value is not None and hasattr(arena, key):
                setattr(arena, key, value)
        db.commit()
        db.refresh(arena)
        return arena

    def remove_member_with_successor(
        self,
        db: Session,
        arena: Arena,
        target_membership: ArenaMembership
    ) -> None:
        """
        Removes target membership from arena. If the removed user is the arena creator,
        automatically promotes the next oldest approved member to admin.
        """
        is_creator_removed = (arena.creator_id == target_membership.user_id)
        db.delete(target_membership)
        db.flush()

        if is_creator_removed:
            next_successor = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena.id,
                ArenaMembership.status == "approved"
            ).order_by(ArenaMembership.id.asc()).first()

            if next_successor:
                next_successor.role = "admin"
                arena.creator_id = next_successor.user_id

        db.commit()

    def delete_arena_cascade(self, db: Session, arena: Arena) -> None:
        """
        Explicitly and completely cascades deletion of all dependent entities
        (DailyArenaSheet, ArenaLogbook, Messages, Submissions, Votes, Memberships, Arena).
        """
        from app.models.models import (
            DailyArenaSheet, ArenaLogbook, Message,
            Submission, SubmissionVote
        )
        arena_id = arena.id

        db.query(DailyArenaSheet).filter(DailyArenaSheet.arena_id == arena_id).delete(synchronize_session=False)
        db.query(ArenaLogbook).filter(ArenaLogbook.arena_id == arena_id).delete(synchronize_session=False)
        db.query(Message).filter(Message.arena_id == arena_id).delete(synchronize_session=False)

        submissions = db.query(Submission).filter(Submission.arena_id == arena_id).all()
        sub_ids = [s.id for s in submissions]
        if sub_ids:
            db.query(SubmissionVote).filter(SubmissionVote.submission_id.in_(sub_ids)).delete(synchronize_session=False)
            db.query(Submission).filter(Submission.arena_id == arena_id).delete(synchronize_session=False)

        db.query(ArenaMembership).filter(ArenaMembership.arena_id == arena_id).delete(synchronize_session=False)
        db.delete(arena)
        db.commit()


# Global Singleton Instance for Arena Repository
arena_repository = ArenaRepository()

