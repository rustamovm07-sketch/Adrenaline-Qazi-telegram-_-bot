from datetime import datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .models import Customer, Order
from .media_security import validate_image_bytes
from .security import TelegramIdentity, get_current_telegram_user, require_admin


UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads" / "customers"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


# =========================================================
# CUSTOMER PROFILE SCHEMAS
# =========================================================


class CustomerProfileCreate(BaseModel):
    """
    Birinchi marta mijoz profilini yaratish uchun.

    Telegram ID faqat eski klientlar bilan moslik uchun qabul qilinadi.
    Saqlashda doim imzolangan Mini App sessiyasidagi ID ishlatiladi.
    """

    # Legacy clients may still send this; identity comes from signed initData.
    telegram_id: int | None = Field(default=None, gt=0)

    name: str = Field(
        min_length=2,
        max_length=150,
    )

    surname: str = Field(
        min_length=2,
        max_length=100,
    )

    phone: str = Field(
        min_length=7,
        max_length=30,
    )

    profile_image: str | None = Field(
        default=None,
        max_length=500,
    )

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

    address: str = Field(
        min_length=2,
        max_length=5000,
    )

    landmark: str = Field(
        min_length=2,
        max_length=1000,
    )


class CustomerProfileUpdate(BaseModel):
    """
    Settings orqali mijoz profilini tahrirlash uchun.

    Barcha maydonlar optional:
    mijoz faqat o'zgartirmoqchi bo'lgan ma'lumotini yuborishi mumkin.
    """

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    surname: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=30,
    )

    profile_image: str | None = Field(
        default=None,
        max_length=500,
    )

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
        min_length=2,
        max_length=5000,
    )

    landmark: str | None = Field(
        default=None,
        min_length=2,
        max_length=1000,
    )


# =========================================================
# INTERNAL HELPERS
# =========================================================


def is_profile_completed(
    customer: Customer,
) -> bool:
    """
    Mijoz profilining asosiy ma'lumotlari to'liq kiritilganini
    aniqlaydi.

    Profil to'liq bo'lishi uchun:
    - ism
    - familiya
    - telefon
    - latitude
    - longitude
    - address
    - landmark

    mavjud bo'lishi kerak.
    """

    required_values = (
        customer.name,
        customer.surname,
        customer.phone,
        customer.latitude,
        customer.longitude,
        customer.address,
        customer.landmark,
    )

    for value in required_values:
        if value is None:
            return False

        if isinstance(value, str) and not value.strip():
            return False

    return True


def customer_profile_response(
    customer: Customer,
) -> dict:
    """
    Customer profilini frontend/bot uchun yagona formatda qaytaradi.
    """

    completed = is_profile_completed(customer)

    # Modeldagi qiymatni ham sinxron ushlab turamiz.
    if customer.profile_completed != completed:
        customer.profile_completed = completed

    return {
        "id": customer.id,
        "telegram_id": customer.telegram_id,
        "name": customer.name,
        "surname": customer.surname,
        "phone": customer.phone,
        "profile_image": customer.profile_image,
        "latitude": customer.latitude,
        "longitude": customer.longitude,
        "accuracy": customer.accuracy,
        "address": customer.address,
        "landmark": customer.landmark,
        "profile_completed": completed,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
    }


# =========================================================
# CUSTOMER PROFILE
# =========================================================


@router.post("/profile/image")
async def upload_customer_profile_image(
    image: UploadFile = File(...),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """Store a validated profile image and return its public upload path."""

    image_type = image.content_type or ""
    format_info = ALLOWED_IMAGE_TYPES.get(image_type)
    if format_info is None:
        raise HTTPException(
            status_code=400,
            detail="Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.",
        )

    content = await image.read(MAX_IMAGE_SIZE + 1)
    if not content or len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Rasm bo'sh yoki hajmi 5 MB dan katta.",
        )

    extension, signature_check = format_info
    if not signature_check(content):
        raise HTTPException(
            status_code=400,
            detail="Rasm faylining tarkibi formati bilan mos kelmadi.",
        )
    validate_image_bytes(content, image_type)

    filename = f"{identity.telegram_id}_{uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"image_url": f"/uploads/customers/{filename}"}


