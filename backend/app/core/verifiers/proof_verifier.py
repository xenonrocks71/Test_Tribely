"""
Proof Verification Strategy Pattern Implementation.
Enforces Open-Closed Principle (OCP) for habit proof validation algorithms.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
import re


class ProofVerificationResult:
    """Immutable result value object holding proof verification status and diagnostic notes."""

    def __init__(self, is_valid: bool, reason: str, confidence_score: float = 1.0) -> None:
        self.is_valid = is_valid
        self.reason = reason
        self.confidence_score = confidence_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "reason": self.reason,
            "confidence_score": self.confidence_score,
        }


class ProofVerifierStrategy(ABC):
    """Abstract Strategy interface for proof validation implementations."""

    @abstractmethod
    def verify(self, proof_payload: str) -> ProofVerificationResult:
        """
        Verify a submission proof payload string.

        :param proof_payload: Submission payload (text, URL, or image data).
        :return: ProofVerificationResult.
        """
        pass


class ImageProofVerifier(ProofVerifierStrategy):
    """Strategy verifying photo/image proof submissions (URLs, S3 links, Data URIs)."""

    def verify(self, proof_payload: str) -> ProofVerificationResult:
        if not proof_payload or not proof_payload.strip():
            return ProofVerificationResult(False, "Image proof payload cannot be empty.", 0.0)

        payload = proof_payload.strip()

        # Check Data URI format (data:image/png;base64,...)
        if payload.startswith("data:image/"):
            return ProofVerificationResult(True, "Valid base64 image data URI provided.", 0.95)

        # Check standard HTTP/HTTPS image extensions or S3 storage URLs
        is_url = payload.startswith("http://") or payload.startswith("https://")
        has_img_ext = bool(re.search(r"\.(jpg|jpeg|png|webp|gif)$", payload, re.IGNORECASE))
        is_s3_url = "s3.amazonaws.com" in payload or "storage" in payload

        if is_url and (has_img_ext or is_s3_url):
            return ProofVerificationResult(True, "Valid image proof URL verified.", 0.98)

        if is_url:
            return ProofVerificationResult(True, "Image URL accepted for manual peer audit.", 0.80)

        return ProofVerificationResult(False, "Invalid image proof format. Expected valid image URL or base64 data.", 0.10)


class LinkProofVerifier(ProofVerifierStrategy):
    """Strategy verifying link/URL proof submissions (GitHub, Strava, Medium, LeetCode)."""

    def verify(self, proof_payload: str) -> ProofVerificationResult:
        if not proof_payload or not proof_payload.strip():
            return ProofVerificationResult(False, "Link proof payload cannot be empty.", 0.0)

        payload = proof_payload.strip()
        is_url = payload.startswith("http://") or payload.startswith("https://")

        if not is_url:
            return ProofVerificationResult(False, "Link proof must start with http:// or https://", 0.0)

        # Enhanced domain detection for common habit proof platforms
        high_trust_domains = ["github.com", "strava.com", "medium.com", "leetcode.com", "duolingo.com", "notion.site"]
        confidence = 0.99 if any(domain in payload.lower() for domain in high_trust_domains) else 0.85

        return ProofVerificationResult(True, "Valid external proof URL provided.", confidence)


class TextProofVerifier(ProofVerifierStrategy):
    """Strategy verifying text journal / commitment proof submissions."""

    def verify(self, proof_payload: str) -> ProofVerificationResult:
        if not proof_payload or not proof_payload.strip():
            return ProofVerificationResult(False, "Text proof cannot be empty.", 0.0)

        payload = proof_payload.strip()
        char_count = len(payload)

        if char_count < 10:
            return ProofVerificationResult(False, "Text proof must be at least 10 characters long.", 0.20)

        confidence = 0.95 if char_count >= 30 else 0.75
        return ProofVerificationResult(True, f"Text proof accepted ({char_count} characters).", confidence)


class ProofVerifierFactory:
    """Factory Pattern to instantiate the appropriate ProofVerifierStrategy."""

    _strategies: Dict[str, ProofVerifierStrategy] = {
        "image": ImageProofVerifier(),
        "link": LinkProofVerifier(),
        "text": TextProofVerifier(),
    }

    @classmethod
    def get_verifier(cls, proof_type: str) -> ProofVerifierStrategy:
        """
        Get strategy implementation for the given proof type.

        :param proof_type: "image", "link", or "text".
        :return: Concrete ProofVerifierStrategy instance.
        """
        normalized_type = (proof_type or "text").lower().strip()
        return cls._strategies.get(normalized_type, cls._strategies["text"])
