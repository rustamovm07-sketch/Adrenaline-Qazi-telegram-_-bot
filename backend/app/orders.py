from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP
import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .models import Customer, InventoryMovement, Order, OrderItem, OrderStatusHistory, Product
from .media_security import validate_image_bytes
from .schemas import (
    DeliveryUpdate,
    AdminOrderResponse,
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
)
from .security import TelegramIdentity, get_current_telegram_user, require_admin
from .bot import notify_admin_new_order, notify_order_status
from .inventory import (
    release_expired_reservations,
    release_order_reservation,
    reservation_expiration,
)


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)

DELIVERY_IMAGE_DIR = Path(__file__).resolve().parent.parent / "uploads" / "order-delivery"
DELIVERY_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
DELIVERY_IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
}
MAX_DELIVERY_IMAGE_SIZE = 5 * 1024 * 1024


VALID_STATUSES = {
    "NEW",
    "PAYMENT_PENDING",
    "PAID",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "DELIVERING",
    "DELIVERED",
    "CANCELLED",
}

ALLOWED_STATUS_TRANSITIONS = {
    "NEW": {"CANCELLED"},
    "PAYMENT_PENDING": {"CANCELLED"},
    "PAID": {"CONFIRMED"},
    "CONFIRMED": {"PREPARING"},
    "PREPARING": {"READY"},
    "READY": {"DELIVERING"},
    "DELIVERING": {"DELIVERED"},
    "DELIVERED": set(),
}


# ============================================================
# CALCULATE ORDER ITEM
# ============================================================

@router.post("/delivery-image")
async def upload_delivery_image(
    image: UploadFile = File(...),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    image_info = DELIVERY_IMAGE_TYPES.get(image.content_type or "")
    if image_info is None:
        raise HTTPException(status_code=400, detail="Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.")

    try:
        content = await image.read(MAX_DELIVERY_IMAGE_SIZE + 1)
        if not content or len(content) > MAX_DELIVERY_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Rasm bo'sh yoki hajmi 5 MB dan katta.")

        extension, signature_check = image_info
        if not signature_check(content):
            raise HTTPException(status_code=400, detail="Rasm faylining tarkibi formati bilan mos kelmadi.")
        validate_image_bytes(content, image.content_type)

        filename = f"{identity.telegram_id}_{uuid4().hex}{extension}"
        (DELIVERY_IMAGE_DIR / filename).write_bytes(content)
        return {"image_url": f"/uploads/order-delivery/{filename}"}
    finally:
        await image.close()

def calculate_item(
    product: Product,
    quantity: Decimal,
    quantity_unit: str,
):
    """
    Buyurtmadagi mahsulot miqdorini hisoblaydi.

    product.unit_type:
        kg
        dona

    quantity_unit:
        kg
        dona

    Natija:
        weight_kg
        stock_required
        price
        subtotal
    """

    if quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Mahsulot miqdori 0 dan katta bo'lishi kerak",
        )

    if quantity_unit not in {"kg", "dona"}:
        raise HTTPException(
            status_code=400,
            detail="O'lchov birligi faqat kg yoki dona bo'lishi mumkin",
        )

    weight_per_unit = Decimal(
        product.weight_per_unit
    )

    if weight_per_unit <= 0:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Mahsulot {product.id} uchun "
                "og'irlik sozlamasi noto'g'ri"
            ),
        )

    # ========================================================
    # DONA PRODUCT
    # ========================================================

    if product.unit_type == "dona":

        if quantity_unit == "dona":
            stock_required = quantity

            weight_kg = (
                quantity * weight_per_unit
            )

        else:
            stock_required_decimal = (
                quantity / weight_per_unit
            )

            if (
                stock_required_decimal
                != stock_required_decimal.to_integral_value()
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Bu mahsulotda 1 dona = "
                        f"{weight_per_unit} kg. "
                        f"Miqdor {weight_per_unit} kg "
                        "ga karrali bo'lishi kerak."
                    ),
                )

            stock_required = (
                stock_required_decimal.to_integral_value()
            )

            weight_kg = quantity

    # ========================================================
    # KG PRODUCT
    # ========================================================

    elif product.unit_type == "kg":

        if quantity_unit == "kg":
            weight_kg = quantity
            stock_required = quantity

        else:
            weight_kg = (
                quantity * weight_per_unit
            )

            stock_required = weight_kg

    else:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Mahsulot {product.id} "
                "uchun unit_type noto'g'ri"
            ),
        )

    price = Decimal(product.price)

    subtotal = (
        weight_kg * price
    )

    return {
        "weight_kg": weight_kg,
        "stock_required": stock_required,
        "price": price,
        "subtotal": subtotal,
    }


