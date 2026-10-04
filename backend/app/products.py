from pathlib import Path
from decimal import Decimal
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import Category, InventoryMovement, OrderItem, Product
from .media_security import validate_image_bytes
from .schemas import ProductResponse, PublicProductResponse
from .inventory import release_expired_reservations
from .security import (
    TelegramIdentity,
    get_optional_telegram_user,
    is_admin_identity,
    require_admin,
)

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


# ============================================================
# UPLOAD CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "products"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

MAX_FILE_SIZE = 5 * 1024 * 1024


# ============================================================
# HELPERS
# ============================================================

def validate_product_data(
    unit_type: str,
    weight_per_unit: float,
    stock_units: float,
) -> None:
    """
    Mahsulotning umumiy business validation qoidalari.
    """

    if unit_type not in {"kg", "dona"}:
        raise HTTPException(
            status_code=400,
            detail="O'lchov birligi faqat kg yoki dona bo'lishi mumkin",
        )

    if weight_per_unit <= 0:
        raise HTTPException(
            status_code=400,
            detail="1 dona og'irligi 0 dan katta bo'lishi kerak",
        )

    if stock_units < 0:
        raise HTTPException(
            status_code=400,
            detail="Stock manfiy bo'lishi mumkin emas",
        )


def get_category_or_404(
    db: Session,
    category_id: int,
    *,
    require_active: bool = True,
) -> Category:
    """
    category_id bo'yicha Category topadi.

    Yangi mahsulot yaratishda active category talab qilinadi.
    Mavjud mahsulotni update qilishda esa inactive category
    ham ishlatilishi mumkin, chunki mahsulotni yo'qotib qo'yish
    yoki tarixiy bog'lanishni buzish kerak emas.
    """

    category = (
        db.query(Category)
        .filter(Category.id == category_id)
        .first()
    )

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Kategoriya topilmadi",
        )

    if require_active and not category.is_active:
        raise HTTPException(
            status_code=400,
            detail="Tanlangan kategoriya faol emas",
        )

    return category


async def save_product_image(
    image: UploadFile,
    product_name: str,
) -> str:
    """
    Mahsulot rasmini tekshiradi va uploads/products ichiga saqlaydi.

    UUID ishlatilishi sababli bir xil nomdagi mahsulot yoki rasm
    boshqa faylni tasodifan ustidan yozib yubormaydi.
    """

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Faqat JPG, PNG yoki WEBP rasm yuklash mumkin",
        )

    original_filename = Path(
        image.filename or "image"
    ).name

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS or extension not in ALLOWED_TYPES[image.content_type]:
        raise HTTPException(
            status_code=400,
            detail="Rasm formati noto'g'ri",
        )

    content = await image.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Rasm fayli bo'sh",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Rasm hajmi 5 MB dan oshmasligi kerak",
        )

    signatures = {
        "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
        "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    }
    if not signatures[image.content_type](content):
        raise HTTPException(status_code=400, detail="Rasm faylining tarkibi formati bilan mos kelmadi")
    validate_image_bytes(content, image.content_type)

    safe_name = "".join(
        char if char.isalnum() or char in "._-" else "_"
        for char in product_name.strip()
    ).strip("._-")

    if not safe_name:
        safe_name = "product"

    filename = (
        f"{safe_name}_{uuid4().hex}{extension}"
    )

    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(content)

    return f"/uploads/products/{filename}"


def delete_product_image(image_path: str | None) -> None:
    """
    Eski mahsulot rasmini diskdan o'chiradi.

    Database ichidagi path mavjud bo'lmasa hech qanday xato
    chiqarilmaydi.
    """

    if not image_path:
        return

    prefix = "/uploads/products/"

    if not image_path.startswith(prefix):
        return

    filename = Path(image_path).name
    file_path = UPLOAD_DIR / filename

    try:
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
    except OSError:
        # Database operationni faqat image o'chirishdagi
        # filesystem xatosi sababli yiqitmaymiz.
        pass


def product_query(db: Session):
    """
    Product bilan Category'ni birga yuklaydi.

    Bu customer/admin API javoblarida category ma'lumotlari
    kerak bo'lganda ortiqcha querylar sonini kamaytiradi.
    """

    return (
        db.query(Product)
        .options(joinedload(Product.category))
    )


# ============================================================
# GET ALL PRODUCTS
# ============================================================

@router.get("/")
def get_products(
    db: Session = Depends(get_db),
    identity: TelegramIdentity | None = Depends(get_optional_telegram_user),
):
    """
    Barcha mahsulotlarni qaytaradi.

    Category nested relationship sifatida ham keladi.
    """

    release_expired_reservations(db)
    query = product_query(db)
    if not is_admin_identity(identity):
        query = query.filter(
            Product.is_available.is_(True),
            Product.stock_units > Product.reserved_stock_units,
        )

    products = query.order_by(Product.id.desc()).all()
    schema = ProductResponse if is_admin_identity(identity) else PublicProductResponse
    return [schema.model_validate(product) for product in products]


# ============================================================
# GET SINGLE PRODUCT
# ============================================================

@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    identity: TelegramIdentity | None = Depends(get_optional_telegram_user),
):
    """
    Bitta mahsulotni ID orqali qaytaradi.

    Customer frontend va keyingi order/cart flow uchun kerak.
    """

    release_expired_reservations(db)
    query = product_query(db).filter(Product.id == product_id)
    if not is_admin_identity(identity):
        query = query.filter(
            Product.is_available.is_(True),
            Product.stock_units > Product.reserved_stock_units,
        )
    product = query.first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Mahsulot topilmadi",
        )

    schema = ProductResponse if is_admin_identity(identity) else PublicProductResponse
    return schema.model_validate(product)


