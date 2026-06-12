"""
Structured Logging Middleware
Adds request correlation IDs and logs request/response details.
"""

import time
import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger("wonderai")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Logs every request with timing, status, and a correlation ID."""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start = time.time()
        
        # Attach correlation ID to request state
        request.state.request_id = request_id
        
        # Skip logging for noisy endpoints in production
        skip_log = request.url.path in ("/health", "/favicon.ico")
        
        if not skip_log and settings.DEBUG:
            logger.info(
                f"[{request_id}] → {request.method} {request.url.path}"
            )
        
        try:
            response = await call_next(request)
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[{request_id}] ✗ {request.method} {request.url.path} "
                f"| {elapsed:.0f}ms | ERROR: {e}"
            )
            raise
        
        elapsed = (time.time() - start) * 1000
        
        if not skip_log:
            log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(
                log_level,
                f"[{request_id}] ← {request.method} {request.url.path} "
                f"| {response.status_code} | {elapsed:.0f}ms"
            )
        
        # Add correlation ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response
