#!/usr/bin/env node
// Симуляция RTP всех игр. Запуск: node tools/rtp.mjs [спинов]
import { simulate as simSlots, LINES } from '../js/math/slots.js';
import { resolveBets, spin as spinRoulette, colorOf } from '../js/math/roulette.js';
import { simulate as simCrash } from '../js/math/crash.js';
import { simulate as simDice, roll } from '../js/math/dice.js';

const SPINS = Number(process.argv[2] || 300000);

function pct(x) {
  return (x * 100).toFixed(2) + '%';
}

console.log(`\n=== LUCKY 777 RTP LAB (${SPINS.toLocaleString('ru-RU')} итераций) ===\n`);

const slots = simSlots(SPINS, 100);
console.log('СЛОТЫ (5×3, 5 линий):');
console.log(`  RTP          ${pct(slots.rtp)}`);
console.log(`  hit rate     ${pct(slots.hitRate)}`);
console.log(`  лучший вин   ${slots.bestWin.toFixed(0)} @ x${slots.bestMult.toFixed(1)}`);

// Рулетка: EV по всем видам ставок
const bets = [
  { kind: 'straight', number: 17, amount: 1 },
  { kind: 'red', amount: 1 },
  { kind: 'black', amount: 1 },
  { kind: 'even', amount: 1 },
  { kind: 'odd', amount: 1 },
  { kind: 'low', amount: 1 },
  { kind: 'high', amount: 1 },
];
console.log('\nРУЛЕТКА (37 чисел, 7 видов ставок):');
for (const bet of bets) {
  let staked = 0;
  let returned = 0;
  const n = Math.min(SPINS, 200000);
  for (let i = 0; i < n; i++) {
    const result = spinRoulette();
    staked += bet.amount;
    returned += resolveBets([bet], result);
  }
  const label = bet.kind === 'straight' ? `straight ${bet.number}` : bet.kind;
  console.log(`  ${label.padEnd(12)} ${pct(returned / staked)}`);
}

console.log('\nКРАШ:');
for (const target of [1.2, 1.5, 2, 3, 5, 10]) {
  console.log(`  кэшаут ×${target.toString().padEnd(4)} EV ${pct(simCrash(target, Math.min(SPINS, 200000)))}`);
}

console.log('\nКОСТИ:');
for (const [target, over] of [[50, true], [50, false], [75, true], [25, false], [90, true]]) {
  console.log(`  ${over ? '>' : '<'} ${target}   EV ${pct(simDice(target, over, Math.min(SPINS, 200000)))}`);
}

// частота выпадения чисел (проверка равномерности)
const counts = new Array(100).fill(0);
for (let i = 0; i < 100000; i++) counts[roll() - 1]++;
const min = Math.min(...counts);
const max = Math.max(...counts);
console.log(`\n  равномерность костей: min ${min}, max ${max} (ожидание ~1000)`);
console.log(`  линий в слотах: ${LINES.length}`);
console.log('');
