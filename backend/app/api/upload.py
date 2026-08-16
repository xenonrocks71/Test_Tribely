"""
High-Throughput Storage & Presigned Upload API Route.
Enables clients to upload media directly to S3/CDN, bypassing application servers.
"""

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel, Field
from typing import Dict, Any
from app.api.deps import get_current_user
from app.models.models import User
from app.core.storage.storage_factory import StorageFactory

router = APIRouter(prefix="/upload", tags=["Storage & Media Pipeline"])


@router.post("/file")
def upload_binary_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload raw binary media file (image, audio, document) and return public access URL.
    """
    try:
        storage = StorageFactory.get_storage_engine()
        file_bytes = file.file.read()
        public_url = storage.upload_file(
            file_bytes=file_bytes,
            filename=file.filename or "upload.bin",
            content_type=file.content_type or "application/octet-stream"
        )
        return {
            "status": "success",
            "url": public_url,
            "filename": file.filename,
            "content_type": file.content_type
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload media file: {str(e)}"
        )


class PresignRequest(BaseModel):
    filename: str = Field(..., description="Target file name with extension")
    file_type: str = Field("image/jpeg", description="MIME type of the media payload")


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    object_key: str


@router.post("/presign", response_model=PresignResponse)
def generate_presigned_upload_url(
    payload: PresignRequest,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generate a presigned upload URL for direct-to-cloud media upload.

    :param payload: PresignRequest containing filename and file_type.
    :param current_user: Authenticated active user.
    :return: PresignResponse containing upload_url and public_url.
    """
    try:
        storage = StorageFactory.get_storage_engine()
        presign_data = storage.generate_presigned_url(
            filename=payload.filename,
            file_type=payload.file_type
        )
        return presign_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned storage URL: {str(e)}"
        )
