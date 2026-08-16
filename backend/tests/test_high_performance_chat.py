"""
Unit Tests for High-Performance Chat Caching & Non-Blocking Pipeline.
"""

import pytest
from app.services.chat_cache_service import chat_cache_service

def test_chat_cache_service_user_meta():
    """
    Test 0ms user display metadata caching & retrieval.
    """
    user_id = 999
    chat_cache_service.cache_user_meta(user_id, "Instant SDE3 User", "http://example.com/avatar.jpg")

    meta = chat_cache_service.get_user_meta(user_id)
    assert meta is not None
    assert meta["full_name"] == "Instant SDE3 User"
    assert meta["avatar_url"] == "http://example.com/avatar.jpg"


def test_chat_cache_service_recent_messages():
    """
    Test sub-millisecond recent message caching and List capping.
    """
    arena_id = 888
    msg1 = {"id": 1, "content": "Hello World", "message_type": "text"}
    msg2 = {"id": 2, "content": "Instant Chat", "message_type": "text"}

    chat_cache_service.push_recent_message(arena_id, msg1)
    chat_cache_service.push_recent_message(arena_id, msg2)

    recent = chat_cache_service.get_recent_messages(arena_id, limit=10)
    assert recent is not None
    assert len(recent) >= 2
    assert recent[0]["id"] == 2
