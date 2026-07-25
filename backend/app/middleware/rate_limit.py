"""
Production Tiered & Endpoint-Aware Rate Limiting Middleware
Applies endpoint-specific rate limits by User ID (authenticated) or Client IP (unauthenticated).
Supports standard headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After).
"""

from typing import Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings
from app.services.rate_limit_service import rate_limit_service
from app.utils.auth import decode_access_token


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Tiered, user & endpoint aware rate limiting middleware.
    """

    def _get_endpoint_tier(self, path: str) -> Tuple[str, int]:
        """Classify endpoint path into a rate limit tier and max requests per minute."""
        # 1. AI Image Generation (heavy GPU / external API resource)
        if path.startswith("/api/images"):
            return "image_gen", settings.RATE_LIMIT_IMAGE_RPM

        # 2. SSE Streaming Chat Messages
        if "/messages/stream" in path:
            return "chat_stream", settings.RATE_LIMIT_CHAT_RPM

        # 3. Auth & Sensitive Endpoints (Login, Register, Password Reset)
        if path.startswith("/api/auth/login") or path.startswith("/api/auth/register") or path.startswith("/api/auth/verify"):
            return "auth", settings.RATE_LIMIT_AUTH_RPM

        # 4. Standard API default
        return "standard", settings.RATE_LIMIT_RPM

    def _get_client_identifier(self, request: Request) -> Tuple[str, str]:
        """
        Identify client by User ID if Bearer token present, otherwise by Client IP.
        Respects X-Forwarded-For for load balancers / NGINX reverse proxies.
        """
        # Try JWT User ID extraction first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1].strip()
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                return f"user:{payload['sub']}", "user"

        # Fallback to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        elif request.client:
            ip = request.client.host
        else:
            ip = "unknown"

        return f"ip:{ip}", "ip"

    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Bypass rate limiting for system health checks & static files
        path = request.url.path
        if path in ("/", "/health", "/docs", "/openapi.json") or path.startswith("/static"):
            return await call_next(request)

        tier_name, max_rpm = self._get_endpoint_tier(path)
        client_id, id_type = self._get_client_identifier(request)

        # Redis key format: ratelimit:{tier}:{client_id}
        rate_key = f"ratelimit:{tier_name}:{client_id}"

        is_limited, remaining, retry_after = await rate_limit_service.is_rate_limited(
            key=rate_key,
            max_requests=max_rpm,
            window_seconds=60
        )

        if is_limited:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded for {tier_name} tier. Please try again in {retry_after} seconds.",
                    "tier": tier_name,
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_rpm),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)

        # Attach rate limit response headers
        response.headers["X-RateLimit-Limit"] = str(max_rpm)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response
