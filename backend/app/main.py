import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, SessionLocal, engine
from .inventory import release_expired_reservations
from .products import router as products_router
from .orders import router as orders_router
from .dashboard import router as dashboard_router
from .customers import router as customers_router
from .categories import router as categories_router
from .inventory_routes import router as inventory_router
from .store_settings import router as store_settings_router

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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
)


cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount(
    "/uploads",
    StaticFiles(
        directory=str(UPLOAD_DIR)
    ),
    name="uploads",
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
