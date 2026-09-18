"""
Activity & Peer-Review Consensus Service Implementation.
Encapsulates proof submission workflows, voting engine calculations, chat message delivery,
social feed aggregation, and Strava consistency heatmap metrics following Google & Meta standards.
"""

from datetime import datetime, time, timedelta, timezone
import os
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.websocket import manager as websocket_manager
from app.core.storage.storage_factory import storage_engine, offload_base64_media
from app.core.verifiers.proof_verifier import ProofVerifierFactory
from app.models.models import (
    Arena,
    ArenaMembership,
    DailyArenaSheet,
    Message,
    Proof,
    Submission,
    SubmissionComment,
    SubmissionVote,
    User,
    UserProfile,
)
from app.repositories.activity_repository import ActivityRepository, activity_repository, _format_submission_dt
from app.repositories.arena_repository import ArenaRepository, arena_repository
from app.repositories.proof_repository import proof_repository
from app.schemas.schemas import (
    CommentCreateRequest,
    MessageCreate,
    MessageCreatePayload,
    NudgePayload,
    PresignedUrlRequest,
    ReactionRequest,
    SubmissionCreate,
    VoteRequest,
)
from app.services.ai_verification_service import ai_proof_auditor
from app.services.audit_service import audit_service
from app.services.chat_cache_service import chat_cache_service
from app.services.cycle_service import cycle_service
from app.services.kudos_service import kudos_service
from app.services.notification_service import notification_service
from app.services.streak_service import streak_service


def parse_arena_deadline(deadline_time: str) -> time:
    """
    Parse arena deadline time string in '%I:%M %p' or '%H:%M' format.

    :param deadline_time: Raw deadline string (e.g. '10:00 PM' or '22:00').
    :return: Parsed datetime.time object.
    :raises ValueError: If the format cannot be parsed.
    """
    normalized = deadline_time.strip().upper()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    raise ValueError("Invalid arena deadline_time format.")


def make_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Strip timezone info from a datetime object if present.

    :param dt: datetime instance or None.
    :return: Naive datetime or None.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def validate_proof_content(proof_type: str, proof_content: str) -> str:
    """
    Strictly validates submission payload according to the Arena's configured proof_type.

    :param proof_type: "text", "link", or "image".
    :param proof_content: User submitted proof URL, text, or data URI.
    :return: Cleaned proof content string.
    :raises ValueError: If proof payload violates arena format constraints.
    """
    cleaned = proof_content.strip()
    if not cleaned:
        raise ValueError("Proof content cannot be empty.")

    normalized_type = proof_type.strip().lower()

    if normalized_type == "text":
        if cleaned.startswith("data:image/"):
            raise ValueError("This arena only accepts text proof. Image submissions are strictly disallowed.")
        return cleaned

    if normalized_type == "link":
        if cleaned.startswith("data:image/"):
            raise ValueError("This arena accepts external link URLs. Base64 image files are disallowed.")

        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Invalid link format. Submissions for this arena must be a valid http:// or https:// URL.")
        return cleaned

    if normalized_type in ["video", "clip"]:
        if cleaned.startswith("data:video/"):
            return cleaned
        if cleaned.startswith("/static/") or cleaned.startswith("static/") or cleaned.startswith("/uploads/") or cleaned.startswith("uploads/"):
            return cleaned
        parsed = urlparse(cleaned)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return cleaned
        raise ValueError("This arena requires a valid video upload or URL.")

    if normalized_type in ["image", "photo"]:
        if cleaned.startswith("data:image/"):
            if ";base64," not in cleaned:
                raise ValueError("Corrupted base64 image payload.")
            return cleaned

        if cleaned.startswith("/static/") or cleaned.startswith("static/") or cleaned.startswith("/uploads/") or cleaned.startswith("uploads/"):
            return cleaned

        parsed = urlparse(cleaned)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return cleaned

        raise ValueError("This arena strictly requires an image file upload or a valid image URL.")

    if normalized_type in ["any", "media", "hybrid", "habit"]:
        return cleaned

    raise ValueError(f"Unsupported proof type '{proof_type}' configured for this arena.")


