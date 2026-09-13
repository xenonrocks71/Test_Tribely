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


# ─────────────────────────────────────────────────────────────────────────────
# Synchronous Redis Client & Distributed Lock Management (Google / Meta SRE Standard)
# ─────────────────────────────────────────────────────────────────────────────

_sync_redis_pool = None
_sync_redis_client = None

# Atomic Lua release script to ensure token ownership (Redlock protection)
LUA_RELEASE_LOCK_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


def get_sync_redis_client():
    """
    Get or initialize thread-safe synchronous Redis client backed by a ConnectionPool.
    Returns None gracefully if Redis is unavailable (circuit-breaker fallback).
    """
    global _sync_redis_pool, _sync_redis_client
    if _sync_redis_client is not None:
        return _sync_redis_client

    try:
        import redis
        if _sync_redis_pool is None:
            if settings.REDIS_URL:
                _sync_redis_pool = redis.ConnectionPool.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_timeout=2.0,
                    socket_connect_timeout=2.0,
                    retry_on_timeout=True,
                    max_connections=50,
                )
            else:
                is_ssl = (
                    "upstash.io" in settings.REDIS_HOST
                    or settings.REDIS_HOST.startswith("rediss://")
                    or getattr(settings, "REDIS_SSL", False)
                )
                _sync_redis_pool = redis.ConnectionPool(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD or None,
                    decode_responses=True,
                    ssl=is_ssl,
                    socket_timeout=2.0,
                    socket_connect_timeout=2.0,
                    retry_on_timeout=True,
                    max_connections=50,
                )
        client = redis.Redis(connection_pool=_sync_redis_pool)
        client.ping()
        _sync_redis_client = client
        return _sync_redis_client
    except Exception:
        return None


def acquire_distributed_lock(redis_client, lock_key: str, lock_token: str, ttl_seconds: int = 5) -> bool:
    """
    Acquire an atomic distributed lock with a unique token and expiry TTL.
    """
    if not redis_client:
        return False
    try:
        return bool(redis_client.set(lock_key, lock_token, nx=True, ex=ttl_seconds))
    except Exception:
        return False


def release_distributed_lock(redis_client, lock_key: str, lock_token: str) -> bool:
    """
    Safely release a distributed lock using an atomic Lua script.
    Guarantees that a process NEVER deletes a lock acquired by another request (Redlock pattern).
    """
    if not redis_client or not lock_token:
        return False
    try:
        result = redis_client.eval(LUA_RELEASE_LOCK_SCRIPT, 1, lock_key, lock_token)
        return bool(result)
    except Exception:
        return False

