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


MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB hard limit to prevent OOM/DoS attacks

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav",
    "application/pdf"
}


def validate_file_signature(file_bytes: bytes, mime_type: str) -> bool:
    """Validates magic bytes to prevent malicious file execution."""
    if not file_bytes:
        return False
    if mime_type in ["image/jpeg", "image/jpg"]:
        return file_bytes.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/gif":
        return file_bytes.startswith(b"GIF87a") or file_bytes.startswith(b"GIF89a")
    if mime_type == "image/webp":
        return len(file_bytes) > 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP"
    if mime_type in ["audio/webm", "video/webm"]:
        return file_bytes.startswith(b"\x1a\x45\xdf\xa3") or file_bytes.startswith(b"1A45DFA3")
    if mime_type == "application/pdf":
        return file_bytes.startswith(b"%PDF-")
    # For general audio types with variable containers, allow if MIME type is recognized
    return True


@router.post("/file")
async def upload_binary_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Upload raw binary media file with strict size limits, MIME verification, and async I/O.
    """
    content_type = (file.content_type or "application/octet-stream").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. Allowed types: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
        )

    try:
        # Read file asynchronously without blocking the event loop
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
            )

        if not validate_file_signature(file_bytes, content_type):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match reported MIME type header."
            )

        storage = StorageFactory.get_storage_engine()
        public_url = storage.upload_file(
            file_bytes=file_bytes,
            filename=file.filename or "upload.bin",
            content_type=content_type
        )
        return {
            "status": "success",
            "url": public_url,
            "filename": file.filename,
            "content_type": content_type
        }
    except HTTPException:
        raise
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
