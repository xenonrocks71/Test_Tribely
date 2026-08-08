"""
Razorpay Payment API Router & Webhook Handler.
Handles UPI AutoPay Mandate Order creation for Next.js checkout, and verifies Razorpay webhook signatures.
"""

import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.models import User, UserWallet, Arena
from app.services.razorpay_service import razorpay_service

router = APIRouter(prefix="/api/payments", tags=["Razorpay Native Payments"])
logger = logging.getLogger(__name__)


def success_response(data: Any) -> Dict[str, Any]:
    return {"status": "success", "data": data}


class MandateCreateRequest(BaseModel):
    arena_id: int
    max_amount_inr: float = 500.0
    upi_vpa: Optional[str] = None


@router.post("/mandate/create")
def create_upi_autopay_mandate(
    payload: MandateCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generates Razorpay UPI AutoPay mandate order token for Next.js Checkout integration.
    """
    arena = db.query(Arena).filter(Arena.id == payload.arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"status": "error", "message": "Arena room not found.", "error_code": "ARENA_NOT_FOUND"}
        )

    try:
        if payload.upi_vpa:
            wallet = razorpay_service.get_or_create_user_wallet(db, current_user.id)
            wallet.upi_vpa = payload.upi_vpa.strip()
            db.commit()

        penalty_amount = float(arena.penalty_amount) if arena.penalty_amount else payload.max_amount_inr
        res = razorpay_service.create_upi_mandate(
            db=db,
            user=current_user,
            arena_id=payload.arena_id,
            max_amount_inr=penalty_amount
        )
        return success_response(res)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"status": "error", "message": f"Failed creating UPI AutoPay mandate: {str(e)}", "error_code": "MANDATE_CREATION_FAILED"}
        )


@router.post("/webhook")
async def handle_razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature")
) -> Dict[str, Any]:
    """
    Razorpay Webhook endpoint handling recurring AutoPay events:
    - subscription.authenticated: Marks UserWallet mandate as active.
    - payment.captured: Confirms successful off-session penalty debit.
    - payment.failed: Flags UserWallet pending_penalty = True.
    """
    raw_body = await request.body()
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "rzp_test_webhooksecret123")

    if x_razorpay_signature and secret:
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, x_razorpay_signature):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay Webhook signature."
            )

    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        event_type = payload.get("event", "")
        payload_entity = payload.get("payload", {})

        logger.info(f"Razorpay webhook event received: {event_type}")

        if event_type in ["subscription.authenticated", "subscription.charged"]:
            sub = payload_entity.get("subscription", {}).get("entity", {})
            sub_id = sub.get("id")
            cust_id = sub.get("customer_id")

            if cust_id or sub_id:
                wallet = db.query(UserWallet).filter(
                    (UserWallet.razorpay_customer_id == cust_id) | (UserWallet.mandate_id == sub_id)
                ).first()
                if wallet:
                    wallet.mandate_status = "active"
                    wallet.pending_penalty = False
                    db.commit()

        elif event_type == "payment.failed":
            pay = payload_entity.get("payment", {}).get("entity", {})
            cust_id = pay.get("customer_id")
            if cust_id:
                wallet = db.query(UserWallet).filter(UserWallet.razorpay_customer_id == cust_id).first()
                if wallet:
                    wallet.pending_penalty = True
                    db.commit()

        return {"status": "success", "event_processed": event_type}
    except Exception as e:
        logger.error(f"Error handling Razorpay webhook: {e}")
        return {"status": "error", "message": str(e)}