@router.get("/profile/me")
def get_my_customer_profile(
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """Return the profile for the identity verified by the Mini App session."""
    customer = (
        db.query(Customer)
        .filter(Customer.telegram_id == identity.telegram_id)
        .first()
    )
    if not customer:
        return {"exists": False, "profile_completed": False, "profile": None}
    profile = customer_profile_response(customer)
    db.commit()
    return {
        "exists": True,
        "profile_completed": profile["profile_completed"],
        "profile": profile,
    }


@router.get(
    "/profile/{telegram_id}",
)
def get_customer_profile(
    telegram_id: int,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """
    Telegram foydalanuvchisining profilini olish.

    Mini App:
        GET /customers/profile/{telegram_id}

    Foydalanuvchi ID si imzolangan Mini App sessiyasi bilan solishtiriladi.
    """

    if telegram_id != identity.telegram_id:
        raise HTTPException(
            status_code=403,
            detail="Faqat o'z Telegram profilingizni ko'rishingiz mumkin.",
        )

    if telegram_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Telegram ID noto'g'ri",
        )

    customer = (
        db.query(Customer)
        .filter(
            Customer.telegram_id == telegram_id,
        )
        .first()
    )

    if not customer:
        return {
            "exists": False,
            "profile_completed": False,
            "profile": None,
        }

    profile = customer_profile_response(customer)

    db.commit()

    return {
        "exists": True,
        "profile_completed": profile[
            "profile_completed"
        ],
        "profile": profile,
    }


@router.post(
    "/profile",
)
def create_customer_profile(
    payload: CustomerProfileCreate,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """
    Mijozning birinchi profilini yaratadi.

    Agar shu Telegram ID oldindan mavjud bo'lsa,
    yangi Customer yaratmaydi va 409 qaytaradi.

    Bu duplicate customer yozuvlarining oldini oladi.
    """

    if payload.telegram_id is not None and payload.telegram_id != identity.telegram_id:
        raise HTTPException(
            status_code=403,
            detail="Telegram foydalanuvchisi mos kelmadi.",
        )

    existing_customer = (
        db.query(Customer)
        .filter(
            Customer.telegram_id
            == identity.telegram_id,
        )
        .first()
    )

    if existing_customer:
        raise HTTPException(
            status_code=409,
            detail=(
                "Bu Telegram foydalanuvchisi "
                "allaqachon ro'yxatdan o'tgan"
            ),
        )

    customer = Customer(
        telegram_id=identity.telegram_id,
        name=payload.name.strip(),
        surname=payload.surname.strip(),
        phone=payload.phone.strip(),
        profile_image=(
            payload.profile_image.strip()
            if payload.profile_image
            else None
        ),
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        address=payload.address.strip(),
        landmark=payload.landmark.strip(),
        profile_completed=False,
    )

    db.add(customer)
    db.flush()

    customer.profile_completed = (
        is_profile_completed(customer)
    )

    db.commit()
    db.refresh(customer)

    return {
        "success": True,
        "message": "Mijoz profili muvaffaqiyatli yaratildi",
        "profile": customer_profile_response(
            customer,
        ),
    }


@router.patch("/profile/me")
def update_my_customer_profile(
    payload: CustomerProfileUpdate,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """Update the profile for the identity verified by the Mini App session."""
    return update_customer_profile(
        telegram_id=identity.telegram_id,
        payload=payload,
        db=db,
        identity=identity,
    )


@router.patch(
    "/profile/{telegram_id}",
)
def update_customer_profile(
    telegram_id: int,
    payload: CustomerProfileUpdate,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    """
    Settings orqali mavjud mijoz profilini tahrirlash.

    Faqat yuborilgan maydonlar o'zgartiriladi.
    """

    if telegram_id != identity.telegram_id:
        raise HTTPException(
            status_code=403,
            detail="Faqat o'z Telegram profilingizni tahrirlashingiz mumkin.",
        )

    if telegram_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Telegram ID noto'g'ri",
        )

    customer = (
        db.query(Customer)
        .filter(
            Customer.telegram_id
            == telegram_id,
        )
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Mijoz profili topilmadi",
        )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if "name" in update_data:
        customer.name = update_data["name"].strip()

    if "surname" in update_data:
        customer.surname = update_data[
            "surname"
        ].strip()

    if "phone" in update_data:
        customer.phone = update_data[
            "phone"
        ].strip()

    if "profile_image" in update_data:
        profile_image = update_data[
            "profile_image"
        ]

        customer.profile_image = (
            profile_image.strip()
            if profile_image
            else None
        )

    if "latitude" in update_data:
        customer.latitude = update_data[
            "latitude"
        ]

    if "longitude" in update_data:
        customer.longitude = update_data[
            "longitude"
        ]

    if "accuracy" in update_data:
        customer.accuracy = update_data[
            "accuracy"
        ]

    if "address" in update_data:
        customer.address = update_data[
            "address"
        ].strip()

    if "landmark" in update_data:
        customer.landmark = update_data[
            "landmark"
        ].strip()

    customer.profile_completed = (
        is_profile_completed(customer)
    )

    db.commit()
    db.refresh(customer)

    return {
        "success": True,
        "message": "Mijoz profili yangilandi",
        "profile": customer_profile_response(
            customer,
        ),
    }


# =========================================================
# ADMIN — CUSTOMER LIST
# =========================================================


@router.get("/")
def get_customers(
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    customers = (
        db.query(Customer)
        .order_by(Customer.created_at.desc())
        .all()
    )

    result = []

    for customer in customers:
        order_count = (
            db.query(func.count(Order.id))
            .filter(
                Order.customer_id == customer.id,
            )
            .scalar()
            or 0
        )

        total_purchases = (
            db.query(
                func.coalesce(
                    func.sum(Order.total),
                    0,
                )
            )
            .filter(
                Order.customer_id == customer.id,
                Order.payment_confirmed.is_(True),
            )
            .scalar()
            or Decimal("0")
        )

        last_order = (
            db.query(Order)
            .filter(
                Order.customer_id == customer.id,
            )
            .order_by(
                Order.created_at.desc(),
            )
            .first()
        )

        result.append(
            {
                "id": customer.id,
                "telegram_id": customer.telegram_id,
                "name": customer.name,
                "surname": customer.surname,
                "phone": customer.phone,
                "profile_image": customer.profile_image,
                "latitude": customer.latitude,
                "longitude": customer.longitude,
                "accuracy": customer.accuracy,
                "address": customer.address,
                "landmark": customer.landmark,
                "profile_completed": (
                    is_profile_completed(
                        customer,
                    )
                ),
                "created_at": customer.created_at,
                "updated_at": customer.updated_at,
                "order_count": order_count,
                "total_purchases": total_purchases,
                "last_order_id": (
                    last_order.id
                    if last_order
                    else None
                ),
                "last_order_at": (
                    last_order.created_at
                    if last_order
                    else None
                ),
                # Nasiya tizimi keyin qo'shiladi.
                "debt_balance": Decimal("0"),
            }
        )

    return result


# =========================================================
# ADMIN — CUSTOMER DETAIL
# =========================================================


@router.get("/{customer_id}")
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
        )
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Mijoz topilmadi",
        )

    orders = (
        db.query(Order)
        .filter(
            Order.customer_id == customer.id,
        )
        .order_by(
            Order.created_at.desc(),
        )
        .all()
    )

    total_purchases = (
        db.query(
            func.coalesce(
                func.sum(Order.total),
                0,
            )
        )
        .filter(
            Order.customer_id == customer.id,
            Order.payment_confirmed.is_(True),
        )
        .scalar()
        or Decimal("0")
    )

    return {
        "id": customer.id,
        "telegram_id": customer.telegram_id,
        "name": customer.name,
        "surname": customer.surname,
        "phone": customer.phone,
        "profile_image": customer.profile_image,
        "latitude": customer.latitude,
        "longitude": customer.longitude,
        "accuracy": customer.accuracy,
        "address": customer.address,
        "landmark": customer.landmark,
        "profile_completed": (
            is_profile_completed(customer)
        ),
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "order_count": len(orders),
        "total_purchases": total_purchases,
        "debt_balance": Decimal("0"),
        "orders": [
            {
                "id": order.id,
                "total": order.total,
                "status": order.status,
                "payment_confirmed": (
                    order.payment_confirmed
                ),
                "payment_method": (
                    order.payment_method
                ),
                "created_at": order.created_at,
                "delivery_phone": order.delivery_phone,
                "latitude": order.latitude,
                "longitude": order.longitude,
                "accuracy": order.accuracy,
                "address": order.address,
                "landmark": order.landmark,
                "comment": order.comment,
                "items": [
                    {
                        "id": item.id,
                        "product_id": item.product_id,
                        "quantity": item.quantity,
                        "quantity_unit": (
                            item.quantity_unit
                        ),
                        "weight_kg": item.weight_kg,
                        "price": item.price,
                        "subtotal": item.subtotal,
                    }
                    for item in order.items
                ],
            }
            for order in orders
        ],
    }
