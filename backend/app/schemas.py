from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# CATEGORIES
# ============================================================


class CategoryResponse(BaseModel):
    id: int

    name: str

    slug: str

    description: str | None = None

    image: str | None = None

    sort_order: int

    is_active: bool

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class CategoryCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    sort_order: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    sort_order: int | None = Field(
        default=None,
        ge=0,
    )

    is_active: bool | None = None


# ============================================================
# PRODUCTS
# ============================================================


class ProductResponse(BaseModel):
    id: int

    name: str

    description: str | None = None

    price: Decimal

    category_id: int

    category: CategoryResponse

    image: str | None = None

    unit_type: Literal[
        "kg",
        "dona",
    ]

    weight_per_unit: Decimal

    stock_units: Decimal

    reserved_stock_units: Decimal = Decimal("0")

    available_stock_units: Decimal

    is_available: bool

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class PublicProductResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: Decimal
    category_id: int
    category: CategoryResponse
    image: str | None = None
    unit_type: Literal["kg", "dona"]
    weight_per_unit: Decimal
    available_stock_units: Decimal
    is_available: bool

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# ORDER ITEMS
# ============================================================


class OrderItemCreate(BaseModel):
    product_id: int = Field(
        gt=0
    )

    quantity: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=3,
    )

    quantity_unit: Literal[
        "kg",
        "dona",
    ]


class OrderItemResponse(BaseModel):
    id: int

    product_id: int

    quantity: Decimal

    quantity_unit: Literal[
        "kg",
        "dona",
    ]

    weight_per_unit: Decimal

    weight_kg: Decimal

    price: Decimal

    subtotal: Decimal

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# CUSTOMER SHORT RESPONSE
# ============================================================


class CustomerShortResponse(BaseModel):
    name: str

    surname: str | None = None

    phone: str

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# ORDER DELIVERY LOCATION
# ============================================================


class OrderDeliveryLocation(BaseModel):
    """
    Buyurtma uchun yetkazib berish lokatsiyasi.

    Agar latitude/longitude yuborilmasa,
    backend mijozning asosiy profil lokatsiyasidan foydalanadi.

    Agar yuborilsa:
    bu buyurtma uchun alohida manzil hisoblanadi
    va mijoz profilini o'zgartirmaydi.
    """

    latitude: float = Field(
        ge=-90,
        le=90,
    )

    longitude: float = Field(
        ge=-180,
        le=180,
    )

    accuracy: float | None = Field(
        default=None,
        ge=0,
    )

    address: str | None = Field(
        default=None,
        max_length=2000,
    )

    landmark: str | None = Field(
        default=None,
        max_length=1000,
    )

    delivery_image_url: str | None = Field(
        default=None,
        max_length=500,
    )


# ============================================================
# CREATE ORDER
# ============================================================


class OrderCreate(BaseModel):
    """
    Checkoutdan buyurtma yaratish.

    Asosiy mijoz ma'lumotlari Customer profilidan olinadi.

    telegram_id:
        Mijozni aniqlash uchun.

    name / phone:
        Hozirgi frontend/backward compatibility uchun
        optional qoldirilgan.
        Keyinchalik Telegram initData authentication
        orqali server Customer profilini aniqlaydi.

    latitude / longitude:
        Agar mijoz profilidagi asosiy lokatsiyadan boshqa
        manzilga buyurtma bermoqchi bo'lsa ishlatiladi.

    Agar latitude/longitude berilmasa,
    backend Customer profilidagi asosiy lokatsiyadan foydalanadi.
    """

    telegram_id: int | None = Field(
        default=None,
        gt=0,
    )

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=30,
    )

    # --------------------------------------------------------
    # ORDER-SPECIFIC DELIVERY LOCATION
    # --------------------------------------------------------

    latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
    )

    accuracy: float | None = Field(
        default=None,
        ge=0,
    )

    address: str | None = Field(
        default=None,
        max_length=2000,
    )

    landmark: str | None = Field(
        default=None,
        max_length=1000,
    )

    delivery_image_url: str | None = Field(
        default=None,
        max_length=500,
    )

    comment: str | None = Field(
        default=None,
        max_length=2000,
    )

    delivery_date: date | None = None

    delivery_time: str | None = Field(default=None, max_length=50)


    # --------------------------------------------------------
    # PRODUCTS
    # --------------------------------------------------------

    items: list[OrderItemCreate] = Field(
        min_length=1
    )


# ============================================================
# ORDER RESPONSE
# ============================================================