# ============================================================
# LOAD ORDER
# ============================================================

def load_order(
    db: Session,
    order_id: int,
):
    return (
        db.query(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.status_history),
        )
        .filter(
            Order.id == order_id
        )
        .first()
    )


# ============================================================
# GET CUSTOMER FOR ORDER
# ============================================================

def get_customer_for_order(
    db: Session,
    order_data: OrderCreate,
) -> Customer:
    """
    Buyurtma uchun Customer topadi.

    Yangi asosiy workflow:
        Telegram ID -> mavjud Customer Profile

    Legacy fallback:
        phone -> Customer

    Muhim:
        Telegram foydalanuvchisi uchun profil bo'lmasa,
        buyurtma yaratishga ruxsat berilmaydi.
    """

    customer = None

    # ========================================================
    # TELEGRAM CUSTOMER
    # ========================================================

    if order_data.telegram_id is not None:
        customer = (
            db.query(Customer)
            .filter(
                Customer.telegram_id
                == order_data.telegram_id
            )
            .first()
        )

        if customer is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Mijoz profili topilmadi. "
                    "Avval profilni to'ldiring."
                ),
            )

        if not customer.profile_completed:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Mijoz profili to'liq emas. "
                    "Buyurtma berishdan oldin profilni to'ldiring."
                ),
            )

        return customer

    # ========================================================
    # LEGACY / NON-TELEGRAM FLOW
    # ========================================================

    if order_data.phone:
        customer = (
            db.query(Customer)
            .filter(
                Customer.phone
                == order_data.phone
            )
            .first()
        )

    if customer is not None:
        return customer

    # Telegramsiz eski workflow uchun
    # zarur ma'lumotlar tekshiriladi.

    if not order_data.name:
        raise HTTPException(
            status_code=400,
            detail="Mijoz ismi kerak",
        )

    if not order_data.phone:
        raise HTTPException(
            status_code=400,
            detail="Mijoz telefoni kerak",
        )

    customer = Customer(
        telegram_id=None,
        name=order_data.name,
        phone=order_data.phone,
        profile_completed=False,
    )

    db.add(customer)
    db.flush()

    return customer


# ============================================================
# RESOLVE DELIVERY DATA
# ============================================================

def resolve_delivery_data(
    order_data: OrderCreate,
    customer: Customer,
):
    """
    Order uchun delivery ma'lumotlarini aniqlaydi.

    Ustuvorlik:

    1. Checkoutda berilgan ma'lumot
    2. Customer profilidagi default ma'lumot

    Orderga yakuniy qiymatlar snapshot sifatida yoziladi.
    """

    latitude = (
        order_data.latitude
        if order_data.latitude is not None
        else customer.latitude
    )

    longitude = (
        order_data.longitude
        if order_data.longitude is not None
        else customer.longitude
    )

    accuracy = (
        order_data.accuracy
        if order_data.accuracy is not None
        else customer.accuracy
    )

    address = (
        order_data.address
        if order_data.address
        else customer.address
    )

    landmark = (
        order_data.landmark
        if order_data.landmark
        else customer.landmark
    )

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Yetkazib berish lokatsiyasi "
                "mavjud emas. Profilga lokatsiya "
                "qo'shing yoki checkoutda lokatsiya tanlang."
            ),
        )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "address": address,
        "landmark": landmark,
    }


# ============================================================
# CREATE ORDER
# ============================================================