def get_user_avatar_url(db: Session, user_id: int) -> Optional[str]:
    """
    Helper to look up avatar image URL from UserProfile.

    :param db: Active database session.
    :param user_id: Target user ID.
    :return: Profile image URL or None.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return profile.profile_image_url if profile and profile.profile_image_url else None


class ActivityService:
    """
    Business service managing daily habit submissions, proof verification voting,
    chat message delivery, Strava consistency heatmaps, and social feed aggregations.
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

    def generate_presigned_media_upload_url(
        self, payload: PresignedUrlRequest, current_user: User
    ) -> Dict[str, Any]:
        """
        Generate presigned media upload URL allowing client applications to upload
        binary image proofs directly to S3 / Cloudflare R2 / Local Storage.

        :param payload: Filename and content type metadata.
        :param current_user: Authenticated user uploading media.
        :return: Presigned upload URL payload dictionary.
        """
        ext = os.path.splitext(payload.filename)[1] or ".jpg"
        unique_key = f"proofs/user_{current_user.id}/{uuid.uuid4().hex}{ext}"
        return storage_engine.generate_presigned_upload_url(object_name=unique_key, expiration=3600)

    def submit_daily_proof(
        self, db: Session, payload: SubmissionCreate, current_user: User
    ) -> Dict[str, Any]:
        """
        Execute daily habit proof submission workflow with cycle locking, proof validation,
        AI verification, streak persistence, live WebSocket ledger broadcast, and stake return.

        :param db: Active database session.
        :param payload: Validated SubmissionCreate payload.
        :param current_user: Authenticated member submitting proof.
        :return: Success response dictionary with submission metadata.
        """
        arena = db.query(Arena).filter(Arena.id == payload.arena_id).first()
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "status": "error",
                    "message": "Target arena not found.",
                    "error_code": "ARENA_NOT_FOUND",
                },
            )

        # Authorization: Caller must be an active approved member of this arena
        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == payload.arena_id,
            ArenaMembership.user_id == current_user.id,
            ArenaMembership.status == "approved"
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": "error",
                    "message": "You must be an approved member of this Arena to submit proof.",
                    "error_code": "ARENA_MEMBERSHIP_REQUIRED"
                }
            )

        # Authoritative Server UTC Time ground truth
        now_server = datetime.now(timezone.utc)

        # Parse and validate client capture timestamp (for offline queued proofs)
        client_dt: Optional[datetime] = None
        if payload.client_submitted_at:
            try:
                parsed_dt = datetime.fromisoformat(payload.client_submitted_at.replace("Z", "+00:00"))
                if parsed_dt.tzinfo is None:
                    client_dt = parsed_dt.replace(tzinfo=timezone.utc)
                else:
                    client_dt = parsed_dt.astimezone(timezone.utc)
            except Exception as pe:
                logger.warning(f"Could not parse client_submitted_at '{payload.client_submitted_at}': {pe}")
                client_dt = None

        # Offline Proof Submission Validation Rules:
        # 1. Reject future-spoofed dates (> 2 minutes in future to allow minor client clock skew)
        # 2. Offline grace buffer: must have been captured within the last 24 hours
        # 3. If client captured the proof before the deadline, honor that cutoff cycle even if network
        #    synced it slightly later.
        is_offline_sync = False
        if client_dt:
            if client_dt > (now_server + timedelta(minutes=2)):
                client_dt = None  # Future timestamp rejected, fallback to server time
            elif (now_server - client_dt) > timedelta(hours=24):
                client_dt = None  # Older than 24-hour offline buffer rejected
            else:
                is_offline_sync = True

        reference_time = client_dt if (is_offline_sync and client_dt) else now_server
        cycle_info = cycle_service.calculate_arena_cycle(arena, reference_dt=reference_time)
        target_date_str = cycle_info.cycle_date.isoformat()
        submission_time = reference_time

        # Verify whether the captured proof was before that cycle's cutoff deadline
        cycle_cutoff = cycle_info.cycle_deadline_utc
        sub_time_cmp = submission_time if submission_time.tzinfo else submission_time.replace(tzinfo=timezone.utc)
        if sub_time_cmp >= cycle_cutoff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "error",
                    "message": f"Proof submission deadline ({cycle_info.formatted_deadline}) for this habit cycle has expired.",
                    "error_code": "CYCLE_DEADLINE_EXPIRED",
                    "cutoff_time": cycle_info.formatted_cutoff
                },
            )

        # Check if user is already locked for the active cycle
        is_locked, unlock_time, existing_sub, existing_proof = cycle_service.is_user_locked_in_cycle(
            db, payload.arena_id, current_user.id, arena, reference_dt=reference_time
        )

        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "error",
                    "message": f"You have already submitted verification proof for this cycle. Submissions are locked until deadline reset at {cycle_info.formatted_deadline}.",
                    "error_code": "DAILY_SUBMISSION_LOCKED",
                    "unlock_time": unlock_time.isoformat() if unlock_time else None
                },
            )

        # Enforce strict submission validation matching arena proof_type
        try:
            proof_content = validate_proof_content(arena.proof_type, payload.proof_url)
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "error",
                    "message": str(ve),
                    "error_code": "INVALID_PROOF_PAYLOAD"
                }
            )

        # Offload base64 image/video to object storage (Supabase Storage in prod, Local in dev)
        # Prevents database row bloat and stores clean CDN/static references in PostgreSQL
        if proof_content.startswith("data:"):
            storage_path = f"proofs/{arena.id}/{current_user.id}"
            proof_content = offload_base64_media(proof_content, folder_prefix=storage_path)

        # Execute Multimodal AI Proof Verification & Anti-Cheat Audit
        ai_audit = ai_proof_auditor.audit_submission(
            proof_type=arena.proof_type,
            proof_url=proof_content,
            arena_title=arena.name,
            arena_category=arena.category,
            arena_description=arena.description,
            caption=getattr(payload, "caption", None)
        )

        ai_status = ai_audit.get("ai_status") or ("verified" if ai_audit.get("anti_cheat_passed", True) else "flagged_suspicious")
        ai_score = ai_audit.get("confidence_score", 0.95)
        ai_notes = ai_audit.get("audit_message", "AI proof audit complete.")

        # Prioritize user-provided caption; fallback to formatted cycle date if empty
        user_caption_input = (getattr(payload, "caption", None) or "").strip()
        if not user_caption_input:
            clean_saved_caption = cycle_info.cycle_date.strftime("%d %b %Y")
        else:
            clean_saved_caption = user_caption_input

        try:
            new_submission = Submission(
                arena_id=payload.arena_id,
                proof_url=proof_content,
                user_id=current_user.id,
                submitted_at=submission_time,
                caption=clean_saved_caption,
                upvotes=0,
                downvotes=0,
                is_absent=False,
                ai_confidence_score=ai_score,
                ai_status=ai_status,
                ai_audit_notes=ai_notes
            )
            db.add(new_submission)

            # Also create Proof model record for keyset cursor indexing and schema integrity
            existing_proof_rec = db.query(Proof).filter(
                Proof.arena_id == payload.arena_id,
                Proof.user_id == current_user.id,
                Proof.submission_date == cycle_info.cycle_date
            ).first()
            if not existing_proof_rec:
                new_proof = Proof(
                    arena_id=payload.arena_id,
                    user_id=current_user.id,
                    submission_date=cycle_info.cycle_date,
                    media_url=proof_content,
                    proof_type=arena.proof_type.upper() if arena.proof_type else "IMAGE",
                    caption=clean_saved_caption,
                    created_at=submission_time
                )
                db.add(new_proof)

            # Upsert DailyArenaSheet in the same atomic database transaction
            existing_sheet = db.query(DailyArenaSheet).filter(
                DailyArenaSheet.arena_id == payload.arena_id,
                DailyArenaSheet.user_id == current_user.id,
                DailyArenaSheet.date_day == target_date_str
            ).first()

            if existing_sheet:
                existing_sheet.status = "present"
                existing_sheet.proof_type = arena.proof_type
                existing_sheet.updated_at = submission_time
            else:
                historical_log = DailyArenaSheet(
                    arena_id=payload.arena_id,
                    user_id=current_user.id,
                    date_day=target_date_str,
                    status="present",
                    proof_type=arena.proof_type
                )
                db.add(historical_log)

            # Atomically increment streak in arena membership
            membership = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == payload.arena_id,
                ArenaMembership.user_id == current_user.id
            ).first()
            if membership:
                membership.current_streak = (membership.current_streak or 0) + 1

            db.commit()
            db.refresh(new_submission)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "error",
                    "message": "A daily submission for this habit cycle has already been recorded.",
                    "error_code": "DUPLICATE_DAILY_SUBMISSION"
                }
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "error",
                    "message": f"Proof submission failed: {str(e)}",
                    "error_code": "SUBMISSION_FAILED"
                }
            )

        # Real-time WebSockets broadcast for live ledger update across all connected users
        user_avatar = (current_user.profile.profile_image_url if current_user.profile else None) or get_user_avatar_url(db, current_user.id)
        websocket_manager.safe_broadcast_to_arena(
            payload.arena_id,
            {
                "event_type": "ledger_update",
                "arena_id": payload.arena_id,
                "action": "submission_created",
                "submission": {
                    "id": new_submission.id,
                    "user_id": current_user.id,
                    "user_name": current_user.full_name or f"Member #{current_user.id}",
                    "user_avatar_url": user_avatar,
                    "proof_url": new_submission.proof_url,
                    "submitted_at": _format_submission_dt(new_submission.submitted_at) or "",
                    "caption": clean_saved_caption,
                    "upvotes": 0,
                    "downvotes": 0,
                    "is_absent": False,
                    "ai_confidence_score": new_submission.ai_confidence_score,
                    "ai_status": new_submission.ai_status,
                    "ai_audit_notes": new_submission.ai_audit_notes
                }
            }
        )

        # Dispatch Pub/Sub notifications & unread badge counters for proof submission
        try:
            import json
            from app.models.notification_models import Notification
            uploader_name = current_user.full_name or f"Member #{current_user.id}"
            notification_service.publish_arena_event_notification(
                db,
                arena_id=payload.arena_id,
                sender_id=current_user.id,
                event_type="proof_submission",
                title=f"🎉 Daily Proof Posted in {arena.name}",
                body=f"{uploader_name} submitted daily verification proof!",
                data_json={"arena_id": payload.arena_id, "url": f"/arenas/{payload.arena_id}", "user_name": uploader_name}
            )

            # Also log confirmation notification for the uploader
            uploader_notif = Notification(
                user_id=current_user.id,
                arena_id=payload.arena_id,
                event_type="proof_submission",
                title=f"Proof Verified in {arena.name}",
                body="Your daily verification proof was successfully logged!",
                data_json=json.dumps({"arena_id": payload.arena_id, "url": f"/arenas/{payload.arena_id}", "user_name": uploader_name})
            )
            db.add(uploader_notif)
            db.commit()
        except Exception:
            pass

        # Invalidate cached streak metrics for real-time consistency tracking
        try:
            streak_service.invalidate_streak_cache(current_user.id, payload.arena_id)
        except Exception:
            pass

        # Phase 4: Daily Stake Unlock - return 1/7th of locked stake back to user immediately
        try:
            kudos_service.unlock_daily_stake_return(db, current_user.id, payload.arena_id)
        except Exception as se:
            print(f"[ActivityService] Daily stake unlock notice: {se}")

        return {
            "message": "Proof registered successfully",
            "id": new_submission.id,
            "proof_type": arena.proof_type,
            "target_window_end": cycle_info.cycle_deadline_utc.isoformat(),
        }

    def get_submission_voters(self, db: Session, submission_id: int) -> Dict[str, Any]:
        """
        Fetch the complete list of members who voted on a submission without disclosing vote direction.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :return: Voter summary dictionary.
        """
        submission = self.activity_repo.get_submission_by_id(db, submission_id)
        if not submission:
            return {"submission_id": submission_id, "total_voters": 0, "voters": []}

        voters = self.activity_repo.get_submission_voters(db, submission_id)
        return {
            "submission_id": submission_id,
            "total_voters": len(voters),
            "voters": voters
        }

    def get_arena_history(self, db: Session, arena_id: int, current_user: User) -> Dict[str, Any]:
        """
        Fetch historical submissions and room chat messages combined into a unified room timeline.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param current_user: Requesting user model.
        :return: Dict containing submissions, messages, and membership metadata.
        """
        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id
        ).first()

        if not membership or membership.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": "error",
                    "message": "Membership approval required to access this arena.",
                    "error_code": "ARENA_MEMBERSHIP_NOT_APPROVED"
                }
            )

        history_data = self.activity_repo.get_arena_history_data(db, arena_id, current_user.id)
        members_count = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).count()

        user_wallet = None
        try:
            user_wallet = kudos_service.get_or_create_user_wallet(db, current_user.id)
        except Exception as we:
            print(f"[ActivityService] Error fetching user wallet: {we}")

        return {
            "submissions": history_data["submissions"],
            "messages": history_data["messages"],
            "active_call": None,
            "twenty_one_day_stats": {
                "arena_id": arena_id,
                "cycle_days": 21,
                "active_members_count": members_count,
                "status": "active"
            },
            "user_is_seized": False,
            "user_kudos_balance": getattr(user_wallet, "tribes_balance", 1000.0) if user_wallet else 1000.0
        }

    async def send_chat_message(
        self, db: Session, arena_id: int, payload: MessageCreatePayload, current_user: User
    ) -> Dict[str, Any]:
        """
        Persist a chat message into an arena and broadcast real-time update to all WebSocket connections.

        :param db: Active database session.
        :param arena_id: Target arena identifier.
        :param payload: Message payload with content and message_type.
        :param current_user: Sender user instance.
        :return: Broadcast payload dictionary.
        """
        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id
        ).first()

        if not membership or membership.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "status": "error",
                    "message": "Membership approval required to send messages in this arena.",
                    "error_code": "ARENA_MEMBERSHIP_NOT_APPROVED"
                }
            )

        content = payload.content.strip()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"status": "error", "message": "Message content cannot be empty."}
            )

        msg_schema = MessageCreate(content=content, message_type=payload.message_type)
        db_msg = self.activity_repo.create_message(
            db, message_in=msg_schema, arena_id=arena_id, user_id=current_user.id
        )

        sender_name = current_user.full_name if (current_user and getattr(current_user, "full_name", None)) else f"Member #{current_user.id}"
        sender_avatar_url = (current_user.profile.profile_image_url if current_user.profile else None) or get_user_avatar_url(db, current_user.id)

        broadcast_payload = {
            "event_type": "chat_message",
            "id": db_msg.id,
            "arena_id": arena_id,
            "user_id": current_user.id,
            "sender_name": sender_name,
            "sender_avatar_url": sender_avatar_url,
            "content": content,
            "text": content,
            "message_type": payload.message_type,
            "created_at": db_msg.created_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ") if db_msg.created_at else ""
        }

        try:
            chat_cache_service.push_recent_message(arena_id, broadcast_payload)
        except Exception as c_err:
            print(f"[ActivityService] ChatCache push notice: {c_err}")

        try:
            await websocket_manager.broadcast_to_arena(arena_id, broadcast_payload)
        except Exception as e:
            print(f"[ActivityService] Error broadcasting message via websocket: {e}")

        try:
            arena_obj = db.query(Arena).filter(Arena.id == arena_id).first()
            arena_title = arena_obj.name if arena_obj else f"Arena #{arena_id}"
            notification_service.publish_arena_event_notification(
                db,
                arena_id=arena_id,
                sender_id=current_user.id,
                event_type="chat_message",
                title=f"💬 {sender_name} in {arena_title}",
                body=content[:120],
                data_json={"arena_id": arena_id, "url": f"/arenas/{arena_id}"}
            )
        except Exception as ne:
            print(f"[ActivityService] Notification dispatch warning: {ne}")

        return broadcast_payload

    def get_user_arena_heatmap(
        self, db: Session, arena_id: int, user_id: int, days: int = 30
    ) -> Dict[str, Any]:
        """
        Computes a Strava/GitHub-style daily consistency matrix (30 or 90 days) for a user in an arena.

        :param db: Active database session.
        :param arena_id: Arena identifier.
        :param user_id: User identifier.
        :param days: Number of history days to evaluate.
        :return: Heatmap matrix dictionary.
        """
        return self.activity_repo.get_user_heatmap_matrix(db, arena_id, user_id, days)

    def get_arena_feed(
        self, db: Session, arena_id: int, current_user_id: Optional[int], limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """
        Social proof feed for an arena displaying habit proof cards with reactions and comments.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param current_user_id: Requesting user ID.
        :param limit: Page size limit.
        :param offset: Pagination offset.
        :return: Arena feed cards and has_more flag.
        """
        return self.activity_repo.get_arena_feed_data(db, arena_id, current_user_id, limit, offset)

    async def toggle_reaction(
        self, db: Session, submission_id: int, payload: ReactionRequest, current_user: Optional[User]
    ) -> Dict[str, Any]:
        """
        Submit or toggle a micro-reaction on a habit proof drop (🔥, ⚡, 👏, 🎯) with live WebSocket broadcast.

        :param db: Active database session.
        :param submission_id: Target submission / proof identifier.
        :param payload: ReactionRequest payload.
        :param current_user: Optional authenticated user.
        :return: Reaction broadcast metadata.
        """
        raw_reaction = payload.reaction_type or payload.emoji or ""
        reaction = raw_reaction.strip().lower()
        valid_reactions = {"fire", "electric", "respect", "target", "up", "down", "🔥", "⚡", "🫡", "🎯"}
        if reaction not in valid_reactions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid reaction type. Valid types: {', '.join(sorted(valid_reactions))}"
            )

        emoji_alias = {
            "fire": "🔥",
            "electric": "⚡",
            "respect": "🫡",
            "target": "🎯",
            "up": "🔥",
            "down": "down"
        }.get(reaction, reaction)

        submission = self.activity_repo.get_submission_by_id(db, submission_id)
        proof = self.activity_repo.get_proof_by_id(db, submission_id)

        if not submission and not proof:
            raise HTTPException(status_code=404, detail="Submission or proof not found.")

        voter_user = current_user or db.query(User).first()
        voter_id = voter_user.id if voter_user else 1
        arena_id = submission.arena_id if submission else proof.arena_id

        proof_react_res = None
        if proof:
            proof_react_res = proof_repository.toggle_reaction(
                db=db,
                proof_id=proof.id,
                user_id=voter_id,
                emoji=emoji_alias
            )

        if not submission:
            db.commit()
            broadcast_data = {
                "event_type": "proof_reaction",
                "arena_id": arena_id,
                "submission_id": submission_id,
                "proof_id": submission_id,
                "user_id": voter_id,
                "user_name": voter_user.full_name if voter_user else f"Member #{voter_id}",
                "reaction_type": reaction,
                "action": proof_react_res["action"] if proof_react_res else "added",
                "reactions": {reaction: proof_react_res["new_count"] if proof_react_res else 1}
            }
            try:
                await websocket_manager.broadcast_to_arena(arena_id, broadcast_data)
            except Exception as e:
                print(f"[ActivityService] Reaction broadcast notice: {e}")
            return broadcast_data

        existing_vote = db.query(SubmissionVote).filter(
            SubmissionVote.submission_id == submission_id,
            SubmissionVote.user_id == voter_id
        ).first()

        if existing_vote:
            if existing_vote.vote_type == reaction:
                db.delete(existing_vote)
                if reaction == "up" and submission.upvotes > 0:
                    submission.upvotes -= 1
                elif reaction == "down" and submission.downvotes > 0:
                    submission.downvotes -= 1
                action = "removed"
                active_reaction = None
            else:
                existing_vote.vote_type = reaction
                if reaction == "up":
                    submission.upvotes += 1
                elif reaction == "down":
                    submission.downvotes += 1
                action = "updated"
                active_reaction = reaction
        else:
            new_vote = SubmissionVote(
                submission_id=submission_id,
                user_id=voter_id,
                vote_type=reaction
            )
            db.add(new_vote)
            if reaction == "up":
                submission.upvotes += 1
            elif reaction == "down":
                submission.downvotes += 1
            action = "added"
            active_reaction = reaction

        db.commit()

        voter_name = voter_user.full_name if voter_user else f"Member #{voter_id}"
        broadcast_data = {
            "event_type": "proof_reaction",
            "arena_id": submission.arena_id,
            "submission_id": submission_id,
            "user_id": voter_id,
            "user_name": voter_name,
            "reaction_type": active_reaction,
            "action": action,
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes
        }

        try:
            await websocket_manager.broadcast_to_arena(submission.arena_id, broadcast_data)
        except Exception as e:
            print(f"[ActivityService] Reaction broadcast notice: {e}")

        return broadcast_data

    def get_submission_comments(self, db: Session, submission_id: int) -> Dict[str, Any]:
        """
        Fetch all peer discussion comments for a habit proof drop in chronological order.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :return: Formatted discussion comments list.
        """
        submission = self.activity_repo.get_submission_by_id(db, submission_id)
        proof = self.activity_repo.get_proof_by_id(db, submission_id) if not submission else None

        if not submission and not proof:
            raise HTTPException(status_code=404, detail="Submission or proof not found.")

        comments = self.activity_repo.get_comments(db, submission_id)
        now = datetime.utcnow()
        formatted = []

        for c in comments:
            author = c.user
            profile = author.profile if author else None
            avatar = profile.profile_image_url if profile and profile.profile_image_url else None
            if not avatar and author:
                avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={author.id}"

            c_time = c.created_at.replace(tzinfo=None) if c.created_at and c.created_at.tzinfo else c.created_at
            if c_time:
                diff = now - c_time
                secs = max(0, diff.total_seconds())
                if secs < 60:
                    time_ago = "Just now"
                elif secs < 3600:
                    time_ago = f"{int(secs // 60)}m ago"
                elif secs < 86400:
                    time_ago = f"{int(secs // 3600)}h ago"
                else:
                    time_ago = f"{int(diff.days)}d ago"
            else:
                time_ago = "Just now"

            formatted.append({
                "id": f"c_{c.id}",
                "rawId": c.id,
                "proofId": str(submission_id),
                "submissionId": submission_id,
                "userId": str(c.user_id),
                "userName": author.full_name if author else f"Member #{c.user_id}",
                "userAvatar": avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={c.user_id}",
                "text": c.content,
                "timeAgo": time_ago,
                "likes": 0,
                "createdAt": c.created_at.isoformat() if c.created_at else None
            })

        return {
            "submission_id": submission_id,
            "comments": formatted,
            "total": len(formatted)
        }

    async def create_submission_comment(
        self, db: Session, submission_id: int, payload: CommentCreateRequest, current_user: Optional[User]
    ) -> Dict[str, Any]:
        """
        Post a discussion comment on a habit proof drop and broadcast live WebSocket event.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :param payload: CommentCreateRequest payload.
        :param current_user: Optional authenticated author.
        :return: Created comment object and updated comment count.
        """
        raw_text = (payload.content or payload.text or "").strip()
        if not raw_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment content cannot be empty."
            )

        if len(raw_text) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment exceeds maximum length of 1000 characters."
            )

        submission = self.activity_repo.get_submission_by_id(db, submission_id)
        proof = self.activity_repo.get_proof_by_id(db, submission_id) if not submission else None

        if not submission and not proof:
            raise HTTPException(status_code=404, detail="Submission or proof not found.")

        arena_id = submission.arena_id if submission else proof.arena_id

        if current_user:
            author_id = current_user.id
            author_name = current_user.full_name or f"Member #{current_user.id}"
            avatar = get_user_avatar_url(db, current_user.id)
        else:
            fallback_author = db.query(User).first()
            author_id = fallback_author.id if fallback_author else 1
            author_name = fallback_author.full_name if fallback_author else "Community Member"
            avatar = get_user_avatar_url(db, author_id)

        new_comment = self.activity_repo.create_comment(
            db, submission_id=submission_id, user_id=author_id, content=raw_text
        )

        if not avatar:
            avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={author_id}"

        comment_obj = {
            "id": f"c_{new_comment.id}",
            "rawId": new_comment.id,
            "proofId": str(submission_id),
            "submissionId": submission_id,
            "userId": str(author_id),
            "userName": author_name,
            "userAvatar": avatar,
            "text": new_comment.content,
            "timeAgo": "Just now",
            "likes": 0,
            "createdAt": new_comment.created_at.isoformat() if new_comment.created_at else None
        }

        total_comments = self.activity_repo.get_comment_count(db, submission_id)

        broadcast_data = {
            "event_type": "proof_comment_added",
            "proof_id": str(submission_id),
            "submission_id": submission_id,
            "arena_id": arena_id,
            "comment": comment_obj,
            "comments_count": total_comments,
            "commentsCount": total_comments
        }

        try:
            await websocket_manager.broadcast_to_arena(arena_id, broadcast_data)
        except Exception as e:
            print(f"[ActivityService] Error broadcasting comment to arena: {e}")

        try:
            await websocket_manager.broadcast_to_all_users(broadcast_data)
        except Exception as e:
            print(f"[ActivityService] Error broadcasting comment to all users: {e}")

        return {
            "comment": comment_obj,
            "submission_id": submission_id,
            "comments_count": total_comments
        }

    async def vote_on_submission(
        self, db: Session, submission_id: int, payload: VoteRequest, current_user: Optional[User]
    ) -> Dict[str, Any]:
        """
        Cast, toggle, or switch an upvote/downvote on a habit proof drop with live WebSocket broadcast.

        :param db: Active database session.
        :param submission_id: Target submission ID.
        :param payload: VoteRequest schema containing vote_type.
        :param current_user: Optional authenticated voter.
        :return: Updated vote tallies and user vote status.
        """
        raw_vote = payload.vote_type.strip().lower()
        norm_vote = "up" if raw_vote in ["up", "upvote"] else "down" if raw_vote in ["down", "downvote"] else None
        if not norm_vote:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid vote type. Must be 'upvote' or 'downvote'."
            )

        submission = self.activity_repo.get_submission_by_id(db, submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        voter_user = current_user or db.query(User).first()
        voter_id = voter_user.id if voter_user else 1

        existing_vote = db.query(SubmissionVote).filter(
            SubmissionVote.submission_id == submission_id,
            SubmissionVote.user_id == voter_id
        ).first()

        active_user_vote = norm_vote

        if existing_vote:
            if existing_vote.vote_type == norm_vote:
                db.delete(existing_vote)
                if norm_vote == "up":
                    submission.upvotes = max(0, submission.upvotes - 1)
                else:
                    submission.downvotes = max(0, submission.downvotes - 1)
                active_user_vote = None
            else:
                if norm_vote == "up":
                    submission.upvotes += 1
                    submission.downvotes = max(0, submission.downvotes - 1)
                else:
                    submission.downvotes += 1
                    submission.upvotes = max(0, submission.upvotes - 1)
                existing_vote.vote_type = norm_vote
        else:
            new_vote = SubmissionVote(
                submission_id=submission_id,
                user_id=voter_id,
                vote_type=norm_vote
            )
            db.add(new_vote)
            if norm_vote == "up":
                submission.upvotes += 1
            else:
                submission.downvotes += 1

        db.commit()
        db.refresh(submission)

        normalized_response_vote = "upvote" if active_user_vote == "up" else "downvote" if active_user_vote == "down" else None

        broadcast_data = {
            "event_type": "submission_vote_updated",
            "arena_id": submission.arena_id,
            "submission_id": submission_id,
            "user_id": voter_id,
            "user_vote": normalized_response_vote,
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes,
            "is_absent": submission.is_absent
        }

        try:
            await websocket_manager.broadcast_to_arena(submission.arena_id, broadcast_data)
        except Exception as e:
            print(f"[ActivityService] Vote broadcast notice: {e}")

        return {
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes,
            "user_vote": normalized_response_vote,
            "userVote": normalized_response_vote,
            "is_absent": submission.is_absent
        }

    def get_arena_story_rings(self, db: Session, arena_id: int, current_user: User) -> Dict[str, Any]:
        """
        Calculate horizontal avatar story ring tray with countdown timers and 1.5x streak multiplier status.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param current_user: Requesting user.
        :return: Story rings and multiplier metadata.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(status_code=404, detail="Arena not found")

        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).all()

        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        deadline_time_obj = parse_arena_deadline(arena.deadline_time)
        today_deadline = datetime.combine(datetime.utcnow().date(), deadline_time_obj)
        now_utc = datetime.utcnow()
        countdown_seconds = max(0, int((today_deadline - now_utc).total_seconds()))

        rings = []
        completed_count = 0

        for m in memberships:
            u = db.query(User).filter(User.id == m.user_id).first()
            if not u:
                continue

            profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
            avatar = profile.profile_image_url if profile else None

            sub = db.query(Submission).filter(
                Submission.arena_id == arena_id,
                Submission.user_id == u.id,
                Submission.submitted_at >= today_start,
                Submission.is_absent == False
            ).order_by(Submission.submitted_at.desc()).first()

            sheet = db.query(DailyArenaSheet).filter(
                DailyArenaSheet.arena_id == arena_id,
                DailyArenaSheet.user_id == u.id,
                DailyArenaSheet.date_day == today_start.date()
            ).first()

            has_submitted = bool(sub or (sheet and sheet.status in ["submitted", "verified", "shielded"]))
            if has_submitted:
                completed_count += 1

            is_at_risk = (not has_submitted) and (countdown_seconds < 3 * 3600)

            rings.append({
                "user_id": u.id,
                "full_name": u.full_name or f"Member #{u.id}",
                "avatar_url": avatar,
                "has_submitted_today": has_submitted,
                "is_at_risk": is_at_risk,
                "latest_proof": {
                    "id": sub.id,
                    "proof_type": getattr(sub, "proof_type", None) or arena.proof_type,
                    "proof_content": getattr(sub, "proof_url", None),
                    "submitted_at": _format_submission_dt(sub.submitted_at)
                } if sub else None
            })

        total = len(rings)
        all_completed = (completed_count == total) and total > 0

        return {
            "arena_id": arena_id,
            "arena_name": arena.name,
            "deadline_time": arena.deadline_time,
            "countdown_seconds": countdown_seconds,
            "multiplier_active": all_completed,
            "multiplier_value": 1.5 if all_completed else 1.0,
            "completed_count": completed_count,
            "total_members": total,
            "rings": rings
        }

    async def send_peer_nudge(
        self, db: Session, arena_id: int, target_user_id: int, payload: Optional[NudgePayload], current_user: User
    ) -> Dict[str, Any]:
        """
        Send a real-time peer nudge reminder to an at-risk cohort member to protect the 1.5x multiplier.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param target_user_id: Cohort member being nudged.
        :param payload: Optional custom nudge message payload.
        :param current_user: Sender user instance.
        :return: Nudge dispatch confirmation.
        """
        sender_mem = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id,
            ArenaMembership.status == "approved"
        ).first()
        if not sender_mem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be an approved member of this Arena to send nudges."
            )

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target member not found")

        target_mem = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == target_user_id,
            ArenaMembership.status == "approved"
        ).first()
        if not target_mem:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target user is not an approved member of this Arena."
            )

        sender_name = current_user.full_name or "A Tribe Member"
        custom_msg = (payload and payload.message) or f"⚡ {sender_name} nudged you! Drop your proof before cutoff to save our 1.5x Tribe Multiplier!"

        broadcast_data = {
            "event_type": "member_nudged",
            "arena_id": arena_id,
            "sender_id": current_user.id,
            "sender_name": sender_name,
            "target_user_id": target_user_id,
            "target_name": target_user.full_name,
            "message": custom_msg,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            await websocket_manager.broadcast_to_arena(arena_id, broadcast_data)
        except Exception as e:
            print(f"[ActivityService] Nudge broadcast error: {e}")

        return {
            "message": f"Nudge sent to {target_user.full_name}!",
            "target_user_id": target_user_id
        }

    def execute_automated_ledger_cycle(self, db: Session, current_user: User) -> Dict[str, Any]:
        """
        Automated Ledger Cycle & Absence Fine Audit evaluating all active cohort arenas.

        :param db: Active database session.
        :param current_user: Admin user executing the audit.
        :return: Audit execution summary.
        """
        active_arenas = db.query(Arena).filter(
            ~Arena.name.ilike("%smoke test%"),
            ~Arena.name.ilike("%test%")
        ).all()

        target_date_str = datetime.utcnow().strftime("%Y-%m-%d")
        results = []
        total_absent = 0

        for arena in active_arenas:
            try:
                summary = audit_service.audit_arena_deadline(db, arena.id, target_date_str)
                pool = kudos_service.get_or_create_arena_pool(db, arena.id)
                absent_cnt = summary.get("absent_count", 0)
                total_absent += absent_cnt
                results.append({
                    "arena_id": arena.id,
                    "arena_name": arena.name,
                    "is_private": arena.is_private,
                    "absent_count": absent_cnt,
                    "penalty_amount": float(arena.penalty_amount or 0.0),
                    "escrow_vault": pool.tribes_reserve_vault
                })
            except Exception as e:
                print(f"[ActivityService] Error auditing arena #{arena.id}: {str(e)}")

        return {
            "message": "Automated ledger cycle executed cleanly.",
            "target_date": target_date_str,
            "arenas_audited": len(results),
            "total_absent_members_fined": total_absent,
            "squad_summaries": results
        }

    def get_social_feed(
        self,
        db: Session,
        current_user: Optional[User],
        limit: int = 20,
        offset: int = 0,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query endless social activity feed showing latest habit verification proofs on top.

        :param db: Active database session.
        :param current_user: Authenticated viewer or None.
        :param limit: Page size limit.
        :param offset: Pagination offset.
        :param cursor: Optional integer offset cursor.
        :return: Social feed response dictionary.
        """
        if cursor and cursor.isdigit():
            offset = int(cursor)
        return self.activity_repo.get_global_feed(db, current_user, limit, offset)


# Global Singleton Service Instance
activity_service = ActivityService()
