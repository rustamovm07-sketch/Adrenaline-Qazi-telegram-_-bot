"""Hamyon UZCARD payment creation and signed callback handling."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse
from urllib.request import Request, urlopen

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request as HttpRequest
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .database import SessionLocal
from .models import Customer, Order, OrderStatusHistory, Payment
from .orders import confirm_payment
from .schemas import HamyonPaymentCreateResponse, HamyonPaymentStatusResponse, PaymentAdminResponse
from .security import TelegramIdentity, get_current_telegram_user, require_admin

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)
HAMYON_PROVIDER = "hamyon"
ACTIVE_PAYMENT_STATUSES = ("CREATING", "PENDING", "PROCESSING")
MAX_AMOUNT_ADJUSTMENT = 10


def _money(value: Decimal | int | float | str) -> Decimal:
    try:
        result = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="To'lov summasi noto'g'ri.") from None
    if result <= 0:
        raise HTTPException(status_code=400, detail="To'lov summasi musbat bo'lishi kerak.")
    return result


def _card_cipher() -> Fernet:
    key = os.getenv("HAMYON_CARD_ENCRYPTION_KEY", "").strip().encode()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Hamyon karta ma'lumotlarini shifrlash kaliti sozlanmagan.",
        )
    try:
        return Fernet(key)
    except (ValueError, TypeError):
        raise HTTPException(status_code=503, detail="Hamyon karta shifrlash kaliti noto'g'ri.") from None


def _encrypt_card(card: str) -> str:
    return _card_cipher().encrypt(card.encode("utf-8")).decode("ascii")


def _decrypt_card(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _card_cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError):
        logger.error("Stored Hamyon card could not be decrypted; no card value logged")
        return None


def _hamyon_credentials() -> tuple[str, str, str]:
    base_url = os.getenv("HAMYON_API_BASE_URL", "https://hamyon-api.uz").strip().rstrip("/")
    shop_id = os.getenv("HAMYON_SHOP_ID", "").strip()
    shop_key = os.getenv("HAMYON_SHOP_KEY", "").strip()
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=503, detail="Hamyon API manzili HTTPS bilan sozlanishi kerak.")
    if not shop_id or not shop_key:
        raise HTTPException(status_code=503, detail="Hamyon do'kon kalitlari sozlanmagan.")
    return base_url, shop_id, shop_key


def _hamyon_create_request(
    *, base_url: str, shop_id: str, shop_key: str, amount: Decimal, order_id: int
) -> dict:
    fields = {
        "shop_id": shop_id,
        "shop_key": shop_key,
        "amount": str(int(amount)),
        "order_id": f"AQ-{order_id}",
    }
    request = Request(
        f"{base_url}/payment/create",
        data=urlencode(fields).encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read(256_000))
    except HTTPError as exc:
        # The provider body is intentionally not returned or logged: it may
        # include merchant input or account details.
        raise RuntimeError(f"Hamyon API qaytargan HTTP {exc.code} xato") from None
    except (URLError, TimeoutError, OSError, json.JSONDecodeError):
        raise RuntimeError("Hamyon API bilan xavfsiz ulanish amalga oshmadi") from None
    if not isinstance(result, dict):
        raise RuntimeError("Hamyon API javob formati noto'g'ri")
    return result


def _provider_card(response: dict) -> str:
    value = response.get("card")
    if not isinstance(value, str):
        raise RuntimeError("Hamyon API karta ma'lumotini qaytarmadi")
    digits = re.sub(r"\D", "", value)
    if not 12 <= len(digits) <= 19:
        raise RuntimeError("Hamyon API karta ma'lumoti noto'g'ri")
    return " ".join(digits[index : index + 4] for index in range(0, len(digits), 4))


def _payment_expiry(response: dict) -> datetime:
    now = int(time.time())
    try:
        expire_at = int(response.get("expire_at", 0))
        if expire_at <= now:
            seconds = int(response.get("expires_in", 300))
            expire_at = now + min(max(seconds, 30), 300)
    except (TypeError, ValueError):
        expire_at = now + 300
    return datetime.utcfromtimestamp(min(expire_at, now + 300))


def _utc_response_time(value: datetime | None) -> datetime | None:
    """Serialize stored naive UTC timestamps with an explicit UTC offset."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _payment_response(payment: Payment) -> HamyonPaymentCreateResponse:
    card = _decrypt_card(payment.card_number_encrypted)
    if not card:
        raise HTTPException(status_code=503, detail="To'lov kartasi vaqtincha ochilmadi.")
    return HamyonPaymentCreateResponse(
        payment_id=payment.provider_payment_id or "",
        order_id=payment.order_id,
        order_amount=payment.amount,
        payment_amount=payment.provider_amount,
        currency=payment.currency,
        card=card,
        status=payment.status,
        expires_at=_utc_response_time(payment.expires_at),
    )


