from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import datetime
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import Arena, ArenaMembership, User, Message, Submission, Proof, UserWallet, ArenaPool, EscrowLedger, KudosLedger

from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.schemas.schemas import ApiSuccessResponse, ArenaCreate, ArenaResponse, MembershipCreate, MembershipResponse
from app.services.arena_service import arena_service
from app.repositories.arena_repository import arena_repository

router = APIRouter(prefix="/api/arenas", tags=["Arenas"])


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}

class DiscoveryJoinRequest(BaseModel):
    arena_id: int

# ==========================================
#         NEW PUBLIC DISCOVERY ROUTES
# ==========================================

@router.get("/discovery/list", response_model=ApiSuccessResponse)
def discover_all_arenas(db: Session = Depends(get_db)):
    """
    Public Endpoint: Returns public and private arena information coupled 
    with real-time total member counts for landing page exploration.
    Filters out automated test arenas.
    """
    try:
        counts_query = db.query(
            ArenaMembership.arena_id, 
            func.count(ArenaMembership.id).label("total_members")
        ).filter(ArenaMembership.status == "approved").group_by(ArenaMembership.arena_id).all()
        
        counts_map = {row.arena_id: row.total_members for row in counts_query}
        test_patterns = [
            "%test%", "%keyset%", "%penalty arena%", "%escrow arena%",
            "%high roller%", "%phase%", "%sprint arena%", "%multiplier arena%", "%smoke%"
        ]
        arenas = db.query(Arena).filter(
            *[~Arena.name.ilike(p) for p in test_patterns]
        ).offset(0).limit(200).all()

        results = []
        for arena in arenas:
            results.append({
                "id": arena.id,
                "name": arena.name,
                "description": arena.description,
                "invite_code": arena.invite_code,
                "is_private": arena.is_private,
                "proof_type": arena.proof_type,
                "penalty_amount": float(arena.penalty_amount or 0.00),
                "deadline_time": arena.deadline_time,
                "member_count": counts_map.get(arena.id, 0)
            })
            
        return success_response(results)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Failed compiling room landing matrix: {str(e)}",
                "error_code": "ARENA_DISCOVERY_LIST_FAILED",
            },
        )


