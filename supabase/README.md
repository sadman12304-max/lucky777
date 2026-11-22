# Деплой бота LUCKY 777 на Supabase

## 1. Проект и база

1. Создай проект на https://supabase.com (Free, EU).
2. SQL Editor → выполни `backend/schema.sql`.
3. В `js/config.js` впиши `supabaseUrl` и `supabaseAnonKey` (Project Settings → API → anon public). Это включит синхронизацию мини-аппы.

## 2. Функция бота

Нужен Supabase CLI: https://supabase.com/docs/guides/cli

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy telegram --no-verify-jwt
```

Секреты:

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN=123:AA... \
  TELEGRAM_WEBHOOK_SECRET=<случайная строка> \
  WEBAPP_URL=https://sadman12304-max.github.io/lucky777/
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` доступны функции автоматически.

## 3. Вебхук Telegram

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram" \
  -d "secret_token=<тот же TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","my_chat_member"]'
```

## 4. Группы

Чтобы бот видел `/me` и `/top` в группах, отключи privacy mode:

@BotFather → `/setprivacy` → выбери бота → **Disable**.

Добавь бота в чат — он пришлёт приветствие. Каждый участник один раз пишет `/me`, после этого попадает в `/top` этого чата. Список всех участников Telegram боту не отдаёт.

## 5. Проверка

- `/start` → кнопка «Открыть мини-аппу».
- `/me` → уровень, баланс, прогресс.
- `/top` → топ чата по уровню и балансу.
- Баланс/уровень синхронизируются из мини-аппы через REST Supabase.

## Безопасность

Сейчас anon-ключ может писать в `players` (RLS разрешает) — это ок для виртуальных очков, но не для реальных денег. Для продакшена нужен Edge Function с проверкой `initData` и серверным расчётом раундов.
