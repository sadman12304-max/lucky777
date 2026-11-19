// Ежедневный бонус за вход. Сброс — в 00:00 по локальному времени.

import { store } from './store.js';

export const DAILY_BASE = 1000;
export const DAILY_STEP = 250;
export const DAILY_CAP = 7;

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function isDailyAvailable(state = store.get()) {
  return (state.daily?.last || '') !== todayKey();
}

export function currentDailyStreak(state = store.get()) {
  return state.daily?.streak || 0;
}

/** Живая серия: сгорает, если последний вход был раньше вчерашнего дня. */
export function effectiveStreak(state = store.get()) {
  const last = state.daily?.last;
  if (!last) return 0;
  const today = todayKey();
  const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return last === today || last === yesterday ? (state.daily?.streak || 0) : 0;
}

export function nextStreakIfClaimed(state = store.get()) {
  const last = state.daily?.last || '';
  if (!last) return 1;
  const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return last === yesterday ? (state.daily?.streak || 0) + 1 : 1;
}

/** Сколько дадут за вход: 1 000 + 250 за каждый следующий день серии (макс. 2 500). */
export function dailyAmount(streak) {
  return DAILY_BASE + DAILY_STEP * (Math.max(1, Math.min(DAILY_CAP, streak)) - 1);
}

export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Забирает бонус. Возвращает { amount, streak } или null, если уже забрано сегодня. */
export function claimDaily() {
  const state = store.get();
  if (!isDailyAvailable(state)) return null;

  const streak = nextStreakIfClaimed(state);
  const amount = dailyAmount(streak);

  state.daily = { last: todayKey(), streak };
  store.addPoints(amount);
  store.touch();
  return { amount, streak };
}
