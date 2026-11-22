#!/usr/bin/env node
// Юнит-проверки нового функционала: дюжины рулетки и математика кено.
import { betWins, resolveBets } from '../js/math/roulette.js';
import { randomPicks, drawNumbers, evaluate, PAYOUTS, PICK_COUNT, DRAW_COUNT } from '../js/math/keno.js';
import { quotaFor, levelName, levelProgress } from '../js/core/levels.js';
import { evaluate as evaluateSlots, SCATTER, drawSuperPrize, BONUS_CHANCE } from '../js/math/slots.js';

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  · ' + extra : '')); }
}

// ── рулетка: дюжины ──
check('dozen 1: 1–12 выигрывает', [1, 5, 12].every((n) => betWins({ kind: 'dozen', number: 1 }, n)));
check('dozen 1: 0, 13, 36 не выигрывают', [0, 13, 36].every((n) => !betWins({ kind: 'dozen', number: 1 }, n)));
check('dozen 2: 13–24', [13, 18, 24].every((n) => betWins({ kind: 'dozen', number: 2 }, n)) && ![12, 25, 0].some((n) => betWins({ kind: 'dozen', number: 2 }, n)));
check('dozen 3: 25–36', [25, 30, 36].every((n) => betWins({ kind: 'dozen', number: 3 }, n)) && ![24, 1, 0].some((n) => betWins({ kind: 'dozen', number: 3 }, n)));
check('дюжина платит 3x', resolveBets([{ kind: 'dozen', number: 2, amount: 100 }], 15) === 300);
check('дюжина проигрывает зеро', resolveBets([{ kind: 'dozen', number: 1, amount: 100 }], 0) === 0);
check('дюжина + красное складываются', resolveBets([
  { kind: 'dozen', number: 1, amount: 100 },
  { kind: 'red', amount: 100 },
], 5) === 500);

// ── кено ──
const picks = randomPicks();
const draws = drawNumbers();
check('кено: 10 уникальных чисел', picks.length === PICK_COUNT && new Set(picks).size === PICK_COUNT && picks.every((n) => n >= 1 && n <= 80));
check('кено: 20 уникальных выпавших', draws.length === DRAW_COUNT && new Set(draws).size === DRAW_COUNT && draws.every((n) => n >= 1 && n <= 80));

const fullPicks = Array.from({ length: 10 }, (_, i) => i + 1);
const fullDraws = Array.from({ length: 20 }, (_, i) => i + 1);
check('кено: 10 попаданий → x5000', evaluate(fullPicks, fullDraws, 100).payout === 500000);
check('кено: 4 попадания → x2.5', evaluate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56], 100).payout === 250);
check('кено: 0 попаданий → 0', evaluate(fullPicks, [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40], 100).payout === 0);

// Теоретический RTP по гипергеометрическому распределению.
function comb(n, k) {
  let r = 1n;
  for (let i = 0n; i < BigInt(k); i++) r = (r * (BigInt(n) - i)) / (i + 1n);
  return r;
}
const total = comb(80, 20);
let rtp = 0;
for (let k = 4; k <= 10; k++) {
  const p = Number(comb(10, k) * comb(70, 20 - k) * 1000000n / total) / 1e6;
  rtp += p * (PAYOUTS[k] || 0);
}
check('кено: теоретический RTP ~95.6%', Math.abs(rtp - 0.956) < 0.005, rtp.toFixed(4));

// ── уровни ──
check('уровни: квота 1 уровня 1 000', quotaFor(1) === 1000);
check('уровни: квота растёт на 1 000', quotaFor(4) === 4000);
check('уровни: названия', levelName(1) === 'Новичок' && levelName(5) === 'Хайроллер');
const lp = levelProgress({ level: { lvl: 2, xp: 500, totalXp: 2500, resets: 1 } });
check('уровни: прогресс 500/2000', lp.quota === 2000 && lp.left === 1500 && Math.round(lp.pct) === 25 && lp.resets === 1);

// ── суперигра ──
const grid = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => ({ id: 'cherry', pays: [0, 0, 0, 1, 2, 3] })));
grid[0][0] = SCATTER; grid[1][1] = SCATTER; grid[2][2] = SCATTER;
const superRes = evaluateSlots(grid, 100);
check('SUPER: 3 скаттера запускают бонус', superRes.bonus === true && superRes.scatters === 3);
check('SUPER: шанс в разумных пределах', BONUS_CHANCE > 0 && BONUS_CHANCE < 0.01, String(BONUS_CHANCE));
check('SUPER: приз из таблицы', [2, 3, 5, 8, 15, 77].includes(drawSuperPrize()));

console.log(`\n=== ${pass}/${pass + fail} PASS ===`);
if (fail) process.exitCode = 1;
