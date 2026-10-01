"""Owner-only inventory adjustments and immutable stock history."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .inventory import release_expired_reservations
from .models import InventoryMovement, Product
from .schemas import InventoryMovementCreate, InventoryMovementResponse
from .security import TelegramIdentity, require_admin

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def movement_response(movement: InventoryMovement) -> dict:
    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "product_name": movement.product.name,
        "unit_type": movement.product.unit_type,
        "order_id": movement.order_id,
        "kind": movement.kind,
        "quantity_delta": movement.quantity_delta,
        "note": movement.note,
        "actor_telegram_id": movement.actor_telegram_id,
        "created_at": movement.created_at,
    }


@router.get("/movements", response_model=list[InventoryMovementResponse])
def get_movements(
    limit: int = 250,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    release_expired_reservations(db)
    rows = (
        db.query(InventoryMovement)
        .options(joinedload(InventoryMovement.product))
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
        .limit(max(1, min(limit, 1000)))
        .all()
    )
    return [movement_response(row) for row in rows]


@router.post("/movements", response_model=InventoryMovementResponse, status_code=201)
def create_movement(
    data: InventoryMovementCreate,
    db: Session = Depends(get_db),
    identity: TelegramIdentity = Depends(require_admin),
):
    quantity_delta = Decimal(data.quantity_delta)
    if quantity_delta == 0:
        raise HTTPException(status_code=400, detail="O'zgarish miqdori 0 bo'lmasligi kerak.")
    if data.kind in {"RECEIPT", "RETURN"} and quantity_delta < 0:
        raise HTTPException(status_code=400, detail="Kirim va qaytarish miqdori musbat bo'lishi kerak.")

    product = (
        db.query(Product)
        .filter(Product.id == data.product_id)
        .with_for_update()
        .first()
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi.")

    new_stock = Decimal(product.stock_units) + quantity_delta
    reserved = Decimal(product.reserved_stock_units or 0)
    if new_stock < reserved:
        raise HTTPException(
            status_code=409,
            detail=f"Yangi qoldiq ({new_stock}) band qilingan qoldiqdan ({reserved}) kam bo'lishi mumkin emas.",
        )

    movement = InventoryMovement(
        product_id=product.id,
        kind=data.kind,
        quantity_delta=quantity_delta,
        note=data.note.strip() if data.note and data.note.strip() else None,
        actor_telegram_id=identity.telegram_id,
    )
    product.stock_units = new_stock
    if new_stock <= 0:
        product.is_available = False
    db.add(movement)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(movement)
    return movement_response(movement)
