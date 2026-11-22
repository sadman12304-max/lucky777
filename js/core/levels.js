// Уровни по обороту: 1 очко оборота = 1 XP.
// Квота уровня = 1000 × уровень. Банкротство сбрасывает на 1 уровень.

export const LEVEL_STEP = 1000;

export const LEVEL_NAMES = [
  'Новичок',
  'Игрок',
  'Счастливчик',
  'Крупье',
  'Хайроллер',
  'Легенда',
  'Магнат',
  'Король',
  'Император',
  'Легенда 777',
];

export function quotaFor(level) {
  return LEVEL_STEP * Math.max(1, Math.trunc(level) || 1);
}

export function levelName(level) {
  const lvl = Math.max(1, Math.trunc(level) || 1);
  return LEVEL_NAMES[Math.min(lvl, LEVEL_NAMES.length) - 1];
}

export function levelProgress(state) {
  const l = state.level || { lvl: 1, xp: 0, totalXp: 0, resets: 0 };
  const lvl = Math.max(1, l.lvl || 1);
  const xp = Math.max(0, l.xp || 0);
  const quota = quotaFor(lvl);
  return {
    lvl,
    xp,
    quota,
    left: Math.max(0, quota - xp),
    pct: Math.min(100, (xp / quota) * 100),
    totalXp: l.totalXp || 0,
    resets: l.resets || 0,
    name: levelName(lvl),
  };
}
