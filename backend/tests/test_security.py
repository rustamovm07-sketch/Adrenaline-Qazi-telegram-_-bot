import hashlib
import hmac
import asyncio
from io import BytesIO
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException
from PIL import Image
from starlette.requests import Request
from starlette.responses import Response

from app import security


def signed_init_data(bot_token: str, auth_date: int, user: str = '{"id":42,"first_name":"Test"}') -> str:
    fields = {"auth_date": str(auth_date), "user": user}
    check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


@pytest.fixture(autouse=True)
def auth_config(monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", "123456:test-only-token")
    monkeypatch.setenv("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", "300")
    monkeypatch.setattr(security.time, "time", lambda: 1_800_000_000)


def test_valid_init_data_returns_signed_identity():
    data = signed_init_data("123456:test-only-token", 1_799_999_999)
    assert security.verify_telegram_init_data(data).telegram_id == 42


def test_admin_authorization_uses_server_configured_identity(monkeypatch):
    monkeypatch.setenv("ADMIN_TELEGRAM_ID", "42")
    owner = security.TelegramIdentity(telegram_id=42)
    other_user = security.TelegramIdentity(telegram_id=43)
    assert security.require_admin(owner) == owner
    with pytest.raises(HTTPException) as error:
        security.require_admin(other_user)
    assert error.value.status_code == 403


@pytest.mark.parametrize("data", ["", "auth_date", "auth_date=1&user=%7B%7D&hash=bad"])
def test_malformed_init_data_is_rejected(data):
    with pytest.raises(HTTPException) as error:
        security.verify_telegram_init_data(data)
    assert error.value.status_code == 401


def test_modified_init_data_is_rejected():
    data = signed_init_data("123456:test-only-token", 1_800_000_000).replace("id%22%3A42", "id%22%3A43")
    with pytest.raises(HTTPException) as error:
        security.verify_telegram_init_data(data)
    assert error.value.status_code == 401


@pytest.mark.parametrize("auth_date", [1_799_999_699, 1_800_000_001])
def test_expired_and_future_init_data_are_rejected(auth_date):
    data = signed_init_data("123456:test-only-token", auth_date)
    with pytest.raises(HTTPException) as error:
        security.verify_telegram_init_data(data)
    assert error.value.status_code == 401


def test_repeated_query_fields_are_rejected():
    data = signed_init_data("123456:test-only-token", 1_800_000_000) + "&auth_date=1800000000"
    with pytest.raises(HTTPException) as error:
        security.verify_telegram_init_data(data)
    assert error.value.status_code == 401


def test_configured_max_age_cannot_exceed_five_minutes(monkeypatch):
    monkeypatch.setenv("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", "86400")
    data = signed_init_data("123456:test-only-token", 1_800_000_000)
    with pytest.raises(HTTPException) as error:
        security.verify_telegram_init_data(data)
    assert error.value.status_code == 503


def test_customer_order_contract_excludes_admin_only_fields():
    from app.schemas import AdminOrderResponse, OrderResponse, OrderStatusHistoryResponse

    assert "payment_transaction_id" not in OrderResponse.model_fields
    assert "customer_id" not in OrderResponse.model_fields
    assert "customer_id" in AdminOrderResponse.model_fields
    assert "payment_transaction_id" in AdminOrderResponse.model_fields
    assert "actor_telegram_id" not in OrderStatusHistoryResponse.model_fields


def test_customer_product_contract_omits_internal_stock():
    from app.schemas import ProductResponse, PublicProductResponse

    assert "reserved_stock_units" not in PublicProductResponse.model_fields
    assert "stock_units" not in PublicProductResponse.model_fields
    assert "reserved_stock_units" in ProductResponse.model_fields


def test_image_validation_decodes_allowlisted_raster_and_rejects_fake_png():
    from app.media_security import validate_image_bytes

    output = BytesIO()
    Image.new("RGB", (3, 3), "red").save(output, format="PNG")
    validate_image_bytes(output.getvalue(), "image/png")
    with pytest.raises(HTTPException):
        validate_image_bytes(b"\x89PNG\r\n\x1a\nnot actually a PNG", "image/png")
    with pytest.raises(HTTPException):
        validate_image_bytes(b"<svg></svg>", "image/svg+xml")


def test_private_media_path_rejects_traversal(tmp_path):
    from app.media_access import is_owned_media, resolve_upload_file

    root = tmp_path / "media"
    root.mkdir()
    (root / "safe.jpg").write_bytes(b"private")
    assert resolve_upload_file(root, "safe.jpg") == (root / "safe.jpg").resolve()
    assert resolve_upload_file(root, "../safe.jpg") is None
    assert resolve_upload_file(root, "..\\safe.jpg") is None
    assert resolve_upload_file(root, str((root / "safe.jpg").resolve())) is None
    assert is_owned_media("42_image.jpg", 42)
    assert not is_owned_media("42_image.jpg", 43)


def test_rate_limit_policy_covers_orders_uploads_and_admin_mutations():
    from app.rate_limit import RateLimitMiddleware

    assert RateLimitMiddleware.policy("/orders/", "POST") == (5, "orders")
    assert RateLimitMiddleware.policy("/customers/profile/image", "POST") == (10, "profile")
    assert RateLimitMiddleware.policy("/products/", "POST") == (30, "admin-mutations")
    assert RateLimitMiddleware.is_upload("/products/", "POST")
    assert RateLimitMiddleware.is_upload("/store-settings/image", "POST")


def test_rate_counter_increments_within_same_window():
    from app.rate_limit import RateLimitMiddleware

    middleware = RateLimitMiddleware(lambda scope, receive, send: None)

    async def run():
        first = await middleware._increment("test-security", 60)
        second = await middleware._increment("test-security", 60)
        return first, second

    first, second = asyncio.run(run())
    assert second == first + 1


def test_order_rate_limit_returns_429_and_retry_after(monkeypatch):
    from app.rate_limit import RateLimitMiddleware

    monkeypatch.setenv("APP_ENV", "development")
    middleware = RateLimitMiddleware(lambda scope, receive, send: None)
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": "/orders/", "raw_path": b"/orders/",
        "query_string": b"", "headers": [], "server": ("test", 80),
        "client": ("198.51.100.42", 1234), "root_path": "",
    }
    request = Request(scope)

    async def run():
        async def call_next(_request):
            return Response("ok")
        responses = [await middleware.dispatch(request, call_next) for _ in range(6)]
        return responses

    responses = asyncio.run(run())
    assert responses[-1].status_code == 429
    assert "Retry-After" in responses[-1].headers
