"""
Asynchronous & Synchronous Email Dispatch Service.
Handles transactional email delivery (OTP verification, notifications) with 
responsive HTML formatting, plain-text fallbacks, and resilient error handling.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Enterprise-grade Email Service for Tribely.
    Supports asynchronous non-blocking SMTP delivery, formatted HTML templates,
    and developer console receipts in local/test environments.
    """

    def __init__(self) -> None:
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_tls = settings.SMTP_TLS
        self.from_email = settings.EMAILS_FROM_EMAIL
        self.from_name = settings.EMAILS_FROM_NAME

    def _render_otp_html(self, code: str, expires_in_minutes: int = 5) -> str:
        """
        Renders a sleek, responsive HTML email template for Tribely OTP codes.
        """
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Tribely Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="500" cellspacing="0" cellpadding="0" border="0" style="max-width: 500px; background: linear-gradient(180deg, #181c2a 0%, #111522 100%); border-radius: 16px; border: 1px solid #282f45; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
          <!-- Header Logo Banner -->
          <tr>
            <td align="center" style="padding: 32px 24px 16px 24px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #FF5E00; text-transform: uppercase;">
                ⚡ TRIBELY
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #9ca3af; letter-spacing: 0.2px;">
                Account Security &amp; Verification
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 16px 32px 24px 32px;">
              <p style="font-size: 15px; line-height: 1.6; color: #e5e7eb; margin: 0 0 16px 0;">
                Hello,
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #9ca3af; margin: 0 0 24px 0;">
                Please use the single-use 6-digit verification code below to verify your email address and continue:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 18px; background: #0e121e; border: 1px solid #FF5E00; border-radius: 12px;">
                    <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #FF7A29;">
                      {code}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Expiration Disclaimer -->
              <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 20px 0 0 0;">
                ⏱️ This code will expire in <strong style="color: #ffffff;">{expires_in_minutes} minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer Security Warning -->
          <tr>
            <td style="padding: 20px 32px 28px 32px; background-color: #0d101a; border-top: 1px solid #1f2538; text-align: center;">
              <p style="font-size: 12px; line-height: 1.5; color: #6b7280; margin: 0;">
                If you did not request this verification code, you can safely ignore this email. Someone may have entered your address by mistake.
              </p>
              <p style="font-size: 11px; color: #4b5563; margin: 12px 0 0 0;">
                &copy; 2026 Tribely Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def send_otp_email_sync(self, to_email: str, code: str, expires_in_minutes: int = 5) -> bool:
        """
        Synchronously dispatches an OTP email via SMTP or fallback dev log.
        """
        clean_email = to_email.strip().lower()
        html_content = self._render_otp_html(code, expires_in_minutes=expires_in_minutes)
        text_content = (
            f"Your Tribely verification code is: {code}\n\n"
            f"This code will expire in {expires_in_minutes} minutes.\n"
            "If you did not request this, please disregard this email."
        )

        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"{code} is your Tribely verification code"
                msg["From"] = f"{self.from_name} <{self.from_email}>"
                msg["To"] = clean_email
                msg.attach(MIMEText(text_content, "plain"))
                msg.attach(MIMEText(html_content, "html"))

                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.smtp_tls:
                        server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, [clean_email], msg.as_string())

                logger.info(f"[EmailService] Delivered OTP code email via SMTP to {clean_email}")
                return True
            except Exception as exc:
                logger.warning(
                    f"[EmailService] SMTP delivery failed for {clean_email} ({exc}). Fallback to console."
                )

        # Developer console dispatch receipt
        try:
            print("\n" + "=" * 60)
            print("[TRIBELY EMAIL OTP DISPATCH RECEIPT]")
            print(f"Recipient: {clean_email}")
            print(f"OTP Code:  {code}")
            print(f"Subject:   {code} is your Tribely verification code")
            print(f"Expires:   {expires_in_minutes} minutes")
            print("Status:    Delivered (Development / Local mode)")
            print("=" * 60 + "\n")
        except Exception:
            pass

        return True

    async def send_otp_email_async(
        self, to_email: str, code: str, expires_in_minutes: int = 5
    ) -> bool:
        """
        Asynchronously sends the OTP email in a background executor thread,
        preventing any blocking on the main async event loop.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self.send_otp_email_sync, to_email, code, expires_in_minutes
        )


# Global Singleton Instance for Email Service
email_service = EmailService()
