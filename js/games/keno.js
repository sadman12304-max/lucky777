// Экран кено: выбор 10 чисел, анимация 20 выпавших, выплаты по попаданиям.

import {
  MAX_NUMBER,
  PICK_COUNT,
  PAYOUTS,
  drawNumbers,
  randomPicks,
  evaluate,
} from '../math/keno.js';
import { fmt, sleep } from '../core/util.js';

export function setupKeno(ctx) {
  const { store, sfx, haptic, toast, confetti, floatWin } = ctx;

  const board = document.getElementById('kenoBoard');
  const countEl = document.getElementById('kenoCount');
  const resultEl = document.getElementById('kenoResult');
  const paytable = document.getElementById('kenoPaytable');
  const randomBtn = document.getElementById('kenoRandom');
  const clearBtn = document.getElementById('kenoClear');
  const playBtn = document.getElementById('kenoPlay');
  const betLabel = document.getElementById('kenoBetLabel');
  const betHost = document.getElementById('kenoBet');

  const betCtl = ctx.createBetControl(betHost, {
    initial: 100,
    chips: [10, 50, 100, 500, 1000],
    onChange: (v) => { betLabel.textContent = fmt(v); },
  });

  const cells = {};
  const picks = new Set();
  let drawing = false;

  for (let n = 1; n <= MAX_NUMBER; n++) {
    const cell = document.createElement('button');
    cell.className = 'keno-cell';
    cell.dataset.n = String(n);
    cell.textContent = String(n);
    cell.setAttribute('aria-label', `Число ${n}`);
    board.appendChild(cell);
    cells[n] = cell;
  }

  paytable.innerHTML = Object.entries(PAYOUTS)
    .map(([h, m]) => `<div>${h}<b>×${Number.isInteger(m) ? fmt(m) : m.toFixed(1)}</b></div>`)
    .join('');

  function updateButton() {
    const need = PICK_COUNT - picks.size;
    countEl.innerHTML = `Выбрано <b>${picks.size}</b> / ${PICK_COUNT}`;
    playBtn.disabled = drawing || need > 0;
    const span = playBtn.querySelector('span');
    if (drawing) span.textContent = 'Тянем…';
    else if (need > 0) span.textContent = `Выберите ещё ${need}`;
    else span.textContent = 'Играть';
    betLabel.textContent = fmt(betCtl.get());
  }

  function clearMarks() {
    resultEl.textContent = '';
    resultEl.className = 'keno-result';
    Object.values(cells).forEach((cell) => {
      cell.classList.remove('is-drawn', 'is-hit', 'is-miss');
    });
  }

  function renderPicks() {
    Object.entries(cells).forEach(([n, cell]) => {
      cell.classList.toggle('is-picked', picks.has(Number(n)));
    });
    updateButton();
  }

  function toggle(n) {
    if (drawing) return;
    if (picks.has(n)) picks.delete(n);
    else if (picks.size >= PICK_COUNT) {
      toast(`Максимум ${PICK_COUNT} чисел`, 'loss');
      return;
    } else picks.add(n);
    clearMarks();
    renderPicks();
    sfx.tick();
  }

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-n]');
    if (cell) toggle(Number(cell.dataset.n));
  });

  randomBtn.addEventListener('click', () => {
    if (drawing) return;
    picks.clear();
    randomPicks().forEach((n) => picks.add(n));
    clearMarks();
    renderPicks();
    sfx.tick();
  });

  clearBtn.addEventListener('click', () => {
    if (drawing) return;
    picks.clear();
    clearMarks();
    renderPicks();
    sfx.tick();
  });

  async function play() {
    if (drawing) return;
    if (picks.size !== PICK_COUNT) {
      toast(`Выберите ровно ${PICK_COUNT} чисел`, 'loss');
      return;
    }
    const bet = betCtl.get();
    if (bet > store.get().balance) {
      toast('Недостаточно очков — заберите бонус', 'loss');
      haptic('error');
      return;
    }
    if (!store.placeBet(bet)) return;

    drawing = true;
    clearMarks();
    board.classList.add('is-locked');
    updateButton();
    sfx.spin();
    haptic('light');

    const picked = [...picks];
    const draws = drawNumbers();

    for (let i = 0; i < draws.length; i++) {
      const n = draws[i];
      cells[n].classList.add('is-drawn');
      if (i % 3 === 0) sfx.tick();
      await sleep(45);
    }

    const res = evaluate(picked, draws, bet);

    picked.forEach((n) => {
      cells[n].classList.add(draws.includes(n) ? 'is-hit' : 'is-miss');
    });

    if (res.payout > 0) {
      store.payout(res.payout, bet);
      store.recordRound({ game: 'keno', bet, win: res.payout });
      resultEl.textContent = `Поймано ${res.hits} из ${PICK_COUNT} · +${fmt(res.payout)}`;
      resultEl.className = 'keno-result win';
      const mult = res.payout / bet;
      if (res.hits >= 8) {
        sfx.bigWin();
        confetti(70);
      } else {
        sfx.win();
        if (res.hits >= 6) confetti(36);
      }
      haptic('success');
      const rect = board.getBoundingClientRect();
      floatWin(`+${fmt(res.payout)}`, rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (mult >= 20) sfx.bigWin();
    } else {
      store.recordRound({ game: 'keno', bet, win: 0 });
      resultEl.textContent = `Поймано ${res.hits} из ${PICK_COUNT} · без выигрыша`;
      resultEl.className = 'keno-result lose';
      sfx.lose();
    }

    drawing = false;
    board.classList.remove('is-locked');
    updateButton();
  }

  playBtn.addEventListener('click', play);

  return {
    enter() {
      updateButton();
    },
    leave() {},
    _state: ctx.debug ? () => ({ picks: [...picks], drawing }) : undefined,
  };
}
