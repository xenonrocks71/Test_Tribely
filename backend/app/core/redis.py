"""
Async Redis Client & Connection Management for Tribely Backend.
Provides connection pooling for Redis Pub/Sub, distributed locking (Redlock), and Arq task queue workers.
"""

from typing import Optional
import redis.asyncio as aioredis
from app.core.config import settings

_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    """
    Get or initialize global async Redis client instance.
    """
    global _redis_client
    if _redis_client is None:
        is_upstash = "upstash.io" in settings.REDIS_HOST
        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            ssl=is_upstash,
            ssl_cert_reqs=None if is_upstash else "required",
            socket_timeout=0.15,
            socket_connect_timeout=0.15,
        )
    return _redis_client


async def close_redis_client() -> None:
    """
    Close global async Redis connection.
    """
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
