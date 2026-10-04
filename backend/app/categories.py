from __future__ import annotations

import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Category, Product
from .media_security import validate_image_bytes
from .security import TelegramIdentity, require_admin
from .schemas import CategoryCreate, CategoryResponse, CategoryUpdate


router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "categories"

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024


def make_slug(value: str) -> str:
    """
    Kategoriya nomidan URL uchun xavfsiz slug yaratadi.
    """

    value = value.strip().lower()

    replacements = {
        "o‘": "o",
        "o'": "o",
        "g‘": "g",
        "g'": "g",
        "ʻ": "",
        "’": "",
        "'": "",
    }

    for old, new in replacements.items():
        value = value.replace(old, new)

    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value)
    value = value.strip("-")

    return value or "category"


def unique_slug(
    db: Session,
    name: str,
    category_id: int | None = None,
) -> str:
    """
    Bir xil nomli kategoriyalar uchun slug collisionni oldini oladi.
    """

    base_slug = make_slug(name)
    slug = base_slug
    counter = 2

    while True:
        query = select(Category.id).where(Category.slug == slug)

        if category_id is not None:
            query = query.where(Category.id != category_id)

        existing_id = db.scalar(query)

        if existing_id is None:
            return slug

        slug = f"{base_slug}-{counter}"
        counter += 1


def validate_category_name(
    db: Session,
    name: str,
    category_id: int | None = None,
) -> str:
    normalized_name = " ".join(name.strip().split())

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kategoriya nomi bo‘sh bo‘lishi mumkin emas.",
        )

    if len(normalized_name) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kategoriya nomi 100 belgidan oshmasligi kerak.",
        )

    query = select(Category).where(
        func.lower(Category.name) == normalized_name.lower()
    )

    if category_id is not None:
        query = query.where(Category.id != category_id)

    existing = db.scalar(query)

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bunday kategoriya allaqachon mavjud.",
        )

    return normalized_name


async def save_category_image(
    image: UploadFile | None,
) -> str | None:
    """
    Kategoriya rasmini uploads/categories ichiga saqlaydi.
    """

    if image is None:
        return None

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rasm faqat JPG, PNG yoki WEBP formatida bo‘lishi kerak.",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    extension = ALLOWED_IMAGE_TYPES[image.content_type]
    filename = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / filename

    total_size = 0

    try:
        with file_path.open("wb") as output_file:
            while True:
                chunk = await image.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_IMAGE_SIZE:
                    output_file.close()

                    if file_path.exists():
                        file_path.unlink()

                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Rasm hajmi 5 MB dan oshmasligi kerak.",
                    )

                output_file.write(chunk)

        validate_image_bytes(file_path.read_bytes(), image.content_type)

    except HTTPException:
        if file_path.exists():
            file_path.unlink()
        raise

    except Exception as exc:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Kategoriya rasmini saqlashda xatolik yuz berdi.",
        ) from exc

    finally:
        await image.close()

    return f"/uploads/categories/{filename}"


def delete_image_file(image_path: str | None) -> None:
    """
    Lokal kategoriya rasmini xavfsiz o‘chiradi.
    """

    if not image_path:
        return

    if not image_path.startswith("/uploads/categories/"):
        return

    relative_path = image_path.removeprefix("/uploads/categories/")
    file_path = UPLOAD_DIR / Path(relative_path).name

    try:
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
    except OSError:
        pass


def category_to_response(category: Category) -> CategoryResponse:
    return CategoryResponse.model_validate(category)


@router.get(
    "/",
    response_model=list[CategoryResponse],
)
def get_categories(
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Barcha kategoriyalarni qaytaradi.
    """

    categories = db.scalars(
        select(Category).order_by(
            Category.sort_order.asc(),
            Category.name.asc(),
        )
    ).all()

    return [
        category_to_response(category)
        for category in categories
    ]


@router.get(
    "/active",
    response_model=list[CategoryResponse],
)
def get_active_categories(
    db: Session = Depends(get_db),
):
    """
    Faqat aktiv kategoriyalarni qaytaradi.
    Customer frontend shu endpointdan foydalanadi.
    """

    categories = db.scalars(
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(
            Category.sort_order.asc(),
            Category.name.asc(),
        )
    ).all()

    return [
        category_to_response(category)
        for category in categories
    ]


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoriya topilmadi.",
        )

    return category_to_response(category)


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    name: str = Form(...),
    description: str | None = Form(None),
    sort_order: int = Form(0),
    is_active: bool = Form(True),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Yangi kategoriya yaratadi.
    """

    normalized_name = validate_category_name(
        db=db,
        name=name,
    )

    if sort_order < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tartib raqami 0 yoki undan katta bo‘lishi kerak.",
        )

    image_path = await save_category_image(image)

    category = Category(
        name=normalized_name,
        slug=unique_slug(
            db=db,
            name=normalized_name,
        ),
        description=(
            description.strip()
            if description and description.strip()
            else None
        ),
        image=image_path,
        sort_order=sort_order,
        is_active=is_active,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category_to_response(category)


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
)
async def update_category(
    category_id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    sort_order: int | None = Form(None),
    is_active: bool | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Kategoriya ma’lumotlarini yangilaydi.

    Faqat yuborilgan fieldlar o‘zgartiriladi.
    """

    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoriya topilmadi.",
        )

    old_image = category.image

    if name is not None:
        normalized_name = validate_category_name(
            db=db,
            name=name,
            category_id=category.id,
        )

        if normalized_name != category.name:
            category.name = normalized_name
            category.slug = unique_slug(
                db=db,
                name=normalized_name,
                category_id=category.id,
            )

    if description is not None:
        cleaned_description = description.strip()

        category.description = (
            cleaned_description
            if cleaned_description
            else None
        )

    if sort_order is not None:
        if sort_order < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tartib raqami 0 yoki undan katta bo‘lishi kerak.",
            )

        category.sort_order = sort_order

    if is_active is not None:
        category.is_active = is_active

    if image is not None:
        new_image_path = await save_category_image(image)
        category.image = new_image_path

    db.commit()
    db.refresh(category)

    if image is not None and old_image != category.image:
        delete_image_file(old_image)

    return category_to_response(category)


@router.delete(
    "/{category_id}",
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Kategoriyani o‘chiradi.

    Agar unga mahsulot bog‘langan bo‘lsa,
    ON DELETE RESTRICT mantig‘iga mos ravishda
    kategoriya o‘chirilmaydi.
    """

    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategoriya topilmadi.",
        )

    linked_products_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.category_id == category.id
        )
    ) or 0

    if linked_products_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Bu kategoriyaga {linked_products_count} ta "
                "mahsulot bog‘langan. Avval mahsulotlarni boshqa "
                "kategoriyaga o‘tkazing."
            ),
        )

    image_path = category.image

    db.delete(category)
    db.commit()

    delete_image_file(image_path)

    return {
        "message": "Kategoriya muvaffaqiyatli o‘chirildi.",
        "id": category_id,
    }
