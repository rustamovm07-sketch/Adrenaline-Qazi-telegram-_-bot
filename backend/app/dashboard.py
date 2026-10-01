from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .models import Customer, Order, OrderItem, Product
from .security import TelegramIdentity, require_admin


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


def decimal_to_float(
    value: Decimal | None,
) -> float:
    if value is None:
        return 0.0

    return float(value)


@router.get("/")
def get_dashboard(
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    now = datetime.utcnow()

    # Bugunning boshlanishi
    today_start = datetime(
        now.year,
        now.month,
        now.day,
    )

    # Ertangi kun boshlanishi
    tomorrow_start = (
        today_start + timedelta(days=1)
    )

    # Oyning boshlanishi
    month_start = datetime(
        now.year,
        now.month,
        1,
    )

    # ========================================================
    # ORDER COUNTS
    # ========================================================

    total_orders = (
        db.query(func.count(Order.id))
        .scalar()
        or 0
    )

    today_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.created_at >= today_start,
            Order.created_at < tomorrow_start,
        )
        .scalar()
        or 0
    )

    month_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.created_at >= month_start,
        )
        .scalar()
        or 0
    )

    new_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.status.in_(["NEW", "PAYMENT_PENDING"]),
        )
        .scalar()
        or 0
    )

    paid_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.payment_confirmed.is_(True),
        )
        .scalar()
        or 0
    )

    delivering_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.status == "DELIVERING",
        )
        .scalar()
        or 0
    )

    delivered_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.status == "DELIVERED",
        )
        .scalar()
        or 0
    )

    # ========================================================
    # REVENUE
    #
    # Muhim:
    # Faqat haqiqiy to'lov tasdiqlangan
    # orderlar tushum sifatida hisoblanadi.
    # ========================================================

    total_revenue = (
        db.query(
            func.coalesce(
                func.sum(Order.total),
                0,
            )
        )
        .filter(
            Order.payment_confirmed.is_(True),
        )
        .scalar()
    )

    today_revenue = (
        db.query(
            func.coalesce(
                func.sum(Order.total),
                0,
            )
        )
        .filter(
            Order.payment_confirmed.is_(True),
            Order.created_at >= today_start,
            Order.created_at < tomorrow_start,
        )
        .scalar()
    )

    month_revenue = (
        db.query(
            func.coalesce(
                func.sum(Order.total),
                0,
            )
        )
        .filter(
            Order.payment_confirmed.is_(True),
            Order.created_at >= month_start,
        )
        .scalar()
    )

    # ========================================================
    # CUSTOMERS
    # ========================================================

    total_customers = (
        db.query(func.count(Customer.id))
        .scalar()
        or 0
    )

    # ========================================================
    # PRODUCTS / STOCK
    # ========================================================

    total_products = (
        db.query(func.count(Product.id))
        .scalar()
        or 0
    )

    available_products = (
        db.query(func.count(Product.id))
        .filter(
            Product.is_available.is_(True),
        )
        .scalar()
        or 0
    )

    low_stock_products = (
        db.query(func.count(Product.id))
        .filter(
            Product.is_available.is_(True),
            Product.stock_units > 0,
            Product.stock_units <= 10,
        )
        .scalar()
        or 0
    )

    out_of_stock_products = (
        db.query(func.count(Product.id))
        .filter(
            Product.stock_units <= 0,
        )
        .scalar()
        or 0
    )

    # ========================================================
    # SOLD WEIGHT
    #
    # Faqat payment tasdiqlangan orderlar.
    # ========================================================

    total_sold_kg = (
        db.query(
            func.coalesce(
                func.sum(
                    OrderItem.weight_kg
                ),
                0,
            )
        )
        .join(
            Order,
            Order.id
            == OrderItem.order_id,
        )
        .filter(
            Order.payment_confirmed.is_(True),
        )
        .scalar()
    )

    today_sold_kg = (
        db.query(
            func.coalesce(
                func.sum(
                    OrderItem.weight_kg
                ),
                0,
            )
        )
        .join(
            Order,
            Order.id
            == OrderItem.order_id,
        )
        .filter(
            Order.payment_confirmed.is_(True),
            Order.created_at >= today_start,
            Order.created_at < tomorrow_start,
        )
        .scalar()
    )

    month_sold_kg = (
        db.query(
            func.coalesce(
                func.sum(
                    OrderItem.weight_kg
                ),
                0,
            )
        )
        .join(
            Order,
            Order.id
            == OrderItem.order_id,
        )
        .filter(
            Order.payment_confirmed.is_(True),
            Order.created_at >= month_start,
        )
        .scalar()
    )

    # ========================================================
    # RECENT ORDERS
    # ========================================================

    recent_orders = (
        db.query(Order)
        .order_by(
            Order.id.desc()
        )
        .limit(8)
        .all()
    )

    recent_orders_data = []

    for order in recent_orders:
        recent_orders_data.append(
            {
                "id": order.id,
                "customer_name": (
                    order.customer.name
                    if order.customer
                    else "Noma'lum"
                ),
                "total": decimal_to_float(
                    order.total
                ),
                "status": order.status,
                "payment_confirmed": (
                    order.payment_confirmed
                ),
                "created_at": (
                    order.created_at
                ),
            }
        )

    # ========================================================
    # TOP PRODUCTS
    #
    # Payment tasdiqlangan buyurtmalardan.
    # ========================================================

    top_products = (
        db.query(
            Product.id,
            Product.name,
            func.sum(
                OrderItem.weight_kg
            ).label("sold_kg"),
            func.sum(
                OrderItem.subtotal
            ).label("revenue"),
        )
        .join(
            OrderItem,
            OrderItem.product_id
            == Product.id,
        )
        .join(
            Order,
            Order.id
            == OrderItem.order_id,
        )
        .filter(
            Order.payment_confirmed.is_(True),
        )
        .group_by(
            Product.id,
            Product.name,
        )
        .order_by(
            func.sum(
                OrderItem.weight_kg
            ).desc()
        )
        .limit(5)
        .all()
    )

    top_products_data = []

    for product in top_products:
        top_products_data.append(
            {
                "id": product.id,
                "name": product.name,
                "sold_kg": decimal_to_float(
                    product.sold_kg
                ),
                "revenue": decimal_to_float(
                    product.revenue
                ),
            }
        )

    # ========================================================
    # LOW STOCK PRODUCTS
    # ========================================================

    low_stock = (
        db.query(Product)
        .filter(
            Product.is_available.is_(True),
            Product.stock_units <= 10,
        )
        .order_by(
            Product.stock_units.asc()
        )
        .limit(8)
        .all()
    )

    low_stock_data = []

    for product in low_stock:
        low_stock_data.append(
            {
                "id": product.id,
                "name": product.name,
                "unit_type": product.unit_type,
                "stock_units": decimal_to_float(
                    product.stock_units
                ),
                "weight_per_unit":
                    decimal_to_float(
                        product.weight_per_unit
                    ),
            }
        )

    return {
        "period": {
            "today": today_start.isoformat(),
            "month": month_start.isoformat(),
        },

        "orders": {
            "total": total_orders,
            "today": today_orders,
            "month": month_orders,
            "new": new_orders,
            "paid": paid_orders,
            "delivering": delivering_orders,
            "delivered": delivered_orders,
        },

        "revenue": {
            "total": decimal_to_float(
                total_revenue
            ),
            "today": decimal_to_float(
                today_revenue
            ),
            "month": decimal_to_float(
                month_revenue
            ),
        },

        "customers": {
            "total": total_customers,
        },

        "products": {
            "total": total_products,
            "available": available_products,
            "low_stock": low_stock_products,
            "out_of_stock":
                out_of_stock_products,
        },

        "sales": {
            "total_sold_kg":
                decimal_to_float(
                    total_sold_kg
                ),
            "today_sold_kg":
                decimal_to_float(
                    today_sold_kg
                ),
            "month_sold_kg":
                decimal_to_float(
                    month_sold_kg
                ),
        },

        "recent_orders":
            recent_orders_data,

        "top_products":
            top_products_data,

        "low_stock_products":
            low_stock_data,
    }
