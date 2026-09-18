"""
Supabase Object Storage Service Implementation.
Uploads user media (proofs, avatars) directly to Supabase Storage buckets via high-speed REST API.
Operates server-side with service-role credentials; zero secrets exposed to client browsers.
"""

import os
import uuid
import logging
from typing import Dict, Any, Optional
import httpx
from app.core.storage.base_storage import BaseStorageService

logger = logging.getLogger(__name__)


class SupabaseStorageService(BaseStorageService):
    """
    Concrete Supabase Object Storage implementation of BaseStorageService.
    Eliminates reliance on Render's ephemeral disk by persisting media to Supabase CDN.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        bucket_name: str = "tribely-proofs"
    ) -> None:
        """
        Initialize Supabase Storage client credentials.

        :param supabase_url: Base Supabase project URL (e.g. https://xyz.supabase.co).
        :param service_role_key: Supabase secret service-role key (server-side only).
        :param bucket_name: Storage bucket name (default: 'tribely-proofs').
        """
        self.supabase_url = (supabase_url or "").rstrip("/")
        self.service_role_key = (service_role_key or "").strip()
        self.bucket_name = bucket_name.strip()

    def is_configured(self) -> bool:
        """Check whether valid Supabase Storage credentials are present."""
        return bool(self.supabase_url and self.service_role_key)

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Upload raw binary media directly to Supabase Storage bucket.

        :param file_bytes: Binary payload.
        :param filename: Target destination path or filename hint.
        :param content_type: Verified MIME content type.
        :return: Public CDN URL string of the stored asset.
        """
        if not self.is_configured():
            raise RuntimeError("Supabase Storage credentials not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).")

        clean_path = filename.replace("\\", "/").strip("/")
        parts = [p for p in clean_path.split("/") if p and p != ".."]
        if not parts:
            parts = ["media", f"{uuid.uuid4().hex}.jpg"]
        elif len(parts) == 1:
            ext = os.path.splitext(parts[0])[1] or ".jpg"
            parts = ["media", f"{uuid.uuid4().hex}{ext}"]

        object_key = "/".join(parts)
        endpoint = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{object_key}"
        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(endpoint, content=file_bytes, headers=headers)
                if resp.status_code not in (200, 201):
                    raise RuntimeError(f"Supabase storage upload failed with HTTP {resp.status_code}: {resp.text}")
            return self.get_public_url(object_key)
        except Exception as e:
            logger.error(f"Supabase storage upload error: {e}")
            raise

    def generate_presigned_upload_url(self, object_name: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Generate signed direct-to-cloud upload URL for direct browser uploads.

        :param object_name: Destination storage key.
        :param expiration: URL validity window in seconds.
        :return: Dict containing upload_url, public_url, and method.
        """
        if not self.is_configured():
            raise RuntimeError("Supabase Storage credentials not configured.")

        clean_object = object_name.lstrip("/")
        endpoint = f"{self.supabase_url}/storage/v1/object/upload/sign/{self.bucket_name}/{clean_object}"
        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }
        payload = {"expiresIn": expiration}

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(endpoint, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    rel_url = data.get("url", "")
                    upload_url = f"{self.supabase_url}{rel_url}" if rel_url.startswith("/") else rel_url
                else:
                    upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{clean_object}"
        except Exception:
            upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{clean_object}"

        return {
            "upload_url": upload_url,
            "public_url": self.get_public_url(clean_object),
            "object_name": clean_object,
            "method": "PUT",
            "expiration": expiration
        }

    def get_public_url(self, object_name: str) -> str:
        """
        Construct the permanent public CDN URL for an asset.

        :param object_name: Key identifier.
        :return: Full HTTPS public URL string.
        """
        clean_name = object_name.lstrip("/")
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{clean_name}"
