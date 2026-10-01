"""Inventory reservations for unpaid orders."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .models import Order, OrderStatusHistory, Product


def reservation_expiration() -> datetime:
    """Return the UTC expiry time for a newly created unpaid order."""

    raw_hours = os.getenv("ORDER_RESERVATION_HOURS", "12")
    try:
        hours = int(raw_hours)
    except ValueError:
        hours = 12
    hours = min(max(hours, 1), 72)
    return datetime.utcnow() + timedelta(hours=hours)


def release_order_reservation(db: Session, order: Order) -> None:
    """Release an unpaid order's held stock exactly once."""

    if order.payment_confirmed:
        return

    for item in order.items:
        if item.reservation_released:
            continue

        reserved = Decimal(item.stock_units_reserved or 0)
        if reserved <= 0:
            item.reservation_released = True
            continue

        product = (
            db.query(Product)
            .filter(Product.id == item.product_id)
            .with_for_update()
            .first()
        )
        if product is not None:
            product.reserved_stock_units = max(
                Decimal("0"),
                Decimal(product.reserved_stock_units) - reserved,
            )
        item.reservation_released = True

    order.reservation_expires_at = None


def release_expired_reservations(db: Session) -> int:
    """Expire unpaid holds and return their stock to the available pool."""

    expired_orders = (
        db.query(Order)
        .filter(
            Order.status.in_(["NEW", "PAYMENT_PENDING"]),
            Order.payment_confirmed.is_(False),
            Order.reservation_expires_at.is_not(None),
            Order.reservation_expires_at <= datetime.utcnow(),
        )
        .order_by(Order.id.asc())
        .with_for_update(skip_locked=True)
        .all()
    )

    if not expired_orders:
        return 0

    try:
        for order in expired_orders:
            release_order_reservation(db, order)
            previous_status = order.status
            order.status = "CANCELLED"
            db.add(OrderStatusHistory(
                order_id=order.id,
                previous_status=previous_status,
                new_status="CANCELLED",
                actor_telegram_id=None,
                note="To'lov muddati tugadi; band bo'shatildi.",
            ))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return len(expired_orders)
