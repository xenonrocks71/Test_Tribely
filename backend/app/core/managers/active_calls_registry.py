"""
Global Real-Time Arena Calls Registry.
Maintains live concurrent group calls state (Voice Huddles & HD Video Calls) per Arena room.
Guarantees WhatsApp-style call concurrency so all users joining an arena enter the SAME active call session.
Session remains ACTIVE as long as at least 1 participant is inside the call.
"""

import time
from typing import Dict, Any, Optional


class ActiveCallsRegistry:
    def __init__(self):
        # Maps arena_id -> active call dict metadata
        self._active_calls: Dict[int, Dict[str, Any]] = {}

    def get_active_call(self, arena_id: Any) -> Optional[Dict[str, Any]]:
        try:
            aid = int(arena_id)
        except (ValueError, TypeError):
            aid = arena_id
        call = self._active_calls.get(aid)
        if call and call.get("active", False):
            return call
        return None

    def start_or_join_call(
        self,
        arena_id: Any,
        caller_id: int,
        caller_name: str,
        call_type: str = "audio"
    ) -> Dict[str, Any]:
        """
        Starts a new audio call or joins an existing call session in the arena.
        Guarantees only ONE active call session exists per arena room.
        """
        try:
            aid = int(arena_id)
        except (ValueError, TypeError):
            aid = arena_id

        existing = self.get_active_call(aid)
        if existing:
            if caller_id not in existing["participants"]:
                existing["participants"].append(caller_id)
                existing.setdefault("participants_info", []).append({
                    "user_id": caller_id,
                    "user_name": caller_name,
                    "joined_at": time.time(),
                    "is_muted": False,
                    "is_hand_raised": False
                })
            return existing

        new_call = {
            "active": True,
            "arena_id": aid,
            "call_type": call_type,
            "caller_id": caller_id,
            "caller_name": caller_name,
            "started_at": time.time(),
            "participants": [caller_id],
            "participants_info": [{
                "user_id": caller_id,
                "user_name": caller_name,
                "joined_at": time.time(),
                "is_muted": False,
                "is_hand_raised": False
            }]
        }
        self._active_calls[aid] = new_call
        return new_call

    def toggle_mute(self, arena_id: Any, user_id: int, is_muted: bool) -> Optional[Dict[str, Any]]:
        call = self.get_active_call(arena_id)
        if not call:
            return None
        for p in call.get("participants_info", []):
            if p["user_id"] == user_id:
                p["is_muted"] = is_muted
                break
        return call

    def toggle_hand(self, arena_id: Any, user_id: int, is_hand_raised: bool) -> Optional[Dict[str, Any]]:
        call = self.get_active_call(arena_id)
        if not call:
            return None
        for p in call.get("participants_info", []):
            if p["user_id"] == user_id:
                p["is_hand_raised"] = is_hand_raised
                break
        return call

    def leave_call(self, arena_id: Any, caller_id: int) -> Optional[Dict[str, Any]]:
        """
        Removes caller from active participants.
        Call session STAYS ACTIVE as long as at least 1 user remains!
        If 0 participants remain, call session officially ends.
        """
        try:
            aid = int(arena_id)
        except (ValueError, TypeError):
            aid = arena_id

        if aid in self._active_calls:
            call = self._active_calls[aid]
            if caller_id in call["participants"]:
                call["participants"].remove(caller_id)
            call["participants_info"] = [p for p in call.get("participants_info", []) if p["user_id"] != caller_id]

            if len(call["participants"]) > 0:
                return call
            else:
                # 0 participants left -> close call session
                ended_call = self._active_calls.pop(aid)
                ended_call["active"] = False
                return None
        return None

    def force_end_call(self, arena_id: Any, admin_user_id: int) -> Optional[Dict[str, Any]]:
        """
        Admin action: Terminate an ongoing call session for all participants immediately.
        """
        try:
            aid = int(arena_id)
        except (ValueError, TypeError):
            aid = arena_id

        if aid in self._active_calls:
            ended_call = self._active_calls.pop(aid)
            ended_call["active"] = False
            ended_call["ended_by"] = admin_user_id
            return ended_call
        return None

    def end_call(self, arena_id: int, caller_id: int) -> Optional[Dict[str, Any]]:
        return self.leave_call(arena_id, caller_id)


active_calls_registry = ActiveCallsRegistry()
