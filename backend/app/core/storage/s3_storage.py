"""
AWS S3 / Cloudflare R2 Media Storage Engine Implementation.
Generates presigned upload/download URLs using boto3 for direct browser-to-S3 high-throughput transfers.
"""

from typing import Dict, Any, Optional
from app.core.storage.base_storage import BaseStorageService

try:
    import boto3
    from botocore.config import Config
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False


class S3StorageService(BaseStorageService):
    """
    Concrete AWS S3 / Cloudflare R2 implementation of BaseStorageService.
    """

    def __init__(
        self,
        bucket_name: str = "tribely-proof-media",
        region_name: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None
    ) -> None:
        """
        Initialize S3StorageService credentials and client instance.

        :param bucket_name: S3 bucket name.
        :param region_name: AWS Region string.
        :param aws_access_key_id: Access key credential.
        :param aws_secret_access_key: Secret key credential.
        :param endpoint_url: Optional custom S3 endpoint (for Cloudflare R2 or MinIO).
        """
        self.bucket_name = bucket_name
        self.region_name = region_name
        self.endpoint_url = endpoint_url

        if HAS_BOTO3 and aws_access_key_id and aws_secret_access_key:
            self.s3_client = boto3.client(
                "s3",
                region_name=region_name,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                endpoint_url=endpoint_url,
                config=Config(signature_version="s3v4")
            )
        else:
            self.s3_client = None

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Upload binary bytes directly to S3 bucket.

        :param file_bytes: Binary payload.
        :param filename: Object key.
        :param content_type: MIME content type.
        :return: Public S3 object URL string.
        """
        if not self.s3_client:
            raise RuntimeError("Boto3 or AWS credentials not configured for S3StorageService.")

        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=filename,
            Body=file_bytes,
            ContentType=content_type
        )
        return self.get_public_url(filename)

    def generate_presigned_upload_url(self, object_name: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Generate presigned URL allowing client to PUT object directly to S3.

        :param object_name: Destination S3 key name.
        :param expiration: Expiry window in seconds.
        :return: Dict containing upload URL and method.
        """
        if not self.s3_client:
            raise RuntimeError("Boto3 or AWS credentials not configured for S3StorageService.")

        url = self.s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket_name, "Key": object_name},
            ExpiresIn=expiration
        )
        return {
            "upload_url": url,
            "method": "PUT",
            "object_name": object_name,
            "expiration": expiration
        }

    def get_public_url(self, object_name: str) -> str:
        """
        Construct accessible S3 public object URL.

        :param object_name: Key identifier.
        :return: Accessible HTTP/HTTPS URL string.
        """
        if self.endpoint_url:
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        return f"https://{self.bucket_name}.s3.{self.region_name}.amazonaws.com/{object_name}"
