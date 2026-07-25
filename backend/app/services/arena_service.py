"""
Arena Domain Service Implementation.
Encapsulates room management, join request logic, privacy controls, and admin management policies.
"""

from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.models import Arena, ArenaMembership, User
from app.schemas.schemas import ArenaCreate
from app.repositories.arena_repository import arena_repository, ArenaRepository


class ArenaService:
    """
    Business service managing Micro-Arena lifecycle, membership state machines, and access control.
    """

    def __init__(self, arena_repo: ArenaRepository = arena_repository) -> None:
        """
        Initialize ArenaService with injected ArenaRepository.

        :param arena_repo: Data access repository for Arena entities.
        """
        self.arena_repo = arena_repo

    def create_arena(self, db: Session, *, arena_in: ArenaCreate, creator_id: int) -> Arena:
        """
        Create a new micro-arena and bind creator as initial owner/admin.

        :param db: Active database session.
        :param arena_in: Arena configuration parameters.
        :param creator_id: User identifier of room creator.
        :return: Created Arena instance.
        """
        return self.arena_repo.create_arena(db, arena_in=arena_in, creator_id=creator_id)

    def get_public_discovery_arenas(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Arena]:
        """
        Fetch public arenas for community discovery feed.

        :param db: Active database session.
        :param skip: Pagination offset.
        :param limit: Pagination limit.
        :return: List of public Arena instances.
        """
        return self.arena_repo.get_public_arenas(db, skip=skip, limit=limit)

    def get_user_arenas(self, db: Session, user_id: int) -> List[Arena]:
        """
        Fetch arenas that the specified user has joined and been approved for.

        :param db: Active database session.
        :param user_id: Primary key of user.
        :return: List of Arena instances.
        """
        return self.arena_repo.get_user_arenas(db, user_id=user_id)

    def get_arena_by_id(self, db: Session, arena_id: int) -> Arena:
        """
        Fetch an arena by primary key ID or raise 404.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :return: Arena entity.
        :raises HTTPException: 404 Not Found if arena does not exist.
        """
        arena = self.arena_repo.get_by_id(db, id=arena_id)
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Arena not found."
            )
        return arena

    def join_arena(self, db: Session, *, user_id: int, arena_id: int) -> ArenaMembership:
        """
        Request or join an arena based on privacy setting. Public arenas join immediately ("approved"),
        whereas private arenas register a "pending" join request.

        :param db: Active database session.
        :param user_id: Target joining user ID.
        :param arena_id: Target arena ID.
        :return: ArenaMembership instance.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        existing = self.arena_repo.get_membership(db, user_id=user_id, arena_id=arena_id)
        if existing:
            return existing

        initial_status = "pending" if arena.is_private else "approved"
        return self.arena_repo.join_arena(db, user_id=user_id, arena_id=arena_id, status=initial_status, role="member")

    def join_by_invite_code(self, db: Session, *, user_id: int, invite_code: str) -> ArenaMembership:
        """
        Join an arena directly using a valid 6-character invite code, bypassing private approval requirements.

        :param db: Active database session.
        :param user_id: Joining user ID.
        :param invite_code: 6-character invite code string.
        :return: ArenaMembership entity.
        :raises HTTPException: 404 Not Found if invite code is invalid.
        """
        arena = self.arena_repo.get_by_invite_code(db, invite_code=invite_code)
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invite code."
            )

        return self.arena_repo.join_arena(db, user_id=user_id, arena_id=arena.id, status="approved", role="member")


# Global Singleton Service Instance
arena_service = ArenaService()
