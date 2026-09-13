"""
Proof Repository for Keyset Cursor Pagination & Reaction Aggregations.
Implements O(log N) B-Tree seeks on (arena_id, created_at DESC, id DESC).
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
import datetime
from app.models.models import Proof, ProofReaction, User, Arena, ArenaMembership


class ProofRepository:
    """
    Data Access Layer for Proofs & Social Reactions.
    """

    def get_by_id(self, db: Session, proof_id: int) -> Optional[Proof]:
        return db.query(Proof).filter(Proof.id == proof_id).first()

    def get_user_proof_for_date(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        submission_date: datetime.date
    ) -> Optional[Proof]:
        """
        Look up proof for a specific arena, user, and date.
        """
        return (
            db.query(Proof)
            .filter(
                Proof.arena_id == arena_id,
                Proof.user_id == user_id,
                Proof.submission_date == submission_date
            )
            .first()
        )

    def create_proof(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        submission_date: datetime.date,
        media_url: str,
        proof_type: str = "IMAGE",
        selfie_url: Optional[str] = None,
        caption: Optional[str] = None,
        telemetry_data: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime.datetime] = None
    ) -> Proof:
        """
        Inserts new daily proof. Relies on UNIQUE (arena_id, user_id, submission_date).
        """
        proof = Proof(
            arena_id=arena_id,
            user_id=user_id,
            submission_date=submission_date,
            media_url=media_url,
            proof_type=proof_type.upper(),
            selfie_url=selfie_url,
            caption=caption,
            telemetry_data=telemetry_data,
            created_at=created_at or datetime.datetime.utcnow()
        )
        db.add(proof)
        db.flush()
        return proof

    def query_feed_keyset(
        self,
        db: Session,
        joined_arena_ids: List[int],
        last_created_at: Optional[datetime.datetime] = None,
        last_id: Optional[int] = None,
        limit: int = 15,
        arena_id_filter: Optional[int] = None
    ) -> List[Proof]:
        """
        High-scale keyset (cursor-based) pagination: O(log N) index seek.
        Filters by (created_at < last_created_at) OR (created_at == last_created_at AND id < last_id).
        """
        query = db.query(Proof)

        if arena_id_filter:
            query = query.filter(Proof.arena_id == arena_id_filter)
        elif joined_arena_ids:
            # Query proofs from joined arenas + public discovery arenas
            public_arena_ids = [
                r[0] for r in db.query(Arena.id).filter(Arena.is_private.is_(False)).all()
            ]
            all_visible_arena_ids = list(set(joined_arena_ids + public_arena_ids))
            query = query.filter(Proof.arena_id.in_(all_visible_arena_ids))

        # Keyset cursor filter
        if last_created_at is not None and last_id is not None:
            query = query.filter(
                or_(
                    Proof.created_at < last_created_at,
                    and_(Proof.created_at == last_created_at, Proof.id < last_id)
                )
            )

        query = query.order_by(desc(Proof.created_at), desc(Proof.id)).limit(limit)
        return query.all()

    def get_reactions_for_proofs(
        self,
        db: Session,
        proof_ids: List[int],
        current_user_id: Optional[int] = None
    ) -> Dict[int, Dict[str, Any]]:
        """
        Batch aggregates reactions for a list of proofs:
        Returns {proof_id: {"reactions": {emoji: count}, "user_reacted": {emoji: bool}}}
        """
        if not proof_ids:
            return {}

        results: Dict[int, Dict[str, Any]] = {
            pid: {"counts": {}, "current_user_emojis": []} for pid in proof_ids
        }

        # Aggregate counts
        counts = (
            db.query(
                ProofReaction.proof_id,
                ProofReaction.emoji,
                func.count(ProofReaction.id).label("cnt")
            )
            .filter(ProofReaction.proof_id.in_(proof_ids))
            .group_by(ProofReaction.proof_id, ProofReaction.emoji)
            .all()
        )
        for pid, emoji, cnt in counts:
            if pid in results:
                results[pid]["counts"][emoji] = cnt

        # Current user reaction checks
        if current_user_id:
            user_reacts = (
                db.query(ProofReaction.proof_id, ProofReaction.emoji)
                .filter(
                    ProofReaction.proof_id.in_(proof_ids),
                    ProofReaction.user_id == current_user_id
                )
                .all()
            )
            for pid, emoji in user_reacts:
                if pid in results:
                    results[pid]["current_user_emojis"].append(emoji)

        return results

    def toggle_reaction(
        self,
        db: Session,
        proof_id: int,
        user_id: int,
        emoji: str
    ) -> Dict[str, Any]:
        """
        Toggles an emoji reaction on a proof atomically.
        """
        existing = (
            db.query(ProofReaction)
            .filter(
                ProofReaction.proof_id == proof_id,
                ProofReaction.user_id == user_id,
                ProofReaction.emoji == emoji
            )
            .first()
        )
        if existing:
            db.delete(existing)
            db.flush()
            action = "removed"
        else:
            reaction = ProofReaction(proof_id=proof_id, user_id=user_id, emoji=emoji)
            db.add(reaction)
            db.flush()
            action = "added"

        total = (
            db.query(func.count(ProofReaction.id))
            .filter(ProofReaction.proof_id == proof_id, ProofReaction.emoji == emoji)
            .scalar()
            or 0
        )
        return {"action": action, "emoji": emoji, "new_count": total}


proof_repository = ProofRepository()
