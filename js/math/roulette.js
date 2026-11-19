// Европейская рулетка: 37 чисел (0–36), честные выплаты, преимущество казино 2.7%.

import { randomInt } from './rng.js';

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function isRed(n) {
  return RED_NUMBERS.has(n);
}

export function colorOf(n) {
  if (n === 0) return 'green';
  return isRed(n) ? 'red' : 'black';
}

export function spin() {
  return randomInt(37);
}

/**
 * Виды ставок и множитель выплаты (включая возврат ставки):
 * straight — 36×, red/black/even/odd/low/high — 2×.
 */
export const OUTSIDE_BETS = {
  red:   { label: 'Красное',  mult: 2 },
  black: { label: 'Чёрное',   mult: 2 },
  even:  { label: 'Чётное',   mult: 2 },
  odd:   { label: 'Нечётное', mult: 2 },
  low:   { label: '1–18',     mult: 2 },
  high:  { label: '19–36',    mult: 2 },
};

export function betMultiplier(bet) {
  if (bet.kind === 'straight') return 36;
  const def = OUTSIDE_BETS[bet.kind];
  return def ? def.mult : 0;
}

export function betWins(bet, result) {
  switch (bet.kind) {
    case 'straight':
      return bet.number === result;
    case 'red':
      return isRed(result) && result !== 0;
    case 'black':
      return result !== 0 && !isRed(result);
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'odd':
      return result % 2 === 1;
    case 'low':
      return result >= 1 && result <= 18;
    case 'high':
      return result >= 19 && result <= 36;
    default:
      return false;
  }
}

/** Возврат по одной ставке. */
export function resolveBet(bet, result) {
  return betWins(bet, result) ? bet.amount * betMultiplier(bet) : 0;
}

/** Суммарный возврат по списку ставок. */
export function resolveBets(bets, result) {
  return bets.reduce((sum, b) => sum + resolveBet(b, result), 0);
}
