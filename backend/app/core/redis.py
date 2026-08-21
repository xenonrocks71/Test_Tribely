"""
Async Redis Client & Connection Management for Tribely Backend.
Provides connection pooling for Redis Pub/Sub, distributed locking (Redlock), and Arq task queue workers.
"""

from typing import Optional
import redis.asyncio as aioredis
from app.core.config import settings

_redis_pool: Optional[aioredis.ConnectionPool] = None
_redis_client: Optional[aioredis.Redis] = None


def get_redis_pool() -> aioredis.ConnectionPool:
    """
    Get or initialize global async Redis ConnectionPool.
    """
    global _redis_pool
    if _redis_pool is None:
        if settings.REDIS_URL:
            _redis_pool = aioredis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=3.0,
                max_connections=50,
                retry_on_timeout=True,
            )
        else:
            is_ssl = (
                "upstash.io" in settings.REDIS_HOST
                or settings.REDIS_HOST.startswith("rediss://")
                or getattr(settings, "REDIS_SSL", False)
            )
            _redis_pool = aioredis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                ssl=is_ssl,
                ssl_cert_reqs=None if is_ssl else None,
                socket_timeout=2.0,
                socket_connect_timeout=3.0,
                max_connections=50,
                retry_on_timeout=True,
            )
    return _redis_pool


async def get_redis_client() -> aioredis.Redis:
    """
    Get or initialize global async Redis client instance backed by connection pool.
    """
    global _redis_client
    if _redis_client is None:
        pool = get_redis_pool()
        _redis_client = aioredis.Redis(connection_pool=pool)
    return _redis_client


async def close_redis_client() -> None:
    """
    Close global async Redis connection and pool.
    """
    global _redis_client, _redis_pool
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None

