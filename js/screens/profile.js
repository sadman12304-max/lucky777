// Профиль: статистика, достижения, настройки, сброс.

import { store } from '../core/store.js';
import { fmt, icon } from '../core/util.js';
import { telegram, share } from '../core/telegram.js';
import { confirmSheet, openSheet, toast } from '../core/ui.js';
import { sfx } from '../core/sound.js';

const ACHIEVEMENTS = [
  { id: 'first', name: 'Первый шаг', hint: 'сыграть раунд', icon: 'i-spark', check: (s) => s.stats.rounds >= 1 },
  { id: 'grinder', name: 'Свояк', hint: '50 раундов', icon: 'i-grid', check: (s) => s.stats.rounds >= 50 },
  { id: 'highroller', name: 'Хайроллер', hint: 'ставка 1 000', icon: 'i-coin', check: (s) => s.stats.maxBet >= 1000 },
  { id: 'bigfish', name: 'Крупная рыба', hint: 'выигрыш 5 000', icon: 'i-gift', check: (s) => s.stats.bestWin >= 5000 },
  { id: 'hunter', name: 'Икс-охотник', hint: '×10 за раунд', icon: 'i-crash', check: (s) => s.stats.bestMult >= 10 },
  { id: 'jackpot', name: 'Джекпот', hint: '×100 за раунд', icon: 'i-wheel', check: (s) => s.stats.bestMult >= 100 },
];

export function setupProfile(ctx) {
  const { go } = ctx;
  const avatarEl = document.getElementById('profileAvatar');
  const nameEl = document.getElementById('profileName');
  const metaEl = document.getElementById('profileMeta');
  const statsRoot = document.getElementById('statsGrid');
  const achRoot = document.getElementById('achievements');
  const achCount = document.getElementById('achCount');
  const resetBtn = document.getElementById('resetBtn');
  const shareBtn = document.getElementById('walletShare');
  const bonusBtn = document.getElementById('walletBonus');

  const created = new Date(store.get().createdAt || Date.now());
  const dateStr = created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  nameEl.textContent = telegram.name;
  avatarEl.textContent = telegram.initials;
  metaEl.textContent = `виртуальный клуб · с ${dateStr}`;

  function renderStats() {
    const s = store.get().stats;
    const net = s.won - s.staked;
    const winrate = s.rounds ? Math.round((s.wins / s.rounds) * 100) : 0;
    const cards = [
      ['Раундов', fmt(s.rounds)],
      ['Побед', fmt(s.wins)],
      ['Винрейт', `${winrate}%`],
      ['Поставлено', fmt(s.staked)],
      ['Выиграно', fmt(s.won)],
      ['Профит', `${net > 0 ? '+' : ''}${fmt(net)}`, net > 0 ? 'pos' : net < 0 ? 'neg' : ''],
    ];
    statsRoot.innerHTML = cards
      .map(([label, value, cls]) => `<div class="stat-card"><span>${label}</span><b class="${cls || ''}">${value}</b></div>`)
      .join('');
  }

  function renderAchievements() {
    const s = store.get();
    const unlocked = ACHIEVEMENTS.filter((a) => a.check(s));
    achCount.textContent = `${unlocked.length} / ${ACHIEVEMENTS.length}`;
    achRoot.innerHTML = ACHIEVEMENTS.map((a) => {
      const got = a.check(s);
      return `
        <div class="ach ${got ? 'is-unlocked' : 'locked'}">
          <div class="ach-icon">${icon(got ? a.icon : 'i-lock')}</div>
          <b>${a.name}</b>
          <span>${got ? 'получено' : a.hint}</span>
        </div>`;
    }).join('');
  }

  function syncToggles() {
    document.querySelectorAll('[data-toggle]').forEach((btn) => {
      const key = btn.dataset.toggle;
      btn.classList.toggle('is-on', Boolean(store.get().settings[key]));
    });
  }

  function renderAll() {
    renderStats();
    renderAchievements();
    syncToggles();
  }

  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      const next = !store.get().settings[key];
      store.setSetting(key, next);
      if (key === 'sound') sfx.setEnabled(next);
      syncToggles();
      sfx.click();
    });
  });

  resetBtn.addEventListener('click', async () => {
    const ok = await confirmSheet(
      'Сбросить прогресс?',
      'Баланс, статистика, дейли-серия и достижения обнулятся. Вернётся стартовый баланс 10 000 очков.',
      'Сбросить'
    );
    if (!ok) return;
    store.reset();
    location.hash = '#/home';
    location.reload();
  });

  shareBtn.addEventListener('click', () => {
    const text = `Играю в LUCKY 777 — виртуальное казино на очки. Мой баланс: ${fmt(store.get().balance)}. Заходи на огонёк!`;
    share(text);
  });

  bonusBtn.addEventListener('click', () => go('bonus'));

  store.addEventListener('change', renderAll);
  renderAll();

  return { render: renderAll };
}
