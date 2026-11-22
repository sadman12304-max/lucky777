-- LUCKY 777 · схема для Supabase (Postgres)
-- Выполнить в SQL Editor проекта Supabase один раз.

create table if not exists public.players (
  telegram_id bigint primary key,
  username text,
  first_name text,
  level int not null default 1,
  xp int not null default 0,
  total_xp bigint not null default 0,
  balance bigint not null default 10000,
  resets int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_players (
  chat_id bigint not null,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, telegram_id)
);

create index if not exists chat_players_chat_idx
  on public.chat_players (chat_id, telegram_id);

create table if not exists public.chat_settings (
  chat_id bigint primary key,
  title text,
  created_at timestamptz not null default now()
);

-- Доступ только через Edge Function с service_role.
-- Прямой доступ anon-ключом закрыт: политик нет.
alter table public.players enable row level security;
alter table public.chat_players enable row level security;
alter table public.chat_settings enable row level security;
