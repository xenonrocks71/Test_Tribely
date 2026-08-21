from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Dict, Any, Tuple
from datetime import datetime, time, timedelta
import asyncio
from urllib.parse import urlparse
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, Submission, Message, User, UserProfile, ArenaMembership, SubmissionVote, DailyArenaSheet, UserWallet

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

        submission_time = datetime.utcnow()
        if payload.client_submitted_at:
            try:
                client_dt = datetime.fromisoformat(payload.client_submitted_at.replace("Z", "+00:00")).replace(tzinfo=None)
                if client_dt <= submission_time + timedelta(minutes=5) and client_dt >= submission_time - timedelta(hours=24):
                    submission_time = client_dt
            except Exception:
                pass

        window_start, window_end, target_date_str = calculate_active_submission_window(arena.deadline_time)

        existing = db.query(Submission).filter(
            Submission.arena_id == payload.arena_id,
            Submission.user_id == current_user.id,
            Submission.submitted_at >= window_start,
            Submission.submitted_at < window_end
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "error",
                    "message": f"You have already submitted verification proof for the upcoming deadline ending at {arena.deadline_time}.",
                    "error_code": "DAILY_SUBMISSION_DUPLICATE",
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
        from app.services.ai_verifier import ai_proof_auditor
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
        db.commit()
        db.refresh(new_submission)

        try:
            historical_log = DailyArenaSheet(
                arena_id=payload.arena_id,
                user_id=current_user.id,
                date_day=target_date_str,
                status="present",
                proof_type=arena.proof_type
            )
            db.add(historical_log)
            db.commit()
        except Exception:
            db.rollback()

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



        return success_response({
            "message": "Proof registered successfully",
            "id": new_submission.id,
            "proof_type": arena.proof_type,
            "target_window_end": str(window_end),
        })
    except HTTPException:
        raise
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


def execute_vote_logic(
    submission_id: int,
    vote_type_raw: str,
    db: Session,
    current_user: User,
):
    try:
        norm_vote = "up" if vote_type_raw in ["up", "upvote"] else "down" if vote_type_raw in ["down", "downvote"] else None
        if not norm_vote:
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "message": "Invalid vote selection framework.", "error_code": "VOTE_TYPE_INVALID"}
            )

        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise HTTPException(
                status_code=404,
                detail={"status": "error", "message": "Target submission not found.", "error_code": "SUBMISSION_NOT_FOUND"}
            )

        arena = db.query(Arena).filter(Arena.id == submission.arena_id).first()
        if not arena:
            raise HTTPException(
                status_code=404,
                detail={"status": "error", "message": "Associated arena room not found.", "error_code": "ARENA_NOT_FOUND"}
            )

        # 1. Enforce voting deadline constraint (voting locked after daily reset)
        voting_cutoff = get_submission_voting_deadline(submission.submitted_at, arena.deadline_time)
        now_naive = make_naive(datetime.utcnow())
        if now_naive > voting_cutoff:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "message": f"Voting window closed. Proof voting for this cycle ended at {arena.deadline_time}.",
                    "error_code": "VOTING_WINDOW_CLOSED"
                }
            )

        voter_id = current_user.id
        if submission.upvotes is None: submission.upvotes = 0
        if submission.downvotes is None: submission.downvotes = 0

        # 2. Check existing vote record for vote toggle / vote switching / single vote enforcement
        existing_vote = db.query(SubmissionVote).filter(
            SubmissionVote.submission_id == submission_id,
            SubmissionVote.user_id == voter_id
        ).first()

        user_vote_res = None

        if existing_vote:
            if existing_vote.vote_type == norm_vote:
                # User clicked their current vote choice again -> Toggle off / un-vote!
                if norm_vote == "up":
                    submission.upvotes = max(0, submission.upvotes - 1)
                else:
                    submission.downvotes = max(0, submission.downvotes - 1)
                db.delete(existing_vote)
                msg = "Vote removed."
                user_vote_res = None
            else:
                # Switch vote from previous choice to new choice
                if existing_vote.vote_type == "up" and norm_vote == "down":
                    submission.upvotes = max(0, submission.upvotes - 1)
                    submission.downvotes += 1
                elif existing_vote.vote_type == "down" and norm_vote == "up":
                    submission.downvotes = max(0, submission.downvotes - 1)
                    submission.upvotes += 1
                
                existing_vote.vote_type = norm_vote
                msg = "Vote choice updated."
                user_vote_res = norm_vote
        else:
            # Create new vote
            new_vote = SubmissionVote(submission_id=submission_id, user_id=voter_id, vote_type=norm_vote)
            db.add(new_vote)
            if norm_vote == "up":
                submission.upvotes += 1
            else:
                submission.downvotes += 1
            msg = "Vote recorded."
            user_vote_res = norm_vote

        db.commit()

        # Recalculate Consensus for Automated Absence Flagging
        total_members = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == submission.arena_id,
            ArenaMembership.status == "approved"
        ).count()

        if total_members > 0 and submission.downvotes > (total_members / 2):
            submission.is_absent = True
            db.commit()
        else:
            submission.is_absent = False
            db.commit()

        # Real-time WS ledger broadcast for live vote tally sync across all connected users
        broadcast_ledger_event(
            submission.arena_id,
            {
                "event_type": "ledger_update",
                "arena_id": submission.arena_id,
                "action": "vote_updated",
                "submission_id": submission.id,
                "upvotes": submission.upvotes,
                "downvotes": submission.downvotes,
                "is_absent": submission.is_absent,
            },
        )

        return success_response({
            "message": msg,
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes,
            "is_absent": submission.is_absent,
            "user_vote": user_vote_res
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Vote operation failed: {str(e)}", "error_code": "VOTE_FAILED"})


@router.post("/submission/{submission_id}/vote", dependencies=[Depends(RateLimiter(times=30, seconds=60))])
def vote_submission_by_path(
    submission_id: int,
    payload: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return execute_vote_logic(submission_id=submission_id, vote_type_raw=payload.vote_type, db=db, current_user=current_user)


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

    return success_response({
        "submissions": formatted_submissions,
        "messages": formatted_messages,
        "active_call": active_call
    })



class MessageCreatePayload(BaseModel):
    content: str
    message_type: str = "text"


@router.post("/arena/{arena_id}/message", status_code=status.HTTP_201_CREATED, dependencies=[Depends(RateLimiter(times=20, seconds=60))])
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
            data_json={"arena_id": arena_id, "url": f"/arena/{arena_id}"}
        )
    except Exception as ne:
        print(f"Notification dispatch warning: {ne}")

    return success_response(broadcast_payload)


@router.get("/arena/{arena_id}/call/token")
def get_sfu_call_token(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate authenticated SFU access token for joining an Arena multi-party call.
    """
    membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == arena_id,
        ArenaMembership.user_id == current_user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this arena."
        )

    user_name = current_user.user_name or current_user.full_name or f"User #{current_user.id}"
    from app.services.sfu_token_service import sfu_token_service
    token_data = sfu_token_service.generate_sfu_room_token(
        arena_id=arena_id,
        user_id=current_user.id,
        user_name=user_name
    )

    return success_response(token_data)