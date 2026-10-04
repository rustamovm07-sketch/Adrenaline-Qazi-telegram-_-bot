from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    func,
    Integer,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# =========================================================
# CUSTOMER
# =========================================================

class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Telegram Mini App / Bot foydalanuvchisi
    telegram_id: Mapped[int | None] = mapped_column(
        BigInteger,
        unique=True,
        nullable=True,
        index=True,
    )

    # Mijozning to'liq ismi.
    #
    # Eski API va Order workflow bilan backward-compatible
    # bo'lishi uchun mavjud "name" maydoni saqlanadi.
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    # Familiya
    surname: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Telefon raqam
    phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    # =====================================================
    # PROFILE
    # =====================================================

    # Telegram/Mini App profil rasmi URL yoki fayl yo'li.
    #
    # Keyinchalik Telegram profile photo yoki
    # server storage bilan ishlashi mumkin.
    profile_image: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Profil ro'yxatdan o'tishi to'liq tugaganmi?
    profile_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    # =====================================================
    # DEFAULT DELIVERY LOCATION
    # =====================================================

    # Mijoz profilidagi asosiy lokatsiya.
    #
    # Bu checkoutdagi default manzil.
    # Orderdagi latitude/longitude esa buyurtma vaqtida
    # alohida snapshot sifatida saqlanadi.
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # GPS aniqlik darajasi.
    accuracy: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # Mijozning asosiy yozma manzili.
    #
    # Masalan:
    # "Chilonzor 9-mavze, 12-uy"
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Yetkazib beruvchi uchun orientir.
    #
    # Masalan:
    # "Maktab yonidagi oq darvoza"
    landmark: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # =====================================================
    # TIMESTAMPS
    # =====================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    orders = relationship(
        "Order",
        back_populates="customer",
        cascade="all, delete-orphan",
    )


# =========================================================
# CATEGORY
# =========================================================

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    slug: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    image: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    products = relationship(
        "Product",
        back_populates="category",
    )


# =========================================================
# PRODUCT
# =========================================================

class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Narx 1 kg uchun.
    #
    # Masalan:
    # 180000 so'm / kg
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # =====================================================
    # CATEGORY
    # =====================================================

    category_id: Mapped[int] = mapped_column(
        ForeignKey(
            "categories.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    image: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Mahsulot qanday o'lchovda sotilishini bildiradi.
    #
    # kg
    # dona
    unit_type: Mapped[str] = mapped_column(
        String(20),
        default="kg",
        nullable=False,
    )

    # 1 dona necha kg?
    #
    # Masalan:
    # Qazi = 1.2 kg
    #
    # kg bilan sotiladigan mahsulotda 1 bo'lishi mumkin.
    weight_per_unit: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("1"),
        nullable=False,
    )

    # Ombordagi dona soni.
    #
    # Masalan:
    # 100 dona
    #
    # Jami kg:
    # 100 × 1.2 = 120 kg
    stock_units: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        default=Decimal("0"),
        nullable=False,
    )

    # Stock held for unpaid orders. Physical stock only changes on payment.
    reserved_stock_units: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        default=Decimal("0"),
        nullable=False,
    )

    @property
    def available_stock_units(self) -> Decimal:
        return max(
            Decimal("0"),
            Decimal(self.stock_units or 0) - Decimal(self.reserved_stock_units or 0),
        )

    # Mahsulot sotuvda mavjudmi?
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    category = relationship(
        "Category",
        back_populates="products",
    )

    order_items = relationship(
        "OrderItem",
        back_populates="product",
    )

    inventory_movements = relationship(
        "InventoryMovement",
        back_populates="product",
        cascade="all, delete-orphan",
    )


