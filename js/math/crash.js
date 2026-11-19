// Краш: множитель растёт, игрок забирает до взрыва.
// P(краш >= m) ≈ 0.97 / m — преимущество казино 3%.

import { randomFloat } from './rng.js';

export const HOUSE_EDGE = 0.03;
export const MAX_MULT = 5000;

/** Точка краха с двумя знаками, минимум 1.00. */
export function crashPoint() {
  const u = randomFloat();
  if (u === 0) return MAX_MULT;
  const raw = (1 - HOUSE_EDGE) / u;
  const m = Math.floor(raw * 100) / 100;
  return Math.min(MAX_MULT, Math.max(1, m));
}

/**
 * Множитель от времени (сек). 2× примерно за 3 c, 10× за 10 c.
 * Рост экспоненциальный, замедляется по мере роста.
 */
export function multiplierAt(seconds) {
  return Math.exp(0.231 * seconds);
}

/** Время (сек) до достижения множителя. */
export function timeForMultiplier(m) {
  if (m <= 1) return 0;
  return Math.log(m) / 0.231;
}

/** Проверка EV: стратегия «забрать на target». */
export function simulate(target, rounds = 1_000_000) {
  let staked = 0;
  let returned = 0;
  for (let i = 0; i < rounds; i++) {
    const crash = crashPoint();
    staked += 1;
    if (crash >= target) returned += target;
  }
  return returned / staked;
}
