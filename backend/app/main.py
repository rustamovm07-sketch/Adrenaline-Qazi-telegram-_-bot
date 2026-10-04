import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from dotenv import dotenv_values, load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, SessionLocal, engine
from .database import get_db
from .inventory import release_expired_reservations
from .products import router as products_router
from .orders import router as orders_router
from .dashboard import router as dashboard_router
from .customers import router as customers_router
from .categories import router as categories_router
from .inventory_routes import router as inventory_router
from .store_settings import router as store_settings_router
from .payments import router as payments_router
from .auth import router as auth_router
from .rate_limit import RateLimitMiddleware
from .media_access import is_owned_media, resolve_upload_file
from .models import Order
from .security import TelegramIdentity, get_current_telegram_user, is_admin_identity
from sqlalchemy.orm import Session

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)

if os.getenv("APP_ENV", "development").lower() == "production":
    bot_token = os.getenv("BOT_TOKEN", "").strip()
    admin_id = os.getenv("ADMIN_TELEGRAM_ID", "").strip()
    database_url = os.getenv("DATABASE_URL", "").strip().lower()
    try:
        init_data_max_age = int(os.getenv("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", "300"))
    except ValueError:
        init_data_max_age = 0
    if len(bot_token) < 35 or ":" not in bot_token or bot_token.lower() in {"changeme", "password"}:
        raise RuntimeError("Production muhitida haqiqiy BOT_TOKEN environment orqali sozlanishi shart.")
    if not admin_id.isdigit() or int(admin_id) <= 0:
        raise RuntimeError("Production muhitida musbat ADMIN_TELEGRAM_ID talab qilinadi.")
    if any(value in database_url for value in ("change_me", "password", "postgres:postgres", "your-password")):
        raise RuntimeError("Production DATABASE_URL default yoki zaif credential ishlatmasligi kerak.")
    if not 1 <= init_data_max_age <= 300:
        raise RuntimeError("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS 1–300 oralig'ida bo'lishi shart.")

Base.metadata.create_all(bind=engine)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


logger = logging.getLogger(__name__)


async def reservation_sweeper() -> None:
    while True:
        db = SessionLocal()
        try:
            released = release_expired_reservations(db)
            if released:
                logger.info("Expired inventory reservations released: %s", released)
        except Exception:
            logger.exception("Could not release expired inventory reservations")
        finally:
            db.close()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(reservation_sweeper())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Adrenalin Qazi API",
    version="1.0.0",
    description=(
        "Adrenalin Qazi online do'koni "
        "backend API"
    ),
    lifespan=lifespan,
    docs_url=None if os.getenv("APP_ENV", "development").lower() == "production" else "/docs",
    redoc_url=None if os.getenv("APP_ENV", "development").lower() == "production" else "/redoc",
    openapi_url=None if os.getenv("APP_ENV", "development").lower() == "production" else "/openapi.json",
)


cors_origins_value = dotenv_values(ENV_FILE).get("CORS_ORIGINS")
if cors_origins_value is None:
    cors_origins_value = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    )

cors_origins = [
    origin.strip()
    for origin in cors_origins_value.split(",")
    if origin.strip()
]
if "*" in cors_origins:
    raise RuntimeError("CORS_ORIGINS wildcard production uchun ruxsat etilmaydi.")
if os.getenv("APP_ENV", "development").lower() == "production" and not cors_origins:
    raise RuntimeError("Production muhitida CORS_ORIGINS aniq domenlar bilan sozlanishi shart.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
)

app.add_middleware(RateLimitMiddleware)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.get("/uploads/order-delivery/{filename}", include_in_schema=False)
def get_private_delivery_image(
    filename: str,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    file_path = resolve_upload_file(UPLOAD_DIR / "order-delivery", filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Rasm topilmadi.")
    is_owner = is_owned_media(filename, identity.telegram_id)
    is_admin = is_admin_identity(identity)
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Bu rasmni ko'rishga ruxsatingiz yo'q.")
    if not is_owner and is_admin:
        # Admins may inspect only media attached to an order, not arbitrary uploads.
        image_url = f"/uploads/order-delivery/{filename}"
        attached = db.query(Order.id).filter(Order.delivery_image_url == image_url).first()
        if attached is None:
            raise HTTPException(status_code=404, detail="Buyurtma rasmi topilmadi.")
    return FileResponse(file_path, headers={"Cache-Control": "private, no-store"})


@app.get("/uploads/customers/{filename}", include_in_schema=False)
def get_private_customer_image(
    filename: str,
    identity: TelegramIdentity = Depends(get_current_telegram_user),
):
    file_path = resolve_upload_file(UPLOAD_DIR / "customers", filename)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Rasm topilmadi.")
    if not is_owned_media(filename, identity.telegram_id) and not is_admin_identity(identity):
        raise HTTPException(status_code=403, detail="Bu rasmni ko'rishga ruxsatingiz yo'q.")
    return FileResponse(file_path, headers={"Cache-Control": "private, no-store"})


for public_media in ("products", "categories", "store"):
    (UPLOAD_DIR / public_media).mkdir(parents=True, exist_ok=True)
    app.mount(
        f"/uploads/{public_media}",
        StaticFiles(directory=str(UPLOAD_DIR / public_media)),
        name=f"{public_media}-uploads",
    )


app.include_router(
    products_router
)

app.include_router(
    orders_router
)

app.include_router(
    dashboard_router
)

app.include_router(
    customers_router
)

app.include_router(
    categories_router
)

app.include_router(inventory_router)
app.include_router(store_settings_router)
app.include_router(payments_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "success": True,
        "message": (
            "Adrenalin Qazi API "
            "ishlayapti"
        ),
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": (
            "adrenalin-qazi-api"
        ),
    }
