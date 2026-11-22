// Математика слотов: 5 барабанов × 3 ряда, 5 линий.
// Выплаты — множители к ставке НА ЛИНИЮ (общая ставка делится на 5 линий).

import { randomFloat, randomInt, weightedPick } from './rng.js';

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

// Скаттер SUPER: 3+ в любом месте запускают суперигру.
// Он не входит в обычные веса, а накладывается поверх сетки с шансом BONUS_CHANCE.
export const SCATTER = { id: 'super', name: 'SUPER', weight: 0, pays: [0, 0, 0, 0, 0, 0] };
export const BONUS_CHANCE = 0.0025;

export const SYMBOL_BY_ID = Object.fromEntries([...SYMBOLS, SCATTER].map((s) => [s.id, s]));

// Призы суперигры: множитель к ставке.
export const SUPER_PRIZES = [
  { mult: 2, weight: 40 },
  { mult: 3, weight: 25 },
  { mult: 5, weight: 18 },
  { mult: 8, weight: 10 },
  { mult: 15, weight: 5 },
  { mult: 77, weight: 2 },
];

export const SUPER_AVG = SUPER_PRIZES.reduce((sum, p) => sum + p.mult * p.weight, 0) /
  SUPER_PRIZES.reduce((sum, p) => sum + p.weight, 0);

export function drawSuperPrize() {
  return weightedPick(SUPER_PRIZES).mult;
}

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

  // Редкий бонус: 3+ SUPER в любом месте. Ставим их поверх готовой сетки.
  if (randomFloat() < BONUS_CHANCE) {
    const spots = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) spots.push([r, row]);
    for (let i = spots.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const count = 3 + (randomFloat() < 0.12 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const [r, row] = spots[i];
      grid[r][row] = SCATTER;
    }
  }
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
  let scatters = 0;

  for (let reel = 0; reel < REELS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[reel][row].id === SCATTER.id) scatters++;
    }
  }

  LINES.forEach((rows, lineIndex) => {
    const first = grid[0][rows[0]];
    if (first.id === SCATTER.id) return;
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

  return { wins, total, scatters, bonus: scatters >= 3 };
}

/** Проверка RTP: крутит n спинов по ставке bet. */
export function simulate(spins, bet) {
  let staked = 0;
  let returned = 0;
  let hitSpins = 0;
  let bonusSpins = 0;
  let best = 0;
  let bestMult = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid();
    const res = evaluate(grid, bet);
    staked += bet;
    returned += res.total;
    if (res.bonus) {
      bonusSpins++;
      // Средний приз суперигры для оценки общего RTP.
      returned += bet * SUPER_AVG;
    }
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
    bonusRate: bonusSpins / spins,
    bestWin: best,
    bestMult,
  };
}

// Экспорт для тестов/симуляций
export const _internal = { randomFloat };