# =========================================================
# ORDER
# =========================================================

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Mijoz
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )

    # Buyurtmaning umumiy summasi
    total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # Yandex Go fare forecast attached to this delivery.
    delivery_fee: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False,
    )

    # =====================================================
    # BUYURTMA STATUSI
    #
    # PAYMENT_PENDING -> PAID -> CONFIRMED -> PREPARING -> READY -> DELIVERING -> DELIVERED
    # =====================================================

    status: Mapped[str] = mapped_column(
        String(30),
        default="PAYMENT_PENDING",
        nullable=False,
        index=True,
    )

    # =====================================================
    # PAYMENT
    # =====================================================

    # Hamyon UZCARD or an explicitly audited manual method
    payment_method: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # To'lov haqiqatan tasdiqlanganmi?
    payment_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    # Payment tizimining transaction ID'si
    payment_transaction_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )

    payment_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # =====================================================
    # DELIVERY
    # =====================================================

    # Admin belgilaydigan yetkazish sanasi.
    delivery_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # Masalan:
    # "14:00–16:00"
    delivery_time: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    # Telefon number provided for this specific delivery.
    delivery_phone: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # Unpaid orders release their inventory hold after this UTC time.
    reservation_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )

    # =====================================================
    # DELIVERY LOCATION SNAPSHOT
    # =====================================================

    # Muhim:
    #
    # Bu Customer profilidagi lokatsiya emas.
    #
    # Bu aynan ushbu order yaratilgan paytdagi
    # yetkazib berish lokatsiyasining snapshot'i.
    #
    # Customer keyinchalik profilini o'zgartirsa,
    # eski order o'zgarmaydi.

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    accuracy: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # Buyurtma vaqtida ishlatilgan yozma manzil.
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Buyurtma vaqtida ishlatilgan orientir.
    #
    # Customer.landmark dan mustaqil snapshot.
    landmark: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # Rasm bilan tasdiqlangan yetkazish manzili.
    delivery_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Qo'shimcha izoh
    comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # =====================================================
    # TIMESTAMPS
    # =====================================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    customer = relationship(
        "Customer",
        back_populates="orders",
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )

    status_history = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.created_at",
    )

    payments = relationship(
        "Payment",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="Payment.created_at.desc()",
    )


class Payment(Base):
    """A provider transaction record for one customer order."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(30), default="hamyon", nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    # The order total remains the source of truth. provider_amount may carry
    # a tiny disclosed disambiguation difference for Hamyon's open payments.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    provider_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="UZS", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="CREATING", nullable=False, index=True
    )
    # Hamyon returns the recipient card. Keep it encrypted at rest so a
    # customer can reopen the pending payment without exposing it to admins.
    card_number_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    order = relationship("Order", back_populates="payments")

    __table_args__ = (
        Index(
            "uq_payments_open_provider_amount",
            "provider_amount",
            unique=True,
            postgresql_where=(status.in_(["CREATING", "PENDING", "PROCESSING"])),
        ),
    )


# =========================================================
# ORDER ITEM
# =========================================================

class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    # Mijoz qancha so'radi?
    #
    # Masalan:
    # 3 dona
    # 3.5 kg
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    # Mijoz tanlagan birlik:
    #
    # kg
    # dona
    quantity_unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Number of Product.stock_units held for this order line.
    stock_units_reserved: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        default=Decimal("0"),
        nullable=False,
    )

    reservation_released: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Shu buyurtma paytidagi 1 dona og'irligi.
    #
    # Keyinchalik product weight_per_unit o'zgarsa ham,
    # eski buyurtma to'g'ri saqlanib qoladi.
    weight_per_unit: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    # Buyurtma qilingan umumiy kg.
    #
    # Masalan:
    #
    # 3 dona × 1.2 kg
    # = 3.6 kg
    weight_kg: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    # Buyurtma paytidagi mahsulot narxi.
    #
    # Narx keyinchalik o'zgarsa ham,
    # eski buyurtmaning narxi o'zgarmaydi.
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # Ushbu mahsulotdan jami qancha pul.
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    order = relationship(
        "Order",
        back_populates="items",
    )

    product = relationship(
        "Product",
        back_populates="order_items",
    )


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    previous_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="status_history")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity_delta: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    actor_telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )

    product = relationship("Product", back_populates="inventory_movements")


class StoreSettings(Base):
    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    shop_name: Mapped[str] = mapped_column(String(160), nullable=False, default="Adrenalin Qazi")
    support_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    support_telegram: Mapped[str | None] = mapped_column(String(100), nullable=True)
    store_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    shop_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    guide_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Mahsulot tanlang, savatga qo'shing va buyurtmani rasmiylashtiring. Manzil va yetkazish joyi rasmini tekshirib yuboring.",
    )
    terms_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Buyurtma yuborilgach mahsulotlar 12 soatgacha band qilinadi. Hozircha onlayn to'lov ulanmagan; buyurtma to'langan deb hisoblanmaydi.",
    )
    updates_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Yangi funksiyalar va muhim o'zgarishlar shu yerda e'lon qilinadi.",
    )