@router.post(
    "/",
    response_model=OrderResponse,
)
def create_order(
    order_data: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    if (
        order_data.telegram_id is not None
        and order_data.telegram_id != identity.telegram_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Buyurtma Telegram foydalanuvchisi mos kelmadi.",
        )

    # Telegram imzosi bilan tasdiqlangan ID doim request body'dan ustun.
    order_data = order_data.model_copy(
        update={"telegram_id": identity.telegram_id}
    )

    image_url = order_data.delivery_image_url
    image_prefix = f"/uploads/order-delivery/{identity.telegram_id}_"
    if not image_url or not image_url.startswith(image_prefix):
        raise HTTPException(
            status_code=400,
            detail="Buyurtmaga yetkazish manzili rasmini biriktiring.",
        )
    image_filename = Path(image_url).name
    if (
        image_url != f"{image_prefix}{image_filename}"
        or not (DELIVERY_IMAGE_DIR / image_filename).is_file()
    ):
        raise HTTPException(
            status_code=400,
            detail="Manzil rasmi topilmadi. Iltimos, rasmni qayta tanlang.",
        )

    release_expired_reservations(db)

    if (
        order_data.delivery_date is not None
        and order_data.delivery_date < datetime.utcnow().date()
    ):
        raise HTTPException(
            status_code=400,
            detail="Yetkazish sanasi bugun yoki kelajakda bo'lishi kerak.",
        )

    if not order_data.items:
        raise HTTPException(
            status_code=400,
            detail=(
                "Buyurtmada kamida "
                "1 ta mahsulot bo'lishi kerak"
            ),
        )

    # ========================================================
    # CUSTOMER
    # ========================================================

    customer = get_customer_for_order(
        db=db,
        order_data=order_data,
    )

    # ========================================================
    # DELIVERY SNAPSHOT
    # ========================================================

    delivery = resolve_delivery_data(
        order_data=order_data,
        customer=customer,
    )

    # ========================================================
    # MERGE SAME PRODUCTS
    # ========================================================

    merged_items: dict[
        tuple[int, str],
        Decimal,
    ] = {}

    for item in order_data.items:
        key = (
            item.product_id,
            item.quantity_unit,
        )

        if key not in merged_items:
            merged_items[key] = Decimal("0")

        merged_items[key] += Decimal(
            str(item.quantity)
        )

    # ========================================================
    # CREATE ORDER
    # ========================================================

    order = Order(
        customer_id=customer.id,

        total=Decimal("0"),

        status="PAYMENT_PENDING",

        payment_method=None,
        payment_confirmed=False,
        payment_transaction_id=None,
        payment_confirmed_at=None,

        delivery_date=(
            datetime.combine(order_data.delivery_date, time.min)
            if order_data.delivery_date is not None
            else None
        ),
        delivery_time=order_data.delivery_time,
        delivery_phone=(
            order_data.phone.strip()
            if order_data.phone and order_data.phone.strip()
            else customer.phone
        ),
        reservation_expires_at=reservation_expiration(),

        latitude=delivery["latitude"],
        longitude=delivery["longitude"],
        accuracy=delivery["accuracy"],

        address=delivery["address"],
        landmark=delivery["landmark"],
        delivery_image_url=image_url,
        comment=order_data.comment,
    )

    db.add(order)
    db.flush()
    db.add(OrderStatusHistory(
        order_id=order.id,
        previous_status=None,
        new_status="PAYMENT_PENDING",
        actor_telegram_id=identity.telegram_id,
        note="Buyurtma yaratildi; to'lov kutilmoqda.",
    ))

    # ========================================================
    # CREATE ORDER ITEMS
    # ========================================================

    total = Decimal("0")

    try:

        for (
            product_id,
            quantity_unit,
        ), quantity in sorted(merged_items.items()):

            product = (
                db.query(Product)
                .filter(
                    Product.id == product_id,
                    Product.is_available.is_(True),
                )
                .with_for_update()
                .first()
            )

            if product is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Mahsulot topilmadi: "
                        f"{product_id}"
                    ),
                )

            calculation = calculate_item(
                product=product,
                quantity=quantity,
                quantity_unit=quantity_unit,
            )

            stock_required = calculation[
                "stock_required"
            ]

            available_stock = max(
                Decimal("0"),
                Decimal(product.stock_units)
                - Decimal(product.reserved_stock_units),
            )

            # =================================================
            # STOCK FAQAT TEKSHIRILADI
            # =================================================
            #
            # Muhim:
            # Order yaratilganda stock kamaymaydi.
            #
            # Real payment confirm bo'lganda
            # confirm_payment() stockni kamaytiradi.
            #

            if (
                available_stock
                < stock_required
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"'{product.name}' "
                        "mahsulotidan yetarli stock yo'q. "
                        f"Mavjud: {available_stock}, "
                        f"kerak: {stock_required}"
                    ),
                )

            order_item = OrderItem(
                order_id=order.id,

                product_id=product.id,

                quantity=quantity,

                quantity_unit=quantity_unit,

                stock_units_reserved=stock_required,

                weight_per_unit=Decimal(
                    product.weight_per_unit
                ),

                weight_kg=calculation[
                    "weight_kg"
                ],

                price=calculation[
                    "price"
                ],

                subtotal=calculation[
                    "subtotal"
                ],
            )

            db.add(order_item)
            product.reserved_stock_units = (
                Decimal(product.reserved_stock_units)
                + stock_required
            )

            total += calculation[
                "subtotal"
            ]

        order.total = total.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

    created_order = load_order(
        db,
        order.id,
    )
    background_tasks.add_task(
        notify_admin_new_order,
        created_order.id,
        str(created_order.total),
        len(created_order.items),
        created_order.customer.name if created_order.customer else "Mijoz",
        created_order.delivery_phone or "Ko'rsatilmagan",
        created_order.address,
        created_order.landmark,
    )
    return created_order


