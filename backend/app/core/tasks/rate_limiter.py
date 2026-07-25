"""
High-Performance Rate Limiting Engine.
Implements a Sliding Window / Token Bucket algorithm shielding API endpoints against traffic spikes.
Designed for high concurrency (Instagram scale).
"""

import time
from typing import Dict, Tuple
from fastapi import HTTPException, status, Request


class RateLimiter:
    """
    Sliding window rate limiter tracking request frequencies per client IP / User ID.
    """

    def __init__(self, requests_per_minute: int = 60) -> None:
        """
        Initialize rate limiter with target threshold.

        :param requests_per_minute: Max requests permitted within 60 seconds.
        """
        self.requests_per_minute = requests_per_minute
        self.client_records: Dict[str, List[float]] = {}

    def is_rate_limited(self, identifier: str) -> bool:
        """
        Check if identifier has exceeded the request threshold.

        :param identifier: Client IP string or User ID string.
        :return: True if rate limited (exceeded threshold), else False.
        """
        now = time.time()
        window_start = now - 60.0

        if identifier not in self.client_records:
            self.client_records[identifier] = []

        # Filter out timestamps outside the active 60-second window
        timestamps = [ts for ts in self.client_records[identifier] if ts > window_start]
        self.client_records[identifier] = timestamps

        if len(timestamps) >= self.requests_per_minute:
            return True

        self.client_records[identifier].append(now)
        return False

    def check(self, request: Request, identifier: str = None) -> None:
        """
        Enforce rate limit check on an incoming request object.

        :param request: FastAPI request object.
        :param identifier: Optional user identifier string.
        :raises HTTPException: 429 Too Many Requests if rate limited.
        """
        client_key = identifier or request.client.host if request.client else "global"
        if self.is_rate_limited(client_key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait before retrying."
            )


# Global Singleton Rate Limiters for App Routes
auth_rate_limiter = RateLimiter(requests_per_minute=20)
global_rate_limiter = RateLimiter(requests_per_minute=120)
