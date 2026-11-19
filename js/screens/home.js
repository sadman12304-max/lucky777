// Главный экран: приветствие, бонус, игры, статистика, последние раунды.

import { store } from '../core/store.js';
import { fmt, icon, timeAgo } from '../core/util.js';
import { telegram } from '../core/telegram.js';
import { bonusRemaining } from './bonus.js';

const GAMES = {
  slots: { name: 'Слоты', icon: 's-seven' },
  roulette: { name: 'Рулетка', icon: 'i-wheel' },
  blackjack: { name: 'Блэкджек', icon: 'i-cards' },
  crash: { name: 'Краш', icon: 'i-crash' },
  dice: { name: 'Кости', icon: 'i-dice' },
  keno: { name: 'Кено', icon: 'i-keno' },
};

export function setupHome(ctx) {
  const { go } = ctx;
  const greetLine = document.getElementById('greetLine');
  const greetName = document.getElementById('greetName');
  const heroTimer = document.getElementById('heroTimer');
  const heroClaim = document.getElementById('heroClaim');
  const statsRoot = document.getElementById('homeStats');
  const recentRoot = document.getElementById('recentList');

  greetLine.textContent = telegram.isTelegram ? 'С возвращением в клуб' : 'Добро пожаловать в клуб';
  greetName.textContent = telegram.name;

  function renderBonus() {
    const left = bonusRemaining(store.get());
    const ready = left <= 0;
    heroTimer.textContent = ready ? 'готов' : fmtTime(left);
    heroTimer.classList.toggle('is-ready', ready);
    heroClaim.textContent = ready ? 'Крутить' : 'Ждать';
    heroClaim.classList.toggle('is-waiting', !ready);
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function renderStats() {
    const s = store.get().stats;
    const net = s.won - s.staked;
    statsRoot.innerHTML = `
      <div class="mini-stat"><span>Раундов</span><b>${fmt(s.rounds)}</b></div>
      <div class="mini-stat"><span>Лучший куш</span><b class="gold">${s.bestWin ? fmt(s.bestWin) : '—'}</b></div>
      <div class="mini-stat"><span>Профит</span><b class="${net > 0 ? 'gold' : net < 0 ? 'neg' : ''}">${net > 0 ? '+' : ''}${fmt(net)}</b></div>
    `;
  }

  function renderRecent() {
    const recent = store.get().recent.slice(0, 6);
    if (!recent.length) {
      recentRoot.innerHTML = `<div class="recent-empty">Пока пусто — самое время сыграть первый раунд</div>`;
      return;
    }
    recentRoot.innerHTML = recent
      .map((r) => {
        const meta = GAMES[r.game] || { name: r.game, icon: 'i-spark' };
        const delta = r.win - r.bet;
        const cls = delta > 0 ? 'win' : delta < 0 ? 'loss' : '';
        const text = delta > 0 ? `+${fmt(delta)}` : delta < 0 ? `−${fmt(-delta)}` : 'возврат';
        return `
          <div class="recent-row">
            <div class="recent-icon">${icon(meta.icon)}</div>
            <div class="recent-name">${meta.name}<span>ставка ${fmt(r.bet)} · ${timeAgo(r.ts)}</span></div>
            <div class="recent-delta ${cls}">${text}</div>
          </div>`;
      })
      .join('');
  }

  function renderAll() {
    renderBonus();
    renderStats();
    renderRecent();
  }

  heroClaim.addEventListener('click', () => go('bonus'));

  store.addEventListener('change', renderAll);
  store.addEventListener('round', renderAll);
  setInterval(renderBonus, 1000);
  renderAll();

  return { render: renderAll };
}