def _release_stale_creating_payments(db: Session) -> None:
    cutoff = datetime.utcnow().timestamp() - 120
    stale = (
        db.query(Payment)
        .filter(Payment.status == "CREATING", Payment.created_at < datetime.utcfromtimestamp(cutoff))
        .with_for_update(skip_locked=True)
        .all()
    )
    for payment in stale:
        payment.status = "FAILED"
        payment.cancelled_at = datetime.utcnow()


def _reserve_payment_record(db: Session, order: Order, amount: Decimal) -> Payment:
    _release_stale_creating_payments(db)
    base_amount = _money(amount)
    occupied = {
        int(value[0])
        for value in db.query(Payment.provider_amount)
        .filter(Payment.provider == HAMYON_PROVIDER, Payment.status.in_(ACTIVE_PAYMENT_STATUSES))
        .all()
    }
    for adjustment in range(MAX_AMOUNT_ADJUSTMENT + 1):
        provider_amount = base_amount + adjustment
        if int(provider_amount) in occupied:
            continue
        payment = Payment(
            order_id=order.id,
            provider=HAMYON_PROVIDER,
            amount=base_amount,
            provider_amount=provider_amount,
            status="CREATING",
        )
        db.add(payment)
        try:
            db.commit()
            db.refresh(payment)
            return payment
        except IntegrityError:
            db.rollback()
            order = db.query(Order).filter(Order.id == order.id).first()
            if order is None:
                raise HTTPException(status_code=404, detail="Buyurtma topilmadi.") from None
            occupied.add(int(provider_amount))
    db.commit()
    raise HTTPException(
        status_code=409,
        detail="Shu summada boshqa to'lovlar ochiq. Birozdan keyin qayta urinib ko'ring.",
    )


def _callback_data(request: HttpRequest, raw_body: bytes) -> dict[str, str]:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    try:
        if content_type == "application/json":
            data = json.loads(raw_body)
            if not isinstance(data, dict):
                raise ValueError
            return {str(key): str(value) for key, value in data.items() if value is not None}
        return dict(parse_qsl(raw_body.decode("utf-8"), keep_blank_values=True, strict_parsing=True))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Hamyon callback formati noto'g'ri.") from None


def _validate_callback(data: dict[str, str]) -> tuple[str, int, Decimal, str]:
    _, expected_shop_id, shop_key = _hamyon_credentials()
    shop_id = data.get("shop_id", "")
    payment_id = data.get("payment_id", "").strip()
    raw_amount = data.get("amount", "").strip()
    order_ref = data.get("order_id", "").strip()
    supplied = (data.get("sign") or data.get("signature") or "").strip().lower()
    if not shop_id or not payment_id or not raw_amount or not order_ref or not supplied:
        raise HTTPException(status_code=400, detail="Hamyon callback majburiy maydonlari yo'q.")
    expected = hashlib.md5(
        f"{shop_id}{payment_id}{raw_amount}{shop_key}".encode("utf-8")
    ).hexdigest()
    if shop_id != expected_shop_id or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Hamyon callback imzosi noto'g'ri.")
    try:
        parsed_amount = Decimal(raw_amount)
        if not parsed_amount.is_finite() or parsed_amount != parsed_amount.to_integral_value():
            raise InvalidOperation
        amount = parsed_amount.quantize(Decimal("1"))
        order_id = int(order_ref.removeprefix("AQ-") if order_ref.startswith("AQ-") else order_ref)
    except (ValueError, InvalidOperation):
        raise HTTPException(status_code=400, detail="Hamyon callback summasi yoki buyurtmasi noto'g'ri.") from None
    if amount <= 0 or order_id <= 0:
        raise HTTPException(status_code=400, detail="Hamyon callback summasi yoki buyurtmasi noto'g'ri.")
    return payment_id, order_id, amount, data.get("status", "").strip().lower()