class OrderResponse(BaseModel):
    id: int

    total: Decimal

    status: Literal[
        "NEW",
        "PAYMENT_PENDING",
        "PAID",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "DELIVERING",
        "DELIVERED",
        "CANCELLED",
    ]

    # --------------------------------------------------------
    # PAYMENT
    # --------------------------------------------------------

    payment_method: str | None = None

    payment_confirmed: bool

    payment_confirmed_at: datetime | None = None

    # --------------------------------------------------------
    # DELIVERY
    # --------------------------------------------------------

    delivery_date: datetime | None = None

    delivery_time: str | None = None

    delivery_phone: str | None = None

    reservation_expires_at: datetime | None = None

    # --------------------------------------------------------
    # ORDER LOCATION SNAPSHOT
    # --------------------------------------------------------

    latitude: float

    longitude: float

    accuracy: float | None = None

    address: str | None = None

    landmark: str | None = None

    delivery_image_url: str | None = None

    comment: str | None = None

    # --------------------------------------------------------
    # TIMESTAMPS
    # --------------------------------------------------------

    created_at: datetime

    updated_at: datetime

    # --------------------------------------------------------
    # ITEMS
    # --------------------------------------------------------

    items: list[OrderItemResponse] = Field(
        default_factory=list
    )

    status_history: list["OrderStatusHistoryResponse"] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# ORDER STATUS
# ============================================================


class OrderStatusHistoryResponse(BaseModel):
    id: int
    previous_status: str | None = None
    new_status: str
    note: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminCustomerShortResponse(CustomerShortResponse):
    id: int
    telegram_id: int | None = None
    profile_image: str | None = None
    profile_completed: bool = False


class AdminOrderStatusHistoryResponse(OrderStatusHistoryResponse):
    actor_telegram_id: int | None = None


class AdminOrderResponse(OrderResponse):
    customer_id: int
    customer: AdminCustomerShortResponse | None = None
    payment_transaction_id: str | None = None
    status_history: list[AdminOrderStatusHistoryResponse] = Field(default_factory=list)


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "NEW",
        "PAYMENT_PENDING",
        "PAID",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "DELIVERING",
        "DELIVERED",
        "CANCELLED",
    ]


OrderResponse.model_rebuild()


# ============================================================
# DELIVERY
# ============================================================


class DeliveryUpdate(BaseModel):
    delivery_date: datetime | None = None

    delivery_time: str | None = Field(
        default=None,
        max_length=50,
    )


# ============================================================
# PAYMENTS
# ============================================================


class PaymentResponse(BaseModel):
    order_id: int

    payment_method: str

    payment_confirmed: bool

    payment_transaction_id: str | None = None

    payment_confirmed_at: datetime | None = None

    model_config = ConfigDict(
        from_attributes=True
    )


class HamyonPaymentCreateResponse(BaseModel):
    payment_id: str
    order_id: int
    order_amount: Decimal
    payment_amount: Decimal
    currency: str
    card: str
    status: str
    expires_at: datetime | None = None


class HamyonPaymentStatusResponse(BaseModel):
    payment_id: str
    order_id: int
    order_amount: Decimal
    payment_amount: Decimal
    currency: str
    status: str
    card: str | None = None
    expires_at: datetime | None = None
    paid_at: datetime | None = None


class PaymentAdminResponse(BaseModel):
    id: int
    order_id: int
    provider: str
    provider_payment_id: str | None = None
    amount: Decimal
    provider_amount: Decimal
    currency: str
    status: str
    created_at: datetime
    expires_at: datetime | None = None
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None


class InventoryMovementCreate(BaseModel):
    product_id: int = Field(gt=0)
    kind: Literal["RECEIPT", "RETURN", "ADJUSTMENT"]
    quantity_delta: Decimal
    note: str | None = Field(default=None, max_length=500)


class InventoryMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    unit_type: Literal["kg", "dona"]
    order_id: int | None = None
    kind: str
    quantity_delta: Decimal
    note: str | None = None
    actor_telegram_id: int | None = None
    created_at: datetime


class StoreSettingsResponse(BaseModel):
    id: int
    shop_name: str
    support_phone: str | None = None
    support_telegram: str | None = None
    store_address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    shop_image_url: str | None = None
    guide_text: str
    terms_text: str
    updates_text: str

    model_config = ConfigDict(from_attributes=True)


class StoreSettingsUpdate(BaseModel):
    shop_name: str | None = Field(default=None, min_length=1, max_length=160)
    support_phone: str | None = Field(default=None, max_length=30)
    support_telegram: str | None = Field(default=None, max_length=100)
    store_address: str | None = Field(default=None, max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    shop_image_url: str | None = Field(default=None, max_length=500)
    guide_text: str | None = Field(default=None, max_length=12000)
    terms_text: str | None = Field(default=None, max_length=12000)
    updates_text: str | None = Field(default=None, max_length=12000)
