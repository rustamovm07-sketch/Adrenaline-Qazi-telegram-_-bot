from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .database import get_db
from .models import StoreSettings
from .media_security import validate_image_bytes
from .schemas import StoreSettingsResponse, StoreSettingsUpdate
from .security import TelegramIdentity, require_admin

router = APIRouter(prefix="/store-settings", tags=["Store settings"])
IMAGE_DIR = Path(__file__).resolve().parent.parent / "uploads" / "store"
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_SIZE = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
}


def _get_or_create(db: Session) -> StoreSettings:
    settings = db.query(StoreSettings).filter(StoreSettings.id == 1).first()
    if settings is None:
        settings = StoreSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/public", response_model=StoreSettingsResponse)
def get_public_store_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.get("/", response_model=StoreSettingsResponse)
def get_admin_store_settings(
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    return _get_or_create(db)


@router.patch("/", response_model=StoreSettingsResponse)
def update_store_settings(
    payload: StoreSettingsUpdate,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    settings = _get_or_create(db)
    values = payload.model_dump(exclude_unset=True)
    latitude = values.get("latitude", settings.latitude)
    longitude = values.get("longitude", settings.longitude)
    if (latitude is None) != (longitude is None):
        raise HTTPException(status_code=400, detail="Xarita koordinatalarining ikkalasini ham kiriting yoki bo'sh qoldiring.")

    for field, value in values.items():
        if isinstance(value, str):
            value = value.strip()
            if field in {"support_phone", "support_telegram", "store_address", "shop_image_url"}:
                value = value or None
        if field == "shop_name":
            if not value:
                raise HTTPException(status_code=400, detail="Do'kon nomi bo'sh bo'lmasligi kerak.")
            value = value[:160]
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


@router.post("/image", response_model=StoreSettingsResponse)
async def upload_store_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    image_info = IMAGE_TYPES.get(image.content_type or "")
    try:
        if image_info is None:
            raise HTTPException(status_code=400, detail="Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.")
        content = await image.read(MAX_IMAGE_SIZE + 1)
        if not content or len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Rasm bo'sh yoki hajmi 5 MB dan katta.")
        extension, signature_check = image_info
        if not signature_check(content):
            raise HTTPException(status_code=400, detail="Rasm faylining formati tarkibiga mos kelmadi.")
        validate_image_bytes(content, image.content_type)

        filename = f"shop_{uuid4().hex}{extension}"
        (IMAGE_DIR / filename).write_bytes(content)
        settings = _get_or_create(db)
        settings.shop_image_url = f"/uploads/store/{filename}"
        db.commit()
        db.refresh(settings)
        return settings
    finally:
        await image.close()
