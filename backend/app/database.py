import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable topilmadi."
    )


# ============================================================
# DATABASE ENGINE
# ============================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
)


# ============================================================
# SESSION
# ============================================================

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ============================================================
# BASE MODEL
# ============================================================

Base = declarative_base()


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    """
    FastAPI endpointlari uchun PostgreSQL session yaratadi.

    Har bir request uchun alohida session ochiladi
    va request tugagach avtomatik yopiladi.
    """

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
