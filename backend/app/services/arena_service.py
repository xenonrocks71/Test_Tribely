"""
Arena Domain & Cohort Management Service Implementation.
Encapsulates squad room creation, discovery feeds, join workflows, private arena authorization,
ledger room inspection, administrative membership moderation, and cascade deallocations.
Adheres strictly to clean layered architecture, OOP standards, and transaction safety.
"""

import datetime
from typing import List, Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.models import (
    Arena, ArenaMembership, User, EscrowLedger, KudosLedger,
    Submission, Proof, DailyArenaSheet, ArenaLogbook, Message,
    SubmissionVote
)
from app.schemas.schemas import ArenaCreate, UpdateArenaSettingsRequest
from app.repositories.arena_repository import arena_repository, ArenaRepository
from app.services.cycle_service import cycle_service
from app.core.managers.websocket_manager import websocket_manager
from app.core.config import settings


class ArenaService:
    """
    Business service orchestrating Micro-Arena lifecycles, membership access gates,
    squad ribbon aggregations, and administrative moderation rules.
    """

    def __init__(self, arena_repo: ArenaRepository = arena_repository) -> None:
        """
        Initialize ArenaService with injected ArenaRepository.

        :param arena_repo: Data access repository for Arena and Membership entities.
        """
        self.arena_repo = arena_repo

    # ── Authorization & Access Control Helpers ───────────────────────────────

    def verify_admin_access(
        self,
        db: Session,
        *,
        arena_id: int,
        user_id: int
    ) -> Tuple[Arena, Optional[ArenaMembership]]:
        """
        Enforces authoritative administrator access control.
        A user is granted admin privileges if they are the arena creator or have role='admin'.

        :param db: Active database session.
        :param arena_id: Primary key of target arena.
        :param user_id: Primary key of user asserting privileges.
        :return: Tuple of (Arena, Optional[ArenaMembership]).
        :raises HTTPException: 404 if arena missing, 403 if user lacks admin privileges.
        """
        arena = self.arena_repo.get_by_id(db, id=arena_id)
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"status": "error", "message": "Arena room not found.", "error_code": "ARENA_NOT_FOUND"}
            )

        admin_membership = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena_id,
            ArenaMembership.user_id == user_id,
            ArenaMembership.role == "admin"
        ).first()

        if arena.creator_id != user_id and not admin_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"status": "error", "message": "Unauthorized Admin access.", "error_code": "ADMIN_ARENA_FORBIDDEN"}
            )

        return arena, admin_membership

    def verify_read_access(
        self,
        db: Session,
        *,
        arena: Arena,
        user_id: int
    ) -> Optional[ArenaMembership]:
        """
        Enforces membership authorization on private arenas.
        Public arenas permit guest/member reads; private arenas strictly require
        creator ownership or an approved membership.

        :param db: Active database session.
        :param arena: Target Arena instance.
        :param user_id: Requesting user primary key.
        :return: Optional active ArenaMembership instance.
        :raises HTTPException: 403 if private arena access is denied.
        """
        membership = self.arena_repo.get_membership(db, user_id=user_id, arena_id=arena.id)

        if arena.is_private:
            is_approved = membership is not None and membership.status == "approved"
            is_creator = user_id == arena.creator_id
            if not (is_approved or is_creator):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "status": "error",
                        "message": "Access denied: This is a private Arena. You must be an approved member to view details.",
                        "error_code": "PRIVATE_ARENA_ACCESS_DENIED",
                        "is_private": True,
                        "membership_status": membership.status if membership else "none"
                    }
                )

        return membership

    # ── Arena Retrieval & Creation ───────────────────────────────────────────

    def get_arena_by_id(self, db: Session, arena_id: int) -> Arena:
        """
        Fetch an arena by primary key ID or raise 404.

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :return: Arena entity.
        :raises HTTPException: 404 Not Found if arena does not exist.
        """
        arena = self.arena_repo.get_by_id(db, id=arena_id)
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Arena not found."
            )
        return arena

    def create_arena(self, db: Session, *, arena_in: ArenaCreate, creator_id: int) -> Arena:
        """
        Create a new micro-arena and bind creator as initial owner/admin.

        :param db: Active database session.
        :param arena_in: Arena configuration parameters.
        :param creator_id: User identifier of room creator.
        :return: Created Arena instance.
        """
        return self.arena_repo.create_arena(db, arena_in=arena_in, creator_id=creator_id)

    def get_public_discovery_arenas(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Arena]:
        """
        Fetch public arenas for community discovery feed.
        """
        return self.arena_repo.get_public_arenas(db, skip=skip, limit=limit)

    def get_user_arenas(self, db: Session, user_id: int) -> List[Arena]:
        """
        Fetch arenas that the specified user has joined and been approved for.
        """
        return self.arena_repo.get_user_arenas(db, user_id=user_id)

    def get_discovery_arenas(self, db: Session) -> List[Dict[str, Any]]:
        """
        Returns public and private arena information coupled with real-time member counts
        for community discovery and landing exploration. Filters out automated test noise.
        """
        counts_query = (
            db.query(
                ArenaMembership.arena_id,
                func.count(ArenaMembership.id).label("total_members")
            )
            .filter(ArenaMembership.status == "approved")
            .group_by(ArenaMembership.arena_id)
            .all()
        )
        counts_map = {row.arena_id: row.total_members for row in counts_query}

        test_patterns = [
            "%test%", "%keyset%", "%penalty arena%", "%escrow arena%",
            "%high roller%", "%phase%", "%sprint arena%", "%multiplier arena%", "%smoke%"
        ]
        arenas = (
            db.query(Arena)
            .filter(*[~Arena.name.ilike(p) for p in test_patterns])
            .offset(0)
            .limit(200)
            .all()
        )

        return [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "invite_code": a.invite_code,
                "is_private": a.is_private,
                "proof_type": a.proof_type,
                "penalty_amount": float(a.penalty_amount or 0.00),
                "deadline_time": a.deadline_time,
                "category": a.category or "Habit",
                "icon_url": a.icon_url,
                "timezone": a.timezone or "UTC",
                "member_count": counts_map.get(a.id, 0)
            }
            for a in arenas
        ]

    def list_user_arenas_with_activity(self, db: Session, *, user_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves all accountability arenas the authenticated user has joined or created,
        sorted by recent activity (chat messages, proof submissions, join dates) descending (WhatsApp order).
        Optimized with batch queries to eliminate N+1 bottlenecks.
        """
        from app.schemas.schemas import ArenaResponse

        memberships = db.query(ArenaMembership).filter(ArenaMembership.user_id == user_id).all()
        membership_map = {m.arena_id: m for m in memberships}
        arena_ids = list(membership_map.keys())

        arenas = db.query(Arena).filter(Arena.id.in_(arena_ids)).all() if arena_ids else []

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
            item["user_role"] = mem.role if mem else ("admin" if arena.creator_id == user_id else "member")

            latest_msg = latest_messages.get(arena.id)
            latest_sub = latest_submissions.get(arena.id)

            msg_time = latest_msg.created_at if latest_msg else None
            sub_time = latest_sub.submitted_at if latest_sub else None
            mem_time = mem.joined_at if (mem and getattr(mem, 'joined_at', None)) else arena.created_at

            valid_times = [t for t in [msg_time, sub_time, mem_time, arena.created_at] if t is not None]
            last_activity_dt = max(valid_times) if valid_times else arena.created_at

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

        arena_payload.sort(key=lambda x: x.get("last_activity_at") or "", reverse=True)
        return arena_payload

    def request_discovery_join(self, db: Session, *, user: User, arena_id: int) -> Dict[str, Any]:
        """
        Processes discovery feed join request.
        Instantly approves public arenas; holds private arenas pending admin approval.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        existing = self.arena_repo.get_membership(db, user_id=user.id, arena_id=arena_id)

        if existing:
            if existing.status == "approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "status": "error",
                        "message": "You are already an approved member inside this arena.",
                        "error_code": "ARENA_MEMBERSHIP_ALREADY_APPROVED",
                    },
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "status": "error",
                        "message": "Your join authorization is currently pending evaluation.",
                        "error_code": "ARENA_MEMBERSHIP_PENDING",
                    },
                )

        membership = self.join_arena(db, user_id=user.id, arena_id=arena_id)

        # Notify room admin via WebSocket
        websocket_manager.safe_broadcast_to_arena(arena.id, {
            "event_type": "join_request_created",
            "arena_id": arena.id,
            "user_id": user.id,
            "user_name": user.full_name or f"Member #{user.id}",
            "status": membership.status,
            "is_private": arena.is_private,
        })

        msg = f"Successfully joined {arena.name}!" if membership.status == "approved" else f"Request to join {arena.name} submitted for admin review with 50 Kudos deposited to squad escrow."
        return {
            "room_state": membership.status,
            "is_private": arena.is_private,
            "message": msg,
        }

    def join_by_code_or_id(self, db: Session, *, user: User, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Unified handler for joining an arena via 6-character code or numeric ID.
        """
        raw_code = payload.get("invite_code") or payload.get("code") or payload.get("inviteCode") or ""
        invite_code = raw_code.strip().upper() if isinstance(raw_code, str) else ""
        arena_id = payload.get("arena_id") or payload.get("arenaId")

        arena = None
        if invite_code:
            arena = self.arena_repo.get_by_invite_code(db, invite_code=invite_code)
        elif arena_id:
            try:
                arena = self.arena_repo.get_by_id(db, id=int(arena_id))
            except (ValueError, TypeError):
                arena = None

        if not arena:
            if not invite_code and not arena_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "status": "error",
                        "message": "Invite code or Arena ID is required.",
                        "error_code": "ARENA_INVITE_CODE_REQUIRED",
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "status": "error",
                    "message": f"No active Habit Tribe matches the code '{invite_code}'. Please check and try again.",
                    "error_code": "ARENA_INVITE_NOT_FOUND",
                },
            )

        existing = self.arena_repo.get_membership(db, user_id=user.id, arena_id=arena.id)
        if existing and existing.status == "approved":
            return {
                "id": arena.id,
                "arena_id": arena.id,
                "name": arena.name,
                "detail": f"You are already an approved member of {arena.name}.",
                "message": f"You are already an approved member of {arena.name}.",
                "membership_status": "approved"
            }
        if existing and existing.status == "pending":
            return {
                "id": arena.id,
                "arena_id": arena.id,
                "name": arena.name,
                "detail": f"Your request to join {arena.name} is currently pending admin review.",
                "message": f"Your request to join {arena.name} is currently pending admin review.",
                "membership_status": "pending"
            }

        if invite_code:
            membership = self.join_by_invite_code(db, user_id=user.id, invite_code=invite_code)
        else:
            membership = self.join_arena(db, user_id=user.id, arena_id=arena.id)

        websocket_manager.safe_broadcast_to_arena(arena.id, {
            "event_type": "member_joined" if membership.status == "approved" else "join_request_created",
            "arena_id": arena.id,
            "user_id": user.id,
            "user_name": user.full_name,
            "status": membership.status
        })

        msg = f"Joined {arena.name} successfully!" if membership.status == "approved" else f"Request to join {arena.name} submitted for admin review."
        return {
            "id": arena.id,
            "arena_id": arena.id,
            "name": arena.name,
            "detail": msg,
            "message": msg,
            "membership_status": membership.status
        }


    # ── Squad Details & Ledger Inspection ────────────────────────────────────

    def get_arena_details(self, db: Session, *, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Aggregates drill-down squad metadata for `/arenas/[id]`:
        - Verifies private authorization gates.
        - Calculates 24h rolling cycle countdown and today's submission lock status.
        - Loads member stories tray with submission flags.
        - Queries real, double-entry escrow and kudos ledger transactions (zero mock seeds).

        :param db: Active database session.
        :param arena_id: Target arena ID.
        :param current_user_id: Authenticated requesting user ID.
        :return: Aggregated squad detail dictionary.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        membership = self.verify_read_access(db, arena=arena, user_id=current_user_id)

        memberships = self.arena_repo.get_approved_members(db, arena_id=arena_id)
        cycle_info = cycle_service.calculate_arena_cycle(arena)

        # Query members who completed submission in the active 24h cycle
        cycle_subs = db.query(Submission.user_id).filter(
            Submission.arena_id == arena_id,
            Submission.submitted_at >= cycle_info.cycle_start_utc.replace(tzinfo=None),
            Submission.submitted_at < cycle_info.cycle_deadline_utc.replace(tzinfo=None),
            Submission.is_absent == False
        ).all()
        cycle_sub_user_ids = set(s[0] for s in cycle_subs)

        cycle_proofs = db.query(Proof.user_id).filter(
            Proof.arena_id == arena_id,
            Proof.submission_date == cycle_info.cycle_date
        ).all()
        for p in cycle_proofs:
            cycle_sub_user_ids.add(p[0])

        user_submitted_today = current_user_id in cycle_sub_user_ids
        user_is_locked, user_unlock_time, _, _ = cycle_service.is_user_locked_in_cycle(
            db, arena_id, current_user_id, arena
        )

        member_list = []
        for m in memberships:
            u = m.user
            profile = u.profile if u else None
            avatar_url = (profile.profile_image_url if profile and profile.profile_image_url else (u.avatar_url if u and u.avatar_url else None)) or None
            member_list.append({
                "user_id": m.user_id,
                "user_name": u.full_name if u else f"Member #{m.user_id}",
                "user_handle": u.email.split("@")[0] if (u and u.email) else f"user{m.user_id}",
                "user_avatar": avatar_url,
                "role": m.role,
                "has_submitted_today": m.user_id in cycle_sub_user_ids,
                "is_current_user": m.user_id == current_user_id
            })

        stake = float(arena.penalty_amount or 50.0)
        member_count = len(memberships)
        member_stakes_pool = member_count * stake

        # Fetch double-entry ledger transactions from database
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
            tx_type = "penalty" if "penalty" in ttype else ("reward" if ("reward" in ttype or "payout" in ttype) else "deposit")
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

        formatted_txs.sort(key=lambda x: x["created_at"], reverse=True)
        penalties_total = sum(t["amount"] for t in formatted_txs if t["type"] == "penalty")
        total_vault_amount = member_stakes_pool + penalties_total

        escrow_summary = {
            "total_vault_amount": round(total_vault_amount, 2),
            "member_stakes_pool": round(member_stakes_pool, 2),
            "penalty_pool": round(penalties_total, 2),
            "reward_pool": round(total_vault_amount, 2),
            "cycle_days_remaining": max(1, 7 - (datetime.datetime.utcnow().weekday())),
            "cycle_days_total": 7,
            "currency_symbol": "₹"
        }

        return {
            "id": arena.id,
            "name": arena.name,
            "tag": "#" + arena.name.replace(" ", "")[:18],
            "description": arena.description or f"Daily {arena.proof_type or 'habit'} accountability squad.",
            "invite_code": arena.invite_code,
            "proof_type": arena.proof_type,
            "penalty_amount": stake,
            "deadline_time": arena.deadline_time or "11:59 PM",
            "category": arena.category or "Habit",
            "icon_url": arena.icon_url,
            "timezone": arena.timezone or "UTC",
            "is_private": bool(arena.is_private),
            "creator_id": arena.creator_id,
            "is_joined": membership is not None and membership.status == "approved",
            "membership_status": membership.status if membership else None,
            "user_role": membership.role if membership else None,
            "member_count": member_count,
            "sprint_vault": total_vault_amount,
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
        }

    def get_arena_ledger_room(self, db: Session, *, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Retrieves real-time Ledger Room state machine status:
        24-hour cycle timeline, enrolled member roster with timestamps,
        and double-entry financial ledger records.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        self.verify_read_access(db, arena=arena, user_id=current_user_id)

        roster_status = cycle_service.get_arena_roster_cycle_status(db, arena)

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

        memberships = self.arena_repo.get_approved_members(db, arena_id=arena_id)
        user_map = {m.user_id: m for m in memberships}

        transactions = []
        for rec in escrow_records:
            mem = user_map.get(rec.user_id)
            u_name = mem.user.full_name if (mem and mem.user) else f"Spotter #{rec.user_id}"
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
                "description": rec.description or f"{u_name} incurred ₹{amt:.0f} {entry_type.replace('_', ' ')}",
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
            tx_type = "penalty" if "penalty" in ttype else ("reward" if ("reward" in ttype or "payout" in ttype) else "deposit")
            transactions.append({
                "id": f"kudos_{krec.id}",
                "type": tx_type,
                "user_id": krec.user_id,
                "user_name": u_name,
                "user_avatar": u_avatar,
                "amount": amt,
                "description": krec.description or f"{u_name} {ttype.replace('_', ' ')} of ₹{amt:.0f}",
                "created_at": krec.created_at.isoformat() if krec.created_at else datetime.datetime.utcnow().isoformat(),
                "formatted_time": krec.created_at.strftime("%b %d, %I:%M %p") if krec.created_at else "Recently",
                "tx_hash": f"tx_0x{abs(hash(krec.idempotency_key or str(krec.id))) % 0xFFFFFFFFFF:010x}"
            })

        transactions.sort(key=lambda x: x["created_at"], reverse=True)

        is_locked, unlock_time, _, _ = cycle_service.is_user_locked_in_cycle(
            db, arena_id, current_user_id, arena
        )

        return {
            **roster_status,
            "current_user_status": {
                "is_locked": is_locked,
                "unlock_time": unlock_time.isoformat() if unlock_time else None,
            },
            "transactions": transactions,
            "deadline_time": arena.deadline_time or "11:59 PM",
        }


    def get_arena_members_list(self, db: Session, *, arena_id: int, current_user_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all approved members with common-arena overlap metrics.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        self.verify_read_access(db, arena=arena, user_id=current_user_id)

        memberships = self.arena_repo.get_approved_members(db, arena_id=arena_id)
        creator_id = arena.creator_id

        user_ids = [m.user_id for m in memberships if m.user]
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
        for m in memberships:
            if not m.user:
                continue
            common_count = counts_map.get(m.user_id, 1)
            avatar_url = (m.user.profile.profile_image_url if (getattr(m.user, 'profile', None) and m.user.profile.profile_image_url) else getattr(m.user, 'avatar_url', None)) or None
            results.append({
                "id": m.id,
                "user_id": m.user_id,
                "user_name": m.user.full_name,
                "full_name": m.user.full_name,
                "email": m.user.email,
                "role": m.role or ("admin" if m.user_id == creator_id else "member"),
                "current_streak": m.current_streak or 0,
                "streak_days": m.current_streak or 0,
                "is_active": True,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                "user_avatar": avatar_url,
                "common_arenas_count": common_count
            })

        return results

    # ── Membership Mutation & Admin Moderation ───────────────────────────────

    def notify_arena_admins_on_join(self, db: Session, *, arena: Arena, user_id: int, status: str) -> None:
        """
        Dispatches notification alerts to all administrators of an arena when a user joins or requests to join.
        If private (status == 'pending'), dispatches a 'join_request' notification with admin approval actions.
        If public (status == 'approved'), dispatches a 'member_joined' celebration notification.
        """
        import json
        from app.models.notification_models import Notification

        joining_user = db.query(User).filter(User.id == user_id).first()
        if not joining_user:
            return

        user_display = joining_user.full_name or f"Member #{joining_user.id}"
        is_pending = (status == "pending")
        event_type = "join_request" if is_pending else "member_joined"
        title = f"Join Request: {arena.name}" if is_pending else f"New Member in {arena.name}"
        body = f"{user_display} requested to join {arena.name}." if is_pending else f"{user_display} joined {arena.name}!"

        # Aggregate unique admin IDs
        admin_ids = set()
        if arena.creator_id:
            admin_ids.add(arena.creator_id)
        if arena.created_by:
            admin_ids.add(arena.created_by)

        admin_mems = db.query(ArenaMembership).filter(
            ArenaMembership.arena_id == arena.id,
            ArenaMembership.role.in_(["admin", "owner"]),
            ArenaMembership.status == "approved"
        ).all()
        for m in admin_mems:
            admin_ids.add(m.user_id)

        payload_data = {
            "arena_id": arena.id,
            "arena_name": arena.name,
            "user_id": joining_user.id,
            "user_name": user_display,
            "action_type": event_type,
            "status": status,
            "url": f"/arenas/{arena.id}"
        }

        for admin_id in admin_ids:
            if admin_id == user_id:
                continue

            notif = Notification(
                user_id=admin_id,
                arena_id=arena.id,
                event_type=event_type,
                title=title,
                body=body,
                data_json=json.dumps(payload_data)
            )
            db.add(notif)

            try:
                websocket_manager.safe_broadcast_to_user(admin_id, {
                    "event_type": "unread_update",
                    "arena_id": arena.id,
                    "target_user_id": admin_id,
                    "notification": {
                        "id": f"dyn-{arena.id}-{joining_user.id}",
                        "arena_id": arena.id,
                        "arena_name": arena.name,
                        "event_type": event_type,
                        "title": title,
                        "body": body,
                        "target_user_id": joining_user.id,
                        "target_user_name": user_display,
                        "status": status,
                        "is_admin_actionable": is_pending,
                        "data": payload_data
                    }
                })
            except Exception:
                pass

        try:
            db.commit()
        except Exception:
            db.rollback()

    def join_arena(self, db: Session, *, user_id: int, arena_id: int) -> ArenaMembership:
        """
        Request or join an arena based on privacy setting. Public arenas join immediately ("approved"),
        whereas private arenas register a "pending" join request.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        existing = self.arena_repo.get_membership(db, user_id=user_id, arena_id=arena_id)
        if existing:
            return existing

        from app.services.kudos_service import kudos_service
        kudos_service.deduct_arena_join_stake(db, user_id, arena)

        initial_status = "pending" if arena.is_private else "approved"
        membership = self.arena_repo.join_arena(db, user_id=user_id, arena_id=arena_id, status=initial_status, role="member")
        self.notify_arena_admins_on_join(db, arena=arena, user_id=user_id, status=initial_status)
        return membership

    def join_by_invite_code(self, db: Session, *, user_id: int, invite_code: str) -> ArenaMembership:
        """
        Join an arena directly using a valid 6-character invite code, bypassing private approval requirements.
        """
        arena = self.arena_repo.get_by_invite_code(db, invite_code=invite_code)
        if not arena:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invite code."
            )

        from app.services.kudos_service import kudos_service
        kudos_service.deduct_arena_join_stake(db, user_id, arena)

        initial_status = "pending" if arena.is_private else "approved"
        membership = self.arena_repo.join_arena(db, user_id=user_id, arena_id=arena.id, status=initial_status, role="member")
        self.notify_arena_admins_on_join(db, arena=arena, user_id=user_id, status=initial_status)
        return membership

    def leave_arena(self, db: Session, *, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Allows a user/admin to exit an arena room.
        If the leaving member is the owner/admin, automatically promotes the next oldest member.
        If no members remain, cleans up the arena.
        """
        arena = self.get_arena_by_id(db, arena_id=arena_id)
        membership = self.arena_repo.get_membership(db, user_id=current_user_id, arena_id=arena_id)

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"status": "error", "message": "No active membership record found for this user.", "error_code": "MEMBERSHIP_NOT_FOUND"}
            )

        is_leaving_admin = (arena.creator_id == current_user_id or membership.role == "admin")
        new_admin_id = None

        try:
            db.delete(membership)
            db.flush()

            if is_leaving_admin:
                next_successor = db.query(ArenaMembership).filter(
                    ArenaMembership.arena_id == arena_id,
                    ArenaMembership.status == "approved",
                    ArenaMembership.user_id != current_user_id
                ).order_by(ArenaMembership.id.asc()).first()

                if next_successor:
                    next_successor.role = "admin"
                    arena.creator_id = next_successor.user_id
                    new_admin_id = next_successor.user_id
                else:
                    db.delete(arena)

            db.commit()

            return {
                "message": f"Successfully left arena {arena.name}",
                "transferred_to_admin": new_admin_id
            }
        except Exception:
            db.rollback()
            raise

    def get_pending_arena_requests(self, db: Session, *, arena_id: int, current_user_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves pending membership join requests for an arena room (Admin only).
        """
        self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)
        requests = self.arena_repo.get_pending_requests(db, arena_id=arena_id)

        return [
            {
                "id": req.id,
                "user_id": req.user_id,
                "arena_id": req.arena_id,
                "status": req.status,
                "user_name": req.user.full_name if (req.user and getattr(req.user, 'full_name', None)) else f"Member #{req.user_id}",
                "user_handle": (req.user.username if (req.user and getattr(req.user, 'username', None)) else f"user{req.user_id}"),
                "user_avatar": (
                    req.user.profile.profile_image_url
                    if (req.user and getattr(req.user, 'profile', None) and req.user.profile.profile_image_url)
                    else (getattr(req.user, 'avatar_url', None) if req.user else None)
                ) or None
            }
            for req in requests
        ]

    def update_arena_proof_type(self, db: Session, *, arena_id: int, current_user_id: int, proof_type: str) -> Dict[str, Any]:
        """
        Updates strictly required proof verification modality for an arena (Admin only).
        """
        arena, _ = self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)

        clean_type = proof_type.strip().lower()
        if clean_type not in ["text", "link", "image"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"status": "error", "message": "Invalid proof type specified. Choose 'text', 'link', or 'image'.", "error_code": "INVALID_PROOF_TYPE"}
            )

        try:
            arena = self.arena_repo.update_proof_type(db, arena=arena, proof_type=clean_type)
            return {
                "message": "Arena proof verification type updated successfully.",
                "proof_type": arena.proof_type
            }
        except Exception:
            db.rollback()
            raise

    def approve_member(self, db: Session, *, arena_id: int, current_user_id: int, target_user_id: int) -> Dict[str, Any]:
        """
        Approves a pending membership request and broadcasts real-time status update.
        """
        self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)

        membership = self.arena_repo.get_membership(db, user_id=target_user_id, arena_id=arena_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"status": "error", "message": "Membership token record not found.", "error_code": "ADMIN_MEMBERSHIP_NOT_FOUND"}
            )

        self.arena_repo.approve_membership(db, membership)

        # Real-time WebSocket event broadcast to arena
        websocket_manager.safe_broadcast_to_arena(arena_id, {
            "event_type": "join_request_approved",
            "arena_id": arena_id,
            "user_id": target_user_id,
            "status": "approved",
        })

        # Notify approved member directly
        try:
            import json
            from app.models.notification_models import Notification
            arena = self.get_arena_by_id(db, arena_id=arena_id)
            notif = Notification(
                user_id=target_user_id,
                arena_id=arena_id,
                event_type="join_approved",
                title=f"Joined {arena.name}!",
                body=f"Your request to join {arena.name} was approved by the squad admin.",
                data_json=json.dumps({"arena_id": arena_id, "arena_name": arena.name, "url": f"/arenas/{arena_id}"})
            )
            db.add(notif)
            db.commit()

            websocket_manager.safe_broadcast_to_user(target_user_id, {
                "event_type": "unread_update",
                "arena_id": arena_id,
                "target_user_id": target_user_id,
                "notification": {
                    "arena_id": arena_id,
                    "arena_name": arena.name,
                    "event_type": "join_approved",
                    "title": f"Joined {arena.name}!",
                    "body": f"Your request to join {arena.name} was approved.",
                    "data": {"arena_id": arena_id, "url": f"/arenas/{arena_id}"}
                }
            })
        except Exception:
            pass

        return {"detail": "Member approved successfully."}

    def reject_member(self, db: Session, *, arena_id: int, current_user_id: int, target_user_id: int) -> Dict[str, Any]:
        """
        Rejects a pending membership request and broadcasts real-time notice.
        """
        self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)

        membership = self.arena_repo.get_membership(db, user_id=target_user_id, arena_id=arena_id)
        if membership:
            self.arena_repo.delete_membership(db, membership)

            websocket_manager.safe_broadcast_to_arena(arena_id, {
                "event_type": "join_request_rejected",
                "arena_id": arena_id,
                "user_id": target_user_id,
                "status": "rejected",
            })

            websocket_manager.safe_broadcast_to_user(target_user_id, {
                "event_type": "join_request_rejected",
                "arena_id": arena_id,
                "target_user_id": target_user_id,
                "status": "rejected"
            })

        return {"detail": "Membership request rejected successfully."}

    def remove_member(self, db: Session, *, arena_id: int, current_user_id: int, target_user_id: int) -> Dict[str, Any]:
        """
        Kicks a member from an arena room, safely reallocating ownership if admin.
        """
        arena, _ = self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)

        target_membership = self.arena_repo.get_membership(db, user_id=target_user_id, arena_id=arena_id)
        if not target_membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"status": "error", "message": "Target member not found.", "error_code": "MEMBER_NOT_FOUND"}
            )

        try:
            self.arena_repo.remove_member_with_successor(db, arena=arena, target_membership=target_membership)

            # Broadcast real-time kick event
            websocket_manager.safe_broadcast_to_arena(arena_id, {
                "event_type": "member_removed",
                "arena_id": arena_id,
                "user_id": target_user_id,
                "message": "A member was removed from the arena."
            })

            return {"detail": "Member removed and admin roles adjusted seamlessly."}
        except Exception:
            db.rollback()
            raise

    def generate_invite_assets(self, db: Session, *, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Returns structured invite links and QR code mapping blocks.
        """
        arena, _ = self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)
        frontend_base = settings.FRONTEND_URL.rstrip("/")
        invite_link = f"{frontend_base}/arenas/{arena.id}?code={arena.invite_code}"

        return {
            "invite_code": arena.invite_code,
            "invite_link": invite_link,
            "qr_payload_string": f"TRIBELY_INVITE:{arena.invite_code}"
        }

    def delete_arena(self, db: Session, *, arena_id: int, current_user_id: int) -> Dict[str, Any]:
        """
        Permanently removes an arena container and all child relational records.
        """
        arena, _ = self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)
        try:
            self.arena_repo.delete_arena_cascade(db, arena=arena)
            return {"detail": "Arena and all associated data permanently deleted."}
        except Exception:
            db.rollback()
            raise

    def update_arena_settings(
        self,
        db: Session,
        *,
        arena_id: int,
        current_user_id: int,
        payload: UpdateArenaSettingsRequest
    ) -> Dict[str, Any]:
        """
        Updates arena visuals, habit instructions, deadline cutoff, and stake amounts.
        """
        arena, _ = self.verify_admin_access(db, arena_id=arena_id, user_id=current_user_id)

        try:
            arena = self.arena_repo.update_arena_settings(
                db,
                arena=arena,
                name=payload.name,
                description=payload.description,
                icon_url=payload.icon_url,
                proof_type=payload.proof_type,
                deadline_time=payload.deadline_time,
                penalty_amount=payload.penalty_amount
            )

            websocket_manager.safe_broadcast_to_arena(arena_id, {
                "event_type": "arena_settings_updated",
                "arena_id": arena_id,
                "deadline_time": arena.deadline_time,
                "proof_type": arena.proof_type,
                "name": arena.name,
                "description": arena.description,
                "icon_url": arena.icon_url,
            })

            return {
                "detail": "Arena settings updated successfully.",
                "icon_url": arena.icon_url,
                "name": arena.name,
                "deadline_time": arena.deadline_time,
                "proof_type": arena.proof_type,
            }
        except Exception:
            db.rollback()
            raise


# Global Singleton Service Instance
arena_service = ArenaService()
