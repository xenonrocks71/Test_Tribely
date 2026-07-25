"""
Abstract Storage Service Interface.
Defines mandatory contracts for Object Storage engines (Local, AWS S3, Cloudflare R2).
Designed for high throughput, modularity, and zero vendor lock-in.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class BaseStorageService(ABC):
    """
    Abstract Base Class for Object Storage engines.
    """

    @abstractmethod
    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Upload raw file binary bytes to target storage provider.

        :param file_bytes: Binary contents of file.
        :param filename: Original or destination filename string.
        :param content_type: MIME type (e.g. image/jpeg, image/png).
        :return: Accessible public URL string of uploaded object.
        """
        pass

    @abstractmethod
    def generate_presigned_upload_url(self, object_name: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Generate a presigned upload URL enabling client-side direct uploads.

        :param object_name: Destination key / path string.
        :param expiration: Expiry window in seconds (default 3600s = 1 hour).
        :return: Dict containing upload URL and required headers/fields.
        """
        pass

    @abstractmethod
    def get_public_url(self, object_name: str) -> str:
        """
        Construct accessible public URL for a given object key.

        :param object_name: Unique key identifier of stored object.
        :return: Full HTTP/HTTPS public URL string.
        """
        pass