def _get_matching_callback_payment(
    db: Session, payment_id: str, order_id: int, amount: Decimal
) -> Payment:
    payment = (
        db.query(Payment)
        .filter(Payment.provider == HAMYON_PROVIDER, Payment.provider_payment_id == payment_id)
        .with_for_update()
        .first()
    )
    if payment is None or payment.order_id != order_id:
        raise HTTPException(status_code=404, detail="Hamyon to'lovi topilmadi.")
    if payment.provider_amount != amount:
        raise HTTPException(status_code=400, detail="Hamyon callback summasi mos kelmadi.")
    return payment


@router.post("/orders/{order_id}/hamyon", response_model=HamyonPaymentCreateResponse)
async def create_hamyon_payment(
    order_id: int,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    order = (
        db.query(Order)
        .join(Customer, Customer.id == Order.customer_id)
        .filter(Order.id == order_id, Customer.telegram_id == identity.telegram_id)
        .with_for_update()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi.")
    if order.payment_confirmed or order.status not in {"NEW", "PAYMENT_PENDING"}:
        raise HTTPException(status_code=409, detail="Bu buyurtma uchun to'lov yaratib bo'lmaydi.")
    if order.reservation_expires_at and order.reservation_expires_at <= datetime.utcnow():
        raise HTTPException(status_code=409, detail="Buyurtma muddati tugagan. Savatdan qayta buyurtma bering.")

    _release_stale_creating_payments(db)
    db.commit()
    active = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.provider == HAMYON_PROVIDER,
            Payment.status.in_(ACTIVE_PAYMENT_STATUSES),
        )
        .order_by(Payment.created_at.desc())
        .first()
    )
    if active:
        if active.expires_at and active.expires_at > datetime.utcnow() and active.provider_payment_id:
            return _payment_response(active)
        if active.status == "CREATING" or not active.expires_at:
            raise HTTPException(status_code=409, detail="To'lov yaratilmoqda. Biroz kutib qayta tekshiring.")
        active.status = "CANCELLED"
        active.cancelled_at = datetime.utcnow()
        db.commit()

    base_url, shop_id, shop_key = _hamyon_credentials()
    cipher = _card_cipher()
    payment = _reserve_payment_record(db, order, order.total)
    response: dict | None = None
    last_error = "Hamyon orqali to'lov yaratilmadi."

    for attempt in range(MAX_AMOUNT_ADJUSTMENT + 1):
        if attempt:
            payment.provider_amount = _money(order.total) + attempt
            payment.status = "CREATING"
            payment.created_at = datetime.utcnow()
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                last_error = "Hamyon summasi band ekan."
                continue
        try:
            response = await asyncio.to_thread(
                _hamyon_create_request,
                base_url=base_url,
                shop_id=shop_id,
                shop_key=shop_key,
                amount=payment.provider_amount,
                order_id=order.id,
            )
            if response.get("error"):
                provider_error = str(response.get("error", ""))
                if "summa" in provider_error.lower() and "ochiq" in provider_error.lower() and attempt < MAX_AMOUNT_ADJUSTMENT:
                    continue
                raise RuntimeError("Hamyon to'lov so'rovini qabul qilmadi")
            returned_order = str(response.get("order_id", ""))
            if returned_order not in {str(order.id), f"AQ-{order.id}"}:
                raise RuntimeError("Hamyon order_id mos kelmadi")
            returned_amount = _money(response.get("amount", 0))
            if returned_amount != payment.provider_amount:
                raise RuntimeError("Hamyon payment amount mos kelmadi")
            provider_payment_id = str(response.get("payment_id", "")).strip()
            if not provider_payment_id or len(provider_payment_id) > 255:
                raise RuntimeError("Hamyon payment_id noto'g'ri")
            card_number = _provider_card(response)
            payment.provider_payment_id = provider_payment_id
            payment.card_number_encrypted = cipher.encrypt(card_number.encode()).decode("ascii")
            payment.expires_at = _payment_expiry(response)
            payment.status = "PENDING"
            db.commit()
            db.refresh(payment)
            return _payment_response(payment)
        except HTTPException:
            raise
        except Exception as exc:
            # Provider errors are deliberately reduced to a generic message;
            # neither account credentials nor card data are logged.
            last_error = str(exc)[:160]
            if response is not None:
                provider_error = str(response.get("error", "")).lower()
                if "summa" in provider_error and "ochiq" in provider_error and attempt < MAX_AMOUNT_ADJUSTMENT:
                    continue
            break

    payment.status = "FAILED"
    payment.cancelled_at = datetime.utcnow()
    db.commit()
    logger.warning("Hamyon payment creation failed for local order %s: %s", order.id, last_error)
    raise HTTPException(status_code=502, detail="To'lov yaratilmadi. Sozlamani tekshirib qayta urinib ko'ring.")