@router.get("/{arena_id}", response_model=ApiSuccessResponse)
def get_arena_details(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dedicated Squad Detail Endpoint for /arenas/[id] Drill-Down View.
    Returns squad status ribbon metrics (deadline, current user status, vault pot, multiplier)
    and member stories tray list with today's proof status.
    """
    try:
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(status_code=404, detail="Arena not found")

        membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == current_user.id
        ).first()

        # Authorization: Private Arenas require approved membership or ownership
        if arena.is_private:
            is_approved = membership is not None and membership.status == "approved"
            is_creator = current_user.id == arena.creator_id
            if not (is_approved or is_creator):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "status": "error",
                        "message": "Access denied: This is a private Arena. You must be an approved member to view details.",
                        "error_code": "PRIVATE_ARENA_ACCESS_DENIED"
                    }
                )

        memberships = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.status == "approved"
        ).options(joinedload(ArenaMembership.user).joinedload(User.profile)).all()

        from app.services.cycle_service import cycle_service
        cycle_info = cycle_service.calculate_arena_cycle(arena)

        cycle_subs = db.query(Submission.user_id).filter(
            Submission.arena_id == arena_id,
            Submission.submitted_at >= cycle_info.cycle_start_utc.replace(tzinfo=None),
            Submission.submitted_at < cycle_info.cycle_deadline_utc.replace(tzinfo=None),
            Submission.is_absent == False
        ).all()
        cycle_sub_user_ids = set(s[0] for s in cycle_subs)

        # Also check Proof model records
        cycle_proofs = db.query(Proof.user_id).filter(
            Proof.arena_id == arena_id,
            Proof.submission_date == cycle_info.cycle_date
        ).all()
        for p in cycle_proofs:
            cycle_sub_user_ids.add(p[0])

        user_submitted_today = current_user.id in cycle_sub_user_ids
        user_is_locked, user_unlock_time, _, _ = cycle_service.is_user_locked_in_cycle(
            db, arena_id, current_user.id, arena
        )

        member_list = []
        for m in memberships:
            u = m.user
            profile = u.profile if u else None
            avatar_url = profile.profile_image_url if profile else None
            member_list.append({
                "user_id": m.user_id,
                "user_name": u.full_name if u else f"Member #{m.user_id}",
                "user_handle": u.email.split("@")[0] if (u and u.email) else f"user{m.user_id}",
                "user_avatar": avatar_url,
                "role": m.role,
                "has_submitted_today": m.user_id in cycle_sub_user_ids,
                "is_current_user": m.user_id == current_user.id
            })

        stake = float(arena.penalty_amount or 50.0)
        member_count = len(memberships)
        member_stakes_pool = member_count * stake

        # Fetch 100% genuine ledger transactions from EscrowLedger & KudosLedger (zero fake seeds)
        escrow_records = (
            db.query(EscrowLedger)
            .filter(EscrowLedger.arena_id == arena_id)
            .order_by(EscrowLedger.created_at.desc())
            .limit(50)
            .all()
        )
        kudos_records = (
            db.query(KudosLedger)
            .filter(KudosLedger.arena_id == arena_id)
            .order_by(KudosLedger.created_at.desc())
            .limit(50)
            .all()
        )

        formatted_txs = []
        user_map = {m.user_id: m for m in memberships}

        for rec in escrow_records:
            mem = user_map.get(rec.user_id)
            u_name = mem.user.full_name if (mem and mem.user) else f"Spotter #{rec.user_id}"
            u_avatar = (mem.user.profile.profile_image_url if (mem and mem.user and mem.user.profile) else None) if mem else None
            entry_type = (rec.entry_type or "penalty_accrual").lower()
            amt = float(rec.amount_tribes or 0.0)
            tx_type = "penalty" if "penalty" in entry_type else ("reward" if "reward" in entry_type else "deposit")
            desc = rec.description or f"{u_name} incurred ₹{amt:.0f} {entry_type.replace('_', ' ')}"
            formatted_txs.append({
                "id": f"escrow_{rec.id}",
                "type": tx_type,
                "user_id": rec.user_id,
                "user_name": u_name,
                "user_avatar": u_avatar,
                "amount": amt,
                "description": desc,
                "created_at": rec.created_at.isoformat() if rec.created_at else datetime.datetime.utcnow().isoformat(),
                "formatted_time": rec.created_at.strftime("%b %d, %I:%M %p") if rec.created_at else "Recently",
                "tx_hash": f"tx_0x{abs(hash(rec.idempotency_key or str(rec.id))) % 0xFFFFFFFFFF:010x}"
            })

        for krec in kudos_records:
            mem = user_map.get(krec.user_id)
            u_name = mem.user.full_name if (mem and mem.user) else f"Spotter #{krec.user_id}"
            u_avatar = (mem.user.profile.profile_image_url if (mem and mem.user and mem.user.profile) else None) if mem else None
            ttype = (krec.transaction_type or "").lower()
            amt = float(krec.amount_kudos or 0.0)
            if "penalty" in ttype:
                tx_type = "penalty"
            elif "reward" in ttype or "payout" in ttype:
                tx_type = "reward"
            else:
                tx_type = "deposit"
            desc = krec.description or f"{u_name} {ttype.replace('_', ' ')} of ₹{amt:.0f}"
            formatted_txs.append({
                "id": f"kudos_{krec.id}",
                "type": tx_type,
                "user_id": krec.user_id,
                "user_name": u_name,
                "user_avatar": u_avatar,
                "amount": amt,
                "description": desc,
                "created_at": krec.created_at.isoformat() if krec.created_at else datetime.datetime.utcnow().isoformat(),
                "formatted_time": krec.created_at.strftime("%b %d, %I:%M %p") if krec.created_at else "Recently",
                "tx_hash": f"tx_0x{abs(hash(krec.idempotency_key or str(krec.id))) % 0xFFFFFFFFFF:010x}"
            })

        # Sort real transactions newest first
        formatted_txs.sort(key=lambda x: x["created_at"], reverse=True)

        penalties_total = sum(t["amount"] for t in formatted_txs if t["type"] == "penalty")
        base_vault = member_stakes_pool
        total_vault_amount = base_vault + penalties_total

        escrow_summary = {
            "total_vault_amount": round(total_vault_amount, 2),
            "member_stakes_pool": round(member_stakes_pool, 2),
            "penalty_pool": round(penalties_total, 2),
            "reward_pool": round(total_vault_amount, 2),
            "cycle_days_remaining": max(1, 7 - (datetime.datetime.utcnow().weekday())),
            "cycle_days_total": 7,
            "currency_symbol": "₹"
        }

        sprint_vault = total_vault_amount

        return success_response({
            "id": arena.id,
            "name": arena.name,
            "tag": "#" + arena.name.replace(" ", "")[:18],
            "description": arena.description or f"Daily {arena.proof_type or 'habit'} accountability squad.",
            "invite_code": arena.invite_code,
            "proof_type": arena.proof_type,
            "penalty_amount": stake,
            "deadline_time": arena.deadline_time or "23:59",
            "is_private": bool(arena.is_private),
            "creator_id": arena.creator_id,
            "is_joined": membership is not None and membership.status == "approved",
            "membership_status": membership.status if membership else None,
            "user_role": membership.role if membership else None,
            "member_count": member_count,
            "sprint_vault": sprint_vault,
            "escrow_summary": escrow_summary,
            "ledger_transactions": formatted_txs,
            "multiplier": 1.5,
            "user_submitted_today": user_submitted_today,
            "is_locked": user_is_locked,
            "unlock_time": user_unlock_time.isoformat() if user_unlock_time else None,
            "cycle_cutoff_time": cycle_info.cycle_cutoff_local.strftime("%I:%M:%S %p"),
            "cycle_deadline_time": cycle_info.formatted_deadline,
            "seconds_remaining": cycle_info.seconds_remaining,
            "members": member_list
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"Failed fetching squad details: {str(e)}"}
        )


@router.get("/{arena_id}/ledger-room", response_model=ApiSuccessResponse)
def get_arena_ledger_room(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Real-Time Ledger Room Maintenance Endpoint.
    Returns:
    - 24-hour cycle timeline (cutoff, deadline, countdown, timezone)
    - Enrolled member roster with submission timestamps, on-time flag, lock status
    - Real, double-entry ledger transactions from database (zero mock seeds)
    """
    try:
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise HTTPException(status_code=404, detail="Arena not found")

        # Authorization: Private Arenas require approved membership or ownership
        if arena.is_private:
            membership = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.user_id == current_user.id
            ).first()
            is_approved = membership is not None and membership.status == "approved"
            is_creator = current_user.id == arena.creator_id
            if not (is_approved or is_creator):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "status": "error",
                        "message": "Access denied: This is a private Arena. You must be an approved member to view the ledger room.",
                        "error_code": "PRIVATE_ARENA_ACCESS_DENIED"
                    }
                )

        from app.services.cycle_service import cycle_service
        roster_status = cycle_service.get_arena_roster_cycle_status(db, arena)

        # Fetch genuine double-entry transactions
        escrow_records = (
            db.query(EscrowLedger)
            .filter(EscrowLedger.arena_id == arena_id)
            .order_by(EscrowLedger.created_at.desc())
            .limit(50)
            .all()
        )
        kudos_records = (
            db.query(KudosLedger)
            .filter(KudosLedger.arena_id == arena_id)
            .order_by(KudosLedger.created_at.desc())
            .limit(50)
            .all()
        )

        memberships = (
            db.query(ArenaMembership)
            .filter(ArenaMembership.arena_id == arena_id)
            .all()
        )
        user_map = {m.user_id: m for m in memberships}

        transactions = []
        for rec in escrow_records:
            mem = user_map.get(rec.user_id)
            u_name = mem.user.full_name if (mem and mem.user) else f"Member #{rec.user_id}"
            u_avatar = (mem.user.profile.profile_image_url if (mem and mem.user and mem.user.profile) else None) if mem else None
            entry_type = (rec.entry_type or "penalty_accrual").lower()
            amt = float(rec.amount_tribes or 0.0)
            tx_type = "penalty" if "penalty" in entry_type else ("reward" if "reward" in entry_type else "deposit")
            transactions.append({
                "id": f"escrow_{rec.id}",
                "type": tx_type,
                "user_id": rec.user_id,
                "user_name": u_name,
                "user_avatar": u_avatar,
                "amount": amt,
                "description": rec.description or f"{u_name}: {entry_type.replace('_', ' ')}",
                "created_at": rec.created_at.isoformat() if rec.created_at else datetime.datetime.utcnow().isoformat(),
                "formatted_time": rec.created_at.strftime("%b %d, %I:%M %p") if rec.created_at else "Recently",
                "tx_hash": f"tx_0x{abs(hash(rec.idempotency_key or str(rec.id))) % 0xFFFFFFFFFF:010x}"
            })

        for krec in kudos_records:
            mem = user_map.get(krec.user_id)
            u_name = mem.user.full_name if (mem and mem.user) else f"Member #{krec.user_id}"
            u_avatar = (mem.user.profile.profile_image_url if (mem and mem.user and mem.user.profile) else None) if mem else None
            ttype = (krec.transaction_type or "").lower()
            amt = float(krec.amount_kudos or 0.0)
            tx_type = "penalty" if "penalty" in ttype else ("reward" if "reward" in ttype or "payout" in ttype else "deposit")
            transactions.append({
                "id": f"kudos_{krec.id}",
                "type": tx_type,
                "user_id": krec.user_id,
                "user_name": u_name,
                "user_avatar": u_avatar,
                "amount": amt,
                "description": krec.description or f"{u_name}: {ttype.replace('_', ' ')}",
                "created_at": krec.created_at.isoformat() if krec.created_at else datetime.datetime.utcnow().isoformat(),
                "formatted_time": krec.created_at.strftime("%b %d, %I:%M %p") if krec.created_at else "Recently",
                "tx_hash": f"tx_0x{abs(hash(krec.idempotency_key or str(krec.id))) % 0xFFFFFFFFFF:010x}"
            })

        transactions.sort(key=lambda x: x["created_at"], reverse=True)

        is_locked, unlock_time, _, _ = cycle_service.is_user_locked_in_cycle(db, arena_id, current_user.id, arena)

        return success_response({
            **roster_status,
            "current_user_status": {
                "is_locked": is_locked,
                "unlock_time": unlock_time.isoformat() if unlock_time else None,
                "has_submitted": is_locked
            },
            "transactions": transactions
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"Failed compiling ledger room: {str(e)}"}
        )


