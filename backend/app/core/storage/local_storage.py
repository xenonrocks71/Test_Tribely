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

    def __init__(self, upload_dir: str = "static/uploads", base_url: str = None) -> None:
        """
        Initialize LocalStorageService with target storage folder and dynamic cloud public URL.

        :param upload_dir: Relative or absolute disk directory.
        :param base_url: Public base URL prefix for serving static files.
        """
        self.upload_dir = upload_dir
        if base_url:
            self.base_url = base_url
        else:
            backend_url = os.getenv("BACKEND_PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL")
            if not backend_url and os.getenv("ENVIRONMENT", "").lower() == "production":
                backend_url = "https://tribely-backend.onrender.com"
            self.base_url = f"{backend_url.rstrip('/')}/static/uploads" if backend_url else "/static/uploads"
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Persist raw binary bytes to local disk.

        :param file_bytes: File contents.
        :param filename: Original filename.
        :param content_type: MIME type.
        :return: Public local URL string.
        """
        ext = os.path.splitext(filename)[1] or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(self.upload_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return self.get_public_url(unique_name)

    def generate_presigned_upload_url(self, object_name: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Simulate presigned upload endpoint for local development testing.

        :param object_name: Object identifier.
        :param expiration: Expiration window.
        :return: Dict containing target upload endpoint.
        """
        return {
            "upload_url": f"{self.base_url}/{object_name}",
            "method": "PUT",
            "fields": {},
            "expiration": expiration
        }

    def get_public_url(self, object_name: str) -> str:
        """
        Construct local static public URL string.

        :param object_name: Disk filename.
        :return: Accessible static URL string.
        """
        return f"{self.base_url}/{object_name}"
