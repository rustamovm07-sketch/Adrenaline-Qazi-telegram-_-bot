from __future__ import annotations

import asyncio
from html import escape
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    MenuButtonWebApp,
    Message,
    ReplyKeyboardRemove,
    WebAppInfo,
)
from dotenv import load_dotenv


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", "").strip()
MINI_APP_URL = os.getenv("MINI_APP_URL", "").strip()
ADMIN_PANEL_URL = os.getenv("ADMIN_PANEL_URL", "").strip()


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(__name__)


# ============================================================
# ROUTER
# ============================================================

router = Router(name="adrenalin_qazi_bot")


# ============================================================
# VALIDATION
# ============================================================

def validate_bot_configuration() -> None:
    """
    Bot ishga tushishidan oldin zarur environment
    o'zgaruvchilar mavjudligini tekshiradi.
    """

    missing = []

    if not BOT_TOKEN:
        missing.append("BOT_TOKEN")

    if not ADMIN_TELEGRAM_ID:
        missing.append("ADMIN_TELEGRAM_ID")

    if not MINI_APP_URL:
        missing.append("MINI_APP_URL")

    if not ADMIN_PANEL_URL:
        missing.append("ADMIN_PANEL_URL")

    if missing:
        raise RuntimeError(
            "Telegram bot uchun quyidagi environment "
            f"o'zgaruvchilar topilmadi: {', '.join(missing)}"
        )

    try:
        owner_id = int(ADMIN_TELEGRAM_ID)
    except ValueError as exc:
        raise RuntimeError(
            "ADMIN_TELEGRAM_ID faqat Telegram numeric ID bo'lishi kerak."
        ) from exc

    if owner_id <= 0:
        raise RuntimeError(
            "ADMIN_TELEGRAM_ID musbat Telegram numeric ID bo'lishi kerak."
        )

    for setting_name, url in (
        ("MINI_APP_URL", MINI_APP_URL),
        ("ADMIN_PANEL_URL", ADMIN_PANEL_URL),
    ):
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise RuntimeError(
                f"{setting_name} to'liq HTTPS URL bo'lishi kerak."
            )


# ============================================================
# ADMIN CHECK
# ============================================================

def is_admin_telegram_id(telegram_id: int | None) -> bool:
    """
    Telegram user ID loyihadagi yagona asosiy admin ID
    ekanligini tekshiradi.
    """

    if telegram_id is None:
        return False

    if not ADMIN_TELEGRAM_ID:
        return False

    try:
        return telegram_id == int(ADMIN_TELEGRAM_ID)
    except ValueError:
        return False


# ============================================================
# TELEGRAM MENU BUTTONS
# ============================================================

def shop_menu_button() -> MenuButtonWebApp:
    """Create the authenticated customer Mini App menu button."""
    return MenuButtonWebApp(
        text="Do'kon",
        web_app=WebAppInfo(url=MINI_APP_URL),
    )


def admin_menu_button() -> MenuButtonWebApp:
    """Create the authenticated owner Mini App menu button."""
    return MenuButtonWebApp(
        text="Admin panel",
        web_app=WebAppInfo(url=ADMIN_PANEL_URL),
    )


async def configure_default_menu_button(bot: Bot) -> None:
    """Expose the shop through Telegram's persistent chat menu."""
    await bot.set_chat_menu_button(menu_button=shop_menu_button())


# ============================================================
# /START
# ============================================================

