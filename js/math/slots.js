// Математика слотов: 5 барабанов × 3 ряда, 5 линий.
// Выплаты — множители к ставке НА ЛИНИЮ (общая ставка делится на 5 линий).

import { randomFloat, weightedPick } from './rng.js';

export const REELS = 5;
export const ROWS = 3;

export const SYMBOLS = [
  { id: 'cherry',  name: 'Вишня',  weight: 30, pays: [0, 0, 0, 8, 22, 55] },
  { id: 'lemon',   name: 'Лимон',  weight: 24, pays: [0, 0, 0, 11, 28, 70] },
  { id: 'bell',    name: 'Колокол',weight: 18, pays: [0, 0, 0, 16, 44, 115] },
  { id: 'star',    name: 'Звезда', weight: 14, pays: [0, 0, 0, 28, 70, 210] },
  { id: 'diamond', name: 'Алмаз',  weight: 10, pays: [0, 0, 0, 50, 140, 420] },
  { id: 'seven',   name: 'Семёрка',weight: 4,  pays: [0, 0, 0, 200, 700, 3500] },
];

export const SYMBOL_BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));

export const LINES = [
  [1, 1, 1, 1, 1], // центр
  [0, 0, 0, 0, 0], // верх
  [2, 2, 2, 2, 2], // низ
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // Λ
];

/** Один барабан: 3 символа сверху вниз. */
export function spinReel() {
  return [pickSymbol(), pickSymbol(), pickSymbol()];
}

function pickSymbol() {
  return weightedPick(SYMBOLS);
}

/** Поле 5×3: grid[reel][row]. */
export function spinGrid() {
  const grid = [];
  for (let r = 0; r < REELS; r++) grid.push(spinReel());
  return grid;
}

/**
 * Считает выигрыши по линиям.
 * @param {Array<Array<object>>} grid
 * @param {number} totalBet — общая ставка на спин
 * @returns {{wins: Array, total: number}}
 */
export function evaluate(grid, totalBet) {
  const lineBet = totalBet / LINES.length;
  const wins = [];
  let total = 0;

  LINES.forEach((rows, lineIndex) => {
    const first = grid[0][rows[0]];
    let count = 1;
    for (let r = 1; r < REELS; r++) {
      if (grid[r][rows[r]].id === first.id) count++;
      else break;
    }
    if (count >= 3) {
      const pay = first.pays[count] * lineBet;
      if (pay > 0) {
        const cells = rows.map((row, r) => [r, row]);
        wins.push({ line: lineIndex, symbol: first.id, count, pay, cells });
        total += pay;
      }
    }
  });

  return { wins, total };
}

/** Проверка RTP: крутит n спинов по ставке bet. */
export function simulate(spins, bet) {
  let staked = 0;
  let returned = 0;
  let hitSpins = 0;
  let best = 0;
  let bestMult = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid();
    const res = evaluate(grid, bet);
    staked += bet;
    returned += res.total;
    if (res.total > 0) hitSpins++;
    if (res.total > best) {
      best = res.total;
      bestMult = res.total / bet;
    }
  }
  return {
    spins,
    rtp: returned / staked,
    hitRate: hitSpins / spins,
    bestWin: best,
    bestMult,
  };
}

// Экспорт для тестов/симуляций
export const _internal = { randomFloat };
