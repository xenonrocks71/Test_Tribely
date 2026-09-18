"""
Activity & Messaging Domain Repository Implementation.
Encapsulates database access for Submissions, Proof Votes, Messages, Comments, and Timeline Aggregations.
Designed for high scalability and clean maintainability following Google & Meta engineering standards.
"""

import os
import datetime
from datetime import timezone, timedelta, time
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, case
from app.models.models import (
    Arena, Submission, Message, User, UserProfile,
    ArenaMembership, SubmissionVote, DailyArenaSheet,
    Proof, ProofReaction, SubmissionComment
)
from app.schemas.schemas import SubmissionCreate, MessageCreate
from app.repositories.base import BaseRepository


def _format_submission_dt(dt: Optional[datetime.datetime]) -> Optional[str]:
    """Serializes datetime into ISO 8601 string with UTC timezone to prevent client timezone offsets."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _detect_proof_media_type(proof_url: str, arena_proof_type: Optional[str] = None) -> str:
    """
    Intelligently determines proof format: 'video' (short 30s clips), 'youtube', 'link', or 'image'.
    Supports native HTML5 video containers (.mp4, .webm, .mov, data:video/), code/run links, and photo drops.
    """
    url_lower = (proof_url or "").strip().lower()
    if any(ext in url_lower for ext in [".mp4", ".webm", ".mov", ".ogg", "video/mp4", "data:video/"]):
        return "video"
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    if any(ext in url_lower for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", "data:image/"]):
        return "image"
    if arena_proof_type == "link" or url_lower.startswith("http://") or url_lower.startswith("https://"):
        return "link"
    if arena_proof_type:
        return arena_proof_type
    return "image"


def _normalize_media_url(url: Optional[str]) -> str:
    """
    Ensures relative static upload paths (e.g. '/static/uploads/proof_123.jpg')
    are fully resolved into absolute public URLs accessible by web and mobile clients in production and dev.
    """
    if not url:
        return ""
    trimmed = url.strip()
    if (
        trimmed.startswith("http://") or
        trimmed.startswith("https://") or
        trimmed.startswith("data:") or
        trimmed.startswith("blob:")
    ):
        return trimmed

    backend_url = os.getenv("BACKEND_PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not backend_url and os.getenv("ENVIRONMENT", "").lower() == "production":
        backend_url = "https://tribely-backend.onrender.com"
    if not backend_url:
        backend_url = "http://localhost:8000"

    clean_path = trimmed if trimmed.startswith("/") else f"/{trimmed}"
    return f"{backend_url.rstrip('/')}{clean_path}"


class ActivityRepository(BaseRepository[Submission, SubmissionCreate, SubmissionCreate]):
    """
    Object-oriented repository managing daily habit proof submissions, peer voting,
    commenting, timeline history, and Strava consistency heatmap metrics.
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

    def get_submission_by_id(self, db: Session, submission_id: int) -> Optional[Submission]:
        """
        Retrieve a submission by its unique identifier.

        :param db: Active database session.
        :param submission_id: Submission primary key.
        :return: Submission instance or None.
        """
        return db.query(Submission).filter(Submission.id == submission_id).first()

    def get_proof_by_id(self, db: Session, proof_id: int) -> Optional[Proof]:
        """
        Retrieve a Proof model entity by primary key.

        :param db: Active database session.
        :param proof_id: Proof primary key.
        :return: Proof instance or None.
        """
        return db.query(Proof).filter(Proof.id == proof_id).first()

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

    def get_submission_voters(self, db: Session, submission_id: int) -> List[Dict[str, Any]]:
        """
        Fetch voter profiles for a given submission without disclosing vote direction (privacy-safe).

        :param db: Active database session.
        :param submission_id: Submission primary key.
        :return: List of voter profiles with id, name, and avatar url.
        """
        votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id == submission_id).all()
        voter_user_ids = list({v.user_id for v in votes if v.user_id})
        if not voter_user_ids:
            return []

        voter_users = db.query(User).options(joinedload(User.profile)).filter(User.id.in_(voter_user_ids)).all()
        users_dict = {u.id: u.full_name or f"Member #{u.id}" for u in voter_users}
        profiles_dict = {
            u.id: u.profile.profile_image_url
            for u in voter_users
            if u.profile and u.profile.profile_image_url
        }

        voters_list: List[Dict[str, Any]] = []
        seen_user_ids = set()
        for v in votes:
            if v.user_id not in seen_user_ids:
                seen_user_ids.add(v.user_id)
                voters_list.append({
                    "user_id": v.user_id,
                    "user_name": users_dict.get(v.user_id, f"Member #{v.user_id}"),
                    "user_avatar_url": profiles_dict.get(v.user_id)
                })
        return voters_list

    def get_arena_history_data(self, db: Session, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Aggregate arena timeline history including messages and habit proofs with peer consensus tallies.

        :param db: Active database session.
        :param arena_id: Target arena identifier.
        :param current_user_id: Requesting user identifier.
        :return: Dict containing formatted messages and formatted submissions.
        """
        # 1. Messages with joined sender and profile
        formatted_messages: List[Dict[str, Any]] = []
        try:
            db_messages = (
                db.query(Message)
                .filter(Message.arena_id == arena_id)
                .options(joinedload(Message.user).joinedload(User.profile))
                .order_by(Message.created_at.desc())
                .limit(200)
                .all()
            )
            for msg in db_messages:
                sender_name = f"Member #{msg.user_id}"
                sender_avatar = None
                if msg.user:
                    sender_name = getattr(msg.user, "full_name", None) or sender_name
                    if msg.user.profile:
                        sender_avatar = getattr(msg.user.profile, "profile_image_url", None)

                created_at_str = ""
                if msg.created_at:
                    if isinstance(msg.created_at, str):
                        created_at_str = msg.created_at
                    elif hasattr(msg.created_at, "strftime"):
                        created_at_str = msg.created_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

                formatted_messages.append({
                    "id": msg.id,
                    "user_id": msg.user_id,
                    "content": str(msg.content or ""),
                    "message_type": str(msg.message_type or "text"),
                    "created_at": created_at_str,
                    "sender_name": sender_name,
                    "sender_avatar_url": sender_avatar
                })
        except Exception as me:
            print(f"[ActivityRepository] Error querying messages for arena {arena_id}: {me}")

        # 2. Submissions with peer voting consensus
        formatted_submissions: List[Dict[str, Any]] = []
        try:
            submissions = (
                db.query(Submission)
                .filter(Submission.arena_id == arena_id)
                .options(joinedload(Submission.user).joinedload(User.profile))
                .order_by(Submission.submitted_at.desc())
                .all()
            )
            sub_ids = [sub.id for sub in submissions]
            user_votes_dict: Dict[int, str] = {}
            voters_by_sub: Dict[int, List[Dict[str, Any]]] = {}

            if sub_ids:
                all_votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id.in_(sub_ids)).all()
                voter_user_ids = list({v.user_id for v in all_votes if v.user_id})

                users_dict: Dict[int, str] = {}
                profiles_dict: Dict[int, str] = {}
                if voter_user_ids:
                    voter_users = db.query(User).options(joinedload(User.profile)).filter(User.id.in_(voter_user_ids)).all()
                    for u in voter_users:
                        users_dict[u.id] = u.full_name or f"Member #{u.id}"
                        if u.profile and u.profile.profile_image_url:
                            profiles_dict[u.id] = u.profile.profile_image_url

                for v in all_votes:
                    if v.user_id == current_user_id:
                        user_votes_dict[v.submission_id] = v.vote_type
                    if v.submission_id not in voters_by_sub:
                        voters_by_sub[v.submission_id] = []
                    if not any(item["user_id"] == v.user_id for item in voters_by_sub[v.submission_id]):
                        voters_by_sub[v.submission_id].append({
                            "user_id": v.user_id,
                            "user_name": users_dict.get(v.user_id, f"Member #{v.user_id}"),
                            "user_avatar_url": profiles_dict.get(v.user_id)
                        })

            for sub in submissions:
                sub_user_name = f"Member #{sub.user_id}"
                sub_user_avatar = None
                if sub.user:
                    sub_user_name = getattr(sub.user, "full_name", None) or sub_user_name
                    if sub.user.profile:
                        sub_user_avatar = getattr(sub.user.profile, "profile_image_url", None)

                formatted_submissions.append({
                    "id": sub.id,
                    "user_id": sub.user_id,
                    "proof_url": _normalize_media_url(sub.proof_url),
                    "submitted_at": _format_submission_dt(sub.submitted_at) or "",
                    "user_name": sub_user_name,
                    "user_avatar_url": sub_user_avatar,
                    "upvotes": getattr(sub, "upvotes", 0) or 0,
                    "downvotes": getattr(sub, "downvotes", 0) or 0,
                    "is_absent": getattr(sub, "is_absent", False) or False,
                    "user_vote": user_votes_dict.get(sub.id),
                    "voters": voters_by_sub.get(sub.id, []),
                    "ai_confidence_score": getattr(sub, "ai_confidence_score", 0.95) or 0.95,
                    "ai_status": getattr(sub, "ai_status", "verified") or "verified",
                    "ai_audit_notes": getattr(sub, "ai_audit_notes", None)
                })
        except Exception as se:
            print(f"[ActivityRepository] Error querying submissions for arena {arena_id}: {se}")

        return {
            "messages": formatted_messages,
            "submissions": formatted_submissions
        }

    def get_user_heatmap_matrix(
        self, db: Session, arena_id: int, user_id: int, days: int = 30
    ) -> Dict[str, Any]:
        """
        Computes Strava/GitHub style habit consistency matrix over a 30 to 90 day window.

        :param db: Active database session.
        :param arena_id: Arena identifier.
        :param user_id: User identifier.
        :param days: Number of history days to compute.
        :return: Heatmap matrix calculation dictionary.
        """
        days = min(max(days, 7), 90)
        today = datetime.datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=days - 1)

        # 1. Query daily sheets in range
        sheets = db.query(DailyArenaSheet).filter(
            DailyArenaSheet.arena_id == arena_id,
            DailyArenaSheet.user_id == user_id,
            DailyArenaSheet.date_day >= start_date.isoformat(),
            DailyArenaSheet.date_day <= today.isoformat()
        ).all()
        sheet_map = {s.date_day: s for s in sheets}

        # 2. Query actual habit submissions in range
        start_dt = datetime.datetime.combine(start_date, time.min)
        submissions = db.query(Submission).filter(
            Submission.arena_id == arena_id,
            Submission.user_id == user_id,
            Submission.submitted_at >= start_dt
        ).all()
        sub_date_map = {}
        for sub in submissions:
            if sub.submitted_at:
                sub_d = sub.submitted_at.date().isoformat()
                sub_date_map[sub_d] = sub

        matrix = []
        present_count = 0
        shielded_count = 0
        absent_count = 0

        curr = start_date
        while curr <= today:
            d_str = curr.isoformat()
            sheet = sheet_map.get(d_str)
            sub = sub_date_map.get(d_str)

            if sheet:
                st = sheet.status
                pt = sheet.proof_type or (sub.proof_url if sub else None)
            elif sub:
                st = "present"
                pt = "verified"
            elif curr == today:
                st = "today_pending"
                pt = None
            else:
                st = "absent"
                pt = None

            if st == "present":
                present_count += 1
            elif st == "shielded":
                shielded_count += 1
            elif st == "absent":
                absent_count += 1

            matrix.append({
                "date": d_str,
                "day_of_week": curr.strftime("%a"),
                "status": st,
                "proof_type": pt,
                "ai_confidence": sub.ai_confidence_score if sub else None
            })
            curr += timedelta(days=1)

        eligible_days = max(1, days - (1 if matrix and matrix[-1]["status"] == "today_pending" else 0))
        consistency_pct = round((present_count / eligible_days) * 100, 1)

        return {
            "arena_id": arena_id,
            "user_id": user_id,
            "days_count": days,
            "matrix": matrix,
            "present_count": present_count,
            "shielded_count": shielded_count,
            "absent_count": absent_count,
            "consistency_percentage": consistency_pct
        }

    def get_arena_feed_data(
        self, db: Session, arena_id: int, current_user_id: Optional[int], limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """
        Fetch social proof cards for a specific arena feed with micro-reactions and comment tallies.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param current_user_id: Current user identifier for vote highlighting.
        :param limit: Page size limit.
        :param offset: Pagination offset.
        :return: Feed cards and pagination metadata.
        """
        limit = min(max(limit, 1), 50)
        submissions = (
            db.query(Submission)
            .options(joinedload(Submission.user).joinedload(User.profile))
            .filter(Submission.arena_id == arena_id)
            .order_by(Submission.submitted_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        sub_ids = [s.id for s in submissions]
        user_votes: Dict[int, str] = {}
        reaction_counts = {
            sid: {"fire": 0, "electric": 0, "respect": 0, "target": 0, "up": 0, "down": 0}
            for sid in sub_ids
        }
        comment_counts: Dict[int, int] = {}

        if sub_ids:
            all_votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id.in_(sub_ids)).all()
            for v in all_votes:
                v_type = v.vote_type.lower()
                if v.submission_id in reaction_counts and v_type in reaction_counts[v.submission_id]:
                    reaction_counts[v.submission_id][v_type] += 1
                if current_user_id and v.user_id == current_user_id:
                    user_votes[v.submission_id] = v.vote_type

            counts = (
                db.query(SubmissionComment.submission_id, func.count(SubmissionComment.id))
                .filter(SubmissionComment.submission_id.in_(sub_ids))
                .group_by(SubmissionComment.submission_id)
                .all()
            )
            comment_counts = {sid: count for sid, count in counts}

        cards = []
        for s in submissions:
            author = s.user
            profile = author.profile if author else None
            avatar_url = profile.profile_image_url if profile else None

            cards.append({
                "id": s.id,
                "arena_id": s.arena_id,
                "user_id": s.user_id,
                "user_name": author.full_name if author else f"Member #{s.user_id}",
                "user_avatar": avatar_url,
                "proof_url": s.proof_url,
                "submitted_at": _format_submission_dt(s.submitted_at),
                "is_absent": s.is_absent,
                "ai_confidence_score": s.ai_confidence_score,
                "ai_status": s.ai_status,
                "ai_audit_notes": s.ai_audit_notes,
                "upvotes": s.upvotes,
                "downvotes": s.downvotes,
                "reactions": reaction_counts.get(s.id, {}),
                "current_user_reaction": user_votes.get(s.id),
                "comments_count": comment_counts.get(s.id, 0),
                "commentsCount": comment_counts.get(s.id, 0)
            })

        return {
            "arena_id": arena_id,
            "feed": cards,
            "has_more": len(cards) == limit
        }

    def get_comments(self, db: Session, submission_id: int) -> List[SubmissionComment]:
        """
        Fetch discussion comments for a habit proof drop ordered chronologically.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :return: List of SubmissionComment model instances with user & profile loaded.
        """
        return (
            db.query(SubmissionComment)
            .options(joinedload(SubmissionComment.user).joinedload(User.profile))
            .filter(SubmissionComment.submission_id == submission_id)
            .order_by(SubmissionComment.created_at.asc())
            .all()
        )

    def create_comment(self, db: Session, *, submission_id: int, user_id: int, content: str) -> SubmissionComment:
        """
        Persist a discussion comment record on a habit proof drop.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :param user_id: Author user ID.
        :param content: Sanitized comment body text.
        :return: Created SubmissionComment instance.
        """
        new_comment = SubmissionComment(
            submission_id=submission_id,
            user_id=user_id,
            content=content,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        return new_comment

    def get_comment_count(self, db: Session, submission_id: int) -> int:
        """
        Retrieve total count of discussion comments for a submission.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :return: Total count integer.
        """
        return (
            db.query(func.count(SubmissionComment.id))
            .filter(SubmissionComment.submission_id == submission_id)
            .scalar()
            or 0
        )

    def get_global_feed(
        self,
        db: Session,
        current_user: Optional[User],
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Query Instagram-style global activity feed across user joined arenas and public discovery arenas.
        Applies synthetic test filtering on public discoveries while preserving squad membership visibility.

        :param db: Active database session.
        :param current_user: Authenticated user or None for guest viewer.
        :param limit: Number of posts to return.
        :param offset: Pagination offset.
        :return: Dict containing posts, total, has_more, and next_offset.
        """
        # 1. Fetch user's approved arena memberships if authenticated
        joined_arena_ids: List[int] = []
        if current_user:
            joined_memberships = (
                db.query(ArenaMembership.arena_id)
                .filter(
                    ArenaMembership.user_id == current_user.id,
                    ArenaMembership.status == "approved"
                )
                .all()
            )
            joined_arena_ids = [m[0] for m in joined_memberships]

        # 2. Fetch public arenas for discovery
        public_arenas = db.query(Arena.id).filter(
            or_(Arena.is_private == False, Arena.is_private == None)
        ).all()
        public_arena_ids = [a[0] for a in public_arenas]

        # 3. Combine queryable arenas
        allowed_arena_ids = list(set(joined_arena_ids).union(set(public_arena_ids)))
        if not allowed_arena_ids:
            return {
                "posts": [],
                "items": [],
                "has_more": False,
                "total": 0,
                "next_offset": 0,
                "next_cursor": None
            }

        # Filter out automated test patterns from public feed display
        arena_test_patterns = [
            "%test%", "%keyset%", "%penalty arena%", "%escrow arena%",
            "%high roller%", "%phase%", "%sprint arena%", "%multiplier arena%", "%smoke%"
        ]

        if joined_arena_ids:
            feed_filter = or_(
                Submission.arena_id.in_(joined_arena_ids),
                and_(
                    Submission.arena_id.in_(public_arena_ids),
                    *[~Arena.name.ilike(p) for p in arena_test_patterns]
                )
            )
        else:
            feed_filter = and_(
                Submission.arena_id.in_(public_arena_ids),
                *[~Arena.name.ilike(p) for p in arena_test_patterns]
            )

        base_query = (
            db.query(Submission)
            .join(Arena, Submission.arena_id == Arena.id)
            .join(User, Submission.user_id == User.id)
            .filter(feed_filter, Submission.is_absent == False)
        )

        total_count = base_query.count()

        if joined_arena_ids:
            # Algorithmic ranking: User's enrolled squads (Priority 0) rank on top,
            # followed by public discovery cohorts (Priority 1).
            # Within each priority tier, proofs are sorted latest first (reverse chronological).
            priority_clause = case((Submission.arena_id.in_(joined_arena_ids), 0), else_=1)
            submissions = (
                base_query
                .options(
                    joinedload(Submission.user).joinedload(User.profile),
                    joinedload(Submission.arena)
                )
                .order_by(priority_clause.asc(), Submission.submitted_at.desc(), Submission.id.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
        else:
            submissions = (
                base_query
                .options(
                    joinedload(Submission.user).joinedload(User.profile),
                    joinedload(Submission.arena)
                )
                .order_by(Submission.submitted_at.desc(), Submission.id.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )

        sub_ids = [s.id for s in submissions]
        user_votes: List[SubmissionVote] = []
        if current_user and sub_ids:
            user_votes = (
                db.query(SubmissionVote)
                .filter(
                    SubmissionVote.user_id == current_user.id,
                    SubmissionVote.submission_id.in_(sub_ids)
                )
                .all()
            )
        user_vote_map = {v.submission_id: v.vote_type for v in user_votes}

        comment_counts: Dict[int, int] = {}
        if sub_ids:
            counts = (
                db.query(SubmissionComment.submission_id, func.count(SubmissionComment.id))
                .filter(SubmissionComment.submission_id.in_(sub_ids))
                .group_by(SubmissionComment.submission_id)
                .all()
            )
            comment_counts = {sid: count for sid, count in counts}

        now = datetime.datetime.utcnow()
        twenty_four_hours_ago = now - timedelta(hours=24)

        posts = []
        joined_set = set(joined_arena_ids)

        for sub in submissions:
            is_joined = sub.arena_id in joined_set
            sub_time = sub.submitted_at
            if sub_time:
                sub_time_naive = sub_time.replace(tzinfo=None) if getattr(sub_time, "tzinfo", None) else sub_time
                is_today = sub_time_naive >= twenty_four_hours_ago
            else:
                is_today = False

            author = sub.user
            avatar = None
            if author and author.profile:
                avatar = author.profile.profile_image_url
            if not avatar and author:
                avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={author.id}"

            author_name = author.full_name if author else f"Member #{sub.user_id}"
            author_handle = author.email.split("@")[0] if (author and author.email) else f"user{sub.user_id}"

            arena = sub.arena
            arena_name = arena.name if arena else f"Arena #{sub.arena_id}"
            clean_tag = "#" + arena_name.replace(" ", "")[:18]

            proof_url = _normalize_media_url(sub.proof_url or "")

            # Determine post caption: user's caption if given; otherwise clean date; NEVER use AI auto-audit notes
            user_caption = getattr(sub, "caption", None)
            if not user_caption or user_caption.strip() == "":
                p_rec = db.query(Proof.caption).filter(
                    Proof.arena_id == sub.arena_id,
                    Proof.user_id == sub.user_id
                ).order_by(Proof.id.desc()).first()
                if p_rec and p_rec[0]:
                    user_caption = p_rec[0]

            if not user_caption or user_caption.strip() == "" or "AI Auto-Audit" in user_caption or "Confidence" in user_caption:
                if sub.submitted_at:
                    dt_val = sub.submitted_at
                    if getattr(dt_val, "tzinfo", None) is None:
                        dt_val = dt_val.replace(tzinfo=timezone.utc)
                    text_caption = dt_val.strftime("%d %b %Y")
                else:
                    text_caption = datetime.datetime.now().strftime("%d %b %Y")
            else:
                text_caption = user_caption.strip()

            raw_vote = user_vote_map.get(sub.id)
            norm_user_vote = (
                "upvote" if raw_vote in ["up", "upvote"]
                else "downvote" if raw_vote in ["down", "downvote"]
                else None
            )

            posts.append({
                "id": sub.id,
                "arena_id": sub.arena_id,
                "arena_name": arena_name,
                "arena_tag": clean_tag,
                "is_private": bool(arena.is_private) if arena else False,
                "is_joined": is_joined,
                "is_today": is_today,
                "proof_type": _detect_proof_media_type(proof_url, arena.proof_type if arena else None),
                "penalty_amount": float(arena.penalty_amount or 50.0) if arena else 50.0,
                "deadline_time": arena.deadline_time if arena else "23:59",
                "user_id": sub.user_id,
                "user_name": author_name,
                "user_handle": author_handle,
                "user_avatar": avatar,
                "proof_url": proof_url,
                "media_url": proof_url,
                "caption": text_caption,
                "text_reflection": text_caption,
                "submitted_at": _format_submission_dt(sub.submitted_at) or "",
                "upvotes": sub.upvotes or 0,
                "downvotes": sub.downvotes or 0,
                "user_vote": norm_user_vote,
                "userVote": norm_user_vote,
                "reactions": {
                    "fire": sub.upvotes or 0,
                    "electric": 0,
                    "respect": 0,
                    "target": sub.downvotes or 0
                },
                "current_user_reaction": norm_user_vote,
                "comments_count": comment_counts.get(sub.id, 0),
                "commentsCount": comment_counts.get(sub.id, 0),
            })

        has_more = (offset + limit) < total_count
        next_offset = offset + len(posts)
        next_cursor = str(next_offset) if has_more else None

        return {
            "posts": posts,
            "items": posts,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "total": total_count,
            "next_offset": next_offset
        }


# Global Singleton Instance for Activity Repository
activity_repository = ActivityRepository()