# ============================================================
# CREATE PRODUCT
# ============================================================

@router.post("/", response_model=ProductResponse)
async def create_product(
    name: str = Form(...),
    price: float = Form(...),
    category_id: int = Form(...),
    description: str | None = Form(None),

    unit_type: str = Form("kg"),
    weight_per_unit: float = Form(1),
    stock_units: float = Form(0),

    image: UploadFile | None = File(None),

    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Yangi mahsulot yaratadi.

    Product category bilan category_id orqali bog'lanadi.
    """

    # --------------------------------------------------------
    # BASIC VALIDATION
    # --------------------------------------------------------

    name = name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Mahsulot nomi bo'sh bo'lishi mumkin emas",
        )

    if price < 0:
        raise HTTPException(
            status_code=400,
            detail="Mahsulot narxi manfiy bo'lishi mumkin emas",
        )

    validate_product_data(
        unit_type=unit_type,
        weight_per_unit=weight_per_unit,
        stock_units=stock_units,
    )

    # --------------------------------------------------------
    # CATEGORY VALIDATION
    # --------------------------------------------------------

    category = get_category_or_404(
        db=db,
        category_id=category_id,
        require_active=True,
    )

    # --------------------------------------------------------
    # IMAGE
    # --------------------------------------------------------

    image_path = None

    if image is not None:
        image_path = await save_product_image(
            image=image,
            product_name=name,
        )

    # --------------------------------------------------------
    # PRODUCT
    # --------------------------------------------------------

    product = Product(
        name=name,
        description=description.strip() if description else None,
        price=price,

        category_id=category.id,

        image=image_path,

        unit_type=unit_type,
        weight_per_unit=weight_per_unit,
        stock_units=stock_units,

        is_available=True,
    )

    db.add(product)
    db.flush()
    if Decimal(str(stock_units)) > 0:
        db.add(InventoryMovement(
            product_id=product.id,
            kind="RECEIPT",
            quantity_delta=Decimal(str(stock_units)),
            note="Mahsulot yaratishda boshlang'ich qoldiq kiritildi.",
            actor_telegram_id=_.telegram_id,
        ))
    db.commit()
    db.refresh(product)

    # Category relationshipni qayta yuklash
    product = (
        product_query(db)
        .filter(Product.id == product.id)
        .first()
    )

    return product


# ============================================================
# UPDATE PRODUCT
# ============================================================

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,

    name: str = Form(...),
    price: float = Form(...),
    category_id: int = Form(...),
    description: str | None = Form(None),

    unit_type: str = Form("kg"),
    weight_per_unit: float = Form(1),
    stock_units: float = Form(0),

    is_available: bool = Form(True),

    image: UploadFile | None = File(None),

    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Mavjud mahsulotni yangilaydi.

    Category string emas, category_id orqali yangilanadi.
    """

    # --------------------------------------------------------
    # FIND PRODUCT
    # --------------------------------------------------------

    product = (
        product_query(db)
        .filter(Product.id == product_id)
        .with_for_update(of=Product)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Mahsulot topilmadi",
        )

    previous_stock = Decimal(product.stock_units)
    current_reservations = Decimal(product.reserved_stock_units or 0)
    if Decimal(str(stock_units)) < current_reservations:
        raise HTTPException(
            status_code=409,
            detail=(
                "Ombor miqdori to'lanmagan buyurtmalar band qilgan "
                "miqdordan kam bo'lishi mumkin emas."
            ),
        )

    if current_reservations > 0 and (
        unit_type != product.unit_type
        or Decimal(str(weight_per_unit)) != Decimal(product.weight_per_unit)
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "To'lov kutilayotgan buyurtma borligi sababli mahsulot "
                "o'lchov birligi yoki dona og'irligini hozir o'zgartirib bo'lmaydi."
            ),
        )

    # --------------------------------------------------------
    # BASIC VALIDATION
    # --------------------------------------------------------

    name = name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Mahsulot nomi bo'sh bo'lishi mumkin emas",
        )

    if price < 0:
        raise HTTPException(
            status_code=400,
            detail="Mahsulot narxi manfiy bo'lishi mumkin emas",
        )

    validate_product_data(
        unit_type=unit_type,
        weight_per_unit=weight_per_unit,
        stock_units=stock_units,
    )

    # --------------------------------------------------------
    # CATEGORY VALIDATION
    # --------------------------------------------------------

    category = get_category_or_404(
        db=db,
        category_id=category_id,
        require_active=False,
    )

    # --------------------------------------------------------
    # UPDATE BASIC DATA
    # --------------------------------------------------------

    product.name = name
    product.price = price
    product.category_id = category.id
    product.description = (
        description.strip()
        if description
        else None
    )

    product.unit_type = unit_type
    product.weight_per_unit = weight_per_unit
    product.stock_units = stock_units

    stock_delta = Decimal(str(stock_units)) - previous_stock
    if stock_delta != 0:
        db.add(InventoryMovement(
            product_id=product.id,
            kind="ADJUSTMENT",
            quantity_delta=stock_delta,
            note="Admin mahsulot tahririda qoldiqni o'zgartirdi.",
            actor_telegram_id=_.telegram_id,
        ))

    product.is_available = is_available

    # --------------------------------------------------------
    # UPDATE IMAGE
    # --------------------------------------------------------

    if image is not None:
        old_image = product.image

        new_image_path = await save_product_image(
            image=image,
            product_name=name,
        )

        product.image = new_image_path

        # Database yangi pathga o'tgandan keyin
        # eski faylni o'chiramiz.
        delete_product_image(old_image)

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    db.commit()
    db.refresh(product)

    # Category relationship bilan qayta olish
    product = (
        product_query(db)
        .filter(Product.id == product.id)
        .first()
    )

    return product


