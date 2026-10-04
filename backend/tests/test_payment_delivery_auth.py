import hashlib
import pytest
from fastapi import HTTPException
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from starlette.background import BackgroundTasks
from starlette.requests import Request
from urllib.parse import urlencode

from app import payments, security
from app.models import Customer, Order, Payment


@pytest.fixture(autouse=True)
def test_secrets(monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", "123456:test-only-token-with-more-than-thirty-five-characters")
    monkeypatch.setenv("HAMYON_API_BASE_URL", "https://hamyon-api.uz")
    monkeypatch.setenv("HAMYON_SHOP_ID", "test-shop")
    monkeypatch.setenv("HAMYON_SHOP_KEY", "test-shop-key")
    monkeypatch.setenv("HAMYON_CARD_ENCRYPTION_KEY", Fernet.generate_key().decode())


def test_session_token_validity_and_expiration(monkeypatch):
    monkeypatch.setattr(security.time, "time", lambda: 1_800_000_000)
    identity = security.TelegramIdentity(telegram_id=42, first_name="Test")
    token, ttl = security.create_session_token(identity)
    assert ttl == 12 * 60 * 60
    assert security.verify_session_token(token).telegram_id == 42
    monkeypatch.setattr(security.time, "time", lambda: 1_800_000_000 + ttl)
    with pytest.raises(HTTPException) as error:
        security.verify_session_token(token)
    assert error.value.status_code == 401


def _callback(payment_id="pay-1", order_id="AQ-17", amount="1000", status="paid"):
    shop_id = "test-shop"
    signature = hashlib.md5(f"{shop_id}{payment_id}{amount}test-shop-key".encode()).hexdigest()
    return {"shop_id": shop_id, "payment_id": payment_id, "order_id": order_id,
            "amount": amount, "status": status, "sign": signature}


def test_hamyon_callback_signature_and_order_validation():
    assert payments._validate_callback(_callback()) == ("pay-1", 17, 1000, "paid")
    invalid = _callback()
    invalid["amount"] = "1001"
    with pytest.raises(HTTPException) as error:
        payments._validate_callback(invalid)
    assert error.value.status_code == 401


def test_hamyon_callback_rejects_fractional_amount():
    with pytest.raises(HTTPException) as error:
        payments._validate_callback(_callback(amount="1000.5"))
    assert error.value.status_code == 400


def test_hamyon_card_is_encrypted_and_decrypted():
    encrypted = payments._encrypt_card("8600 1234 5678 9012")
    assert encrypted != "8600 1234 5678 9012"
    assert payments._decrypt_card(encrypted) == "8600 1234 5678 9012"


def _payment_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Customer.__table__.create(engine)
    Order.__table__.create(engine)
    Payment.__table__.create(engine)
    db = Session(engine)
    customer = Customer(telegram_id=42, name="Test", phone="+998901234567")
    db.add(customer)
    db.flush()
    order = Order(customer_id=customer.id, total=1000, latitude=41.3, longitude=69.2, status="PAYMENT_PENDING")
    db.add(order)
    db.flush()
    payment = Payment(
        order_id=order.id, provider="hamyon", provider_payment_id="pay-1",
        amount=1000, provider_amount=1000, status="PENDING",
    )
    db.add(payment)
    db.commit()
    return engine, db, order.id


def _request_for_callback(fields):
    body = urlencode(fields).encode()
    sent = False
    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": "/payments/callbacks/complete",
        "raw_path": b"/payments/callbacks/complete", "query_string": b"",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
        "server": ("test", 80), "client": ("127.0.0.1", 1234), "root_path": "",
    }
    return Request(scope, receive)


def test_callback_prepare_moves_pending_payment_to_processing():
    engine, db, _order_id = _payment_db()
    try:
        order = db.query(Order).one()
        result = __import__("asyncio").run(payments.hamyon_prepare_callback(_request_for_callback(_callback(order_id=f"AQ-{order.id}")), db))
        assert result == {"success": True}
        assert db.query(Payment).one().status == "PROCESSING"
    finally:
        db.close(); engine.dispose()


def test_cancel_callback_is_idempotent_and_keeps_order_reservation():
    engine, db, order_id = _payment_db()
    try:
        payload = _callback(order_id=f"AQ-{order_id}", status="cancel")
        first = __import__("asyncio").run(payments.hamyon_complete_callback(_request_for_callback(payload), BackgroundTasks(), db))
        second = __import__("asyncio").run(payments.hamyon_complete_callback(_request_for_callback(payload), BackgroundTasks(), db))
        assert first == second == {"success": True, "status": "cancel"}
        assert db.query(Payment).one().status == "CANCELLED"
        assert db.get(Order, order_id).status == "PAYMENT_PENDING"
    finally:
        db.close(); engine.dispose()


def test_prepare_callback_rejects_bad_signature_before_database_lookup():
    engine, db, _order_id = _payment_db()
    try:
        payload = _callback()
        payload["sign"] = "0" * 32
        with pytest.raises(HTTPException) as error:
            __import__("asyncio").run(payments.hamyon_prepare_callback(_request_for_callback(payload), db))
        assert error.value.status_code == 401
    finally:
        db.close(); engine.dispose()
