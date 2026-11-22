// Точка входа: инициализация, роутер, связывание экранов.

import { store } from './core/store.js';
import { initTelegram, telegram, cloud, haptic, setBackButton } from './core/telegram.js';
import { fmt, $, $$ } from './core/util.js';
import { toast, openSheet, confirmSheet, confetti, floatWin, closeSheet } from './core/ui.js';
import { createBetControl } from './core/bet.js';
import { sfx } from './core/sound.js';
import { openRules } from './core/rules.js';
import { initReferral, shareClaim, REFERRAL } from './core/referral.js';
import { backend } from './core/backend.js';

import { setupSlots } from './games/slots.js';
import { setupRoulette } from './games/roulette.js';
import { setupCrash } from './games/crash.js';
import { setupDice } from './games/dice.js';
import { setupBlackjack } from './games/blackjack.js';
import { setupKeno } from './games/keno.js';

import { setupHome } from './screens/home.js';
import { setupBonus } from './screens/bonus.js';
import { setupProfile } from './screens/profile.js';
import { setupLevel } from './screens/level.js';
import { setupDaily } from './screens/daily.js';
import { setupReferral } from './screens/referral.js';

const SCREENS = ['home', 'bonus', 'profile', 'slots', 'roulette', 'crash', 'dice', 'blackjack', 'keno'];

// Отладочные ручки (LUCKY 777._state и т.п.) — только локально, не в проде.
const DEBUG =
  ['localhost', '127.0.0.1'].includes(location.hostname) ||
  new URLSearchParams(location.search).has('debug');
const GAME_SCREENS = new Set(['slots', 'roulette', 'crash', 'dice', 'blackjack', 'keno']);

let current = null;
let games = {};
let home = null;
let bonus = null;
let profile = null;

function parseHash() {
  const m = location.hash.match(/^#\/([a-z]+)/);
  return m && SCREENS.includes(m[1]) ? m[1] : 'home';
}

function go(name) {
  const target = SCREENS.includes(name) ? name : 'home';
  if (location.hash === `#/${target}`) apply(target);
  else location.hash = `#/${target}`;
}

function apply(name) {
  const target = SCREENS.includes(name) ? name : 'home';

  // Любая навигация закрывает открытую шторку (иначе она висит поверх нового экрана).
  closeSheet({ notify: true });

  $$('[data-screen]').forEach((screen) => {
    screen.classList.toggle('is-active', screen.dataset.screen === target);
  });
  document.body.classList.toggle('is-game', GAME_SCREENS.has(target));

  $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === target));

  if (current && GAME_SCREENS.has(current) && current !== target) {
    games[current]?.leave?.();
  }
  if (GAME_SCREENS.has(target)) {
    games[target]?.enter?.();
  }

  setBackButton(GAME_SCREENS.has(target), () => go('home'));

  current = target;
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (target === 'home') home?.render?.();
  if (target === 'bonus') bonus?.render?.();
  if (target === 'profile') profile?.render?.();
}

function renderBalances() {
  const value = fmt(store.get().balance);
  $$('[data-balance]').forEach((node) => { node.textContent = value; });
}

