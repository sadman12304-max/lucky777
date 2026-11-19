"""Минимальный бот для запуска LUCKY 777 как Telegram Mini App.

Установка:
    pip install -r requirements.txt

Запуск:
    BOT_TOKEN=123:abc WEBAPP_URL=https://example.com python bot.py
"""
import asyncio
import os

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

if not BOT_TOKEN or not WEBAPP_URL:
    raise SystemExit("Нужны переменные окружения BOT_TOKEN и WEBAPP_URL (https://...)")

if not WEBAPP_URL.startswith("https://"):
    raise SystemExit("Telegram открывает мини-аппы только по HTTPS")

dp = Dispatcher()


def app_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🎰 Открыть LUCKY 777", web_app=WebAppInfo(url=WEBAPP_URL))]
        ]
    )


@dp.message(CommandStart())
async def start(message: Message) -> None:
    await message.answer(
        "<b>LUCKY 777</b> — виртуальное казино на очки.\n\n"
        "Слоты, рулетка, блэкджек, краш, кости и кено. Все ставки — только на виртуальные очки: "
        "их нельзя купить или вывести.\n\n"
        "Заходи каждый день за бонусом и крути колесо раз в 4 часа.",
        reply_markup=app_keyboard(),
    )


@dp.message(F.text == "/app")
async def open_app(message: Message) -> None:
    await message.answer("Жми кнопку 👇", reply_markup=app_keyboard())


async def main() -> None:
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(text="LUCKY 777", web_app=WebAppInfo(url=WEBAPP_URL))
    )
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
