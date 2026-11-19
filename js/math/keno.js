// Кено: 80 чисел, игрок выбирает 10, выпадает 20.
// Выплаты подобраны так, чтобы RTP был около 96%.

import { shuffle } from './rng.js';

export const MAX_NUMBER = 80;
export const PICK_COUNT = 10;
export const DRAW_COUNT = 20;

export const PAYOUTS = {
  4: 2.5,
  5: 5,
  6: 16,
  7: 60,
  8: 300,
  9: 1500,
  10: 5000,
};

export function drawNumbers() {
  return shuffle(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1))
    .slice(0, DRAW_COUNT)
    .sort((a, b) => a - b);
}

export function randomPicks() {
  return shuffle(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1))
    .slice(0, PICK_COUNT)
    .sort((a, b) => a - b);
}

export function countHits(picks, draws) {
  const set = new Set(draws);
  return picks.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0);
}

export function multiplierFor(hits) {
  return PAYOUTS[hits] || 0;
}

export function evaluate(picks, draws, bet) {
  const hits = countHits(picks, draws);
  return { hits, payout: Math.round(bet * multiplierFor(hits)) };
}

export function simulate(rounds = 200000, bet = 100) {
  let staked = 0;
  let returned = 0;
  let wins = 0;
  let bestHits = 0;
  for (let i = 0; i < rounds; i++) {
    const picks = randomPicks();
    const draws = drawNumbers();
    const res = evaluate(picks, draws, bet);
    staked += bet;
    returned += res.payout;
    if (res.payout > 0) wins++;
    bestHits = Math.max(bestHits, res.hits);
  }
  return { rtp: returned / staked, hitRate: wins / rounds, bestHits };
}
