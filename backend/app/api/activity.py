from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, literal, or_
from pydantic import BaseModel
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime, time, timedelta, timezone
import asyncio
from urllib.parse import urlparse
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import (
    Arena, Submission, Message, User, UserProfile,
    ArenaMembership, SubmissionVote, DailyArenaSheet, UserWallet,
    Proof, ProofReaction
)

from app.api.websocket import manager as websocket_manager
from app.core.managers.active_calls_registry import active_calls_registry
from app.schemas.schemas import MessageCreate
from app.repositories.activity_repository import activity_repository


router = APIRouter(prefix="/api/activity", tags=["Activity & History Logs"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


def get_user_avatar_url(db: Session, user_id: int) -> str | None:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return profile.profile_image_url if profile and profile.profile_image_url else None


def parse_arena_deadline(deadline_time: str) -> time:
    normalized = deadline_time.strip().upper()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    raise ValueError("Invalid arena deadline_time format.")


def make_naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def calculate_active_submission_window(deadline_str: str) -> Tuple[datetime, datetime, str]:
    now = datetime.utcnow()
    deadline_time_obj = parse_arena_deadline(deadline_str)
    
    today_cutoff = datetime.combine(now.date(), deadline_time_obj)
    
    if now <= today_cutoff:
        window_start = today_cutoff - timedelta(days=1)
        window_end = today_cutoff
        target_date_str = now.date().isoformat()
    else:
        window_start = today_cutoff
        window_end = today_cutoff + timedelta(days=1)
        target_date_str = (now.date() + timedelta(days=1)).isoformat()
        
    return window_start, window_end, target_date_str


def validate_proof_content(proof_type: str, proof_content: str) -> str:
    """Strictly validates submission payload according to the Arena's configured proof_type."""
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

    if normalized_type == "image":
        # 1. Base64 Data Payload Validation
        if cleaned.startswith("data:image/"):
            if ";base64," not in cleaned:
                raise ValueError("Corrupted base64 image payload.")
            return cleaned

        # 2. HTTP/HTTPS Image URL Validation
        parsed = urlparse(cleaned)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return cleaned

        raise ValueError("This arena strictly requires an image file upload or a valid image URL.")

    raise ValueError(f"Unsupported proof type '{proof_type}' configured for this arena.")


def broadcast_ledger_event(arena_id: int, payload: Dict[str, Any]) -> None:
    """Broadcasts real-time events to all connected clients in the arena WebSocket channel."""
    websocket_manager.safe_broadcast_to_arena(arena_id, payload)


class SubmissionCreate(BaseModel):
    arena_id: int
    proof_url: str
    client_submitted_at: str | None = None
    caption: str | None = None
    telemetry_data: dict | None = None


class VoteRequest(BaseModel):
    vote_type: str


from app.core.storage.storage_factory import storage_engine

class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"



@router.post("/upload-url")
def get_presigned_media_upload_url(
    payload: PresignedUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generates a presigned media upload URL allowing client applications to upload 
    binary image proofs directly to S3 / Cloudflare R2 / Local Storage.
    """
    import uuid, os
    ext = os.path.splitext(payload.filename)[1] or ".jpg"
    unique_key = f"proofs/user_{current_user.id}/{uuid.uuid4().hex}{ext}"
    res = storage_engine.generate_presigned_upload_url(object_name=unique_key, expiration=3600)
    return success_response(res)


from app.core.rate_limiter import RateLimiter

@router.post("/submit", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=5, seconds=60))])
def submit_proof(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.exc import IntegrityError

    try:
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
        from app.services.cycle_service import cycle_service
        now_server = datetime.utcnow()
        cycle_info = cycle_service.calculate_arena_cycle(arena)
        target_date_str = cycle_info.cycle_date.isoformat()

        # Validate and clamp client timestamp to ensure no spoofing outside current cycle window
        submission_time = now_server
        if payload.client_submitted_at:
            try:
                client_dt = datetime.fromisoformat(payload.client_submitted_at.replace("Z", "+00:00")).replace(tzinfo=None)
                window_start_naive = cycle_info.cycle_start_utc.replace(tzinfo=None)
                if window_start_naive <= client_dt <= now_server:
                    submission_time = client_dt
            except Exception:
                pass

        # Check if user is already locked for the active 24-hour cycle
        is_locked, unlock_time, existing_sub, existing_proof = cycle_service.is_user_locked_in_cycle(
            db, payload.arena_id, current_user.id, arena
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

        # Execute Multimodal AI Proof Verification & Anti-Cheat Audit
        from app.services.ai_verification_service import ai_proof_auditor
        ai_audit = ai_proof_auditor.audit_submission(arena.proof_type, proof_content)

        new_submission = Submission(
            arena_id=payload.arena_id,
            proof_url=proof_content,
            user_id=current_user.id,
            submitted_at=submission_time,
            upvotes=0,
            downvotes=0,
            is_absent=False,
            ai_confidence_score=ai_audit.get("confidence_score", 0.95),
            ai_status="verified" if ai_audit.get("anti_cheat_passed", True) else "flagged_suspicious",
            ai_audit_notes=ai_audit.get("audit_message", "AI proof audit complete.")
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
                caption=payload.caption or "Daily habit proof drop.",
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

        # Real-time WebSockets broadcast for live ledger update across all connected users
        user_avatar = (current_user.profile.profile_image_url if current_user.profile else None) or get_user_avatar_url(db, current_user.id)
        broadcast_ledger_event(
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
                    "submitted_at": str(new_submission.submitted_at),
                    "upvotes": 0,
                    "downvotes": 0,
                    "is_absent": False,
                    "ai_confidence_score": new_submission.ai_confidence_score,
                    "ai_status": new_submission.ai_status,
                    "ai_audit_notes": new_submission.ai_audit_notes
                }
            },
        )

        # Dispatch Pub/Sub notifications & unread badge counters for proof submission
        try:
            from app.services.notification_service import notification_service
            uploader_name = current_user.full_name or f"Member #{current_user.id}"
            notification_service.publish_arena_event_notification(
                db,
                arena_id=payload.arena_id,
                sender_id=current_user.id,
                event_type="proof_submission",
                title=f"🎉 Daily Proof Posted in {arena.name}",
                body=f"{uploader_name} submitted daily verification proof!",
                data_json={"arena_id": payload.arena_id, "url": f"/arena/{payload.arena_id}"}
            )
        except Exception:
            pass

        # Invalidate cached streak metrics for real-time consistency tracking
        try:
            from app.services.streak_service import streak_service
            streak_service.invalidate_streak_cache(current_user.id, payload.arena_id)

            # Check if this submission unlocked a 7-day milestone shield reward
            streak_info = streak_service.calculate_user_streak(db, current_user.id, payload.arena_id)
            cur_streak = streak_info.get("current_streak", 0)
            if cur_streak > 0 and cur_streak % 7 == 0:
                locked_wallet = db.query(UserWallet).filter(UserWallet.user_id == current_user.id).with_for_update().first()
                if locked_wallet and locked_wallet.streak_shields < 3:
                    locked_wallet.streak_shields += 1
                    db.commit()
                    streak_service.invalidate_streak_cache(current_user.id, payload.arena_id)
        except Exception:
            pass

        # Phase 4: Daily Stake Unlock - return 1/7th of locked stake back to user immediately
        try:
            from app.services.kudos_service import kudos_service
            kudos_service.unlock_daily_stake_return(db, current_user.id, payload.arena_id)
        except Exception as se:
            print(f"Daily stake unlock notice: {se}")

        return success_response({
            "message": "Proof registered successfully",
            "id": new_submission.id,
            "proof_type": arena.proof_type,
            "target_window_end": cycle_info.cycle_deadline_utc.isoformat(),
        })
    except HTTPException:
        raise
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


def get_submission_voting_deadline(submission_time: datetime, deadline_str: str) -> datetime:
    """Calculates the exact voting window expiration cutoff for a given submission timestamp."""
    sub_dt = make_naive(submission_time) or datetime.utcnow()
    deadline_time_obj = parse_arena_deadline(deadline_str)
    same_day_cutoff = datetime.combine(sub_dt.date(), deadline_time_obj)
    if sub_dt <= same_day_cutoff:
        return same_day_cutoff
    else:
        return same_day_cutoff + timedelta(days=1)




@router.get("/submission/{submission_id}/voters")
def get_submission_voters(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches the complete list of members who voted on a submission (upvote OR downvote).
    PRIVACY GUARANTEE: Does NOT reveal whether a specific user voted up or down!
    """
    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            return success_response({"submission_id": submission_id, "total_voters": 0, "voters": []})

        votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id == submission_id).all()
        voter_user_ids = list({v.user_id for v in votes if v.user_id})

        voters_list = []
        if voter_user_ids:
            voter_users = db.query(User).filter(User.id.in_(voter_user_ids)).all()
            users_dict = {u.id: u.full_name or f"Member #{u.id}" for u in voter_users}
            profiles = db.query(UserProfile).filter(UserProfile.user_id.in_(voter_user_ids)).all()
            profiles_dict = {p.user_id: p.profile_image_url for p in profiles if p.profile_image_url}

            seen_user_ids = set()
            for v in votes:
                if v.user_id not in seen_user_ids:
                    seen_user_ids.add(v.user_id)
                    voters_list.append({
                        "user_id": v.user_id,
                        "user_name": users_dict.get(v.user_id, f"Member #{v.user_id}"),
                        "user_avatar_url": profiles_dict.get(v.user_id)
                    })

        return success_response({
            "submission_id": submission_id,
            "total_voters": len(voters_list),
            "voters": voters_list
        })
    except Exception as e:
        print(f"Error fetching voters list for submission {submission_id}: {e}")
        return success_response({"submission_id": submission_id, "total_voters": 0, "voters": []})


@router.get("/arena/{arena_id}/history")
@router.get("/arenas/{arena_id}/history")
def get_arena_history(
    arena_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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

    formatted_messages = []
    try:
        # 1. Fetch ground-truth persistent messages from database
        db_messages = db.query(Message)\
            .filter(Message.arena_id == arena_id)\
            .options(joinedload(Message.user).joinedload(User.profile))\
            .order_by(Message.created_at.desc())\
            .limit(200)\
            .all()

        for msg in db_messages:
            try:
                # Safe sender name
                sender_name = f"Member #{msg.user_id}"
                sender_avatar = None
                if msg.user:
                    sender_name = getattr(msg.user, 'full_name', None) or sender_name
                    if msg.user.profile:
                        sender_avatar = getattr(msg.user.profile, 'profile_image_url', None)

                # Safe created_at ISO string
                created_at_str = ""
                if msg.created_at:
                    if isinstance(msg.created_at, str):
                        created_at_str = msg.created_at
                    elif hasattr(msg.created_at, 'strftime'):
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
            except Exception as m_err:
                print(f"Error formatting single message {getattr(msg, 'id', None)}: {m_err}")
    except Exception as me:
        print(f"Error querying messages for arena {arena_id}: {me}")

    formatted_submissions = []
    try:
        submissions = db.query(Submission)\
            .filter(Submission.arena_id == arena_id)\
            .options(joinedload(Submission.user).joinedload(User.profile))\
            .order_by(Submission.submitted_at.desc())\
            .all()

        submission_ids = [sub.id for sub in submissions]
        user_votes_dict = {}
        voters_by_sub = {}
        if submission_ids:
            try:
                all_votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id.in_(submission_ids)).all()
                voter_user_ids = list({v.user_id for v in all_votes if v.user_id})
                
                users_dict = {}
                profiles_dict = {}
                if voter_user_ids:
                    voter_users = db.query(User).options(joinedload(User.profile)).filter(User.id.in_(voter_user_ids)).all()
                    for u in voter_users:
                        users_dict[u.id] = u.full_name or f"Member #{u.id}"
                        if u.profile and u.profile.profile_image_url:
                            profiles_dict[u.id] = u.profile.profile_image_url

                for v in all_votes:
                    if v.user_id == current_user.id:
                        user_votes_dict[v.submission_id] = v.vote_type
                    if v.submission_id not in voters_by_sub:
                        voters_by_sub[v.submission_id] = []
                    if not any(item["user_id"] == v.user_id for item in voters_by_sub[v.submission_id]):
                        voters_by_sub[v.submission_id].append({
                            "user_id": v.user_id,
                            "user_name": users_dict.get(v.user_id, f"Member #{v.user_id}"),
                            "user_avatar_url": profiles_dict.get(v.user_id)
                        })
            except Exception as ve:
                print(f"Non-critical voters query error: {ve}")

        for sub in submissions:
            try:
                sub_user_name = f"Member #{sub.user_id}"
                sub_user_avatar = None
                if sub.user:
                    sub_user_name = getattr(sub.user, 'full_name', None) or sub_user_name
                    if sub.user.profile:
                        sub_user_avatar = getattr(sub.user.profile, 'profile_image_url', None)

                formatted_submissions.append({
                    "id": sub.id,
                    "user_id": sub.user_id,
                    "proof_url": sub.proof_url,
                    "submitted_at": str(sub.submitted_at),
                    "user_name": sub_user_name,
                    "user_avatar_url": sub_user_avatar,
                    "upvotes": getattr(sub, 'upvotes', 0) or 0,
                    "downvotes": getattr(sub, 'downvotes', 0) or 0,
                    "is_absent": getattr(sub, 'is_absent', False) or False,
                    "user_vote": user_votes_dict.get(sub.id),
                    "voters": voters_by_sub.get(sub.id, []),
                    "ai_confidence_score": getattr(sub, 'ai_confidence_score', 0.95) or 0.95,
                    "ai_status": getattr(sub, 'ai_status', 'verified') or 'verified',
                    "ai_audit_notes": getattr(sub, 'ai_audit_notes', None)
                })
            except Exception as sub_err:
                print(f"Error formatting single submission {getattr(sub, 'id', None)}: {sub_err}")
    except Exception as se:
        print(f"Error querying submissions for arena {arena_id}: {se}")

    active_call = None
    try:
        active_call = active_calls_registry.get_active_call(arena_id)
    except Exception as ce:
        print(f"Error checking active call for arena {arena_id}: {ce}")

    twenty_one_day_stats = {
        "arena_id": arena_id,
        "cycle_days": 21,
        "active_members_count": len(memberships),
        "status": "active"
    }

    user_is_seized = False  # Account freezing deprecated; users always have posting access

    user_wallet = None
    try:
        from app.services.kudos_service import kudos_service
        user_wallet = kudos_service.get_or_create_user_wallet(db, current_user.id)
    except Exception as we:
        print(f"Error fetching user wallet: {we}")

    return success_response({
        "submissions": formatted_submissions,
        "messages": formatted_messages,
        "active_call": active_call,
        "twenty_one_day_stats": twenty_one_day_stats,
        "user_is_seized": user_is_seized,
        "user_kudos_balance": getattr(user_wallet, 'tribes_balance', 1000.0) if user_wallet else 1000.0
    })



class MessageCreatePayload(BaseModel):
    content: str
    message_type: str = "text"


@router.post("/arena/{arena_id}/message", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=20, seconds=60))])
@router.post("/arenas/{arena_id}/message", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=20, seconds=60))])
@router.post("/arenas/{arena_id}/messages", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=20, seconds=60))])
async def send_arena_message(
    arena_id: int,
    payload: MessageCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    HTTP POST endpoint to send a chat message into an arena.
    Persists message to database and broadcasts real-time update to all WebSocket connections.
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
    db_msg = activity_repository.create_message(db, message_in=msg_schema, arena_id=arena_id, user_id=current_user.id)

    sender_name = current_user.full_name if (current_user and getattr(current_user, 'full_name', None)) else f"Member #{current_user.id}"
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

    # Push to Redis for instant sub-millisecond prefetching
    try:
        from app.services.chat_cache_service import chat_cache_service
        chat_cache_service.push_recent_message(arena_id, broadcast_payload)
    except Exception as c_err:
        print(f"ChatCache push notice: {c_err}")

    try:
        await websocket_manager.broadcast_to_arena(arena_id, broadcast_payload)
    except Exception as e:
        print(f"Error broadcasting message via websocket: {e}")

    # Dispatch Meta/Instagram scale Pub/Sub notifications & unread badge counters
    try:
        from app.services.notification_service import notification_service
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
        print(f"Notification dispatch warning: {ne}")

    return success_response(broadcast_payload)





# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: Strava Consistency Heatmap & Instagram/BeReal Social Proof Feed
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/arenas/{arena_id}/heatmap/{user_id}")
def get_user_arena_heatmap(
    arena_id: int,
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Computes a Strava/GitHub-style daily consistency matrix (30 or 90 days)
    for a user in an arena, showing present, shielded, absent, and pending status.
    """
    days = min(max(days, 7), 90)
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)

    # 1. Query daily sheets in date range
    sheets = db.query(DailyArenaSheet).filter(
        DailyArenaSheet.arena_id == arena_id,
        DailyArenaSheet.user_id == user_id,
        DailyArenaSheet.date_day >= start_date.isoformat(),
        DailyArenaSheet.date_day <= today.isoformat()
    ).all()
    sheet_map = {s.date_day: s for s in sheets}

    # 2. Query submissions in range to verify actual proofs
    start_dt = datetime.combine(start_date, time.min)
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

    eligible_days = max(1, days - (1 if matrix[-1]["status"] == "today_pending" else 0))
    consistency_pct = round(((present_count + shielded_count) / eligible_days) * 100, 1)

    return success_response({
        "arena_id": arena_id,
        "user_id": user_id,
        "days_count": days,
        "matrix": matrix,
        "present_count": present_count,
        "shielded_count": shielded_count,
        "absent_count": absent_count,
        "consistency_percentage": consistency_pct
    })


@router.get("/arenas/{arena_id}/feed")
def get_arena_social_proof_feed(
    arena_id: int,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    High-speed social proof feed (Instagram/BeReal style) displaying habit proof cards,
    AI verification confidence, media previews, peer vote tallies, and micro-reaction chips.
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
    user_votes = {}
    reaction_counts = {sid: {"fire": 0, "electric": 0, "respect": 0, "target": 0, "up": 0, "down": 0} for sid in sub_ids}

    if sub_ids:
        all_votes = db.query(SubmissionVote).filter(SubmissionVote.submission_id.in_(sub_ids)).all()
        for v in all_votes:
            v_type = v.vote_type.lower()
            if v.submission_id in reaction_counts and v_type in reaction_counts[v.submission_id]:
                reaction_counts[v.submission_id][v_type] += 1
            if v.user_id == current_user.id:
                user_votes[v.submission_id] = v.vote_type

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
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "is_absent": s.is_absent,
            "ai_confidence_score": s.ai_confidence_score,
            "ai_status": s.ai_status,
            "ai_audit_notes": s.ai_audit_notes,
            "upvotes": s.upvotes,
            "downvotes": s.downvotes,
            "reactions": reaction_counts.get(s.id, {}),
            "current_user_reaction": user_votes.get(s.id)
        })

    return success_response({
        "arena_id": arena_id,
        "feed": cards,
        "has_more": len(cards) == limit
    })


class ReactionRequest(BaseModel):
    reaction_type: str  # "fire", "electric", "respect", "target", "up", "down"


@router.post("/submissions/{submission_id}/react", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
@router.post("/proofs/{submission_id}/react", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def react_to_submission(
    submission_id: int,
    payload: ReactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a micro-reaction to a habit proof (🔥, ⚡, 👏, 🎯) with real-time
    WebSocket broadcast to the arena room.
    """
    from app.repositories.proof_repository import proof_repository
    reaction = payload.reaction_type.strip().lower()
    valid_reactions = {"fire", "electric", "respect", "target", "up", "down", "🔥", "⚡", "🫡", "🎯"}
    if reaction not in valid_reactions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reaction type. Valid types: {', '.join(sorted(valid_reactions))}"
        )

    # Normalize emoji aliases
    emoji_alias = {
        "fire": "🔥",
        "electric": "⚡",
        "respect": "🫡",
        "target": "🎯",
        "up": "🔥",
        "down": "down"
    }.get(reaction, reaction)

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    proof = db.query(Proof).filter(Proof.id == submission_id).first()

    if not submission and not proof:
        raise HTTPException(status_code=404, detail="Submission or proof not found.")

    arena_id = submission.arena_id if submission else proof.arena_id

    # Update ProofReaction if proof exists
    proof_react_res = None
    if proof:
        proof_react_res = proof_repository.toggle_reaction(
            db=db,
            proof_id=proof.id,
            user_id=current_user.id,
            emoji=emoji_alias
        )

    if not submission:
        db.commit()
        broadcast_data = {
            "event_type": "proof_reaction",
            "arena_id": arena_id,
            "submission_id": submission_id,
            "proof_id": submission_id,
            "user_id": current_user.id,
            "user_name": current_user.full_name or f"Member #{current_user.id}",
            "reaction_type": reaction,
            "action": proof_react_res["action"] if proof_react_res else "added",
            "reactions": {reaction: proof_react_res["new_count"] if proof_react_res else 1}
        }
        try:
            await websocket_manager.broadcast_to_arena(arena_id, broadcast_data)
        except Exception as e:
            print(f"Reaction broadcast notice: {e}")
        return success_response(broadcast_data)

    existing_vote = db.query(SubmissionVote).filter(
        SubmissionVote.submission_id == submission_id,
        SubmissionVote.user_id == current_user.id
    ).first()

    old_reaction = None
    if existing_vote:
        old_reaction = existing_vote.vote_type
        if existing_vote.vote_type == reaction:
            # Toggle off if same reaction tapped again
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
            user_id=current_user.id,
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

    # Real-time WebSocket broadcast to all connected members in the arena
    broadcast_data = {
        "event_type": "proof_reaction",
        "arena_id": submission.arena_id,
        "submission_id": submission_id,
        "user_id": current_user.id,
        "user_name": current_user.full_name or f"Member #{current_user.id}",
        "reaction_type": active_reaction,
        "action": action,
        "upvotes": submission.upvotes,
        "downvotes": submission.downvotes
    }

    try:
        await websocket_manager.broadcast_to_arena(submission.arena_id, broadcast_data)
    except Exception as e:
        print(f"Reaction broadcast notice: {e}")

    return success_response(broadcast_data)


@router.post("/submission/{submission_id}/vote", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
async def vote_on_submission(
    submission_id: int,
    payload: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Official vote endpoint matching the frontend client (/api/activity/submission/{id}/vote).
    Supports 'upvote'/'up' and 'downvote'/'down', self-voting prevention,
    toggle-off unvoting, and real-time WebSocket broadcast to all connected arena members.
    """
    raw_vote = payload.vote_type.strip().lower()
    norm_vote = "up" if raw_vote in ["up", "upvote"] else "down" if raw_vote in ["down", "downvote"] else None
    if not norm_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid vote type. Must be 'upvote' or 'downvote'."
        )

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot vote on your own proof submission."
        )

    existing_vote = db.query(SubmissionVote).filter(
        SubmissionVote.submission_id == submission_id,
        SubmissionVote.user_id == current_user.id
    ).first()

    active_user_vote = norm_vote

    if existing_vote:
        if existing_vote.vote_type == norm_vote:
            # Toggle off / un-vote
            db.delete(existing_vote)
            if norm_vote == "up":
                submission.upvotes = max(0, submission.upvotes - 1)
            else:
                submission.downvotes = max(0, submission.downvotes - 1)
            active_user_vote = None
        else:
            # Switch vote choice
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
            user_id=current_user.id,
            vote_type=norm_vote
        )
        db.add(new_vote)
        if norm_vote == "up":
            submission.upvotes += 1
        else:
            submission.downvotes += 1

    db.commit()
    db.refresh(submission)

    broadcast_data = {
        "event_type": "submission_vote_updated",
        "arena_id": submission.arena_id,
        "submission_id": submission_id,
        "user_id": current_user.id,
        "user_vote": active_user_vote,
        "upvotes": submission.upvotes,
        "downvotes": submission.downvotes,
        "is_absent": submission.is_absent
    }

    try:
        await websocket_manager.broadcast_to_arena(submission.arena_id, broadcast_data)
    except Exception as e:
        print(f"Vote broadcast notice: {e}")

    return success_response({
        "upvotes": submission.upvotes,
        "downvotes": submission.downvotes,
        "user_vote": active_user_vote,
        "is_absent": submission.is_absent
    })


@router.get("/arenas/{arena_id}/story-rings")
def get_arena_story_rings(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Phase 2: Tribe Story Rings Endpoint.
    Returns the horizontal avatar carousel items for an arena with active countdown timers,
    glowing border status (submitted), empty ring (pending), and 'At Risk' status.
    Also returns 1.5x Tribe Multiplier status.
    """
    arena = db.query(Arena).filter(Arena.id == arena_id).first()
    if not arena:
        raise HTTPException(status_code=404, detail="Arena not found")

    memberships = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == arena_id,
        ArenaMembership.status == "approved"
    ).all()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate deadline countdown seconds
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

        # Check today's submission
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
                "proof_type": sub.proof_type,
                "proof_content": sub.proof_content,
                "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None
            } if sub else None
        })

    total = len(rings)
    all_completed = (completed_count == total) and total > 0

    return success_response({
        "arena_id": arena_id,
        "arena_name": arena.name,
        "deadline_time": arena.deadline_time,
        "countdown_seconds": countdown_seconds,
        "multiplier_active": all_completed,
        "multiplier_value": 1.5 if all_completed else 1.0,
        "completed_count": completed_count,
        "total_members": total,
        "rings": rings
    })


