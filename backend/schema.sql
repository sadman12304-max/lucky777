-- LUCKY 777 · Supabase schema
-- Выполнить в SQL Editor проекта Supabase.

create table if not exists public.players (
  telegram_id bigint primary key,
  username text,
  first_name text,
  level int not null default 1,
  xp int not null default 0,
  total_xp bigint not null default 0,
  balance bigint not null default 10000,
  resets int not null default 0,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.players add column if not exists stats jsonb not null default '{}'::jsonb;

create table if not exists public.chat_players (
  chat_id bigint not null,
  telegram_id bigint not null references public.players(telegram_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, telegram_id)
);

create index if not exists chat_players_chat_idx on public.chat_players (chat_id);

create table if not exists public.chat_settings (
  chat_id bigint primary key,
  title text,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.chat_players enable row level security;
alter table public.chat_settings enable row level security;

-- Клиент мини-аппы пишет только свой прогресс (anon key).
-- Внимание: это виртуальные очки; для реальных денег нужен Edge Function
-- с проверкой initData и серверным расчётом раундов.
drop policy if exists "anon select players" on public.players;
drop policy if exists "anon insert players" on public.players;
drop policy if exists "anon update players" on public.players;
create policy "anon select players" on public.players for select to anon using (true);
create policy "anon insert players" on public.players for insert to anon with check (true);
create policy "anon update players" on public.players for update to anon using (true) with check (true);

drop policy if exists "anon select chat_players" on public.chat_players;
drop policy if exists "anon insert chat_players" on public.chat_players;
create policy "anon select chat_players" on public.chat_players for select to anon using (true);
create policy "anon insert chat_players" on public.chat_players for insert to anon with check (true);
