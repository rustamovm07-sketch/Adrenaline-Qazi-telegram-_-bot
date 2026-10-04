"""Shared Redis rate limits with a development-only local fallback."""

from __future__ import annotations

import os
import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .security import verify_session_token, verify_telegram_init_data

_local_counts: dict[tuple[str, int], int] = defaultdict(int)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.redis_url = os.getenv("REDIS_URL", "").strip()
        self.redis = None
        if self.redis_url:
            try:
                from redis.asyncio import Redis

                self.redis = Redis.from_url(self.redis_url, decode_responses=True)
            except ImportError as exc:
                raise RuntimeError("REDIS_URL berilgan bo'lsa redis dependency kerak.") from exc
        elif os.getenv("APP_ENV", "development").lower() == "production":
            raise RuntimeError("Production muhitida distributed rate limiting uchun REDIS_URL talab qilinadi.")

    @staticmethod
    def policy(path: str, method: str) -> tuple[int, str] | None:
        if method in {"GET", "HEAD", "OPTIONS"}:
            return None
        if path == "/orders/" and method == "POST":
            return 5, "orders"
        if path in {"/customers/profile", "/customers/profile/image"} or path.startswith("/customers/profile/"):
            return 10, "profile"
        if path in {"/orders/delivery-image"}:
            return 10, "uploads"
        if path.startswith(("/products/", "/categories/", "/inventory/", "/store-settings/", "/orders/")):
            return 30, "admin-mutations"
        return None

    @staticmethod
    def is_upload(path: str, method: str) -> bool:
        return (
            path in {"/orders/delivery-image", "/customers/profile/image", "/store-settings/image"}
            and method == "POST"
        ) or (
            path.startswith(("/products/", "/categories/"))
            and method in {"POST", "PUT"}
        )

    async def _increment(self, key: str, window: int) -> int:
        now = int(time.time())
        bucket = now // window
        redis_key = f"adrenalin:rl:{key}:{bucket}"
        if self.redis is not None:
            count = await self.redis.eval(
                "local n = redis.call('INCR', KEYS[1]); "
                "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; "
                "return n",
                1,
                redis_key,
                window + 1,
            )
            return int(count)
        local_key = (redis_key, bucket)
        # Expire old development counters and avoid unbounded growth.
        for old_key in [entry for entry in _local_counts if entry[1] < bucket - 2]:
            _local_counts.pop(old_key, None)
        _local_counts[local_key] += 1
        return _local_counts[local_key]

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        window = 60
        identity_key = ip
        authorization = request.headers.get("authorization", "")
        scheme, separator, init_data = authorization.partition(" ")
        if scheme.lower() == "tma" and separator:
            try:
                identity_key = str(verify_telegram_init_data(init_data.strip()).telegram_id)
            except Exception:
                pass  # The authentication dependency returns the canonical 401.
        elif scheme.lower() == "bearer" and separator:
            try:
                identity_key = str(verify_session_token(init_data.strip()).telegram_id)
            except Exception:
                pass  # The authentication dependency returns the canonical 401.

        limits = [(60, f"global:ip:{ip}")]
        if self.is_upload(request.url.path, request.method):
            limits.append((10, f"uploads:user:{identity_key}"))
        route_policy = self.policy(request.url.path, request.method)
        if route_policy:
            cap, category = route_policy
            limits.append((cap, f"{category}:user:{identity_key}"))
        if authorization:
            limits.append((10, f"authentication:ip:{ip}"))

        for cap, key in limits:
            try:
                count = await self._increment(key, window)
            except Exception:
                if self.redis is not None:
                    return JSONResponse(
                        {"detail": "Rate limiting xizmati vaqtincha ishlamayapti."},
                        status_code=503,
                    )
                raise
            if count > cap:
                retry_after = window - (int(time.time()) % window)
                return JSONResponse(
                    {"detail": "So'rovlar limiti oshdi. Birozdan so'ng qayta urinib ko'ring."},
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)
