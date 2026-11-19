// Кости (dice 1–100): выпадает число, ставка «больше»/«меньше» цели.
// Множитель = 0.97 * 100 / шанс выигрыша → EV 0.97.

import { randomInt } from './rng.js';

export const HOUSE_EDGE = 0.03;

export function roll() {
  return randomInt(100) + 1;
}

/** target: 2..99; over=true → выигрыш при roll > target. */
export function winChance(target, over) {
  const wins = over ? 100 - target : target - 1;
  return Math.max(0, wins) / 100;
}

export function multiplier(target, over) {
  const chance = winChance(target, over);
  if (chance <= 0) return 0;
  return (1 - HOUSE_EDGE) / chance;
}

export function isWin(value, target, over) {
  return over ? value > target : value < target;
}

export function simulate(target, over, rounds = 1_000_000) {
  const mult = multiplier(target, over);
  let staked = 0;
  let returned = 0;
  for (let i = 0; i < rounds; i++) {
    staked += 1;
    if (isWin(roll(), target, over)) returned += mult;
  }
  return returned / staked;
}
