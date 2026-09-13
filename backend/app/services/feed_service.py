"""
Feed Query Service for Tribely with Keyset (Cursor-Based) Pagination.
Implements O(log N) index seeking eliminating offset drift during live writes.
Composes proofs from joined arenas (priority) with public discovery drops.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import datetime
import logging

from app.models.models import Proof, Arena, ArenaMembership, User, UserProfile
from app.repositories.proof_repository import proof_repository

logger = logging.getLogger(__name__)


class FeedService:
    """
    High-performance social habit feed service.
    """

    def parse_cursor(self, cursor: Optional[str]) -> tuple[Optional[datetime.datetime], Optional[int]]:
        """
        Parses keyset cursor token format: '{created_at_iso}_{id}'
        """
        if not cursor:
            return None, None
        try:
            parts = cursor.rsplit("_", 1)
            if len(parts) == 2:
                dt = datetime.datetime.fromisoformat(parts[0].replace("Z", "+00:00")).replace(tzinfo=None)
                last_id = int(parts[1])
                return dt, last_id
        except Exception as e:
            logger.warning(f"[FeedService] Invalid cursor format '{cursor}': {e}")
        return None, None

    def build_cursor(self, proof: Proof) -> str:
        """
        Generates next keyset cursor token.
        """
        return f"{proof.created_at.isoformat()}_{proof.id}"

    def get_feed(
        self,
        db: Session,
        current_user_id: Optional[int] = None,
        cursor: Optional[str] = None,
        limit: int = 15,
        arena_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Fetches cursor-paginated feed with reaction aggregates and joined priority.
        """
        last_created_at, last_id = self.parse_cursor(cursor)

        joined_arena_ids = []
        if current_user_id:
            joined_memberships = (
                db.query(ArenaMembership.arena_id)
                .filter(
                    ArenaMembership.user_id == current_user_id,
                    ArenaMembership.status == "approved"
                )
                .all()
            )
            joined_arena_ids = [m[0] for m in joined_memberships]

        proofs = proof_repository.query_feed_keyset(
            db=db,
            joined_arena_ids=joined_arena_ids,
            last_created_at=last_created_at,
            last_id=last_id,
            limit=limit,
            arena_id_filter=arena_id
        )

        proof_ids = [p.id for p in proofs]
        reactions_map = proof_repository.get_reactions_for_proofs(
            db=db,
            proof_ids=proof_ids,
            current_user_id=current_user_id
        )

        items = []
        for p in proofs:
            user = p.user
            user_avatar = user.avatar_url if user else None
            if not user_avatar and user and user.profile:
                user_avatar = user.profile.profile_image_url

            arena = p.arena
            arena_name = arena.title or arena.name if arena else "Arena"
            arena_tag = "#" + arena_name.replace(" ", "").lower()[:20]

            p_reacts = reactions_map.get(p.id, {"counts": {}, "current_user_emojis": []})
            reaction_counts = p_reacts["counts"]
            user_emojis = p_reacts["current_user_emojis"]

            item = {
                "id": p.id,
                "arena_id": p.arena_id,
                "arena_name": arena_name,
                "arena_tag": arena_tag,
                "is_joined": p.arena_id in joined_arena_ids,
                "user_id": p.user_id,
                "user_name": user.full_name if user else "Tribe Member",
                "user_handle": f"@{user.username}" if user and user.username else f"@user{p.user_id}",
                "user_avatar": user_avatar,
                "media_url": p.media_url,
                "selfie_url": p.selfie_url,
                "proof_type": p.proof_type.lower() if p.proof_type else "image",
                "caption": p.caption or "",
                "telemetry_data": p.telemetry_data or {},
                "submission_date": p.submission_date.isoformat(),
                "created_at": p.created_at.isoformat(),
                "reactions": {
                    "fire": reaction_counts.get("🔥", 0) + reaction_counts.get("fire", 0),
                    "electric": reaction_counts.get("⚡", 0) + reaction_counts.get("electric", 0),
                    "respect": reaction_counts.get("🫡", 0) + reaction_counts.get("respect", 0),
                    "target": reaction_counts.get("🎯", 0) + reaction_counts.get("target", 0),
                },
                "current_user_reactions": user_emojis,
                "has_user_reacted": len(user_emojis) > 0,
            }
            items.append(item)

        next_cursor = self.build_cursor(proofs[-1]) if len(proofs) == limit else None

        return {
            "items": items,
            "next_cursor": next_cursor,
            "has_more": len(proofs) == limit,
            "count": len(items)
        }


feed_service = FeedService()
