"""
Redis-Backed Multi-Party Call Session Manager (SFU Architecture).
Tracks active call sessions, participant rosters, ring state, and auto-teardown when last participant leaves.
"""

import json
import time
import uuid
from typing import Dict, Any, Optional, List
from app.core.config import settings

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False


class RedisCallSessionManager:
    """
    Manages active arena call sessions stored in Redis with local memory fallback.
    """

    def __init__(self) -> None:
        self._local_sessions: Dict[int, Dict[str, Any]] = {}
        self._redis_client: Optional[Any] = None

    async def _get_redis(self) -> Optional[Any]:
        if not HAS_REDIS:
            return None
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    decode_responses=True
                )
                await self._redis_client.ping()
            except Exception as e:
                print(f"[RedisCallSessionManager] Redis fallback to in-memory: {e}")
                self._redis_client = None
        return self._redis_client

    def _call_key(self, arena_id: int) -> str:
        return f"sfu:call:arena:{arena_id}"

    async def initiate_call(
        self,
        arena_id: int,
        host_id: int,
        host_name: str,
        call_type: str = "video"
    ) -> Dict[str, Any]:
        """
        Initiate a new SFU call session.
        
        :param arena_id: Target arena room ID.
        :param host_id: User ID initiating call.
        :param host_name: Name of initiator.
        :param call_type: "audio" or "video".
        :return: Call session object dict.
        """
        call_id = f"call_{arena_id}_{uuid.uuid4().hex[:8]}"
        session_data = {
            "call_id": call_id,
            "arena_id": arena_id,
            "host_id": host_id,
            "host_name": host_name,
            "call_type": call_type,
            "status": "RINGING",
            "participants": [host_id],
            "created_at": time.time()
        }

        redis_c = await self._get_redis()
        if redis_c:
            try:
                await redis_c.set(self._call_key(arena_id), json.dumps(session_data), ex=86400)
            except Exception as e:
                print(f"[RedisCallSessionManager] Redis set error: {e}")

        self._local_sessions[arena_id] = session_data
        return session_data

    async def get_active_call(self, arena_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve active call session for an arena."""
        redis_c = await self._get_redis()
        if redis_c:
            try:
                raw = await redis_c.get(self._call_key(arena_id))
                if raw:
                    return json.loads(raw)
            except Exception as e:
                print(f"[RedisCallSessionManager] Redis get error: {e}")

        return self._local_sessions.get(arena_id)

    async def join_call(self, arena_id: int, user_id: int, user_name: str) -> Dict[str, Any]:
        """
        Add user to existing active call session.
        
        :param arena_id: Arena room ID.
        :param user_id: Joining user ID.
        :param user_name: Joining user name.
        :return: Updated call session object.
        """
        session = await self.get_active_call(arena_id)
        if not session:
            # Auto-instantiate call if joining non-existent session
            return await self.initiate_call(arena_id, user_id, user_name)

        if user_id not in session["participants"]:
            session["participants"].append(user_id)

        session["status"] = "IN_CALL"
        
        redis_c = await self._get_redis()
        if redis_c:
            try:
                await redis_c.set(self._call_key(arena_id), json.dumps(session), ex=86400)
            except Exception as e:
                print(f"[RedisCallSessionManager] Redis update error: {e}")

        self._local_sessions[arena_id] = session
        return session

    async def leave_call(self, arena_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Remove user from active call session. Teardowns session when last participant leaves.
        
        :param arena_id: Arena room ID.
        :param user_id: Leaving user ID.
        :return: Active call session dict if participants remaining, or None if call ended.
        """
        session = await self.get_active_call(arena_id)
        if not session:
            return None

        if user_id in session["participants"]:
            session["participants"].remove(user_id)

        if len(session["participants"]) > 0:
            redis_c = await self._get_redis()
            if redis_c:
                try:
                    await redis_c.set(self._call_key(arena_id), json.dumps(session), ex=86400)
                except Exception as e:
                    print(f"[RedisCallSessionManager] Redis leave update error: {e}")
            self._local_sessions[arena_id] = session
            return session
        else:
            # 0 participants left -> teardown session
            redis_c = await self._get_redis()
            if redis_c:
                try:
                    await redis_c.delete(self._call_key(arena_id))
                except Exception as e:
                    print(f"[RedisCallSessionManager] Redis delete error: {e}")
            if arena_id in self._local_sessions:
                del self._local_sessions[arena_id]
            return None


# Global Singleton Instance for Call Session Manager
call_session_manager = RedisCallSessionManager()
