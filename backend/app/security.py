"""Telegram Mini App authentication and owner authorization."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass(frozen=True)
class TelegramIdentity:
    """Identity proven by Telegram's signed Mini App initData."""

    telegram_id: int
    first_name: str | None = None
    username: str | None = None


def _unauthorized(detail: str = "Telegram Mini App orqali qayta kiring.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "tma"},
    )


def verify_telegram_init_data(init_data: str) -> TelegramIdentity:
    """Verify Telegram WebApp initData using the official HMAC procedure."""

    bot_token = os.getenv("BOT_TOKEN", "").strip()
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram autentifikatsiyasi hali sozlanmagan.",
        )

    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
        values = dict(pairs)
        supplied_hash = values.pop("hash")
        auth_date = int(values["auth_date"])
    except (ValueError, KeyError):
        raise _unauthorized("Telegram initData formati noto'g'ri.") from None

    if len(values) != len(pairs) - 1:
        raise _unauthorized("Telegram initData ichida takroriy maydon bor.")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(values.items())
    )
    secret_key = hmac.new(
        b"WebAppData",
        bot_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, supplied_hash):
        raise _unauthorized("Telegram imzosi tasdiqlanmadi.")

    max_age = int(os.getenv("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", "86400"))
    now = int(time.time())
    if auth_date > now + 30 or now - auth_date > max_age:
        raise _unauthorized("Telegram sessiyasi eskirgan. Ilovani qayta oching.")

    try:
        user = json.loads(values["user"])
        telegram_id = int(user["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise _unauthorized("Telegram foydalanuvchisi aniqlanmadi.") from None

    if telegram_id <= 0:
        raise _unauthorized("Telegram foydalanuvchi ID noto'g'ri.")

    first_name = user.get("first_name")
    username = user.get("username")
    return TelegramIdentity(
        telegram_id=telegram_id,
        first_name=first_name if isinstance(first_name, str) else None,
        username=username if isinstance(username, str) else None,
    )


def get_current_telegram_user(request: Request) -> TelegramIdentity:
    """Authenticate the request's `Authorization: tma <initData>` header."""

    authorization = request.headers.get("authorization", "")
    scheme, separator, init_data = authorization.partition(" ")
    if scheme.lower() != "tma" or not separator or not init_data.strip():
        raise _unauthorized()
    return verify_telegram_init_data(init_data.strip())


def get_optional_telegram_user(request: Request) -> TelegramIdentity | None:
    """Allow anonymous catalog reads while validating any supplied identity."""

    authorization = request.headers.get("authorization")
    if not authorization:
        return None
    return get_current_telegram_user(request)


def is_admin_identity(identity: TelegramIdentity | None) -> bool:
    owner_id = os.getenv("ADMIN_TELEGRAM_ID", "").strip()
    return owner_id.isdigit() and identity is not None and identity.telegram_id == int(owner_id)


def require_admin(
    identity: TelegramIdentity = Depends(get_current_telegram_user),
) -> TelegramIdentity:
    """Allow privileged API access only to the configured owner ID."""

    if not os.getenv("ADMIN_TELEGRAM_ID", "").strip().isdigit():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_TELEGRAM_ID sozlanmagan yoki noto'g'ri.",
        )

    if not is_admin_identity(identity):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu amal faqat loyiha egasi uchun.",
        )
    return identity