function boot() {
  store.init();
  initTelegram();

  if (telegram.isTelegram) {
    document.body.classList.add('is-tg');
  }

  sfx.setEnabled(store.get().settings.sound);

  const ctx = {
    store,
    sfx,
    haptic,
    toast,
    openSheet,
    confirmSheet,
    confetti,
    floatWin,
    createBetControl,
    go,
    debug: DEBUG,
  };

  games = {
    slots: setupSlots(ctx),
    roulette: setupRoulette(ctx),
    crash: setupCrash(ctx),
    dice: setupDice(ctx),
    blackjack: setupBlackjack(ctx),
    keno: setupKeno(ctx),
  };

  home = setupHome(ctx);
  bonus = setupBonus(ctx);
  profile = setupProfile(ctx);
  setupLevel(ctx);
  setupDaily(ctx);
  setupReferral(ctx);

  // Реферальные start_param/URL обрабатываем до первого рендера и до welcome.
  const refResult = initReferral();

  renderBalances();
  store.addEventListener('change', renderBalances);

  // Кнопки навигации
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { go(open.dataset.open); return; }
    const back = e.target.closest('[data-back]');
    if (back) { go('home'); return; }
    const info = e.target.closest('[data-info]');
    if (info) { openRules(ctx, info.dataset.info); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { go(tab.dataset.tab); return; }
  });

  const balanceAdd = document.getElementById('balanceAdd');
  if (balanceAdd) balanceAdd.addEventListener('click', () => go('bonus'));

  window.addEventListener('hashchange', () => apply(parseHash()));

  apply(parseHash());

  // Supabase: общий прогресс между устройствами (если настроен).
  if (backend.enabled) {
    store.addEventListener('change', () => backend.scheduleSync());
    backend.restore().then((updated) => {
      if (updated) {
        renderBalances();
        home?.render?.();
        bonus?.render?.();
        profile?.render?.();
      }
    });
  }

  // Облако Telegram: подтягиваем более свежий прогресс
  if (cloud) {
    store.cloud = cloud;
    store.hydrateFromCloud().then((updated) => {
      if (updated) {
        renderBalances();
        home?.render?.();
        bonus?.render?.();
        profile?.render?.();
      }
    });
  }

  // Реферальные события
  if (refResult.invited) {
    store.setWelcomed();
    setTimeout(() => {
      sfx.coin();
      openSheet({
        title: 'Тебя пригласил друг',
        body: `<p>На баланс уже начислено <b>+${fmt(REFERRAL.inviteeBonus)}</b> очков.</p>
               <p>Отправь другу ответный бонус +${fmt(REFERRAL.inviterBonus)} — он получит его, когда откроет сообщение.</p>`,
        actions: [
          { label: 'Отправить другу', kind: 'primary', onClick: () => { shareClaim(); sfx.coin(); } },
          { label: 'Позже', kind: 'ghost' },
        ],
      });
    }, 600);
  } else if (refResult.claimed) {
    store.setWelcomed();
    setTimeout(() => {
      sfx.bigWin();
      haptic('success');
      confetti(60);
      openSheet({
        title: 'Друг зашёл!',
        body: `<p>Начислено <b>+${fmt(REFERRAL.inviterBonus)}</b> очков за приглашённого друга.</p>
               <p>Так можно пригласить до ${REFERRAL.maxClaims} друзей.</p>`,
        actions: [
          { label: 'К бонусам', kind: 'primary', onClick: () => go('bonus') },
          { label: 'Ок', kind: 'ghost' },
        ],
      });
    }, 700);
  } else if (!store.get().welcomed) {
    // Первый запуск
    setTimeout(() => {
      openSheet({
        title: 'Добро пожаловать в LUCKY 777',
        body: `<p>Это казино без денег: на балансе <b>10 000 виртуальных очков</b>, ставки — только на них. Очки нельзя купить, продать или вывести.</p>
               <p>Заходите каждый день за бонусом, крутите колесо раз в 4 часа и пробуйте пять игр. Всё честно — математика та же, что в настоящих казино.</p>`,
        actions: [{
          label: 'Погнали',
          kind: 'primary',
          onClick: () => {
            store.setWelcomed();
            sfx.coin();
            haptic('success');
          },
        }],
        closable: false,
      });
    }, 500);
  }

  if (refResult.error) {
    const errors = {
      expired: 'Срок действия бонус-ссылки истёк',
      already: 'Этот бонус уже получен',
      self: 'Нельзя пригласить самого себя',
      limit: 'Достигнут лимит наград за друзей',
    };
    const text = errors[refResult.error];
    if (text) setTimeout(() => toast(text, 'loss', 3200), 900);
  }

  // Отладочный API только локально — в проде глобального объекта нет.
  if (DEBUG) {
    window.LUCKY = {
      store,
      go,
      games,
      get current() { return current; },
      version: '1.0.1',
    };
  }
}

boot();
