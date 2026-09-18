"""
Proof Ingestion & Habit Verification Service for Tribely.
Enforces timezone-aware submission windows, single daily proof database constraint,
atomic streak progression (+1), Redis cache invalidations, and real-time WebSocket sync.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import datetime
import zoneinfo
import logging

from app.models.models import Arena, ArenaMembership, Proof, Submission, DailyArenaSheet, User
from app.repositories.proof_repository import proof_repository
from app.services.ai_verification_service import ai_verification_service
from app.api.websocket import manager as websocket_manager
from app.core.redis import get_sync_redis_client
from app.core.storage.storage_factory import offload_base64_media

logger = logging.getLogger(__name__)


class ProofService:
    """
    Ingestion engine for daily habit proofs.
    """

    def get_arena_timezone(self, arena: Arena) -> zoneinfo.ZoneInfo:
        tz_name = arena.timezone or "UTC"
        try:
            return zoneinfo.ZoneInfo(tz_name)
        except Exception:
            return zoneinfo.ZoneInfo("UTC")

    def parse_cutoff_time(self, cutoff_str: Optional[str]) -> datetime.time:
        if not cutoff_str:
            return datetime.time(23, 59, 59)
        normalized = cutoff_str.strip().upper()
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
            try:
                return datetime.datetime.strptime(normalized, fmt).time()
            except ValueError:
                continue
        return datetime.time(23, 59, 59)

    def submit_proof(
        self,
        db: Session,
        arena_id: int,
        user_id: int,
        media_url: str,
        proof_type: str = "IMAGE",
        selfie_url: Optional[str] = None,
        caption: Optional[str] = None,
        telemetry_data: Optional[Dict[str, Any]] = None,
        client_submitted_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes and records a daily habit proof:
        1. Validates submission window using arena's IANA timezone.
        2. Enforces single daily proof per arena at database schema level.
        3. Atomically increments member current streak (+1).
        4. Runs AI verification heuristic audit.
        5. Invalidates Redis caches.
        6. Broadcasts real-time WebSocket event to all connected arena peers.
        """
        arena = db.query(Arena).filter(Arena.id == arena_id).first()
        if not arena:
            raise ValueError(f"Arena #{arena_id} not found.")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User #{user_id} not found.")

        # ── 1. Timezone-Aware 24-Hour Habit Cycle & Locking ───────────────────
        from app.services.cycle_service import cycle_service
        cycle_info = cycle_service.calculate_arena_cycle(arena)
        target_date = cycle_info.cycle_date

        is_locked, unlock_time, existing_sub, existing_proof = cycle_service.is_user_locked_in_cycle(
            db, arena_id, user_id, arena
        )
        if is_locked:
            return {
                "status": "conflict",
                "error_code": "DAILY_SUBMISSION_LOCKED",
                "message": f"Proof already submitted for this cycle in {arena.name}. Submissions are locked until deadline reset at {cycle_info.formatted_deadline}.",
                "unlock_time": unlock_time.isoformat() if unlock_time else None,
                "submission_date": target_date.isoformat(),
            }

        # ── 3. Run Multimodal AI Proof & Anti-Cheat Audit ───────────────────────
        if media_url and media_url.startswith("data:"):
            storage_path = f"proofs/{arena_id}/{user_id}"
            media_url = offload_base64_media(media_url, folder_prefix=storage_path)

        ai_audit = ai_verification_service.audit_submission(
            proof_type=proof_type,
            proof_url=media_url,
            arena_title=arena.name if arena else None,
            arena_category=arena.category if arena else None,
            arena_description=arena.description if arena else None,
            caption=caption
        )

        ai_status = ai_audit.get("ai_status") or ("verified" if ai_audit.get("anti_cheat_passed", True) else "flagged_suspicious")
        ai_score = ai_audit.get("confidence_score", 0.95)
        ai_notes = ai_audit.get("audit_message", "AI Verification completed.")

        ai_telemetry = {
            "ai_confidence_score": ai_score,
            "ai_status": ai_status,
            "ai_audit_notes": ai_notes,
            "verifier_type": ai_audit.get("verifier_type", "AIVerifier")
        }
        enriched_telemetry = {**(telemetry_data or {}), "ai_verification": ai_telemetry}

        # ── 4. Insert Proof with DB Constraint Protection ───────────────────────
        try:
            utc_now = datetime.datetime.now(datetime.timezone.utc)
            proof = proof_repository.create_proof(
                db=db,
                arena_id=arena_id,
                user_id=user_id,
                submission_date=target_date,
                media_url=media_url,
                proof_type=proof_type,
                selfie_url=selfie_url,
                caption=caption,
                telemetry_data=enriched_telemetry,
                created_at=utc_now
            )

            # Sync legacy Submission & DailyArenaSheet records for backwards compatibility
            legacy_sub = Submission(
                arena_id=arena_id,
                user_id=user_id,
                proof_url=media_url,
                submitted_at=utc_now,
                is_verified=ai_audit.get("anti_cheat_passed", True),
                ai_confidence_score=ai_score,
                ai_status=ai_status,
                ai_audit_notes=ai_notes
            )
            db.add(legacy_sub)

            date_str = target_date.isoformat()
            sheet = (
                db.query(DailyArenaSheet)
                .filter(
                    DailyArenaSheet.arena_id == arena_id,
                    DailyArenaSheet.user_id == user_id,
                    DailyArenaSheet.date_day == date_str
                )
                .first()
            )
            if sheet:
                sheet.status = "submitted"
                sheet.proof_type = proof_type
                sheet.updated_at = utc_now
            else:
                db.add(DailyArenaSheet(
                    arena_id=arena_id,
                    user_id=user_id,
                    date_day=date_str,
                    status="submitted",
                    proof_type=proof_type
                ))

            # ── 5. Atomically Increment Member Streak ───────────────────────────
            membership = (
                db.query(ArenaMembership)
                .filter(ArenaMembership.arena_id == arena_id, ArenaMembership.user_id == user_id)
                .first()
            )
            new_streak = 1
            if membership:
                membership.current_streak = (membership.current_streak or 0) + 1
                new_streak = membership.current_streak

            db.commit()
            db.refresh(proof)

        except IntegrityError:
            db.rollback()
            return {
                "status": "conflict",
                "error_code": "DUPLICATE_DAILY_SUBMISSION",
                "message": f"Concurrent submission detected. Proof already exists for {target_date.isoformat()}.",
            }
        except Exception as e:
            db.rollback()
            logger.error(f"[ProofService] Error inserting proof: {e}")
            raise e

        # ── 6. Invalidate Redis Caches ──────────────────────────────────────────
        try:
            r = get_sync_redis_client()
            if r:
                r.delete(f"arena:{arena_id}:proofs:latest")
                r.delete(f"arena:{arena_id}:feed")
                r.delete("feed:public")
        except Exception as e:
            logger.warning(f"[ProofService] Redis cache invalidation notice: {e}")

        # ── 7. Real-Time WebSocket Broadcast ────────────────────────────────────
        user_avatar = user.avatar_url or (user.profile.profile_image_url if user.profile else None)
        broadcast_payload = {
            "type": "proof_submitted",
            "proof_id": proof.id,
            "arena_id": arena_id,
            "user_id": user_id,
            "user_name": user.full_name,
            "user_avatar": user_avatar,
            "media_url": proof.media_url,
            "proof_type": proof.proof_type,
            "current_streak": new_streak,
            "submission_date": target_date.isoformat(),
            "timestamp": utc_now.isoformat()
        }
        websocket_manager.safe_broadcast_to_arena(arena_id, broadcast_payload)

        return {
            "status": "success",
            "proof_id": proof.id,
            "arena_id": arena_id,
            "user_id": user_id,
            "current_streak": new_streak,
            "submission_date": target_date.isoformat(),
            "ai_verification": ai_audit
        }


proof_service = ProofService()