class NudgePayload(BaseModel):
    message: Optional[str] = None


@router.post("/arenas/{arena_id}/nudge/{target_user_id}")
async def nudge_cohort_member(
    arena_id: int,
    target_user_id: int,
    payload: Optional[NudgePayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Phase 4: 1-Tap Nudge for 'At Risk' cohort members.
    Broadcasts real-time alert via WebSocket to protect the cohort's 1.5x Streak Multiplier.
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
        print(f"Nudge broadcast error: {e}")

    return success_response({
        "message": f"Nudge sent to {target_user.full_name}!",
        "target_user_id": target_user_id
    })


@router.post("/streak/lifeline")
def claim_streak_lifeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Phase 4: Streak Lifeline Growth Mechanism.
    When a user is out of shields, allows them to claim an emergency lifeline.
    """
    wallet = kudos_service.get_or_create_user_wallet(db, current_user.id)
    cur_shields = getattr(wallet, 'streak_shields', 0)
    
    # Credit 1 emergency shield
    wallet.streak_shields = min(3, cur_shields + 1)
    db.commit()
    db.refresh(wallet)

    return success_response({
        "message": "Emergency Streak Lifeline credited! Your streak is saved.",
        "streak_shields": wallet.streak_shields
    })


@router.post("/ledger-cycle/run")
def execute_automated_ledger_cycle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Automated Ledger Cycle & Absence Fine Audit.
    Evaluates all active arenas:
    1. Checks daily cutoff deadlines for each member.
    2. Marks members who missed the daily proof as absent.
    3. Deducts agreed fine from user wallet and deposits into arena escrow vault (ArenaPool.tribes_reserve_vault).
    4. Broadcasts real-time WebSocket notices.
    """
    from app.services.audit_service import audit_service
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
            logger.warning(f"Error auditing arena #{arena.id}: {str(e)}")

    return success_response({
        "message": "Automated ledger cycle executed cleanly.",
        "target_date": target_date_str,
        "arenas_audited": len(results),
        "total_absent_members_fined": total_absent,
        "squad_summaries": results
    })


@router.get("/feed")
def get_user_social_feed(
    limit: int = 20,
    offset: int = 0,
    cursor: Optional[str] = None,
    use_cursor: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Instagram-Style Social Feed supporting endless pagination and prioritized sorting:
    1. Latest proofs from the arenas in which the current user is enrolled (newest first).
    2. Followed by proofs from public arenas in which user is not enrolled (newest first).
    """
    # If cursor is passed as an integer offset string, parse it
    if cursor and cursor.isdigit():
        offset = int(cursor)

    # 1. Fetch user's approved arena memberships
    joined_memberships = db.query(ArenaMembership.arena_id).filter(
        ArenaMembership.user_id == current_user.id,
        ArenaMembership.status == "approved"
    ).all()
    joined_arena_ids = [m[0] for m in joined_memberships]

    # 2. Fetch public arenas for discovery
    public_arenas = db.query(Arena.id).filter(
        or_(Arena.is_private == False, Arena.is_private == None)
    ).all()
    public_arena_ids = [a[0] for a in public_arenas]

    # 3. Combine queryable arenas
    allowed_arena_ids = list(set(joined_arena_ids).union(set(public_arena_ids)))
    if not allowed_arena_ids:
        return success_response({
            "posts": [],
            "items": [],
            "has_more": False,
            "total": 0,
            "next_offset": 0
        })

    # 4. Construct two-tier priority ordering in SQL:
    # Tier 1: User's enrolled arenas (priority = 1)
    # Tier 2: Public discovery arenas (priority = 0)
    if joined_arena_ids:
        enrolled_priority = case((Submission.arena_id.in_(joined_arena_ids), 1), else_=0)
    else:
        enrolled_priority = literal(0)

    # 5. Base query for all real verified habit submissions from database
    base_query = db.query(Submission)\
        .join(Arena, Submission.arena_id == Arena.id)\
        .join(User, Submission.user_id == User.id)\
        .filter(
            Submission.arena_id.in_(allowed_arena_ids),
            Submission.is_absent == False
        )

    total_count = base_query.count()

    submissions = base_query\
        .options(
            joinedload(Submission.user).joinedload(User.profile),
            joinedload(Submission.arena)
        )\
        .order_by(
            enrolled_priority.desc(),
            Submission.submitted_at.desc(),
            Submission.id.desc()
        )\
        .offset(offset)\
        .limit(limit)\
        .all()

    # User's existing votes on these submissions
    sub_ids = [s.id for s in submissions]
    user_votes = db.query(SubmissionVote).filter(
        SubmissionVote.user_id == current_user.id,
        SubmissionVote.submission_id.in_(sub_ids)
    ).all() if sub_ids else []
    user_vote_map = {v.submission_id: v.vote_type for v in user_votes}

    now = datetime.utcnow()
    twenty_four_hours_ago = now - timedelta(hours=24)

    posts = []
    joined_set = set(joined_arena_ids)

    for sub in submissions:
        is_joined = sub.arena_id in joined_set
        
        sub_time = sub.submitted_at
        if sub_time:
            sub_time_naive = sub_time.replace(tzinfo=None) if getattr(sub_time, 'tzinfo', None) else sub_time
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

        proof_url = sub.proof_url or ""
        text_caption = getattr(sub, 'ai_audit_notes', None) or f"Daily habit check-in for {arena_name}!"

        posts.append({
            "id": sub.id,
            "arena_id": sub.arena_id,
            "arena_name": arena_name,
            "arena_tag": clean_tag,
            "is_private": bool(arena.is_private) if arena else False,
            "is_joined": is_joined,
            "is_today": is_today,
            "proof_type": arena.proof_type if (arena and arena.proof_type) else "image",
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
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else "",
            "upvotes": sub.upvotes or 0,
            "downvotes": sub.downvotes or 0,
            "user_vote": user_vote_map.get(sub.id),
            "reactions": {
                "fire": sub.upvotes or 0,
                "electric": 0,
                "respect": 0,
                "target": sub.downvotes or 0
            },
            "current_user_reaction": user_vote_map.get(sub.id),
        })

    has_more = (offset + limit) < total_count
    next_offset = offset + len(posts)
    next_cursor = str(next_offset) if has_more else None

    return success_response({
        "posts": posts,
        "items": posts,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total": total_count,
        "next_offset": next_offset
    })