from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Dict, Any, Tuple
from datetime import datetime, time, timedelta
import asyncio
from urllib.parse import urlparse
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, Submission, Message, User, UserProfile, ArenaMembership, SubmissionVote, DailyArenaSheet
from app.api.websocket import manager as websocket_manager

router = APIRouter(prefix="/activity", tags=["Activity & History Logs"])


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


def calculate_active_submission_window(deadline_str: str) -> Tuple[datetime, datetime, str]:
    """
    Computes the boundaries of the target execution period dynamically.
    Returns:
        Tuple containing:
        - window_start (datetime)
        - window_end (datetime)
        - target_date_str (str): The logical tracking day (YYYY-MM-DD) for metrics logs.
    """
    now = datetime.utcnow()
    deadline_time_obj = parse_arena_deadline(deadline_str)
    
    # Establish today's cutoff baseline
    today_cutoff = datetime.combine(now.date(), deadline_time_obj)
    
    if now <= today_cutoff:
        # Prior to today's deadline: Window covers from yesterday's deadline up to today's deadline.
        window_start = today_cutoff - timedelta(days=1)
        window_end = today_cutoff
        target_date_str = now.date().isoformat()
    else:
        # Today's deadline has passed: Window is already active for the upcoming cycle tomorrow.
        window_start = today_cutoff
        window_end = today_cutoff + timedelta(days=1)
        target_date_str = (now.date() + timedelta(days=1)).isoformat()
        
    return window_start, window_end, target_date_str


def validate_proof_content(proof_type: str, proof_content: str) -> str:
    cleaned = proof_content.strip()
    if not cleaned:
        raise ValueError("Proof content cannot be empty.")

    normalized_type = proof_type.strip().lower()
    if normalized_type == "text":
        return cleaned

    if normalized_type == "link":
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Link proofs must be a valid http or https URL.")
        return cleaned

    if normalized_type == "image":
        if cleaned.startswith("data:image/"):
            return cleaned
        parsed = urlparse(cleaned)
        image_extensions = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg")
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Image proofs must be a valid image URL or data:image payload.")
        if not parsed.path.lower().endswith(image_extensions):
            raise ValueError("Image proofs must point to an image file URL or data:image payload.")
        return cleaned

    raise ValueError("Unsupported proof type configured for arena.")


def broadcast_ledger_event(arena_id: int, payload: Dict[str, Any]) -> None:
    try:
        asyncio.run(websocket_manager.broadcast_to_arena(arena_id, payload))
    except RuntimeError:
        loop = asyncio.get_event_loop()
        loop.create_task(websocket_manager.broadcast_to_arena(arena_id, payload))


class SubmissionCreate(BaseModel):
    arena_id: int
    proof_url: str


class VoteRequest(BaseModel):
    submission_id: int
    vote_type: str  # Must parse "up" or "down"


@router.post("/submit", status_code=status.HTTP_201_CREATED)
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

        # 1. Calculate dynamic window thresholds based on 12h/24h string values
        window_start, window_end, target_date_str = calculate_active_submission_window(arena.deadline_time)

        # 2. Check if a submission has already been registered inside this active logical block
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

        # 3. Validate and apply proof criteria safely
        proof_content = validate_proof_content(arena.proof_type, payload.proof_url)

        new_submission = Submission(
            arena_id=payload.arena_id,
            proof_url=proof_content,
            user_id=current_user.id,
            submitted_at=datetime.utcnow(),
            upvotes=0,
            downvotes=0,
            is_absent=False
        )
        db.add(new_submission)
        db.commit()
        db.refresh(new_submission)

        # 4. Map directly to historical metric ledger using computed destination day string
        try:
            historical_log = DailyArenaSheet(
                arena_id=payload.arena_id,
                user_id=current_user.id,
                date_day=target_date_str,
                status="present",
                proof_type="url"
            )
            db.add(historical_log)
            db.commit()
        except Exception:
            db.rollback()

        broadcast_ledger_event(
            payload.arena_id,
            {
                "event_type": "ledger_update",
                "arena_id": payload.arena_id,
                "action": "submission_created",
                "submission_id": new_submission.id,
                "user_id": current_user.id,
            },
        )

        return success_response({
            "message": "Proof registered successfully",
            "id": new_submission.id,
            "proof_type": arena.proof_type,
            "target_window_end": str(window_end),
            "allocated_date_day": target_date_str
        })
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database ingestion failed: {str(e)}")


