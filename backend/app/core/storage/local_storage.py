"""
Local File System Storage Engine Implementation.
Persists uploaded media assets to local disk directories and serves public URLs for development.
"""

import os
import uuid
from typing import Dict, Any
from app.core.storage.base_storage import BaseStorageService


class LocalStorageService(BaseStorageService):
    """
    Concrete Local File System implementation of BaseStorageService.
    """

    def __init__(self, upload_dir: str = None, base_url: str = None) -> None:
        """
        Initialize LocalStorageService with target storage folder and dynamic cloud public URL.

        :param upload_dir: Relative or absolute disk directory.
        :param base_url: Public base URL prefix for serving static files.
                         Use None to store relative paths (recommended for local dev with Next.js proxy).
        """
        if upload_dir:
            self.upload_dir = upload_dir
        else:
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            self.upload_dir = os.path.join(backend_root, "static", "uploads")

        if base_url:
            self.base_url = base_url
        else:
            backend_url = os.getenv("BACKEND_PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL")
            if not backend_url and os.getenv("ENVIRONMENT", "").lower() == "production":
                # In production, use the absolute backend URL
                backend_url = "https://tribely-backend.onrender.com"
                self.base_url = f"{backend_url.rstrip('/')}/static/uploads"
            else:
                # In local dev: store relative paths so Next.js proxy rewrites serve them correctly
                self.base_url = "/static/uploads"
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Persist raw binary bytes to local disk.

        :param file_bytes: File contents.
        :param filename: Original filename or target path.
        :param content_type: MIME type.
        :return: Public local URL string.
        """
        clean_path = filename.replace("\\", "/").strip("/")
        parts = [p for p in clean_path.split("/") if p and p != ".."]
        if not parts:
            parts = [f"{uuid.uuid4().hex}.jpg"]
        
        object_key = "/".join(parts)
        file_path = os.path.join(self.upload_dir, *parts)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return self.get_public_url(object_key)

    def generate_presigned_upload_url(self, object_name: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Simulate presigned upload endpoint for local development testing.

        :param object_name: Object identifier.
        :param expiration: Expiration window.
        :return: Dict containing target upload endpoint.
        """
        clean_name = object_name.replace("\\", "/").strip("/")
        return {
            "upload_url": f"{self.base_url.rstrip('/')}/{clean_name}",
            "method": "PUT",
            "fields": {},
            "expiration": expiration
        }

    def get_public_url(self, object_name: str) -> str:
        """
        Construct local static public URL string.

        :param object_name: Disk filename or relative path.
        :return: Accessible static URL string.
        """
        clean_name = object_name.replace("\\", "/").strip("/")
        return f"{self.base_url.rstrip('/')}/{clean_name}"