# ============================================================
# GET ALL ORDERS
# ============================================================

@router.get(
    "/mine",
    response_model=list[OrderResponse],
)
def get_my_orders(
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    release_expired_reservations(db)
    return (
        db.query(Order)
        .join(Customer, Customer.id == Order.customer_id)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.status_history),
        )
        .filter(Customer.telegram_id == identity.telegram_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )

@router.get(
    "/",
    response_model=list[AdminOrderResponse],
)
def get_orders(
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    release_expired_reservations(db)
    return (
        db.query(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.status_history),
        )
        .order_by(
            Order.id.desc()
        )
        .all()
    )


# ============================================================
# GET SINGLE ORDER
# ============================================================

@router.get(
    "/{order_id}",
)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    release_expired_reservations(db)
    order = load_order(
        db,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Buyurtma topilmadi",
        )

    owner_id = os.getenv("ADMIN_TELEGRAM_ID", "").strip()
    is_admin = owner_id.isdigit() and identity.telegram_id == int(owner_id)
    is_customer = (
        order.customer is not None
        and order.customer.telegram_id == identity.telegram_id
    )
    if not is_admin and not is_customer:
        raise HTTPException(
            status_code=403,
            detail="Bu buyurtmani ko'rishga ruxsatingiz yo'q.",
        )

    response_schema = AdminOrderResponse if is_admin else OrderResponse
    return response_schema.model_validate(order)


# ============================================================
# UPDATE STATUS
# ============================================================

@router.patch(
    "/{order_id}/status",
    response_model=AdminOrderResponse,
)
def update_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    if status_data.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Noto'g'ri buyurtma statusi",
        )

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Buyurtma topilmadi",
        )

    if status_data.status == order.status:
        return load_order(db, order.id)

    if status_data.status not in ALLOWED_STATUS_TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Buyurtma holatini {order.status} dan {status_data.status} ga "
                "o'zgartirib bo'lmaydi. To'lov faqat payment callback orqali tasdiqlanadi."
            ),
        )

    # ========================================================
    # PAYMENT STATUS PROTECTION
    # ========================================================

    if (
        status_data.status == "PAID"
        and not order.payment_confirmed
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "PAID statusini faqat "
                "tasdiqlangan to'lov orqali "
                "berish mumkin"
            ),
        )

    if status_data.status == "CANCELLED":
        if order.payment_confirmed:
            raise HTTPException(
                status_code=409,
                detail="To'langan buyurtmani admin orqali bekor qilib bo'lmaydi.",
            )
        release_order_reservation(db, order)

    if (
        status_data.status == "DELIVERING"
        and not order.payment_confirmed
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "To'lov tasdiqlanmagan "
                "buyurtmani yetkazishga "
                "chiqarib bo'lmaydi"
            ),
        )

    if (
        status_data.status == "DELIVERED"
        and not order.payment_confirmed
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "To'lov tasdiqlanmagan "
                "buyurtmani yakunlab bo'lmaydi"
            ),
        )

    previous_status = order.status
    order.status = status_data.status
    db.add(OrderStatusHistory(
        order_id=order.id,
        previous_status=previous_status,
        new_status=order.status,
        actor_telegram_id=_.telegram_id,
    ))

    db.commit()

    updated_order = load_order(
        db,
        order.id,
    )
    background_tasks.add_task(
        notify_order_status,
        updated_order.customer.telegram_id if updated_order.customer else None,
        updated_order.id,
        updated_order.status,
        updated_order.delivery_time,
    )
    return updated_order


# ============================================================
# DELIVERY DATE / TIME
# ============================================================

@router.patch(
    "/{order_id}/delivery",
    response_model=AdminOrderResponse,
)
def update_delivery(
    order_id: int,
    delivery_data: DeliveryUpdate,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Buyurtma topilmadi",
        )

    order.delivery_date = (
        delivery_data.delivery_date
    )

    order.delivery_time = (
        delivery_data.delivery_time
    )

    db.commit()

    return load_order(
        db,
        order.id,
    )


# ============================================================
# PAYMENT CONFIRMATION
# ============================================================

