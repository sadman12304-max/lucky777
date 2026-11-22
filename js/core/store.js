// Состояние игрока: баланс, уровни, статистика, бонусы, настройки.

import { quotaFor } from './levels.js';
// Хранение: localStorage + (если есть) Telegram CloudStorage.

const KEY = 'lucky777.state.v1';
const LEGACY_KEY = 'fortuna.state.v1';
const CLOUD_KEY = 'lucky777_state';
const LEGACY_CLOUD_KEY = 'fortuna_state';

function defaults() {
  return {
    v: 1,
    balance: 10000,
    createdAt: Date.now(),
    updatedAt: 0,
    welcomed: false,
    stats: {
      rounds: 0,
      wins: 0,
      staked: 0,
      won: 0,
      bestWin: 0,
      bestMult: 0,
      maxBet: 0,
    },
    bonus: { lastSpin: 0, streak: 0 },
    daily: { last: '', streak: 0 },
    level: { lvl: 1, xp: 0, totalXp: 0, resets: 0 },
    referral: { referredBy: null, joinedAt: 0, claims: [], earned: 0 },
    settings: { sound: true, haptics: true },
    recent: [],
  };
}

function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats || {}) },
    bonus: { ...base.bonus, ...(raw.bonus || {}) },
    daily: { ...base.daily, ...(raw.daily || {}) },
    level: (() => {
      const l = { ...base.level, ...(raw.level || {}) };
      l.lvl = Math.max(1, Number(l.lvl) || 1);
      l.xp = Math.max(0, Number(l.xp) || 0);
      l.totalXp = Math.max(0, Number(l.totalXp) || 0);
      l.resets = Math.max(0, Number(l.resets) || 0);
      return l;
    })(),
    referral: (() => {
      const r = { ...base.referral, ...(raw.referral || {}) };
      r.claims = Array.isArray(r.claims) ? r.claims.slice(0, 100) : [];
      r.earned = Number(r.earned) || 0;
      return r;
    })(),
    settings: { ...base.settings, ...(raw.settings || {}) },
    recent: Array.isArray(raw.recent) ? raw.recent.slice(0, 20) : [],
  };
}

class Store extends EventTarget {
  constructor() {
    super();
    this.state = defaults();
    this._saveTimer = null;
    this._cloudTimer = null;
    this.cloud = null; // { getItem, setItem } — ставит telegram.js
    this._loaded = false;
  }

  init() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) {
        // прогресс старого бренда FORTUNA — переезжаем без потерь
        raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          localStorage.setItem(KEY, raw);
          localStorage.removeItem(LEGACY_KEY);
        }
      }
      if (raw) this.state = normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('store: не удалось прочитать localStorage', e);
    }
    this._loaded = true;
    return this.state;
  }

  /** Подтягивает более свежее состояние из Telegram CloudStorage. */
  async hydrateFromCloud() {
    if (!this.cloud) return false;
    try {
      let raw = await this.cloud.getItem(CLOUD_KEY);
      if (!raw) {
        raw = await this.cloud.getItem(LEGACY_CLOUD_KEY);
        if (raw) await this.cloud.setItem(CLOUD_KEY, raw);
      }
      if (!raw) return false;
      const remote = normalize(JSON.parse(raw));
      if ((remote.updatedAt || 0) > (this.state.updatedAt || 0)) {
        this.state = remote;
        this.emit('change');
        return true;
      }
    } catch (e) {
      console.warn('store: cloud hydrate failed', e);
    }
    return false;
  }

  emit(type) {
    this.dispatchEvent(new CustomEvent(type, { detail: this.state }));
  }

  touch() {
    this.state.updatedAt = Date.now();
    this.emit('change');
    this.scheduleSave();
  }

  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), 120);
    clearTimeout(this._cloudTimer);
    this._cloudTimer = setTimeout(() => this.saveCloud(), 1200);
  }

  saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('store: save failed', e);
    }
  }

  async saveCloud() {
    if (!this.cloud) return;
    try {
      await this.cloud.setItem(CLOUD_KEY, JSON.stringify(this.state));
    } catch (e) {
      // CloudStorage может быть недоступен — это не критично.
    }
  }

  get() {
    return this.state;
  }

  canBet(amount) {
    return Number.isFinite(amount) && amount >= 10 && amount <= this.state.balance;
  }

  /** Списывает ставку. Возвращает false, если не хватает очков. */
  placeBet(amount) {
    if (!this.canBet(amount)) return false;
    const s = this.state;
    s.balance -= amount;
    s.stats.staked += amount;
    s.stats.maxBet = Math.max(s.stats.maxBet, amount);

    // Уровни: XP = оборот, квота растёт на 1000 за уровень.
    s.level.totalXp += amount;
    s.level.xp += amount;
    let leveled = false;
    while (s.level.xp >= quotaFor(s.level.lvl)) {
      s.level.xp -= quotaFor(s.level.lvl);
      s.level.lvl += 1;
      leveled = true;
    }

    this.touch();
    if (leveled) this.emit('levelup');
    return true;
  }

  /** Возврат отменённой ставки (например, ушли с экрана краша). */
  refundBet(amount) {
    const s = this.state;
    s.balance += amount;
    s.stats.staked = Math.max(0, s.stats.staked - amount);
    this.touch();
  }

  /** Начисление выигрыша. */
  payout(amount, bet) {
    if (!(amount > 0)) return;
    const s = this.state;
    s.balance += amount;
    s.stats.won += amount;
    if (amount > s.stats.bestWin) s.stats.bestWin = amount;
    if (bet > 0) s.stats.bestMult = Math.max(s.stats.bestMult, amount / bet);
    this.touch();
  }

  addPoints(amount) {
    if (!(amount > 0)) return;
    this.state.balance += amount;
    this.touch();
  }

  recordRound({ game, bet, win }) {
    const s = this.state;
    s.stats.rounds += 1;
    if (win > bet) s.stats.wins += 1;
    s.recent.unshift({
      game,
      bet,
      win: Math.round(win * 100) / 100,
      ts: Date.now(),
    });
    s.recent = s.recent.slice(0, 20);
    if (s.balance < 10) {
      // Банкротство: игрок всё проиграл — с 1 уровня и небольшой страховкой.
      s.level.lvl = 1;
      s.level.xp = 0;
      s.level.resets += 1;
      s.balance += 1000;
      this.touch();
      this.emit('bankrupt');
    } else {
      this.touch();
    }
    this.emit('round');
  }

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.touch();
  }

  setWelcomed() {
    this.state.welcomed = true;
    this.touch();
  }

  reset() {
    const createdAt = this.state.createdAt;
    this.state = defaults();
    this.state.createdAt = createdAt;
    this.state.welcomed = true;
    this.touch();
    this.saveNow();
  }
}

export const store = new Store();
