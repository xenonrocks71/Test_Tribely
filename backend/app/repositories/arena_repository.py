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


# Global Singleton Instance for Arena Repository
arena_repository = ArenaRepository()