@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    """
    /start komandasi.

    Oddiy foydalanuvchi:
    - Mini App ochishi mumkin.

    Har qanday foydalanuvchi avval do'konni mijoz sifatida ochadi.
    Egasi /admin buyrug'i bilan admin menyusiga o'tadi.
    """

    user = message.from_user

    if user is None:
        return

    user_name = escape(user.first_name or "foydalanuvchi")

    is_admin = is_admin_telegram_id(user.id)
    await message.bot.set_chat_menu_button(
        chat_id=user.id,
        menu_button=shop_menu_button(),
    )
    text = (
        f"Assalomu alaykum, {user_name}.\n\n"
        "Adrenalin Qazi do'koniga xush kelibsiz.\n"
        "Mahsulotlarni ko'rish va buyurtma berish uchun chat "
        "pastidagi <b>Do'kon</b> menyu tugmasini bosing."
    )
    if is_admin:
        text += "\n\nAdmin panelga kirish uchun /admin buyrug'ini yuboring."

    await message.answer(
        text,
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Command("shop"))
async def shop_handler(message: Message) -> None:
    """Switch this user's persistent menu button to the shop."""
    user = message.from_user
    if user is None:
        return

    await message.bot.set_chat_menu_button(
        chat_id=user.id,
        menu_button=shop_menu_button(),
    )
    await message.answer(
        "Do'kon menyusi tayyor. Chat pastidagi <b>Do'kon</b> tugmasini bosing.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(Command("admin"))
async def admin_handler(message: Message) -> None:
    """Switch the configured owner's persistent menu to the admin panel."""
    user = message.from_user
    if user is None:
        return
    if not is_admin_telegram_id(user.id):
        await message.answer("Bu buyruq faqat loyiha egasi uchun.")
        return

    await message.bot.set_chat_menu_button(
        chat_id=user.id,
        menu_button=admin_menu_button(),
    )
    await message.answer(
        "Admin menyusi tayyor. Chat pastidagi "
        "<b>Admin panel</b> tugmasini bosing.",
        reply_markup=ReplyKeyboardRemove(),
    )


# ============================================================
# BOT FACTORY
# ============================================================

def create_bot() -> Bot:
    """
    Telegram Bot obyektini yaratadi.
    """

    validate_bot_configuration()

    return Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(
            parse_mode=ParseMode.HTML,
        ),
    )


def create_dispatcher() -> Dispatcher:
    """
    Dispatcher yaratadi va barcha bot routerlarini ulaydi.
    """

    dispatcher = Dispatcher()

    dispatcher.include_router(router)

    return dispatcher


# ============================================================
# BOT RUNNER
# ============================================================

async def run_bot() -> None:
    """
    Telegram bot polling orqali ishga tushadi.

    Production deploymentda bot alohida process/service
    sifatida ishga tushirilishi mumkin.
    """

    bot = create_bot()
    dispatcher = create_dispatcher()

    logger.info("Adrenalin Qazi Telegram bot ishga tushmoqda...")

    try:
        await configure_default_menu_button(bot)
        await dispatcher.start_polling(
            bot,
            allowed_updates=dispatcher.resolve_used_update_types(),
        )
    finally:
        await bot.session.close()


async def notify_admin_new_order(
    order_id: int,
    total_amount: str,
    item_count: int,
    customer_name: str,
    customer_phone: str,
    address: str | None,
    landmark: str | None,
) -> None:
    """Send a minimal order alert to the single configured owner."""

    if not BOT_TOKEN or not ADMIN_TELEGRAM_ID:
        logger.warning("Order alert skipped: Telegram bot settings are missing")
        return

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    try:
        await bot.send_message(
            chat_id=int(ADMIN_TELEGRAM_ID),
            text=(
                f"Yangi buyurtma <b>#{order_id}</b>\n"
                f"Mijoz: {escape(customer_name)}\n"
                f"Telefon: {escape(customer_phone)}\n"
                f"Mahsulot turlari: {item_count}\n"
                f"Jami: {total_amount} so'm\n\n"
                f"Yetkazish: {escape(address or 'Xaritadagi nuqta')}\n"
                f"Orientir: {escape(landmark or 'Ko‘rsatilmagan')}\n\n"
                "Buyurtmani admin panelda tekshiring."
            ),
        )
    except Exception:
        logger.exception("Failed to send Telegram alert for order %s", order_id)
    finally:
        await bot.session.close()


async def notify_order_status(
    customer_telegram_id: int | None,
    order_id: int,
    status: str,
    delivery_time: str | None = None,
) -> None:
    """Notify the customer when the owner advances their order."""
    messages = {
        "PAID": "To‘lovingiz tasdiqlandi.",
        "CONFIRMED": "Buyurtmangiz tasdiqlandi.",
        "PREPARING": "Buyurtmangiz tayyorlanmoqda.",
        "READY": "Buyurtmangiz tayyor; yetkazishni kutmoqda.",
        "DELIVERING": "Buyurtmangiz yetkazib berishga chiqarildi.",
        "DELIVERED": "Buyurtmangiz yetkazib berildi.",
        "CANCELLED": "Buyurtmangiz bekor qilindi; band qilingan mahsulotlar bo‘shatildi.",
    }
    message = messages.get(status)
    if not BOT_TOKEN or customer_telegram_id is None or message is None:
        return
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        if delivery_time and status == "DELIVERING":
            message = f"{message}\nYetkazish vaqti: {escape(delivery_time)}"
        await bot.send_message(customer_telegram_id, f"{message}\nBuyurtma <b>#{order_id}</b>")
    except Exception:
        logger.exception("Failed to send status update for order %s", order_id)
    finally:
        await bot.session.close()


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

    asyncio.run(run_bot())
