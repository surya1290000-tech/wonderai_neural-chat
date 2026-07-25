"""
Rate Limit Service - Distributed Sliding Window Rate Limiter
Supports Redis-backed rate limiting with automatic in-memory fallback.
Uses precise millisecond sliding window algorithm.
"""

import time
import asyncio
import logging
from typing import Tuple, Dict, List
from collections import defaultdict
from app.config import settings

logger = logging.getLogger("wonderai.rate_limit")

# Optional redis import with graceful fallback
try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    aioredis = None


class DistributedRateLimiter:
    """
    Sliding window rate limiter using Redis sorted sets (ZSET) when available,
    with automatic fallback to an in-memory sliding window queue.
    """

    def __init__(self):
        self.redis_client = None
        self._memory_store: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

        if HAS_REDIS and settings.REDIS_URL:
            try:
                self.redis_client = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2.0
                )
                logger.info(f"Initialized Redis rate limiter client: {settings.REDIS_URL}")
            except Exception as e:
                logger.warning(f"Failed to initialize Redis client: {e}. Falling back to in-memory store.")

    async def is_rate_limited(
        self,
        key: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> Tuple[bool, int, int]:
        """
        Check if request key exceeds limit.
        Returns Tuple: (is_limited: bool, remaining_requests: int, retry_after_seconds: int)
        """
        now = time.time()
        window_start = now - window_seconds

        # Attempt Redis sliding window ZSET algorithm
        if self.redis_client:
            try:
                pipeline = self.redis_client.pipeline()
                # ZREMRANGEBYSCORE key 0 window_start
                pipeline.zremrangebyscore(key, 0, window_start)
                # ZCARD key
                pipeline.zcard(key)
                # ZADD key now now
                pipeline.zadd(key, {str(now): now})
                # EXPIRE key window_seconds
                pipeline.expire(key, window_seconds + 5)
                
                results = await pipeline.execute()
                current_count = results[1]

                if current_count >= max_requests:
                    # Over limit — remove the attempt we just added
                    await self.redis_client.zrem(key, str(now))
                    remaining = 0
                    retry_after = int(window_seconds)
                    return True, remaining, retry_after

                remaining = max(0, max_requests - (current_count + 1))
                return False, remaining, 0

            except Exception as e:
                logger.warning(f"Redis rate limit error ({e}). Falling back to in-memory check.")

        # In-memory sliding window fallback
        async with self._lock:
            timestamps = self._memory_store[key]
            # Prune old entries
            timestamps = [ts for ts in timestamps if ts > window_start]
            self._memory_store[key] = timestamps

            if len(timestamps) >= max_requests:
                remaining = 0
                retry_after = int(window_seconds - (now - timestamps[0])) if timestamps else window_seconds
                return True, remaining, max(1, retry_after)

            timestamps.append(now)
            remaining = max(0, max_requests - len(timestamps))
            return False, remaining, 0


# Global singleton instance
rate_limit_service = DistributedRateLimiter()
