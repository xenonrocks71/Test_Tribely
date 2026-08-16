"""
SFU (Selective Forwarding Unit) Room Token Generator Service.
Generates secure access tokens for LiveKit/Mediasoup SFU room access.
"""

import time
from typing import Dict, Any, Optional
from jose import jwt
from app.core.config import settings


class SFUTokenService:
    """
    Service generating authenticated SFU room tokens for client WebRTC publishing and subscribing.
    """

    def __init__(self) -> None:
        self.api_key = getattr(settings, "LIVEKIT_API_KEY", "devkey")
        self.api_secret = getattr(settings, "LIVEKIT_API_SECRET", "secretkey_1234567890_tribely_sfu_secret")
        self.sfu_url = getattr(settings, "LIVEKIT_URL", "wss://sfu.tribely.app")

    def generate_sfu_room_token(
        self,
        arena_id: int,
        user_id: int,
        user_name: str,
        can_publish: bool = True,
        can_subscribe: bool = True,
        can_publish_data: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a signed JWT token granting access to the target SFU room.

        :param arena_id: Arena room ID.
        :param user_id: Authenticated user ID.
        :param user_name: Display name of user.
        :param can_publish: Grant permission to publish audio/video/screen tracks.
        :param can_subscribe: Grant permission to subscribe to forwarded tracks.
        :param can_publish_data: Grant permission to send data messages over SFU.
        :return: Dict containing token, SFU URL, room name, identity, and claims.
        """
        room_name = f"arena_{arena_id}"
        identity = f"user_{user_id}"
        now = int(time.time())

        # LiveKit / Standard SFU JWT Claim Payload
        claims = {
            "iss": self.api_key,
            "sub": identity,
            "nbf": now - 5,
            "exp": now + 24 * 3600,  # 24 hour token TTL
            "name": user_name,
            "video": {
                "room": room_name,
                "roomJoin": True,
                "canPublish": can_publish,
                "canSubscribe": can_subscribe,
                "canPublishData": can_publish_data,
                "canPublishSources": ["camera", "microphone", "screen_share"],
            },
        }

        token = jwt.encode(claims, self.api_secret, algorithm="HS256")

        return {
            "status": "success",
            "token": token,
            "sfu_url": self.sfu_url,
            "room_name": room_name,
            "identity": identity,
            "user_name": user_name,
            "expires_at": claims["exp"]
        }


# Global Singleton Instance for SFU Token Service
sfu_token_service = SFUTokenService()
