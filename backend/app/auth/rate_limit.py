"""
Simple in-memory rate limiter for auth and sensitive endpoints.
Key = client identifier (e.g. IP), window = 1 minute, max requests per window.
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import DefaultDict, Tuple

from app.logging_config import get_logger

logger = get_logger(__name__)

# (count, window_start_ts)
_buckets: DefaultDict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0.0))

# 10 attempts per minute per key for auth
AUTH_LIMIT = 10
# 30 uploads per minute per key (avatar + prompt-image)
UPLOAD_LIMIT = 30
AUTH_WINDOW_SEC = 60


def _window_start(now: float, window_sec: int) -> float:
    return (now // window_sec) * window_sec


def check_rate_limit(key: str, limit: int = AUTH_LIMIT, window_sec: int = AUTH_WINDOW_SEC) -> bool:
    """
    Returns True if the request is allowed, False if rate limited.
    Caller should raise 429 if False.
    """
    now = time.monotonic()
    start = _window_start(now, window_sec)
    count, bucket_start = _buckets[key]
    if bucket_start != start:
        count = 0
        bucket_start = start
        _buckets[key] = (0, start)
    if count >= limit:
        logger.warning("rate_limit_exceeded key=%s count=%s limit=%s", key, count + 1, limit)
        return False
    _buckets[key] = (count + 1, bucket_start)
    return True


def get_client_key(request) -> str:
    """Prefer X-Forwarded-For (proxy), else request.client.host."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if getattr(request, "client", None) and request.client:
        return request.client.host or "unknown"
    return "unknown"


def get_upload_rate_limit_key(request) -> str:
    """Separate bucket from auth: upload:<ip>."""
    return "upload:" + get_client_key(request)
