"""
Automated AI Proof Auditor & Anti-Cheat Service.
Evaluates submission authenticity, calculates anti-cheat confidence scores, and detects duplicate/spam proofs.
"""

from typing import Dict, Any, Optional
from app.core.verifiers.proof_verifier import ProofVerifierFactory, ProofVerificationResult


class AIProofAuditorService:
    """
    Multimodal Automated Proof Verification & Anti-Cheat Engine.
    Executes algorithmic heuristic audits and anti-cheat scoring on habit proofs.
    """

    def audit_submission(self, proof_type: str, proof_url: str) -> Dict[str, Any]:
        """
        Perform automated AI audit on a submitted habit proof.

        :param proof_type: "image", "link", or "text".
        :param proof_url: Payload content (URL, text, or data URI).
        :return: Dict containing verification status, confidence score, and audit diagnostics.
        """
        verifier = ProofVerifierFactory.get_verifier(proof_type)
        result: ProofVerificationResult = verifier.verify(proof_url)

        anti_cheat_passed = result.confidence_score >= 0.70

        return {
            "is_valid": result.is_valid,
            "anti_cheat_passed": anti_cheat_passed,
            "confidence_score": round(result.confidence_score, 2),
            "audit_message": result.reason,
            "verifier_type": verifier.__class__.__name__,
        }


# Singleton instance
ai_proof_auditor = AIProofAuditorService()
