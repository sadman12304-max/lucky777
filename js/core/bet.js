// Универсальный блок ставки: минус/плюс + быстрые чипы.

import { fmt, icon, clamp } from './util.js';

const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);

export function createBetControl(host, {
  chips = [10, 50, 100, 500, 1000],
  initial = 100,
  min = 10,
  max = 5000,
  onChange = null,
} = {}) {
  let value = clamp(round10(initial), min, max);

  host.innerHTML = `
    <div class="bet-head">
      <span>Ставка</span>
      <div class="bet-stepper">
        <button class="bet-step" data-step="-" aria-label="Уменьшить">−</button>
        <span class="bet-value">${icon('i-coin')}<b>${fmt(value)}</b></span>
        <button class="bet-step" data-step="+" aria-label="Увеличить">+</button>
      </div>
    </div>
    <div class="bet-chips">${chips
      .map((c) => `<button class="chip${c === value ? ' is-active' : ''}" data-chip="${c}">${fmt(c)}</button>`)
      .join('')}</div>
  `;

  const valueEl = host.querySelector('.bet-value b');
  const chipEls = Array.from(host.querySelectorAll('.chip'));

  function sync() {
    valueEl.textContent = fmt(value);
    chipEls.forEach((c) => c.classList.toggle('is-active', Number(c.dataset.chip) === value));
    if (onChange) onChange(value);
  }

  function set(next) {
    value = clamp(round10(next), min, max);
    sync();
  }

  host.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      set(Number(chip.dataset.chip));
      return;
    }
    const step = e.target.closest('[data-step]');
    if (!step) return;
    if (step.dataset.step === '+') set(value >= 500 ? value + Math.max(100, value / 2) : value * 2);
    else set(value <= 20 ? min : value / 2);
  });

  sync();

  return {
    get: () => value,
    set,
    sync,
    get elements() {
      return { valueEl, chipEls };
    },
  };
}
