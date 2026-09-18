"""
Automated Test Suite for AI Multimodal Proof Verification & Anti-Cheat Pipeline (Gemini 1.5 Flash).
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app.services.ai_verification_service import ai_verification_service, AIVerificationService
from app.core.config import settings


def test_ai_verification_absence_rejection():
    """Verify that absent/missed cutoff proofs are immediately rejected with zero score."""
    result = ai_verification_service.audit_submission(
        proof_type="image",
        proof_url="ABSENT_CUTOFF_MISSED",
        arena_title="Morning Running Squad"
    )
    assert result["is_valid"] is False
    assert result["anti_cheat_passed"] is False
    assert result["confidence_score"] == 0.0
    assert result["ai_status"] == "rejected"
    assert "missed" in result["audit_message"].lower()


def test_ai_verification_heuristic_fallback_image():
    """Verify heuristic image proof validation when Gemini API key is not configured."""
    with patch.object(settings, "GEMINI_API_KEY", None):
        result = ai_verification_service.audit_submission(
            proof_type="image",
            proof_url="https://example.com/uploads/morning_run_proof.jpg",
            arena_title="10K Running Challenge",
            arena_category="Fitness",
            caption="Completed 10K around the park!"
        )
        assert result["is_valid"] is True
        assert result["anti_cheat_passed"] is True
        assert result["confidence_score"] >= 0.70
        assert result["ai_status"] == "verified"
        assert "Fitness" in result["audit_message"] or "verified" in result["audit_message"].lower()


def test_ai_verification_heuristic_fallback_link():
    """Verify heuristic link proof validation for high-trust habit domains."""
    with patch.object(settings, "GEMINI_API_KEY", None):
        result = ai_verification_service.audit_submission(
            proof_type="link",
            proof_url="https://github.com/user/daily-leetcode/commit/12345",
            arena_title="LeetCode Daily",
            arena_category="Coding",
            caption="Solved Hard DP Problem"
        )
        assert result["is_valid"] is True
        assert result["confidence_score"] >= 0.85
        assert result["ai_status"] == "verified"


def test_ai_verification_heuristic_empty_proof_flagged():
    """Verify that invalid/empty payloads fail anti-cheat validation."""
    with patch.object(settings, "GEMINI_API_KEY", None):
        result = ai_verification_service.audit_submission(
            proof_type="text",
            proof_url="short",
            arena_title="Daily Journaling"
        )
        assert result["is_valid"] is False
        assert result["anti_cheat_passed"] is False
        assert result["confidence_score"] < 0.70
        assert result["ai_status"] in ["flagged_suspicious", "rejected"]


def test_gemini_vision_multimodal_successful_verification():
    """Verify multimodal Gemini 1.5 Flash inspection when API responds with structured JSON."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "is_valid": True,
                                "confidence_score": 0.96,
                                "status": "verified",
                                "audit_notes": "Identified active treadmill console with 5.2 km distance logged."
                            })
                        }
                    ]
                }
            }
        ]
    }

    with patch.object(settings, "GEMINI_API_KEY", "test_gemini_api_key_123"):
        with patch("httpx.Client.post", return_value=mock_response):
            result = ai_verification_service.audit_submission(
                proof_type="image",
                proof_url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                arena_title="5K Treadmill Run",
                arena_category="Fitness",
                arena_description="Run at least 5 kilometers daily",
                caption="Finished in 27 minutes!"
            )
            assert result["is_valid"] is True
            assert result["anti_cheat_passed"] is True
            assert result["confidence_score"] == 0.96
            assert result["ai_status"] == "verified"
            assert "treadmill console" in result["audit_message"].lower()
            assert result["verifier_type"] == "Gemini15FlashMultimodal"


def test_gemini_vision_anti_cheat_suspicious_flag():
    """Verify that Gemini detects suspicious/unrelated proof and flags it."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "is_valid": False,
                                "confidence_score": 0.35,
                                "status": "flagged_suspicious",
                                "audit_notes": "Stock photo watermark detected; no physical gym environment visible."
                            })
                        }
                    ]
                }
            }
        ]
    }

    with patch.object(settings, "GEMINI_API_KEY", "test_gemini_api_key_123"):
        with patch("httpx.Client.post", return_value=mock_response):
            result = ai_verification_service.audit_submission(
                proof_type="image",
                proof_url="https://example.com/fake_stock.jpg",
                arena_title="Heavy Bench Press",
                arena_category="Fitness",
                caption="Just benched 100kg"
            )
            assert result["is_valid"] is False
            assert result["anti_cheat_passed"] is False
            assert result["confidence_score"] == 0.35
            assert result["ai_status"] == "flagged_suspicious"
            assert "stock photo" in result["audit_message"].lower()


def test_gemini_vision_api_failure_graceful_fallback():
    """Verify that if the Gemini endpoint times out or errors, it falls back seamlessly."""
    with patch.object(settings, "GEMINI_API_KEY", "test_gemini_api_key_123"):
        with patch("httpx.Client.post", side_effect=Exception("API Connection Timeout")):
            result = ai_verification_service.audit_submission(
                proof_type="image",
                proof_url="https://example.com/workout.png",
                arena_title="Daily Pushups",
                arena_category="Fitness",
                caption="30 pushups done"
            )
            # Should not raise exception; fallback heuristic handles it
            assert result["is_valid"] is True
            assert result["confidence_score"] >= 0.70
            assert result["ai_status"] == "verified"
            assert "AI Auto-Audit" in result["audit_message"]
