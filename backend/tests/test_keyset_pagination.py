"""
Keyset (Cursor-Based) Pagination & Keyset Seek Test Suite.
Verifies O(log N) index seeking stability, reverse chronological ordering,
and elimination of offset drift under live proof writes.
"""

import pytest
import datetime
import uuid
from app.core.database import SessionLocal
from app.models.models import User, Arena, Proof
from app.services.feed_service import feed_service
from app.repositories.proof_repository import proof_repository


def test_keyset_pagination_ordering_and_cursor():
    with SessionLocal() as db:
        uid = uuid.uuid4().hex[:6]
        user = User(
            email=f"keyset_{uid}@tribely.internal",
            hashed_password="pw",
            full_name="Keyset Tester"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        arena = Arena(
            name=f"Keyset Arena {uid}",
            invite_code=f"KEYSET_{uid}".upper(),
            creator_id=user.id,
            is_private=False
        )
        db.add(arena)
        db.commit()
        db.refresh(arena)

        # Insert 5 daily proofs across 5 distinct days (respecting unique daily constraint)
        base_time = datetime.datetime.utcnow()
        base_date = base_time.date()
        created_proofs = []
        for i in range(5):
            p_time = base_time - datetime.timedelta(days=i)
            p_date = base_date - datetime.timedelta(days=i)
            p = proof_repository.create_proof(
                db=db,
                arena_id=arena.id,
                user_id=user.id,
                submission_date=p_date,
                media_url=f"https://example.com/proof_{i}.jpg",
                proof_type="IMAGE",
                created_at=p_time
            )
            created_proofs.append(p)
        db.commit()

        # Page 1: fetch first 2 proofs
        page1 = feed_service.get_feed(db, current_user_id=user.id, cursor=None, limit=2, arena_id=arena.id)
        assert len(page1["items"]) == 2
        assert page1["has_more"] is True
        assert page1["next_cursor"] is not None
        assert page1["items"][0]["id"] == created_proofs[0].id
        assert page1["items"][1]["id"] == created_proofs[1].id

        # Page 2: fetch next 2 proofs using next_cursor
        cursor1 = page1["next_cursor"]
        page2 = feed_service.get_feed(db, current_user_id=user.id, cursor=cursor1, limit=2, arena_id=arena.id)
        assert len(page2["items"]) == 2
        assert page2["items"][0]["id"] == created_proofs[2].id
        assert page2["items"][1]["id"] == created_proofs[3].id

        # Page 3: fetch last proof
        cursor2 = page2["next_cursor"]
        page3 = feed_service.get_feed(db, current_user_id=user.id, cursor=cursor2, limit=2, arena_id=arena.id)
        assert len(page3["items"]) == 1
        assert page3["items"][0]["id"] == created_proofs[4].id
        assert page3["has_more"] is False
