"""
AI-Powered Proof Auto-Verification Engine using Google Gemini 1.5 Flash Multimodal Vision.
Provides automated verification scoring, anti-cheat detection, and context tagging for habit submissions.
"""

import os
import re
import json
import base64
import logging
from typing import Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from app.models.models import Submission
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIVerificationService:
    """
    Multimodal AI verification engine that analyzes submitted habit proofs using Google Gemini 1.5 Flash.
    Features automated anti-cheat detection, visual inspection, and zero-downtime deterministic fallback.
    """

    def __init__(self):
        self.gemini_endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    def _resolve_image_bytes_and_mime(self, media_url: str) -> tuple[Optional[str], Optional[str]]:
        """
        Extracts base64 image data and mime type from Data URIs, local static uploads, or remote URLs.
        Returns: (base64_data_str, mime_type) or (None, None) if unresolved.
        """
        if not media_url:
            return None, None

        clean_url = media_url.strip()

        # 1. Base64 Data URI
        if clean_url.startswith("data:image/"):
            match = re.match(r"^data:(image/[a-zA-Z0-9\+\-]+);base64,(.+)$", clean_url)
            if match:
                return match.group(2), match.group(1)

        # 2. Local Static Upload File
        local_path = None
        if clean_url.startswith("/static/uploads/"):
            local_path = os.path.join("static", "uploads", os.path.basename(clean_url))
        elif clean_url.startswith("static/uploads/"):
            local_path = clean_url
        elif clean_url.startswith("/uploads/"):
            local_path = os.path.join("static", "uploads", os.path.basename(clean_url))

        if local_path and os.path.exists(local_path):
            try:
                with open(local_path, "rb") as img_f:
                    data = img_f.read()
                ext = os.path.splitext(local_path)[1].lower().replace(".", "")
                mime = f"image/{ext}" if ext in ["jpeg", "png", "webp", "gif"] else "image/jpeg"
                return base64.b64encode(data).decode("utf-8"), mime
            except Exception as e:
                logger.warning(f"Error reading local static image {local_path}: {e}")

        # 3. Remote HTTP/HTTPS Image URL
        if clean_url.startswith("http://") or clean_url.startswith("https://"):
            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get(clean_url)
                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                        return base64.b64encode(resp.content).decode("utf-8"), content_type
            except Exception as e:
                logger.debug(f"Could not fetch remote proof media {clean_url}: {e}")

        return None, None

    def _verify_with_gemini_vision(
        self,
        proof_type: str,
        proof_url: str,
        arena_title: str,
        arena_category: str,
        arena_description: str,
        caption: str
    ) -> Optional[Dict[str, Any]]:
        """
        Executes multimodal inspection using Gemini 1.5 Flash API with structured JSON output.
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return None

        prompt_text = (
            f"You are Tribely's automated habit verification and anti-cheat auditor.\n"
            f"A member of an accountability squad has submitted daily proof for an active habit challenge.\n\n"
            f"Arena Information:\n"
            f"- Title: {arena_title or 'General Habit Squad'}\n"
            f"- Category: {arena_category or 'General'}\n"
            f"- Goal Description: {arena_description or 'Daily consistency habit'}\n"
            f"- Submission Type: {proof_type}\n"
            f"- Member Caption: {caption or 'None'}\n\n"
            f"Audit Tasks:\n"
            f"1. Check if the visual evidence/content authenticates genuine habit performance matching the arena goal.\n"
            f"2. Inspect for anti-cheat anomalies (e.g. stock photo watermarks, unrelated memes, recycled or irrelevant images).\n"
            f"3. Return strict JSON with:\n"
            f"   - is_valid: boolean (true if genuine evidence, false if clearly invalid/fraudulent)\n"
            f"   - confidence_score: float between 0.00 and 1.00\n"
            f"   - status: 'verified' (if score >= 0.70), 'flagged_suspicious' (if 0.40 <= score < 0.70), or 'rejected' (if score < 0.40)\n"
            f"   - audit_notes: concise 1-sentence explanation of what was verified or flagged"
        )

        parts = [{"text": prompt_text}]

        # If it's an image proof, attach inline base64 image data
        if proof_type.lower() in ["image", "photo", "selfie"]:
            b64_data, mime_type = self._resolve_image_bytes_and_mime(proof_url)
            if b64_data and mime_type:
                parts.append({
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": b64_data
                    }
                })

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2
            }
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                url = f"{self.gemini_endpoint}?key={api_key}"
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        raw_text = candidates[0]["content"]["parts"][0].get("text", "{}")
                        result = json.loads(raw_text)
                        
                        score = float(result.get("confidence_score", 0.95))
                        is_valid = bool(result.get("is_valid", score >= 0.50))
                        status = result.get("status")
                        if not status:
                            status = "verified" if score >= 0.70 else ("flagged_suspicious" if score >= 0.40 else "rejected")

                        return {
                            "is_valid": is_valid,
                            "anti_cheat_passed": score >= 0.70,
                            "confidence_score": round(score, 2),
                            "ai_status": status,
                            "audit_message": result.get("audit_notes") or f"Gemini Vision: {arena_category} habit verified ({int(score * 100)}% Confidence)",
                            "verifier_type": "Gemini15FlashMultimodal"
                        }
        except Exception as e:
            logger.warning(f"Gemini Vision API inspection exception (falling back to heuristics): {e}")

        return None

    def _fallback_heuristic_audit(
        self,
        proof_type: str,
        proof_url: str,
        arena_category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        High-reliability deterministic heuristic and algorithmic fallback verifier.
        Guarantees zero user-facing errors even when offline or without Gemini API keys.
        """
        from app.core.verifiers.proof_verifier import ProofVerifierFactory, ProofVerificationResult

        verifier = ProofVerifierFactory.get_verifier(proof_type)
        result: ProofVerificationResult = verifier.verify(proof_url)
        score = round(result.confidence_score, 2)
        anti_cheat_passed = score >= 0.70

        status = "verified" if anti_cheat_passed else ("flagged_suspicious" if score >= 0.40 else "rejected")

        # Category-aware audit note enrichment
        cat_note = f" [{arena_category}]" if arena_category else ""
        audit_note = f"AI Auto-Audit{cat_note}: {result.reason} ({int(score * 100)}% Confidence)"

        return {
            "is_valid": result.is_valid,
            "anti_cheat_passed": anti_cheat_passed,
            "confidence_score": score,
            "ai_status": status,
            "audit_message": audit_note,
            "verifier_type": verifier.__class__.__name__,
        }

    def audit_submission(
        self,
        proof_type: str,
        proof_url: str,
        arena_title: Optional[str] = None,
        arena_category: Optional[str] = None,
        arena_description: Optional[str] = None,
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Perform multimodal AI verification on submitted habit proof.
        First attempts Gemini 1.5 Flash inspection; gracefully falls back to deterministic heuristics.
        """
        if not proof_url or proof_url == "ABSENT_CUTOFF_MISSED":
            return {
                "is_valid": False,
                "anti_cheat_passed": False,
                "confidence_score": 0.0,
                "ai_status": "rejected",
                "audit_message": "Deadline missed - zero proof submitted.",
                "verifier_type": "AbsenceValidator"
            }

        # Attempt Gemini 1.5 Flash Multimodal Pipeline
        gemini_result = self._verify_with_gemini_vision(
            proof_type=proof_type or "image",
            proof_url=proof_url,
            arena_title=arena_title or "",
            arena_category=arena_category or "",
            arena_description=arena_description or "",
            caption=caption or ""
        )

        if gemini_result is not None:
            return gemini_result

        # Fallback to deterministic verification rules
        return self._fallback_heuristic_audit(
            proof_type=proof_type or "image",
            proof_url=proof_url,
            arena_category=arena_category
        )

    def analyze_submission_proof(
        self,
        proof_url: str,
        proof_type: Optional[str] = "image"
    ) -> Dict[str, Any]:
        """
        Legacy heuristic signature compatibility helper.
        """
        audit = self.audit_submission(proof_type=proof_type or "image", proof_url=proof_url)
        return {
            "ai_confidence_score": audit.get("confidence_score", 0.95),
            "ai_status": audit.get("ai_status", "verified"),
            "ai_audit_notes": audit.get("audit_message", "AI Proof Verified.")
        }

    def process_and_attach_ai_score(
        self,
        db: Session,
        submission: Submission
    ) -> Submission:
        """
        Calculates and attaches AI verification score & audit notes to a submission instance.
        """
        res = self.analyze_submission_proof(submission.proof_url)
        submission.ai_confidence_score = res["ai_confidence_score"]
        submission.ai_status = res["ai_status"]
        submission.ai_audit_notes = res["ai_audit_notes"]
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission


# Global Singleton Instances
ai_verification_service = AIVerificationService()
ai_proof_auditor = ai_verification_service
AIProofAuditorService = AIVerificationService