@router.post("/discovery/join")
def request_membership_gatekeeper(
    payload: DiscoveryJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Binds visitors to arenas. Instantly approves public entry,
    while holding private room entries as 'pending' for admin approval.
    Delegates validation and persistence to ArenaService.
    """
    try:
        arena = arena_service.get_arena_by_id(db, arena_id=payload.arena_id)
        existing = arena_repository.get_membership(db, user_id=current_user.id, arena_id=payload.arena_id)

        if existing:
            if existing.status == "approved":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "message": "You are already an approved member inside this arena.",
                        "error_code": "ARENA_MEMBERSHIP_ALREADY_APPROVED",
                    },
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "message": "Your join authorization is currently pending evaluation.",
                        "error_code": "ARENA_MEMBERSHIP_PENDING",
                    },
                )

        membership = arena_service.join_arena(db, user_id=current_user.id, arena_id=payload.arena_id)

        # Broadcast real-time WebSocket notification so admin sees pending join request instantly
        from app.core.managers.websocket_manager import websocket_manager
        join_payload = {
            "event_type": "join_request_created",
            "arena_id": arena.id,
            "user_id": current_user.id,
            "user_name": current_user.full_name or f"Member #{current_user.id}",
            "status": membership.status,
            "is_private": arena.is_private,
        }
        websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)

        msg = f"Successfully joined {arena.name}!" if membership.status == "approved" else f"Request to join {arena.name} submitted for admin review with 50 Kudos deposited to squad escrow."
        return success_response({
            "room_state": membership.status,
            "is_private": arena.is_private,
            "message": msg,
        })

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Gatekeeper core tracking script execution failed: {str(e)}",
                "error_code": "ARENA_DISCOVERY_JOIN_FAILED",
            },
        )


# ==========================================
#         EXISTING WORKING ROUTES
# ==========================================

@router.post("/", response_model=ApiSuccessResponse, status_code=status.HTTP_201_CREATED)
def create_new_arena(arena_in: ArenaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Creates a new micro-arena room configuration and maps authenticated user as Owner/Admin.
    Delegates domain creation to ArenaService.
    """
    created_arena = arena_service.create_arena(db, arena_in=arena_in, creator_id=current_user.id)
    return success_response(ArenaResponse.model_validate(created_arena, from_attributes=True).model_dump())

@router.post("/join", response_model=ApiSuccessResponse)
def join_arena_by_invite(payload: MembershipCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Joins an existing arena using auto-generated 6-character alphanumeric invite code.
    Delegates to ArenaService.
    """
    membership = arena_service.join_by_invite_code(db, user_id=current_user.id, invite_code=payload.invite_code)
    arena = arena_service.get_arena_by_id(db, arena_id=membership.arena_id)
    return success_response({
        "membership": MembershipResponse.model_validate(membership, from_attributes=True).model_dump(),
        "arena": ArenaResponse.model_validate(arena, from_attributes=True).model_dump(),
        "id": arena.id,
        "detail": f"Successfully joined {arena.name}!"
    })


@router.get("/", response_model=ApiSuccessResponse)
def list_my_arenas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves all accountability arenas the authenticated user has joined or created,
    sorted by recent activity (chat messages, proof submissions, join dates) descending (WhatsApp order).
    Optimized to O(1) query complexity to prevent N+1 query bottlenecks.
    """
    memberships = db.query(ArenaMembership).filter(ArenaMembership.user_id == current_user.id).all()
    membership_map = {m.arena_id: m for m in memberships}
    
    arena_ids = list(membership_map.keys())
    arenas = db.query(Arena).filter(Arena.id.in_(arena_ids)).all() if arena_ids else []
    
    # Efficient O(1) batch query optimization to eliminate N+1 loop queries
    latest_messages: Dict[int, Message] = {}
    latest_submissions: Dict[int, Submission] = {}
    
    if arena_ids:
        all_msgs = (
            db.query(Message)
            .filter(Message.arena_id.in_(arena_ids))
            .options(joinedload(Message.user))
            .order_by(Message.arena_id, Message.created_at.desc())
            .all()
        )
        for msg in all_msgs:
            if msg.arena_id not in latest_messages:
                latest_messages[msg.arena_id] = msg

        all_subs = (
            db.query(Submission)
            .filter(Submission.arena_id.in_(arena_ids))
            .options(joinedload(Submission.user))
            .order_by(Submission.arena_id, Submission.submitted_at.desc())
            .all()
        )
        for sub in all_subs:
            if sub.arena_id not in latest_submissions:
                latest_submissions[sub.arena_id] = sub

    arena_payload = []
    for arena in arenas:
        item = ArenaResponse.model_validate(arena, from_attributes=True).model_dump()
        mem = membership_map.get(arena.id)
        item["membership_status"] = mem.status if mem else "approved"
        item["user_role"] = mem.role if mem else ("admin" if arena.creator_id == current_user.id else "member")

        latest_msg = latest_messages.get(arena.id)
        latest_sub = latest_submissions.get(arena.id)

        msg_time = latest_msg.created_at if latest_msg else None
        sub_time = latest_sub.submitted_at if latest_sub else None
        mem_time = mem.joined_at if (mem and getattr(mem, 'joined_at', None)) else arena.created_at

        # Calculate latest activity timestamp
        valid_times = [t for t in [msg_time, sub_time, mem_time, arena.created_at] if t is not None]
        last_activity_dt = max(valid_times) if valid_times else arena.created_at

        # Formulate last activity preview snippet (WhatsApp style)
        snippet = "No recent activity"
        if latest_msg and (not sub_time or latest_msg.created_at >= sub_time):
            sender_name = latest_msg.user.full_name.split()[0] if (latest_msg.user and getattr(latest_msg.user, 'full_name', None)) else "Member"
            snippet = f"💬 {sender_name}: {latest_msg.content[:36]}{'...' if len(latest_msg.content) > 36 else ''}"
        elif latest_sub:
            sub_name = latest_sub.user.full_name.split()[0] if (latest_sub.user and getattr(latest_sub.user, 'full_name', None)) else "Member"
            snippet = f"📸 {sub_name} submitted daily proof"
        elif mem:
            snippet = "Active in chamber"

        item["last_activity_at"] = last_activity_dt.isoformat() if last_activity_dt else None
        item["last_activity_snippet"] = snippet
        arena_payload.append(item)

    # Sort WhatsApp-style: most recent activity at the top!
    arena_payload.sort(key=lambda x: x.get("last_activity_at") or "", reverse=True)

    return success_response(arena_payload)

@router.post("/join", response_model=ApiSuccessResponse)
@router.post("/join-by-code", response_model=ApiSuccessResponse)
def join_arena_by_code(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Looks up an arena by code or ID and creates an approved membership record.
    Supports /api/arenas/join and /api/arenas/join-by-code.
    """
    invite_code = (
        payload.get("invite_code") or 
        payload.get("code") or 
        payload.get("inviteCode") or 
        ""
    )
    if isinstance(invite_code, str):
        invite_code = invite_code.strip().upper()
    else:
        invite_code = ""

    arena_id = payload.get("arena_id") or payload.get("arenaId")

    arena = None
    if invite_code:
        arena = arena_repository.get_by_invite_code(db, invite_code=invite_code)
    elif arena_id:
        try:
            arena = db.query(Arena).filter(Arena.id == int(arena_id)).first()
        except (ValueError, TypeError):
            arena = None

    if not arena:
        if not invite_code and not arena_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "message": "Invite code or Arena ID is required.",
                    "error_code": "ARENA_INVITE_CODE_REQUIRED",
                },
            )
        raise HTTPException(
            status_code=404,
            detail={
                "status": "error",
                "message": f"No active Habit Tribe matches the code '{invite_code}'. Please check and try again.",
                "error_code": "ARENA_INVITE_NOT_FOUND",
            },
        )
        
    existing_membership = arena_repository.get_membership(db, user_id=current_user.id, arena_id=arena.id)
    
    if existing_membership:
        if existing_membership.status == "approved":
            return success_response({
                "id": arena.id,
                "arena_id": arena.id,
                "name": arena.name,
                "detail": f"You are already an approved member of {arena.name}.",
                "message": f"You are already an approved member of {arena.name}.",
                "membership_status": "approved"
            })
            
    if invite_code:
        membership = arena_service.join_by_invite_code(db, user_id=current_user.id, invite_code=invite_code)
    else:
        membership = arena_service.join_arena(db, user_id=current_user.id, arena_id=arena.id)
    
    # Broadcast real-time join event safely
    from app.core.managers.websocket_manager import websocket_manager
    join_payload = {
        "event_type": "member_joined",
        "arena_id": arena.id,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "status": membership.status
    }
    websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)

    msg = f"Joined {arena.name} successfully!"
    return success_response({
        "id": arena.id,
        "arena_id": arena.id,
        "name": arena.name,
        "detail": msg,
        "message": msg,
        "membership_status": membership.status
    })

@router.get("/{arena_id}/members", response_model=ApiSuccessResponse)
def get_arena_members_list(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches all approved active members inside an arena room alongside 
    pre-calculated total arena room overlap metrics.
    Optimized with SQL group-by aggregation to prevent loop queries.
    """
    try:
        arena_obj = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena_obj:
            raise HTTPException(status_code=404, detail="Arena not found")

        # Authorization: Private Arenas require approved membership or ownership
        if arena_obj.is_private:
            mem = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.user_id == current_user.id
            ).first()
            is_approved = mem is not None and mem.status == "approved"
            is_creator = current_user.id == arena_obj.creator_id
            if not (is_approved or is_creator):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "status": "error",
                        "message": "Access denied: This is a private Arena. You must be an approved member to view members.",
                        "error_code": "PRIVATE_ARENA_ACCESS_DENIED"
                    }
                )

        memberships = db.query(ArenaMembership)\
            .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.status == "approved")\
            .options(joinedload(ArenaMembership.user))\
            .all()

        creator_id = arena_obj.creator_id

        user_ids = [member.user_id for member in memberships if member.user]
        counts_map = {}
        if user_ids:
            counts_query = (
                db.query(
                    ArenaMembership.user_id,
                    func.count(ArenaMembership.id).label("cnt")
                )
                .filter(
                    ArenaMembership.user_id.in_(user_ids),
                    ArenaMembership.status == "approved"
                )
                .group_by(ArenaMembership.user_id)
                .all()
            )
            counts_map = {row.user_id: row.cnt for row in counts_query}

        results = []
        for member in memberships:
            if not member.user:
                continue
                
            common_count = counts_map.get(member.user_id, 1)
            avatar_url = (member.user.profile.profile_image_url if getattr(member.user, 'profile', None) else None) or None

            results.append({
                "id": member.id,
                "user_id": member.user_id,
                "user_name": member.user.full_name,
                "full_name": member.user.full_name,
                "email": member.user.email,
                "role": member.role or ("admin" if member.user_id == creator_id else "member"),
                "current_streak": member.current_streak or 0,
                "streak_days": member.current_streak or 0,
                "is_active": True,
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                "user_avatar": avatar_url,
                "common_arenas_count": common_count
            })

        return success_response(results)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": str(e),
                "error_code": "ARENA_MEMBERS_LIST_FAILED",
            },
        )

