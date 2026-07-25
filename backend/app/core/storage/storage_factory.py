"""
Storage Factory Implementation.
Provides factory method instantiating target BaseStorageService engine based on environment configuration.
"""

import os
from app.core.storage.base_storage import BaseStorageService
from app.core.storage.local_storage import LocalStorageService
from app.core.storage.s3_storage import S3StorageService


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
            provider = os.getenv("STORAGE_PROVIDER", "local").lower()
            if provider == "s3":
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