@router.post("/vote")
def vote_proof(
    payload: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if payload.vote_type not in ["up", "down"]:
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Invalid vote type selection framework.", "error_code": "VOTE_TYPE_INVALID"})

        submission = db.query(Submission).filter(Submission.id == payload.submission_id).first()
        if not submission:
            raise HTTPException(status_code=404, detail={"status": "error", "message": "Target submission data row missing.", "error_code": "SUBMISSION_NOT_FOUND"})

        voter_id = current_user.id

        if submission.upvotes is None: submission.upvotes = 0
        if submission.downvotes is None: submission.downvotes = 0

        existing_vote = db.query(SubmissionVote).filter(
            SubmissionVote.submission_id == payload.submission_id,
            SubmissionVote.user_id == voter_id
        ).first()

        if existing_vote:
            if existing_vote.vote_type == payload.vote_type:
                if payload.vote_type == "up":
                    submission.upvotes = max(0, submission.upvotes - 1)
                else:
                    submission.downvotes = max(0, submission.downvotes - 1)
                db.delete(existing_vote)
                db.commit()
                broadcast_ledger_event(
                    submission.arena_id,
                    {
                        "event_type": "ledger_update",
                        "arena_id": submission.arena_id,
                        "action": "vote_updated",
                        "submission_id": submission.id,
                        "user_id": current_user.id,
                    },
                )
                return success_response({"message": "Vote removed", "upvotes": submission.upvotes, "downvotes": submission.downvotes})
            
            else:
                if payload.vote_type == "up":
                    submission.upvotes += 1
                    submission.downvotes = max(0, submission.downvotes - 1)
                else:
                    submission.downvotes += 1
                    submission.upvotes = max(0, submission.upvotes - 1)
                existing_vote.vote_type = payload.vote_type
                db.commit()
                broadcast_ledger_event(
                    submission.arena_id,
                    {
                        "event_type": "ledger_update",
                        "arena_id": submission.arena_id,
                        "action": "vote_updated",
                        "submission_id": submission.id,
                        "user_id": current_user.id,
                    },
                )
                return success_response({"message": "Vote switched", "upvotes": submission.upvotes, "downvotes": submission.downvotes})

        else:
            new_vote = SubmissionVote(submission_id=payload.submission_id, user_id=voter_id, vote_type=payload.vote_type)
            db.add(new_vote)
            if payload.vote_type == "up":
                submission.upvotes += 1
            else:
                submission.downvotes += 1

        db.commit()

        total_members = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == submission.arena_id,
            ArenaMembership.status == "approved"
        ).count()

        if total_members > 0 and submission.downvotes > (total_members / 2):
            submission.is_absent = True
            db.commit()

            try:
                date_str = submission.submitted_at.date().isoformat()
                sheet_record = db.query(DailyArenaSheet).filter(
                    DailyArenaSheet.arena_id == submission.arena_id,
                    DailyArenaSheet.user_id == submission.user_id,
                    DailyArenaSheet.date_day == date_str
                ).first()
                if sheet_record:
                    sheet_record.status = "absent"
                    db.commit()
            except Exception:
                db.rollback()

        broadcast_ledger_event(
            submission.arena_id,
            {
                "event_type": "ledger_update",
                "arena_id": submission.arena_id,
                "action": "vote_updated",
                "submission_id": submission.id,
                "user_id": current_user.id,
            },
        )

        return success_response({
            "upvotes": submission.upvotes,
            "downvotes": submission.downvotes,
            "is_absent": submission.is_absent,
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Vote orchestration failed: {str(e)}", "error_code": "VOTE_ORCHESTRATION_FAILED"})


@router.get("/arena/{arena_id}/history")
def get_arena_history(arena_id: int, db: Session = Depends(get_db)):
    try:
        submissions = db.query(Submission)\
            .filter(Submission.arena_id == arena_id)\
            .options(joinedload(Submission.user))\
            .order_by(Submission.submitted_at.desc())\
            .all()
            
        messages = db.query(Message)\
            .filter(Message.arena_id == arena_id)\
            .options(joinedload(Message.user))\
            .order_by(Message.created_at.desc())\
            .all()

        return success_response({
            "submissions": [
                {
                    "id": sub.id,
                    "user_id": sub.user_id,
                    "proof_url": sub.proof_url,
                    "submitted_at": str(sub.submitted_at),
                    "user_name": sub.user.full_name if (sub.user and getattr(sub.user, 'full_name', None)) else f"Member #{sub.user_id}",
                    "user_avatar_url": get_user_avatar_url(db, sub.user_id),
                    "upvotes": getattr(sub, 'upvotes', 0) or 0,
                    "downvotes": getattr(sub, 'downvotes', 0) or 0,
                    "is_absent": getattr(sub, 'is_absent', False) or False
                } for sub in submissions
            ],
            "messages": [
                {
                    "id": msg.id,
                    "user_id": msg.user_id,
                    "content": str(msg.content),
                    "message_type": str(msg.message_type or "text"),
                    "created_at": str(msg.created_at),
                    "sender_name": msg.user.full_name if (msg.user and getattr(msg.user, 'full_name', None)) else f"Member #{msg.user_id}",
                    "sender_avatar_url": get_user_avatar_url(db, msg.user_id)
                } for msg in messages
            ]
        })
    except Exception as e:
        return success_response({"submissions": [], "messages": [], "error": str(e)})