@router.get("/{payment_id}", response_model=HamyonPaymentStatusResponse)
def get_customer_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    payment = (
        db.query(Payment)
        .join(Order, Order.id == Payment.order_id)
        .join(Customer, Customer.id == Order.customer_id)
        .filter(Payment.provider_payment_id == payment_id, Customer.telegram_id == identity.telegram_id)
        .first()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="To'lov topilmadi.")
    return HamyonPaymentStatusResponse(
        payment_id=payment.provider_payment_id or "",
        order_id=payment.order_id,
        order_amount=payment.amount,
        payment_amount=payment.provider_amount,
        currency=payment.currency,
        status=payment.status,
        card=_decrypt_card(payment.card_number_encrypted),
        expires_at=_utc_response_time(payment.expires_at),
        paid_at=_utc_response_time(payment.paid_at),
    )


@router.get("/", response_model=list[PaymentAdminResponse])
def list_admin_payments(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    query = db.query(Payment).order_by(Payment.created_at.desc()).limit(500)
    if status:
        normalized = status.upper()
        if normalized not in {"CREATING", "PENDING", "PROCESSING", "PAID", "PAID_REVIEW", "CANCELLED", "FAILED"}:
            raise HTTPException(status_code=400, detail="To'lov holati noto'g'ri.")
        query = query.filter(Payment.status == normalized)
    payments = query.all()
    return [
        PaymentAdminResponse(
            id=p.id,
            order_id=p.order_id,
            provider=p.provider,
            provider_payment_id=p.provider_payment_id,
            amount=p.amount,
            provider_amount=p.provider_amount,
            currency=p.currency,
            status=p.status,
            created_at=_utc_response_time(p.created_at),
            expires_at=_utc_response_time(p.expires_at),
            paid_at=_utc_response_time(p.paid_at),
            cancelled_at=_utc_response_time(p.cancelled_at),
        )
        for p in payments
    ]


@router.post("/callbacks/prepare")
async def hamyon_prepare_callback(request: HttpRequest, db: Session = Depends(get_db)):
    data = _callback_data(request, await request.body())
    payment_id, order_id, amount, status = _validate_callback(data)
    payment = _get_matching_callback_payment(db, payment_id, order_id, amount)
    if payment.status not in ACTIVE_PAYMENT_STATUSES:
        raise HTTPException(status_code=409, detail="To'lov tayyorlash holatiga mos emas.")
    payment.status = "PROCESSING"
    db.commit()
    return {"success": True}


async def _notify_payment_result(order_id: int, payment_id: int, payment_status: str) -> None:
    bot_token = os.getenv("BOT_TOKEN", "").strip()
    admin_id = os.getenv("ADMIN_TELEGRAM_ID", "").strip()
    if not bot_token:
        return
    db = SessionLocal()
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        order = db.query(Order).filter(Order.id == order_id).first()
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first() if order else None
        if order is None or customer is None or payment is None:
            return
        from aiogram import Bot

        bot = Bot(token=bot_token)
        order_name = f"AQ-{order.id}"
        amount = f"{payment.amount:,.0f}".replace(",", " ")
        if payment_status == "PAID" and customer.telegram_id:
            try:
                await bot.send_message(customer.telegram_id, f"To'lov muvaffaqiyatli amalga oshirildi. Buyurtma {order_name}.")
            except Exception:
                logger.warning("Customer payment notification failed for order %s", order.id)
        if admin_id.isdigit():
            try:
                review_text = "\nHolat: PAID_REVIEW — qo'lda ko'rib chiqish kerak." if payment_status == "PAID_REVIEW" else f"\nHolat: {payment_status}"
                await bot.send_message(
                    int(admin_id),
                    f"Yangi to'lov\nBuyurtma: {order_name}\nSumma: {amount} so'm{review_text}",
                )
            except Exception:
                logger.warning("Admin payment notification failed for order %s", order.id)
        await bot.session.close()
    except Exception:
        logger.warning("Telegram payment notification could not be sent for order %s", order_id)
    finally:
        db.close()


@router.post("/callbacks/complete")
async def hamyon_complete_callback(
    request: HttpRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    data = _callback_data(request, await request.body())
    payment_id, order_id, amount, status = _validate_callback(data)
    if status not in {"paid", "cancel"}:
        raise HTTPException(status_code=400, detail="Hamyon yakuniy holati noto'g'ri.")
    payment = _get_matching_callback_payment(db, payment_id, order_id, amount)
    order = db.query(Order).filter(Order.id == payment.order_id).with_for_update().first()
    if order is None:
        raise HTTPException(status_code=404, detail="To'lov buyurtmasi topilmadi.")

    if status == "paid":
        if payment.status == "PAID":
            return {"success": True, "status": "paid"}
        if payment.status == "PAID_REVIEW":
            return {"success": True, "status": "review"}
        if payment.status in {"CANCELLED", "FAILED"}:
            logger.error("Late paid Hamyon callback requires review for order %s", order.id)
            payment.status = "PAID_REVIEW"
            payment.paid_at = datetime.utcnow()
            db.commit()
            background_tasks.add_task(_notify_payment_result, order.id, payment.id, "PAID_REVIEW")
            return {"success": True, "status": "review"}
        try:
            if order.reservation_expires_at and order.reservation_expires_at <= datetime.utcnow():
                payment.status = "PAID_REVIEW"
                payment.paid_at = datetime.utcnow()
                db.commit()
                background_tasks.add_task(_notify_payment_result, order.id, payment.id, "PAID_REVIEW")
                return {"success": True, "status": "review"}
            confirm_payment(
                db=db,
                order_id=order.id,
                payment_method=HAMYON_PROVIDER,
                transaction_id=payment.provider_payment_id or payment_id,
                commit=False,
            )
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail=str(exc)) from None
        payment = db.query(Payment).filter(Payment.id == payment.id).with_for_update().first()
        payment.status = "PAID"
        payment.paid_at = datetime.utcnow()
        db.commit()
        background_tasks.add_task(_notify_payment_result, order.id, payment.id, "PAID")
        return {"success": True, "status": "paid"}

    if payment.status == "PAID":
        return {"success": True, "status": "paid"}
    if payment.status != "CANCELLED":
        payment.status = "CANCELLED"
        payment.cancelled_at = datetime.utcnow()
        # The provider's five-minute timeout cancels this payment attempt,
        # while the existing order reservation stays available for retry.
        db.commit()
    return {"success": True, "status": "cancel"}
