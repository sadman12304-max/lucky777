// Синхронизация прогресса с Supabase (players / chat_players).
// Работает только внутри Telegram и только если в js/config.js заполнены
// supabaseUrl и supabaseAnonKey. Без них приложение остаётся локальным.

import { store } from './store.js';
import { telegram } from './telegram.js';

const CFG = window.LUCKY_CONFIG || {};
const BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
const KEY = String(CFG.supabaseAnonKey || '');

const enabled = Boolean(BASE && KEY && telegram.isTelegram && telegram.user?.id);

let syncTimer = null;
let busy = false;
let restored = false;

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

function uid() {
  return Number(telegram.user?.id) || null;
}

function currentChatId() {
  return telegram.app?.initDataUnsafe?.chat?.id ?? null;
}

function payload() {
  const s = store.get();
  const u = telegram.user || {};
  return {
    telegram_id: uid(),
    username: u.username || null,
    first_name: u.first_name || null,
    level: s.level.lvl,
    xp: s.level.xp,
    total_xp: s.level.totalXp,
    balance: s.balance,
    resets: s.level.resets,
    stats: s.stats,
    updated_at: new Date().toISOString(),
  };
}

async function push() {
  if (!enabled || busy || !uid()) return;
  busy = true;
  try {
    const res = await fetch(`${BASE}/rest/v1/players?on_conflict=telegram_id`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload()),
    });
    if (!res.ok) throw new Error(`players ${res.status}`);

    const chatId = currentChatId();
    if (chatId) {
      await fetch(`${BASE}/rest/v1/chat_players?on_conflict=chat_id,telegram_id`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ chat_id: chatId, telegram_id: uid() }),
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('backend sync:', e.message);
  } finally {
    busy = false;
  }
}

export const backend = {
  enabled,

  scheduleSync() {
    if (!enabled || !restored) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(push, 1500);
  },

  /** Подтягивает серверный прогресс; если его нет — отправляет локальный. */
  async restore() {
    if (!enabled || restored) return false;
    restored = true;
    try {
      const res = await fetch(
        `${BASE}/rest/v1/players?telegram_id=eq.${uid()}&select=*`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`select ${res.status}`);
      const rows = await res.json();
      const server = rows[0];
      if (server) {
        const serverTs = Date.parse(server.updated_at) || 0;
        if (serverTs > (store.get().updatedAt || 0)) {
          store.applyRemote(server);
          return true;
        }
      }
      await push();
    } catch (e) {
      console.warn('backend restore:', e.message);
    }
    return false;
  },

  pushNow: push,
};