# ============================================================
# DELETE PRODUCT
# ============================================================

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    """
    Mahsulotni o'chiradi.

    Keyinchalik OrderItem bilan tarixiy bog'lanish uchun
    alohida soft-delete strategiyasi qo'shilishi mumkin.
    Hozirgi modeldagi mavjud delete behavior saqlanadi.
    """

    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Mahsulot topilmadi",
        )

    if Decimal(product.reserved_stock_units or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="To'lanmagan buyurtmalar bu mahsulotni band qilib turibdi.",
        )

    has_order_history = db.query(OrderItem.id).filter(
        OrderItem.product_id == product_id
    ).first() is not None
    has_inventory_history = db.query(InventoryMovement.id).filter(
        InventoryMovement.product_id == product_id
    ).first() is not None

    if has_order_history or has_inventory_history:
        product.is_available = False
        db.commit()
        return {
            "success": True,
            "archived": True,
            "message": "Mahsulot sotuvdan olindi; buyurtma va ombor tarixi saqlandi.",
        }

    old_image = product.image

    db.delete(product)
    db.commit()

    delete_product_image(old_image)

    return {
        "success": True,
        "archived": False,
        "message": "Mahsulot o'chirildi",
    }


@router.patch("/{product_id}/availability")
def set_product_availability(
    product_id: int,
    is_available: bool,
    db: Session = Depends(get_db),
    _: TelegramIdentity = Depends(require_admin),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if is_available and not product.category.is_active:
        raise HTTPException(status_code=409, detail="Avval mahsulot kategoriyasini faollashtiring.")
    product.is_available = is_available
    db.commit()
    return {"success": True, "is_available": product.is_available}
