// Колесо фортуны: один прокрут раз в 4 часа, серия усиливает приз.

import { store } from '../core/store.js';
import { fmt } from '../core/util.js';
import { weightedPick } from '../math/rng.js';
import { sfx } from '../core/sound.js';

export const BONUS_COOLDOWN = 4 * 60 * 60 * 1000;

const PRIZES = [
  { value: 500, weight: 26, color: '#241a38' },
  { value: 750, weight: 22, color: '#332450' },
  { value: 1000, weight: 18, color: '#241a38' },
  { value: 1500, weight: 12, color: '#3a2a5a' },
  { value: 2000, weight: 9, color: '#241a38' },
  { value: 2500, weight: 6, color: '#3a2a5a' },
  { value: 4000, weight: 4, color: '#241a38' },
  { value: 8000, weight: 1, color: '#4a3468' },
];

export function bonusRemaining(state) {
  return Math.max(0, (state.bonus.lastSpin || 0) + BONUS_COOLDOWN - Date.now());
}

export function streakMultiplier(streak) {
  return 1 + Math.max(0, Math.min(5, (streak || 1) - 1)) * 0.1;
}

function buildWheel(svg) {
  const cx = 150;
  const cy = 150;
  const R = 142;
  const seg = 360 / PRIZES.length;

  const paths = PRIZES.map((prize, i) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    const x0 = cx + R * Math.cos(a0);
    const y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);
    return `<path d="M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z"
      fill="${prize.color}" stroke="rgba(255,209,102,.22)" stroke-width="1"/>`;
  });

  const labels = PRIZES.map((prize, i) => {
    const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
    const lx = cx + R * 0.66 * Math.cos(mid);
    const ly = cy + R * 0.66 * Math.sin(mid);
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
      font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${prize.value >= 1000 ? 16 : 17}"
      font-weight="800" fill="#ffe3a3">${fmt(prize.value)}</text>`;
  });

  svg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="none" stroke="rgba(255,209,102,.35)" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="#160f24"/>
    ${paths.join('')}
    ${labels.join('')}
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#g-gold)" stroke-width="2" opacity=".7"/>
  `;
}

export function setupBonus(ctx) {
  const { toast, confetti, haptic } = ctx;
  const svg = document.getElementById('wheelSvg');
  const wheel = document.getElementById('wheel');
  const statusEl = document.getElementById('wheelStatus');
  const spinBtn = document.getElementById('bonusSpinBtn');
  const streakRow = document.getElementById('streakRow');
  const streakPill = document.getElementById('streakPill');

  buildWheel(svg);

  let rotation = 0;
  let busy = false;

  function renderStreak() {
    const b = store.get().bonus;
    const streak = b.streak || 0;
    streakPill.textContent = `серия ${streak}`;
    streakRow.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const filled = i < Math.min(streak, 7);
      const current = i === Math.min(streak, 7) - 1;
      return `<span class="streak-dot${filled ? ' filled' : ''}${current ? ' current' : ''}">${i + 1}</span>`;
    }).join('');
  }

  function renderState() {
    renderStreak();
    const left = bonusRemaining(store.get());
    if (busy) {
      spinBtn.disabled = true;
      spinBtn.textContent = 'Крутится…';
      return;
    }
    if (left > 0) {
      spinBtn.disabled = true;
      const total = Math.ceil(left / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n) => String(n).padStart(2, '0');
      spinBtn.textContent = `Следующий через ${h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}`;
    } else {
      spinBtn.disabled = false;
      spinBtn.textContent = 'Крутить колесо';
    }
  }

  function award(prize) {
    const state = store.get();
    const now = Date.now();
    const last = state.bonus.lastSpin || 0;
    const inStreak = last > 0 && now - last < 8 * 60 * 60 * 1000;
    const streak = inStreak ? (state.bonus.streak || 0) + 1 : 1;
    const mult = streakMultiplier(streak);
    const amount = Math.round(prize.value * mult);

    state.bonus.lastSpin = now;
    state.bonus.streak = streak;
    store.addPoints(amount);
    store.touch();

    const wheelRect = wheel.getBoundingClientRect();
    statusEl.innerHTML = `Выигрыш: <b>+${fmt(amount)}</b>${mult > 1 ? ` · серия ×${mult.toFixed(1)}` : ''}`;
    toast(`Колесо: +${fmt(amount)} очков`, 'win', 3200);
    sfx.bonus();
    haptic('success');
    confetti(56, { x: wheelRect.left + wheelRect.width / 2, y: wheelRect.top + wheelRect.height / 2 });

    busy = false;
    renderState();
  }

  function spinWheel() {
    if (busy) return;
    if (bonusRemaining(store.get()) > 0) {
      toast('Бонус ещё не восстановился', 'loss');
      return;
    }
    busy = true;
    renderState();
    statusEl.textContent = 'Колесо крутится…';

    const prize = weightedPick(PRIZES);
    const index = PRIZES.indexOf(prize);
    const seg = 360 / PRIZES.length;
    const centerAngle = index * seg + seg / 2;
    const current = ((rotation % 360) + 360) % 360;
    const delta = 360 * 5 + ((((-centerAngle - current) % 360) + 360) % 360);
    rotation += delta;

    svg.classList.add('is-spinning');
    svg.style.transform = `rotate(${rotation}deg)`;
    sfx.spin();

    const started = performance.now();
    const duration = 3900;
    (function tick() {
      const t = performance.now() - started;
      if (t > duration) return;
      // тики замедляются к концу
      const speed = 60 + 260 * Math.pow(t / duration, 2);
      setTimeout(tick, speed);
      sfx.tick();
    })();

    setTimeout(() => {
      svg.classList.remove('is-spinning');
      award(prize);
    }, duration + 120);
  }

  spinBtn.addEventListener('click', spinWheel);
  setInterval(() => { if (!busy) renderState(); }, 1000);
  renderState();

  return { render: renderState, _spin: spinWheel };
}
