"""
Unit Tests for Binary Media File Upload API Route (/upload/file).
"""

import io
import pytest
from fastapi.testclient import TestClient
from main import app
from app.api.deps import get_current_user
from app.models.models import User

client = TestClient(app)

def mock_get_current_user():
    return User(id=1, email="testmediauser@example.com", full_name="Test Media User")

@pytest.fixture(autouse=True)
def setup_teardown_media_user():
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()


def test_image_file_binary_upload():
    """
    Test binary image file upload via multipart/form-data.
    """
    image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("test_chat_image.png", io.BytesIO(image_bytes), "image/png")}

    response = client.post("/upload/file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "static/uploads" in data["url"]
    assert data["filename"] == "test_chat_image.png"


def test_audio_voice_note_binary_upload():
    """
    Test audio voice note (.webm) binary upload via multipart/form-data.
    """
    audio_bytes = b"1A45DFA3010000000000001F4286810142F7810142F2810442F381084282847765626D"
    files = {"file": ("voice_note_123.webm", io.BytesIO(audio_bytes), "audio/webm")}

    response = client.post("/upload/file", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "static/uploads" in data["url"]
    assert data["filename"] == "voice_note_123.webm"
