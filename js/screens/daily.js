// Карточка ежедневного входа (на главной и на экране бонусов).

import { store } from '../core/store.js';
import { fmt } from '../core/util.js';
import {
  isDailyAvailable,
  nextStreakIfClaimed,
  dailyAmount,
  currentDailyStreak,
  effectiveStreak,
  msUntilMidnight,
  claimDaily,
  DAILY_CAP,
} from '../core/daily.js';
import { confetti, toast } from '../core/ui.js';
import { sfx } from '../core/sound.js';

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function setupDaily(ctx) {
  const { haptic } = ctx;
  const cards = Array.from(document.querySelectorAll('[data-daily]'));
  if (!cards.length) return { render() {} };

  function render() {
    const state = store.get();
    const available = isDailyAvailable(state);
    const streak = effectiveStreak(state);
    const nextStreak = nextStreakIfClaimed(state);
    const amount = dailyAmount(available ? nextStreak : Math.max(1, streak));
    const dots = Math.min(DAILY_CAP, available ? nextStreak : streak);
    const left = msUntilMidnight();

    cards.forEach((card) => {
      const amountEl = card.querySelector('[data-daily-amount]');
      const subEl = card.querySelector('[data-daily-sub]');
      const btn = card.querySelector('[data-daily-claim]');
      const timer = card.querySelector('[data-daily-timer]');
      const dotsEl = card.querySelector('[data-daily-dots]');

      if (amountEl) amountEl.textContent = `+${fmt(amount)}`;
      if (subEl) {
        subEl.textContent = available
          ? `день ${nextStreak}${streak > 0 ? ` · серия ${streak}` : ''}`
          : `получено · день ${streak}`;
      }
      if (timer) timer.textContent = available ? 'до 00:00' : clock(left);
      if (btn) {
        btn.disabled = !available;
        btn.textContent = available ? 'Забрать' : 'Завтра';
      }
      if (dotsEl) {
        dotsEl.innerHTML = Array.from({ length: DAILY_CAP }, (_, i) =>
          `<span class="daily-dot${i < dots ? ' filled' : ''}"></span>`
        ).join('');
      }
    });
  }

  function claim(e) {
    const result = claimDaily();
    if (!result) {
      toast('Сегодняшний бонус уже получен — приходите после полуночи', 'loss');
      return;
    }
    const rect = e?.currentTarget?.getBoundingClientRect?.();
    sfx.bonus();
    haptic('success');
    toast(`Ежедневный вход: +${fmt(result.amount)} очков · день ${result.streak}`, 'win', 3200);
    confetti(46, rect ? { x: rect.left + rect.width / 2, y: rect.top } : undefined);
    render();
  }

  cards.forEach((card) => {
    card.querySelector('[data-daily-claim]')?.addEventListener('click', claim);
  });

  store.addEventListener('change', render);
  setInterval(render, 1000);
  render();

  return { render, claim };
}
