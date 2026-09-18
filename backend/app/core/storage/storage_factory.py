"""
Storage Factory Implementation.
Provides factory method instantiating target BaseStorageService engine based on environment configuration.
"""

import os
from app.core.storage.base_storage import BaseStorageService
from app.core.storage.local_storage import LocalStorageService
from app.core.storage.s3_storage import S3StorageService
from app.core.storage.supabase_storage import SupabaseStorageService


class StorageFactory:
    """
    Factory class providing singleton instance of active Object Storage Engine.
    """

    _instance: BaseStorageService = None

    @classmethod
    def get_storage_engine(cls) -> BaseStorageService:
        """
        Instantiate or return cached storage engine instance.

        :return: BaseStorageService concrete implementation.
        """
        if cls._instance is None:
            provider = os.getenv("STORAGE_PROVIDER", "").lower()
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

            if provider == "supabase" or (provider != "local" and provider != "s3" and supabase_url and supabase_key):
                cls._instance = SupabaseStorageService(
                    supabase_url=supabase_url,
                    service_role_key=supabase_key,
                    bucket_name=os.getenv("SUPABASE_STORAGE_BUCKET", "tribely-proofs")
                )
            elif provider == "s3":
                cls._instance = S3StorageService(
                    bucket_name=os.getenv("S3_BUCKET_NAME", "tribely-proof-media"),
                    region_name=os.getenv("AWS_REGION", "us-east-1"),
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                    endpoint_url=os.getenv("S3_ENDPOINT_URL")
                )
            else:
                cls._instance = LocalStorageService()
        return cls._instance



# Global Singleton Storage Instance
storage_engine = StorageFactory.get_storage_engine()

import base64
import logging
import uuid
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
}


def offload_base64_media(
    media_data_or_url: str,
    folder_prefix: str = "proofs",
    max_bytes: int = 10 * 1024 * 1024
) -> str:
    """
    Decodes base64 Data URIs, validates size and MIME types, persists binary media to
    the active Object Storage engine (Supabase Storage in production, Local in dev),
    and returns the permanent accessible URL.

    If media_data_or_url is already a normal URL or relative path, it is returned unchanged.
    """
    cleaned = (media_data_or_url or "").strip()
    if not cleaned or not cleaned.startswith("data:"):
        return cleaned

    if ";base64," not in cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "error", "message": "Corrupted or malformed base64 media payload."}
        )

    header, encoded = cleaned.split(";base64,", 1)
    mime_type = header.replace("data:", "").strip().lower()

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "message": f"Unsupported media type '{mime_type}'. Supported: JPEG, PNG, WebP, GIF, MP4, WebM."
            }
        )

    # Coarse size check on base64 string length (~4/3 overhead)
    if len(encoded) > int(max_bytes * 1.45):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"status": "error", "message": f"Uploaded file exceeds maximum permitted size of {max_bytes // (1024 * 1024)} MB."}
        )

    try:
        file_bytes = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "error", "message": "Invalid base64 encoding in media upload."}
        )

    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"status": "error", "message": f"Uploaded file exceeds maximum permitted size of {max_bytes // (1024 * 1024)} MB."}
        )

    ext = ALLOWED_MIME_TYPES[mime_type]
    clean_folder = folder_prefix.replace("\\", "/").strip("/")
    filename = f"{clean_folder}/{uuid.uuid4().hex}{ext}"

    engine = StorageFactory.get_storage_engine()
    try:
        return engine.upload_file(file_bytes=file_bytes, filename=filename, content_type=mime_type)
    except Exception as e:
        logger.error(f"[StorageFactory] Failed to offload base64 media to storage: {e}")
        if not isinstance(engine, LocalStorageService):
            try:
                local_engine = LocalStorageService()
                return local_engine.upload_file(file_bytes=file_bytes, filename=filename, content_type=mime_type)
            except Exception as le:
                logger.error(f"[StorageFactory] Local fallback also failed: {le}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "message": "Media storage service is temporarily unavailable. Please try again."}
        )
