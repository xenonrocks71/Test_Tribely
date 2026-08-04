"""
Distributed Lock (Redlock) Engine for Tribely Worker Nodes.
Guarantees single-execution idempotency across horizontal server/worker nodes
using Redis SETNX with TTL and non-blocking acquisition semantics.
"""

import uuid
import logging
from typing import Optional
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Lua script to release lock atomically only if token matches
RELEASE_LOCK_LUA_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class RedisDistributedLock:
    """
    Non-blocking Async Redis Distributed Lock context manager.
    Key pattern: lock:audit:arena:{arena_id}:{YYYY-MM-DD}
    """

    def __init__(
        self,
        redis_client: aioredis.Redis,
        arena_id: int,
        date_str: str,
        ttl_seconds: int = 300,
    ) -> None:
        self.redis = redis_client
        self.arena_id = arena_id
        self.date_str = date_str
        self.ttl = ttl_seconds
        self.lock_key = f"lock:audit:arena:{arena_id}:{date_str}"
        self.lock_token = str(uuid.uuid4())
        self.acquired = False

    async def acquire(self) -> bool:
        """
        Attempt non-blocking lock acquisition using SET key token NX EX ttl.
        Returns True if acquired, False if lock is held by another worker.
        """
        try:
            acquired = await self.redis.set(
                self.lock_key,
                self.lock_token,
                nx=True,
                ex=self.ttl,
            )
            self.acquired = bool(acquired)
            if not self.acquired:
                logger.info(f"Audit lock already active for arena {self.arena_id}")
            return self.acquired
        except Exception as e:
            logger.error(f"Error acquiring Redis lock {self.lock_key}: {e}")
            return False

    async def release(self) -> bool:
        """
        Safely release lock using atomic Lua script matching token.
        """
        if not self.acquired:
            return False

        try:
            res = await self.redis.eval(
                RELEASE_LOCK_LUA_SCRIPT,
                1,
                self.lock_key,
                self.lock_token,
            )
            self.acquired = False
            return bool(res)
        except Exception as e:
            logger.error(f"Error releasing Redis lock {self.lock_key}: {e}")
            return False

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.release()
