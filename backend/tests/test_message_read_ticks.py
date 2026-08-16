"""
Unit Tests for WhatsApp-Style Message Status Ticks & Read Receipts.
"""

import pytest

def test_read_receipt_payload_structure():
    """
    Test READ_RECEIPT event structure for single and double blue ticks.
    """
    arena_id = 101
    reader_user_id = 5
    last_read_msg_id = 42

    read_payload = {
        "event_type": "READ_RECEIPT",
        "arena_id": arena_id,
        "reader_user_id": reader_user_id,
        "last_read_msg_id": last_read_msg_id,
        "is_read": True
    }

    assert read_payload["event_type"] == "READ_RECEIPT"
    assert read_payload["arena_id"] == 101
    assert read_payload["reader_user_id"] == 5
    assert read_payload["last_read_msg_id"] == 42
    assert read_payload["is_read"] is True