@router.post("/{arena_id}/leave")
def leave_arena(
    arena_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows a user/admin to leave an arena room. 
    Transfers ownership if leaving user is admin/creator.
    """
    try:
        arena = arena_service.get_arena_by_id(db, arena_id=arena_id)

        membership = arena_repository.get_membership(db, user_id=current_user.id, arena_id=arena_id)

        if not membership:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "message": "No active membership record found for this user.",
                    "error_code": "MEMBERSHIP_NOT_FOUND"
                }
            )

        is_leaving_admin = (arena.creator_id == current_user.id or membership.role == "admin")

        db.delete(membership)
        db.flush()

        if is_leaving_admin:
            next_successor = db.query(ArenaMembership).filter(
                ArenaMembership.arena_id == arena_id,
                ArenaMembership.status == "approved",
                ArenaMembership.user_id != current_user.id
            ).order_by(ArenaMembership.id.asc()).first()

            if next_successor:
                next_successor.role = "admin"
                arena.creator_id = next_successor.user_id
                message = f"You exited the arena. Admin ownership transferred to User #{next_successor.user_id}."
            else:
                db.delete(arena)
                message = "You exited the arena. Room deleted as no members remained."
        else:
            message = "Successfully exited the arena room."

        db.commit()

        return success_response({
            "message": f"Successfully left arena {arena.name}",
            "transferred_to_admin": new_admin_id
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e), "error_code": "LEAVE_ARENA_FAILED"}
        )


@router.post("/{arena_id}/join", response_model=ApiSuccessResponse)
def join_arena_direct(
    arena_id: int,
    payload: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct endpoint for joining an arena by ID, optionally validating an invite code.
    If invite_code matches or arena is public, member is approved immediately.
    If private without invite code, join request is set to pending.
    """
    invite_code = (
        (payload or {}).get("invite_code") or 
        (payload or {}).get("code") or 
        (payload or {}).get("inviteCode") or 
        ""
    ).strip().upper() if payload else ""

    existing = arena_repository.get_membership(db, user_id=current_user.id, arena_id=arena_id)
    if existing:
        if existing.status == "approved":
            return success_response({"detail": "You are already an approved member of this arena.", "arena_id": arena.id, "membership_status": "approved"})
        elif existing.status == "pending" and not invite_code:
            return success_response({"detail": "Your join request is pending evaluation.", "arena_id": arena.id, "membership_status": "pending"})

    arena_code_upper = (arena.invite_code or "").strip().upper()
    is_code_valid = bool(
        invite_code and (
            invite_code == arena_code_upper or 
            invite_code.replace("TRIB-", "") == arena_code_upper or
            invite_code == f"TRIB-{arena.id}" or
            invite_code == str(arena.id)
        )
    )
    if is_code_valid:
        membership = arena_service.join_by_invite_code(db, user_id=current_user.id, invite_code=arena.invite_code)
    else:
        membership = arena_service.join_arena(db, user_id=current_user.id, arena_id=arena.id)

    from app.core.managers.websocket_manager import websocket_manager
    join_payload = {
        "event_type": "member_joined",
        "arena_id": arena.id,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "status": membership.status
    }
    websocket_manager.safe_broadcast_to_arena(arena.id, join_payload)

    msg = f"Joined {arena.name} successfully!" if membership.status == "approved" else "Join request submitted for approval."
    return success_response({"detail": msg, "arena_id": arena.id, "membership_status": membership.status})


@router.post("/{arena_id}/process-deadline", response_model=ApiSuccessResponse)
def process_arena_deadline(
    arena_id: int,
    target_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers automated deadline processing for the specified Arena.
    Evaluates members who missed the daily submission, marks them absent,
    resets their active streak to 0, and broadcasts WebSocket notices.
    Authorized for Arena Creator or Admins.
    """
    arena = db.query(Arena).filter(Arena.id == arena_id).first()
    if not arena:
        raise HTTPException(status_code=404, detail="Arena not found")

    membership = db.query(ArenaMembership).filter(
        ArenaMembership.arena_id == arena_id,
        ArenaMembership.user_id == current_user.id
    ).first()

    is_creator = current_user.id == arena.creator_id
    is_admin = membership is not None and membership.role == "admin" and membership.status == "approved"
    if not (is_creator or is_admin):
        raise HTTPException(
            status_code=403,
            detail={
                "status": "error",
                "message": "Only the Arena creator or an admin can trigger deadline processing.",
                "error_code": "FORBIDDEN"
            }
        )

    from app.services.audit_service import audit_service
    summary = audit_service.audit_arena_deadline(db, arena_id=arena_id, target_date_str=target_date)
    return success_response(summary)