def confirm_payment(
    db: Session,
    order_id: int,
    payment_method: str,
    transaction_id: str,
    background_tasks: BackgroundTasks | None = None,
    commit: bool = True,
):
    """
    Real Payme / Click callbackidan keyin ishlatiladi.

    Payment tasdiqlangandan keyingina:

    1. payment_confirmed = True
    2. transaction_id saqlanadi
    3. order status = PAID
    4. stock kamayadi

    Transaction ID orqali double payment himoyalanadi.
    """

    if not payment_method:
        raise ValueError(
            "payment_method kerak"
        )

    if not transaction_id:
        raise ValueError(
            "transaction_id kerak"
        )

    # Muddati tugagan buyurtmalar to'lovni endi qabul qilmaydi.
    # Provider callback takror yuborilgan bo'lsa ham bu tekshiruv
    # transaction lock olinmasidan oldin muddati o'tgan bandni bo'shatadi.
    release_expired_reservations(db)

    order = (
        db.query(Order)
        .filter(
            Order.id == order_id
        )
        .with_for_update()
        .first()
    )

    if order is None:
        raise ValueError(
            "Buyurtma topilmadi"
        )

    # ========================================================
    # IDEMPOTENCY
    # ========================================================

    if order.payment_confirmed:
        if (
            order.payment_transaction_id != transaction_id
            or order.payment_method != payment_method
        ):
            raise ValueError(
                "Buyurtma boshqa payment transaction bilan tasdiqlangan"
            )
        return load_order(
            db,
            order.id,
        )

    if order.status not in {"NEW", "PAYMENT_PENDING"}:
        raise ValueError(
            "Faqat yangi va muddati o'tmagan buyurtma to'lovi tasdiqlanadi"
        )

    existing_payment = (
        db.query(Order)
        .filter(
            Order.payment_transaction_id
            == transaction_id,
            Order.id != order.id,
        )
        .first()
    )

    if existing_payment is not None:
        raise ValueError(
            "Bu transaction_id boshqa "
            "buyurtmada ishlatilgan"
        )

    try:

        # ====================================================
        # STOCK LOCK + DECREMENT
        # ====================================================

        for item in order.items:

            product = (
                db.query(Product)
                .filter(
                    Product.id
                    == item.product_id
                )
                .with_for_update()
                .first()
            )

            if product is None:
                raise ValueError(
                    f"Mahsulot topilmadi: "
                    f"{item.product_id}"
                )

            stock_required = Decimal(item.stock_units_reserved or 0)
            if stock_required <= 0:
                # Support historical orders created before reservations.
                calculation = calculate_item(
                    product=product,
                    quantity=Decimal(item.quantity),
                    quantity_unit=item.quantity_unit,
                )
                stock_required = calculation["stock_required"]

            current_stock = Decimal(
                product.stock_units
            )

            if current_stock < stock_required:
                raise ValueError(
                    (
                        f"'{product.name}' "
                        "mahsulotidan yetarli stock "
                        "qolmagan. "
                        f"Mavjud: {current_stock}, "
                        f"kerak: {stock_required}"
                    )
                )

            product.stock_units = (
                current_stock
                - stock_required
            )
            db.add(InventoryMovement(
                product_id=product.id,
                order_id=order.id,
                kind="SALE",
                quantity_delta=-stock_required,
                note=f"Buyurtma #{order.id} to'lovi tasdiqlandi.",
            ))

            if not item.reservation_released:
                product.reserved_stock_units = max(
                    Decimal("0"),
                    Decimal(product.reserved_stock_units or 0)
                    - Decimal(item.stock_units_reserved or 0),
                )
                item.reservation_released = True

            if product.stock_units <= 0:
                product.stock_units = Decimal(
                    "0"
                )

                product.is_available = False

        # ====================================================
        # CONFIRM PAYMENT
        # ====================================================

        order.payment_method = (
            payment_method
        )

        order.payment_confirmed = True

        order.payment_transaction_id = (
            transaction_id
        )

        order.payment_confirmed_at = (
            datetime.utcnow()
        )

        previous_status = order.status
        order.status = "PAID"
        order.reservation_expires_at = None
        db.add(OrderStatusHistory(
            order_id=order.id,
            previous_status=previous_status,
            new_status="PAID",
            actor_telegram_id=None,
            note=f"{payment_method} callback orqali tasdiqlandi.",
        ))

        if commit:
            db.commit()

    except Exception:
        db.rollback()
        raise

    paid_order = load_order(db, order.id)
    if background_tasks is not None:
        background_tasks.add_task(
            notify_order_status,
            paid_order.customer.telegram_id if paid_order.customer else None,
            paid_order.id,
            paid_order.status,
            paid_order.delivery_time,
        )
    return paid_order
