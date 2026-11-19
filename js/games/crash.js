// Краш: живой график, ручной и авто-кэшаут.

import { crashPoint, multiplierAt } from '../math/crash.js';
import { fmt } from '../core/util.js';

const PRESETS = [
  { v: null, label: 'выкл' },
  { v: 1.5, label: '×1.5' },
  { v: 2, label: '×2' },
  { v: 3, label: '×3' },
  { v: 5, label: '×5' },
  { v: 10, label: '×10' },
];

export function setupCrash(ctx) {
  const { store, sfx, haptic, toast, confetti } = ctx;
  const stage = document.querySelector('.crash-stage');
  const canvas = document.getElementById('crashCanvas');
  const c2d = canvas.getContext('2d');
  const multEl = document.getElementById('crashMult');
  const statusEl = document.getElementById('crashStatus');
  const actionBtn = document.getElementById('crashAction');
  const betLabel = document.getElementById('crashBetLabel');
  const betHost = document.getElementById('crashBet');
  const historyEl = document.getElementById('crashHistory');
  const presetsEl = document.getElementById('crashPresets');

  const betCtl = ctx.createBetControl(betHost, {
    initial: 100,
    chips: [10, 50, 100, 500, 1000],
    onChange: (v) => { betLabel.textContent = fmt(v); },
  });

  let running = false;
  let crashed = false;
  let cashed = false;
  let crashAt = 0;
  let startTs = 0;
  let rafId = 0;
  let bet = 0;
  let lastMult = 1;
  let lastElapsed = 0;
  let autoTarget = null;
  let resetTimer = 0;
  let cashTarget = 0;
  const history = [];
  renderHistoryPlaceholder();

  presetsEl.innerHTML = PRESETS.map(
    (p) => `<button class="chip${p.v === null ? ' is-active' : ''}" data-auto="${p.v ?? ''}">${p.label}</button>`
  ).join('');

  presetsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auto]');
    if (!btn || running) return;
    autoTarget = btn.dataset.auto === '' ? null : Number(btn.dataset.auto);
    presetsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
    sfx.tick();
  });

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function paint(mult, isCrash = false) {
    multEl.innerHTML = `${mult.toFixed(2)}<span>×</span>`;
    multEl.classList.toggle('warm', !isCrash && mult >= 2 && mult < 5);
    multEl.classList.toggle('hot', !isCrash && mult >= 5);
    multEl.classList.toggle('crashed', isCrash);
    lastMult = mult;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(lastElapsed, lastMult, crashed);
  }
  window.addEventListener('resize', () => { if (document.querySelector('[data-screen="crash"]').classList.contains('is-active')) resize(); });

  function draw(elapsed, mult, isCrash) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    c2d.clearRect(0, 0, w, h);

    const padX = 18;
    const padY = 18;
    const tMax = Math.max(4, elapsed * 1.2);
    const mMax = Math.max(2, mult * 1.2);
    const xOf = (t) => padX + (w - padX * 2) * (t / tMax);
    const yOf = (m) => h - padY - (h - padY * 2) * ((m - 1) / (mMax - 1));

    // сетка
    c2d.lineWidth = 1;
    c2d.strokeStyle = 'rgba(255,255,255,0.055)';
    for (let i = 1; i < 5; i++) {
      const x = padX + ((w - padX * 2) * i) / 5;
      c2d.beginPath();
      c2d.moveTo(x, padY);
      c2d.lineTo(x, h - padY);
      c2d.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = padY + ((h - padY * 2) * i) / 4;
      c2d.beginPath();
      c2d.moveTo(padX, y);
      c2d.lineTo(w - padX, y);
      c2d.stroke();
    }

    if (elapsed <= 0.001) return;

    const steps = Math.max(2, Math.min(160, Math.floor(elapsed * 60)));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      points.push([xOf(t), yOf(Math.exp(0.231 * t))]);
    }

    const stroke = isCrash ? '#fb7185' : '#38bdf8';
    const fillTop = isCrash ? 'rgba(251,113,133,0.22)' : 'rgba(56,189,248,0.22)';

    // заливка
    const grad = c2d.createLinearGradient(0, padY, 0, h - padY);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    c2d.beginPath();
    c2d.moveTo(points[0][0], h - padY);
    points.forEach(([x, y]) => c2d.lineTo(x, y));
    c2d.lineTo(points[points.length - 1][0], h - padY);
    c2d.closePath();
    c2d.fillStyle = grad;
    c2d.fill();

    // линия
    c2d.beginPath();
    points.forEach(([x, y], i) => (i ? c2d.lineTo(x, y) : c2d.moveTo(x, y)));
    c2d.strokeStyle = stroke;
    c2d.lineWidth = 2.4;
    c2d.lineJoin = 'round';
    c2d.shadowColor = stroke;
    c2d.shadowBlur = 16;
    c2d.stroke();
    c2d.shadowBlur = 0;

    // точка на конце
    const [hx, hy] = points[points.length - 1];
    c2d.beginPath();
    c2d.arc(hx, hy, 3.6, 0, Math.PI * 2);
    c2d.fillStyle = stroke;
    c2d.fill();
  }

  function renderHistoryPlaceholder() {
    historyEl.innerHTML = '<span class="crash-empty">История раундов появится после первой ставки</span>';
  }

  function renderHistory() {
    if (!history.length) {
      historyEl.innerHTML = '<span class="crash-empty">История раундов появится после первой ставки</span>';
      return;
    }
    historyEl.innerHTML = history
      .map((m) => `<span class="crash-chip ${m < 2 ? 'low' : m < 10 ? 'mid' : 'high'}">${m.toFixed(2)}×</span>`)
      .join('');
  }

  function setIdle() {
    running = false;
    crashed = false;
    cashed = false;
    lastElapsed = 0;
    paint(1, false);
    setStatus('Сделайте ставку');
    actionBtn.classList.remove('is-cashout', 'is-cashed');
    actionBtn.disabled = false;
    actionBtn.querySelector('span').textContent = 'Играть';
    actionBtn.querySelector('b').style.display = '';
    betLabel.textContent = fmt(betCtl.get());
    draw(0, 1, false);
  }

  function endRound(win, crash) {
    store.recordRound({ game: 'crash', bet, win });
    history.unshift(crash);
    if (history.length > 14) history.pop();
    renderHistory();
  }

  function cashOut(target) {
    if (!running || cashed || crashed) return;
    const m = Math.min(target ?? lastMult, crashAt);
    if (!(m > 1)) return;
    cashed = true;
    const win = Math.round(bet * m);
    store.payout(win, bet);
    endRound(win, crashAt);
    actionBtn.disabled = true;
    actionBtn.querySelector('span').textContent = `Забрано ×${m.toFixed(2)}`;
    actionBtn.querySelector('b').style.display = 'none';
    setStatus(`Забрано ${fmt(win)} очков`);
    sfx.win();
    haptic('success');
    if (m >= 3) confetti(50);
    if (m >= 10) sfx.bigWin();
  }

  function crashNow() {
    running = false;
    crashed = true;
    paint(crashAt, true);
    draw(lastElapsed, crashAt, true);
    actionBtn.classList.remove('is-cashout');
    actionBtn.disabled = true;
    actionBtn.querySelector('span').textContent = 'Играть';
    actionBtn.querySelector('b').style.display = '';
    if (!cashed) {
      endRound(0, crashAt);
      setStatus('Ставка сгорела');
      sfx.crash();
      haptic('error');
      toast(`Краш на ×${crashAt.toFixed(2)}`, 'loss');
    } else {
      setStatus(`Краш ×${crashAt.toFixed(2)} — вы успели`);
      sfx.tick();
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (document.querySelector('[data-screen="crash"]').classList.contains('is-active')) setIdle();
    }, 2300);
  }

  function loop(now) {
    if (!running) return;
    const elapsed = (now - startTs) / 1000;
    const m = multiplierAt(elapsed);

    if (m >= crashAt) {
      lastElapsed = Math.max(lastElapsed, elapsed);
      crashNow();
      return;
    }

    lastElapsed = elapsed;
    paint(m, false);
    draw(elapsed, m, false);
    if (!cashed) actionBtn.querySelector('span').textContent = `Забрать ×${m.toFixed(2)}`;

    if (autoTarget && m >= autoTarget) cashOut(autoTarget);

    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    bet = betCtl.get();
    if (bet > store.get().balance) {
      toast('Недостаточно очков — заберите бонус', 'loss');
      haptic('error');
      return;
    }
    if (!store.placeBet(bet)) return;

    running = true;
    crashed = false;
    cashed = false;
    crashAt = crashPoint();
    startTs = performance.now();
    lastMult = 1;
    lastElapsed = 0;
    cashTarget = autoTarget;

    actionBtn.classList.add('is-cashout');
    actionBtn.classList.remove('is-cashed');
    actionBtn.querySelector('b').style.display = 'none';
    actionBtn.querySelector('span').textContent = 'Забрать ×1.00';
    setStatus(cashTarget ? `Авто-кэшаут ×${cashTarget}` : 'Лети!');
    sfx.spin();
    haptic('medium');
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  actionBtn.addEventListener('click', () => {
    if (running && !cashed) cashOut(null);
    else if (!running) start();
  });

  const api = {
    enter() {
      resize();
      if (!running) setIdle();
    },
    leave() {
      cancelAnimationFrame(rafId);
      clearTimeout(resetTimer);
      // Уход с экрана завершает раунд по текущему множителю — «бесплатной страховки» нет.
      if (running && !cashed && !crashed) {
        cashOut(Math.max(1, lastMult));
        setIdle();
      }
      running = false;
    },
    _start: start,
    _cashOut: () => cashOut(null),
  };
  if (ctx.debug) api._state = () => ({ running, cashed, crashed, bet });
  return api;
}
