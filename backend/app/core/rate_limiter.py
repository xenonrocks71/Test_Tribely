"""
Distributed Redis-Backed Sliding Window Rate Limiter Engine.
Protects FastAPI application servers against DDoS spikes, brute-force login attempts,
and API spam using Redis Sorted Sets (ZSET) with microsecond precision.
"""

import time
import uuid
import logging
from typing import Tuple, Optional
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response as StarletteResponse
from jose import jwt, JWTError

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """
    Core Redis Sorted Set (ZSET) Sliding Window Engine.
    """

    @staticmethod
    async def check_rate_limit(
        identifier: str,
        route_key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Evaluate sliding window rate limit for an identifier and route key.

        :param identifier: User ID or Client IP.
        :param route_key: Route path identifier.
        :param max_requests: Max requests allowed in window.
        :param window_seconds: Time window in seconds.
        :return: Tuple of (is_rate_limited: bool, remaining_requests: int, reset_ttl_seconds: int).
        """
        redis = await get_redis_client()
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000
        clear_before_ms = now_ms - window_ms
        key = f"ratelimit:{identifier}:{route_key}"

        try:
            # Atomic pipeline to prune old entries and count current window elements
            pipe = redis.pipeline()
            pipe.zremrangebyscore(key, 0, clear_before_ms)
            pipe.zcard(key)
            pipe.ttl(key)
            results = await pipe.execute()

            current_count = results[1]
            existing_ttl = results[2]
            reset_ttl = existing_ttl if existing_ttl > 0 else window_seconds

            if current_count >= max_requests:
                return True, 0, reset_ttl

            # Add current request timestamp to ZSET
            member_id = f"{now_ms}:{uuid.uuid4().hex[:8]}"
            pipe = redis.pipeline()
            pipe.zadd(key, {member_id: now_ms})
            pipe.expire(key, window_seconds + 5)
            await pipe.execute()

            remaining = max(0, max_requests - (current_count + 1))
            return False, remaining, window_seconds

        except Exception as e:
            logger.debug(f"Redis rate limiter bypassed (Redis unavailable): {e}")
            # Fallback to allow request if Redis fails
            return False, max_requests, window_seconds


class RateLimiter:
    """
    Reusable FastAPI Dependency class for route-level rate limiting.
    Usage: @router.post("/login", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
    """

    def __init__(self, times: int = 10, seconds: int = 60) -> None:
        self.times = times
        self.seconds = seconds

    async def __call__(self, request: Request, response: Response) -> None:
        # Extract identity: Authenticated User ID or Client IP
        identifier = self._get_client_identifier(request)
        route_key = request.url.path.strip("/") or "root"

        import asyncio
        try:
            is_limited, remaining, reset_ttl = await asyncio.wait_for(
                SlidingWindowRateLimiter.check_rate_limit(
                    identifier=identifier,
                    route_key=route_key,
                    max_requests=self.times,
                    window_seconds=self.seconds
                ),
                timeout=0.3
            )
        except Exception:
            is_limited, remaining, reset_ttl = False, self.times, self.seconds

        # Standardize X-RateLimit response headers
        response.headers["X-RateLimit-Limit"] = str(self.times)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_ttl)

        if is_limited:
            response.headers["Retry-After"] = str(reset_ttl)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please try again in {reset_ttl} seconds.",
                headers={
                    "Retry-After": str(reset_ttl),
                    "X-RateLimit-Limit": str(self.times),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_ttl)
                }
            )

    @staticmethod
    def _get_client_identifier(request: Request) -> str:
        """Extract user_id from JWT token or fallback to Client IP."""
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except JWTError:
                pass

        # Fallback to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
            return f"ip:{ip}"
        
        ip = request.client.host if request.client else "127.0.0.1"
        return f"ip:{ip}"


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Global FastAPI Middleware enforcing general baseline traffic limits across all routes.
    """

    def __init__(self, app, requests_per_minute: int = 200) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> StarletteResponse:
        if request.method == "OPTIONS":
            return await call_next(request)

        identifier = RateLimiter._get_client_identifier(request)
        route_key = "global"

        import asyncio
        try:
            is_limited, remaining, reset_ttl = await asyncio.wait_for(
                SlidingWindowRateLimiter.check_rate_limit(
                    identifier=identifier,
                    route_key=route_key,
                    max_requests=self.requests_per_minute,
                    window_seconds=60
                ),
                timeout=0.3
            )
        except Exception as e:
            logger.warning(f"Rate limiter check bypassed due to exception or timeout: {e}")
            is_limited, remaining, reset_ttl = False, self.requests_per_minute, 60

        if is_limited:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": f"Rate limit exceeded. Please try again in {reset_ttl} seconds."},
                headers={
                    "Retry-After": str(reset_ttl),
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_ttl)
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_ttl)
        return response
