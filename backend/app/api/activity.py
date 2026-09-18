"""
Activity & Cohort Timeline API Router Implementation.
Decoupled Controller layer adhering to Google & Meta architectural standards.
Performs HTTP validation and response serialization, delegating domain business logic
strictly to ActivityService and data access to ActivityRepository.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import RateLimiter
from app.api.deps import get_current_user, get_current_user_optional
from app.models.models import User
from app.schemas.schemas import (
    CommentCreateRequest,
    MessageCreatePayload,
    NudgePayload,
    PresignedUrlRequest,
    ReactionRequest,
    SubmissionCreate,
    VoteRequest,
)
from app.services.activity_service import activity_service


router = APIRouter(prefix="/api/activity", tags=["Activity & History Logs"])


def success_response(data: Any) -> Dict[str, Any]:
    """Uniform API success envelope helper."""
    return {"status": "success", "data": data}


@router.post("/upload-url")
def get_presigned_media_upload_url(
    payload: PresignedUrlRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generates a presigned media upload URL allowing client applications to upload
    binary image proofs directly to S3 / Cloudflare R2 / Local Storage.
    """
    upload_data = activity_service.generate_presigned_media_upload_url(payload, current_user)
    return success_response(upload_data)


@router.post(
    "/submit",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))]
)
def submit_proof(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Submit daily habit proof with cycle window enforcement, AI anti-cheat audit,
    and live WebSocket broadcast to cohort peers.
    """
    submission_res = activity_service.submit_daily_proof(db, payload, current_user)
    return success_response(submission_res)


@router.get("/submission/{submission_id}/voters")
def get_submission_voters(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Fetches the complete list of members who voted on a submission (upvote OR downvote).
    PRIVACY GUARANTEE: Does NOT reveal whether a specific user voted up or down!
    """
    voters_data = activity_service.get_submission_voters(db, submission_id)
    return success_response(voters_data)


@router.get("/arena/{arena_id}/history")
@router.get("/arenas/{arena_id}/history")
def get_arena_history(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieve historical submissions, chat messages, and member status metrics for an arena.
    """
    history_data = activity_service.get_arena_history(db, arena_id, current_user)
    return success_response(history_data)


@router.post(
    "/arena/{arena_id}/message",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=20, seconds=60))]
)
@router.post(
    "/arenas/{arena_id}/message",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=20, seconds=60))]
)
@router.post(
    "/arenas/{arena_id}/messages",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=20, seconds=60))]
)
async def send_arena_message(
    arena_id: int,
    payload: MessageCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    HTTP POST endpoint to send a chat message into an arena.
    Persists message to database and broadcasts real-time update to all WebSocket connections.
    """
    msg_data = await activity_service.send_chat_message(db, arena_id, payload, current_user)
    return success_response(msg_data)


@router.get("/arenas/{arena_id}/heatmap/{user_id}")
def get_user_arena_heatmap(
    arena_id: int,
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Computes a Strava/GitHub-style daily consistency matrix (30 or 90 days)
    for a user in an arena, showing present, shielded, absent, and pending status.
    """
    matrix_data = activity_service.get_user_arena_heatmap(db, arena_id, user_id, days)
    return success_response(matrix_data)


@router.get("/arenas/{arena_id}/feed")
def get_arena_social_proof_feed(
    arena_id: int,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    High-speed social proof feed (Instagram/BeReal style) displaying habit proof cards,
    AI verification confidence, media previews, peer vote tallies, and micro-reaction chips.
    """
    feed_data = activity_service.get_arena_feed(db, arena_id, current_user.id, limit, offset)
    return success_response(feed_data)


@router.post(
    "/submissions/{submission_id}/react",
    dependencies=[Depends(RateLimiter(times=30, seconds=60))]
)
@router.post(
    "/proofs/{submission_id}/react",
    dependencies=[Depends(RateLimiter(times=30, seconds=60))]
)
async def react_to_submission(
    submission_id: int,
    payload: ReactionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Submits a micro-reaction to a habit proof (🔥, ⚡, 👏, 🎯) with real-time
    WebSocket broadcast to the arena room.
    """
    reaction_data = await activity_service.toggle_reaction(db, submission_id, payload, current_user)
    return success_response(reaction_data)


@router.get("/submissions/{submission_id}/comments")
@router.get("/proofs/{submission_id}/comments")
def get_submission_comments(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Fetch all peer discussion comments for a habit proof submission in chronological order.
    """
    comments_data = activity_service.get_submission_comments(db, submission_id)
    return success_response(comments_data)


@router.post("/submissions/{submission_id}/comments")
@router.post("/proofs/{submission_id}/comments")
async def create_submission_comment(
    submission_id: int,
    payload: CommentCreateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Post a discussion reply / comment on a habit proof drop.
    Persists to database and broadcasts real-time WebSocket update to peers.
    """
    comment_data = await activity_service.create_submission_comment(db, submission_id, payload, current_user)
    return success_response(comment_data)


@router.post(
    "/submission/{submission_id}/vote",
    dependencies=[Depends(RateLimiter(times=30, seconds=60))]
)
@router.post(
    "/submissions/{submission_id}/vote",
    dependencies=[Depends(RateLimiter(times=30, seconds=60))]
)
async def vote_on_submission(
    submission_id: int,
    payload: VoteRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Official vote endpoint matching the frontend client (/api/activity/submission/{id}/vote).
    Supports 'upvote'/'up' and 'downvote'/'down', self-voting prevention,
    toggle-off unvoting, and real-time WebSocket broadcast to all connected arena members.
    """
    vote_data = await activity_service.vote_on_submission(db, submission_id, payload, current_user)
    return success_response(vote_data)


@router.get("/arenas/{arena_id}/story-rings")
def get_arena_story_rings(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Tribe Story Rings Endpoint.
    Returns the horizontal avatar carousel items for an arena with active countdown timers,
    glowing border status (submitted), empty ring (pending), and 'At Risk' status.
    Also returns 1.5x Tribe Multiplier status.
    """
    story_rings_data = activity_service.get_arena_story_rings(db, arena_id, current_user)
    return success_response(story_rings_data)


@router.post("/arenas/{arena_id}/nudge/{target_user_id}")
async def nudge_cohort_member(
    arena_id: int,
    target_user_id: int,
    payload: Optional[NudgePayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    1-Tap Nudge for 'At Risk' cohort members.
    Broadcasts real-time alert via WebSocket to protect the cohort's 1.5x Streak Multiplier.
    """
    nudge_data = await activity_service.send_peer_nudge(db, arena_id, target_user_id, payload, current_user)
    return success_response(nudge_data)


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
    3. Deducts agreed fine from user wallet and deposits into arena escrow vault.
    4. Broadcasts real-time WebSocket notices.
    """
    cycle_res = activity_service.execute_automated_ledger_cycle(db, current_user)
    return success_response(cycle_res)


@router.get("/feed")
def get_user_social_feed(
    limit: int = 20,
    offset: int = 0,
    cursor: Optional[str] = None,
    use_cursor: bool = False,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Instagram-Style Social Feed supporting endless pagination and prioritized sorting:
    Shows latest habit verification proofs on top (newest first).
    """
    feed_data = activity_service.get_social_feed(db, current_user, limit, offset, cursor)
    return success_response(feed_data)