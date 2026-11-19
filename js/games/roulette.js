// Европейская рулетка: лента результатов + стол ставок.

import { spin, colorOf, resolveBets, isRed } from '../math/roulette.js';
import { randomInt } from '../math/rng.js';
import { fmt, sleep, icon } from '../core/util.js';

const COLOR_LABEL = { red: 'красное', black: 'чёрное', green: 'зеро' };
const OUTSIDE = [
  { kind: 'low', label: '1–18' },
  { kind: 'even', label: 'ЧЁТНОЕ' },
  { kind: 'red', label: 'КРАСНОЕ', cls: 'red' },
  { kind: 'black', label: 'ЧЁРНОЕ', cls: 'black' },
  { kind: 'odd', label: 'НЕЧЁТНОЕ' },
  { kind: 'high', label: '19–36' },
];
const CHIPS = [10, 50, 100, 500];

export function setupRoulette(ctx) {
  const { store, sfx, haptic, toast, confetti } = ctx;
  const table = document.getElementById('rouletteTable');
  const strip = document.getElementById('rouletteStrip');
  const ribbon = strip.parentElement;
  const chipsRoot = document.getElementById('rouletteChips');
  const totalEl = document.getElementById('rouletteTotal');
  const spinBtn = document.getElementById('rouletteSpinBtn');
  const clearBtn = document.getElementById('rouletteClear');
  const undoBtn = document.getElementById('rouletteUndo');
  const historyEl = document.getElementById('rouletteHistory');
  const betsEl = document.getElementById('rouletteBets');

  const bets = new Map(); // key -> {kind, number?, amount}
  const stack = [];
  const recent = [];
  let chip = 100;
  let locked = false;

  /* ── стол ── */
  const parts = [];
  parts.push(`<button class="rt-cell green zero" data-straight="0" aria-label="Зеро">0</button>`);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const n = col * 3 + (3 - row);
      const cls = isRed(n) ? 'red' : 'black';
      parts.push(`<button class="rt-cell ${cls}" data-straight="${n}" aria-label="${n}">${n}</button>`);
    }
  }
  OUTSIDE.forEach((bet) => {
    parts.push(`<button class="rt-outside ${bet.cls || ''}" data-outside="${bet.kind}">${bet.label}<b hidden>0</b></button>`);
  });
  table.innerHTML = parts.join('');

  chipsRoot.innerHTML = CHIPS.map(
    (c) => `<button class="chip${c === chip ? ' is-active' : ''}" data-chip="${c}">${fmt(c)}</button>`
  ).join('');

  chipsRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    chip = Number(btn.dataset.chip);
    chipsRoot.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', Number(c.dataset.chip) === chip));
    sfx.tick();
  });

  function totalBet() {
    let sum = 0;
    bets.forEach((b) => { sum += b.amount; });
    return sum;
  }

  const OUTSIDE_LABEL = Object.fromEntries(OUTSIDE.map((b) => [b.kind, b.label]));

  function renderBetsPanel() {
    if (!bets.size) {
      betsEl.innerHTML = '<span class="bets-hint">Тапните по столу, чтобы поставить</span>';
      return;
    }
    betsEl.innerHTML = [...bets.values()]
      .map((b) => {
        const label = b.kind === 'straight' ? String(b.number) : OUTSIDE_LABEL[b.kind];
        return `<span class="bet-pill">${label}<b>${fmt(b.amount)}</b></span>`;
      })
      .join('');
  }

  function redraw() {
    const total = totalBet();
    totalEl.textContent = fmt(total);
    renderBetsPanel();
    table.querySelectorAll('[data-straight]').forEach((cell) => {
      const key = `straight:${cell.dataset.straight}`;
      cell.classList.toggle('has-bet', bets.has(key));
    });
    table.querySelectorAll('[data-outside]').forEach((cell) => {
      const key = cell.dataset.outside;
      const bet = bets.get(key);
      cell.classList.toggle('has-bet', Boolean(bet));
      const badge = cell.querySelector('b');
      if (badge) {
        badge.hidden = !bet;
        if (bet) badge.textContent = fmt(bet.amount);
      }
    });
  }

  function addBet(kind, number) {
    if (locked) return;
    const key = number != null ? `straight:${number}` : kind;
    const existing = bets.get(key);
    const amount = (existing?.amount || 0) + chip;
    if (totalBet() + chip > store.get().balance) {
      toast('Не хватает очков на эту ставку', 'loss');
      haptic('error');
      return;
    }
    bets.set(key, { kind, number, amount });
    stack.push({ key, amount: chip });
    redraw();
    sfx.tick();
    haptic('light');
  }

  table.addEventListener('click', (e) => {
    const num = e.target.closest('[data-straight]');
    if (num) {
      addBet('straight', Number(num.dataset.straight));
      return;
    }
    const out = e.target.closest('[data-outside]');
    if (out) addBet(out.dataset.outside);
  });

  undoBtn.addEventListener('click', () => {
    if (locked) return;
    const entry = stack.pop();
    if (!entry) return;
    const bet = bets.get(entry.key);
    if (!bet) return;
    bet.amount -= entry.amount;
    if (bet.amount <= 0) bets.delete(entry.key);
    redraw();
    sfx.tick();
  });

  clearBtn.addEventListener('click', () => {
    if (locked) return;
    bets.clear();
    stack.length = 0;
    redraw();
  });

  function renderHistory() {
    if (!recent.length) { historyEl.innerHTML = ''; return; }
    historyEl.innerHTML = '<span class="h-label">Было</span>' +
      recent.map((n) => `<span class="h-num ${colorOf(n)}">${n}</span>`).join('');
  }

  /* ── лента ── */
  const STRIP_INDEX = 44;
  let spun = false;

  function fillStrip(result) {
    const cellsHtml = [];
    for (let i = 0; i < 56; i++) {
      const n = i === STRIP_INDEX ? result : randomInt(37);
      cellsHtml.push(`<div class="ribbon-cell ${colorOf(n)}">${n}</div>`);
    }
    strip.innerHTML = cellsHtml.join('');
  }

  function targetX(index) {
    const first = strip.firstElementChild;
    const cellW = first ? first.getBoundingClientRect().width + 6 : 58;
    return ribbon.clientWidth / 2 - (index * cellW + cellW / 2 - 3);
  }

  function parkStrip() {
    // ставим ленту так, чтобы центральная ячейка была под маркером
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${targetX(STRIP_INDEX)}px)`;
  }

  function idleStrip() {
    if (locked) return;
    fillStrip(randomInt(37));
    requestAnimationFrame(parkStrip);
  }

  async function runSpin() {
    if (locked) return;
    const total = totalBet();
    if (total <= 0) {
      toast('Сначала поставьте хотя бы на одно поле', 'loss');
      return;
    }
    if (total > store.get().balance) {
      toast('Не достаточно очков для этой ставки', 'loss');
      return;
    }
    if (!store.placeBet(total)) return;

    locked = true;
    spinBtn.disabled = true;
    undoBtn.disabled = true;
    clearBtn.disabled = true;
    sfx.spin();

    spun = true;
    const result = spin();
    fillStrip(result);

    // сбрасываем ленту в начало и запускаем длинный проезд
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';
    void strip.offsetWidth;
    strip.style.transition = 'transform 3.4s cubic-bezier(.1,.72,.08,1)';
    strip.style.transform = `translateX(${targetX(STRIP_INDEX)}px)`;

    await sleep(3500);

    strip.children[STRIP_INDEX]?.classList.add('is-result');
    recent.unshift(result);
    if (recent.length > 10) recent.pop();
    renderHistory();

    const resolved = [...bets.values()];
    const payout = resolveBets(resolved, result);

    table.querySelectorAll('.win').forEach((c) => c.classList.remove('win'));
    table.querySelector(`[data-straight="${result}"]`)?.classList.add('win');
    resolved.forEach((bet) => {
      const won = bet.kind === 'straight'
        ? bet.number === result
        : (bet.kind === 'red' && isRed(result))
          || (bet.kind === 'black' && result !== 0 && !isRed(result))
          || (bet.kind === 'even' && result !== 0 && result % 2 === 0)
          || (bet.kind === 'odd' && result % 2 === 1)
          || (bet.kind === 'low' && result >= 1 && result <= 18)
          || (bet.kind === 'high' && result >= 19 && result <= 36);
      if (won && bet.kind !== 'straight') {
        table.querySelector(`[data-outside="${bet.kind}"]`)?.classList.add('win');
      }
    });

    if (payout > 0) {
      store.payout(payout, total);
      store.recordRound({ game: 'roulette', bet: total, win: payout });
      const label = COLOR_LABEL[colorOf(result)];
      toast(`Выпало ${result} · ${label} · +${fmt(payout)}`, 'win', 3200);
      sfx.win();
      haptic('success');
      if (payout >= total * 6) confetti(56);
    } else {
      store.recordRound({ game: 'roulette', bet: total, win: 0 });
      toast(`Выпало ${result} · ${COLOR_LABEL[colorOf(result)]}`, 'loss');
      sfx.lose();
    }

    await sleep(1200);
    bets.clear();
    stack.length = 0;
    redraw();

    locked = false;
    spinBtn.disabled = false;
    undoBtn.disabled = false;
    clearBtn.disabled = false;
  }

  spinBtn.addEventListener('click', runSpin);
  redraw();
  renderHistory();

  return {
    enter() {
      redraw();
      if (!spun) requestAnimationFrame(idleStrip);
    },
    leave() {},
    _spin: runSpin,
    _addBet: addBet,
    get _total() { return totalBet(); },
  };
}
