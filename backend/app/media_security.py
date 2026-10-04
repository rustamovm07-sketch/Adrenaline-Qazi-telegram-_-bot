"""Strict allowlist and decoder validation for uploaded raster images."""

from io import BytesIO

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def validate_image_bytes(data: bytes, content_type: str | None) -> None:
    expected = _FORMATS.get(content_type or "")
    if expected is None or not data:
        raise HTTPException(status_code=400, detail="Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.")
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != expected or image.width * image.height > 40_000_000:
                raise HTTPException(status_code=400, detail="Rasm formati yoki o'lchami yaroqsiz.")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Rasm fayli yaroqsiz yoki buzilgan.") from None
