// Экран слотов: анимация барабанов и подсветка линий.

import { SYMBOLS, spinGrid, evaluate, REELS, ROWS } from '../math/slots.js';
import { randomInt } from '../math/rng.js';
import { fmt, sleep, icon } from '../core/util.js';

const ICONS = {
  cherry: 's-cherry',
  lemon: 's-lemon',
  bell: 's-bell',
  star: 's-star',
  diamond: 's-diamond',
  seven: 's-seven',
};

export function setupSlots(ctx) {
  const { store, sfx, haptic, toast, confetti, floatWin } = ctx;
  const board = document.getElementById('slotGrid');
  const winBanner = document.getElementById('slotWin');
  const spinBtn = document.getElementById('slotSpinBtn');
  const betLabel = document.getElementById('slotBetLabel');
  const betHost = document.getElementById('slotBet');

  const cells = Array.from({ length: REELS }, () => []);
  board.innerHTML = '';

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < REELS; col++) {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.dataset.col = String(col);
      cell.dataset.row = String(row);
      cell.innerHTML = `<svg><use href="#s-cherry"/></svg>`;
      cells[col][row] = cell;
      board.appendChild(cell);
    }
  }

  let spinning = false;

  const betCtl = ctx.createBetControl(betHost, {
    initial: 100,
    chips: [10, 50, 100, 500, 1000],
    onChange: (v) => { betLabel.textContent = fmt(v); },
  });
  betLabel.textContent = fmt(betCtl.get());

  function setSymbol(cell, sym) {
    const use = cell.querySelector('use');
    if (use) use.setAttribute('href', `#${ICONS[sym.id]}`);
  }

  function randomSymbol() {
    return SYMBOLS[randomInt(SYMBOLS.length)];
  }

  function clearHighlights() {
    cells.flat().forEach((c) => c.classList.remove('hit', 'dim', 'landed'));
  }

  function showBanner(text, bad = false) {
    winBanner.textContent = text;
    winBanner.classList.toggle('bad', bad);
    winBanner.classList.add('show');
  }

  function hideBanner() {
    winBanner.classList.remove('show');
  }

  function busy(state) {
    spinning = state;
    spinBtn.disabled = state;
  }

  async function animateReel(col, finalSymbols, duration) {
    const column = cells[col];
    column.forEach((cell) => cell.classList.add('spinning'));
    const started = performance.now();
    while (performance.now() - started < duration) {
      column.forEach((cell) => setSymbol(cell, randomSymbol()));
      await sleep(58);
    }
    column.forEach((cell, row) => {
      setSymbol(cell, finalSymbols[row]);
      cell.classList.remove('spinning');
      cell.classList.add('landed');
      setTimeout(() => cell.classList.remove('landed'), 360);
    });
    sfx.tick();
  }

  async function spin() {
    if (spinning) return;
    const bet = betCtl.get();
    const balance = store.get().balance;
    if (bet > balance) {
      toast('Недостаточно очков — заберите бонус в разделе «Бонус»', 'loss');
      haptic('error');
      return;
    }
    if (!store.placeBet(bet)) return;

    busy(true);
    clearHighlights();
    hideBanner();
    sfx.spin();

    // Результат фиксируется до анимации — крутим «под него».
    const grid = spinGrid();
    const durations = [460, 600, 740, 880, 1020];
    await Promise.all(grid.map((reel, col) => animateReel(col, reel, durations[col])));
    await sleep(140);

    const result = evaluate(grid, bet);

    if (result.total > 0) {
      const hitCells = new Set();
      result.wins.forEach((w) => w.cells.forEach(([reel, row]) => hitCells.add(`${reel}:${row}`)));
      cells.forEach((column, reel) => column.forEach((cell, row) => {
        if (hitCells.has(`${reel}:${row}`)) cell.classList.add('hit');
        else cell.classList.add('dim');
      }));

      store.payout(result.total, bet);
      store.recordRound({ game: 'slots', bet, win: result.total });

      const mult = result.total / bet;
      showBanner(`+${fmt(result.total)}  ·  ${mult >= 10 ? '×' + mult.toFixed(1) : 'выигрыш'}`);

      const rect = board.getBoundingClientRect();
      floatWin(`+${fmt(result.total)}`, rect.left + rect.width / 2, rect.top + rect.height / 2);

      if (mult >= 8) {
        sfx.bigWin();
        haptic('success');
        confetti(60, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 });
      } else {
        sfx.win();
        haptic('success');
      }
    } else {
      showBanner('Не повезло', true);
      store.recordRound({ game: 'slots', bet, win: 0 });
      sfx.lose();
    }

    setTimeout(hideBanner, 2600);
    busy(false);
  }

  spinBtn.addEventListener('click', spin);

  // стартовое поле
  cells.forEach((column) => column.forEach((cell) => setSymbol(cell, randomSymbol())));

  return {
    enter() {
      betLabel.textContent = fmt(betCtl.get());
      this.resize?.();
    },
    leave() {
      hideBanner();
    },
    // для тестов/симуляций
    _spin: spin,
    _bet: betCtl,
  };
}
