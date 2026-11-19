#!/usr/bin/env node
// E2E-прогон всех игр в headless Chrome: клики, баланс, раунды, отсутствие JS-ошибок.
// Запуск: node tools/e2e.mjs [http://127.0.0.1:8765/]

import { launch, sleep } from './cdp.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok: Boolean(ok), extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`);
}

const browser = await launch({ width: 390, height: 844, dpr: 1 });
const { cdp, errors } = browser;

const js = (expr) => cdp.eval(expr);
const balance = () => js('LUCKY.store.state.balance');
const rounds = () => js('LUCKY.store.state.stats.rounds');
const go = async (hash) => {
  await js(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(500);
};

try {
  await browser.navigate(BASE);

  // чистый старт
  await js(`(() => {
    LUCKY.store.reset();
    LUCKY.store.state.settings.sound = false;
    LUCKY.store.state.welcomed = true;
    LUCKY.store.touch();
    document.querySelectorAll('.sheet-backdrop,.sheet').forEach((n) => n.remove());
  })()`);
  await sleep(300);

  check('boot: баланс 10 000', (await balance()) === 10000);
  check('boot: главный экран активен', await js(`document.querySelector('[data-screen="home"]').classList.contains('is-active')`));

  /* ── слоты ── */
  await go('#/slots');
  check('slots: 15 ячеек', (await js(`document.querySelectorAll('#slotGrid .slot-cell').length`)) === 15);
  const slotsBefore = await balance();
  await js(`document.getElementById('slotSpinBtn').click()`);
  await sleep(2700);
  const slotsAfter = await balance();
  check('slots: раунд записан', (await rounds()) === 1);
  check('slots: ставка списана/выигрыш начислен', slotsAfter !== slotsBefore, `${slotsBefore} → ${slotsAfter}`);
  check('slots: кнопка снова активна', await js(`!document.getElementById('slotSpinBtn').disabled`));
  check('slots: символы отрисованы', (await js(`document.querySelectorAll('#slotGrid .slot-cell use').length`)) === 15);

  /* ── рулетка ── */
  await go('#/roulette');
  const fits = await js(`(() => {
    const t = document.getElementById('rouletteTable');
    const app = document.querySelector('.app');
    return t.scrollWidth <= t.clientWidth + 1 && app.scrollWidth <= app.clientWidth + 1;
  })()`);
  check('roulette: стол не вылезает за экран', fits);
  check('roulette: лента заполнена', (await js(`document.querySelectorAll('#rouletteStrip .ribbon-cell').length`)) === 56);
  await js(`document.querySelector('[data-outside="red"]').click()`);
  check('roulette: ставка поставлена', (await js(`document.getElementById('rouletteTotal').textContent`)) !== '0');
  await js(`document.querySelector('[data-dozen="2"]').click()`);
  check('roulette: дюжина 13–24 ставится', (await js(`document.getElementById('rouletteTotal').textContent.replace(/[^0-9]/g, '')`)) === '200');
  const rouletteStakedBefore = await js(`LUCKY.store.state.stats.staked`);
  await js(`document.getElementById('rouletteSpinBtn').click()`);
  await sleep(4400);
  check('roulette: раунд записан', (await rounds()) === 2);
  check('roulette: ставка 200 списана', (await js(`LUCKY.store.state.stats.staked`)) === rouletteStakedBefore + 200);
  check('roulette: лента остановилась на результате', (await js(`document.querySelectorAll('#rouletteStrip .is-result').length`)) === 1);

  /* ── кости ── */
  await go('#/dice');
  const diceBefore = await balance();
  await js(`document.getElementById('diceRollBtn').click()`);
  await sleep(1700);
  check('dice: раунд записан', (await rounds()) === 3);
  check('dice: число выпало', /^\d+$/.test(await js(`document.getElementById('diceNumber').textContent.trim()`)));
  check('dice: баланс изменился', (await balance()) !== diceBefore);

  /* ── блэкджек ── */
  await go('#/blackjack');
  await js(`document.getElementById('bjDeal').click()`);
  await sleep(150);
  check('blackjack: скрытая карта дилера не утекает в DOM', await js(`(() => {
    const hole = document.querySelectorAll('#bjDealerHand .bj-card')[1];
    return hole && hole.classList.contains('is-hidden') && hole.textContent.trim() === '';
  })()`));
  await sleep(800);
  let bjState = await js(`LUCKY.games.blackjack._state()`);
  check('blackjack: карты розданы', bjState.player.length === 2 && bjState.dealer.length === 2, `phase=${bjState.phase}`);
  if (bjState.phase === 'player') {
    await js(`document.querySelector('[data-bj="stand"]').click()`);
    await sleep(300);
  }
  await sleep(2600);
  check('blackjack: раунд записан', (await rounds()) === 4);
  check('blackjack: карты видны', (await js(`document.querySelectorAll('#bjPlayerHand .bj-card').length`)) >= 2);
  check('blackjack: дилер доиграл', (await js(`LUCKY.games.blackjack._state().phase`)) === 'over');
  check('blackjack: карта дилера открыта после раздачи', await js(`(() => {
    const cards = document.querySelectorAll('#bjDealerHand .bj-card');
    return cards.length >= 2 && [...cards].every((c) => !c.classList.contains('is-hidden') && c.textContent.trim().length > 0);
  })()`));

  /* ── краш ── */
  await go('#/crash');
  const crashBefore = await balance();
  await js(`document.getElementById('crashAction').click()`);
  await sleep(900);
  const crashRunning = await js(`LUCKY.games.crash._state().running`);
  if (crashRunning) {
    await js(`document.getElementById('crashAction').click()`);
    await sleep(400);
  }
  check('crash: раунд записан', (await rounds()) === 5);
  check('crash: ставка списана', (await balance()) !== crashBefore);
  check('crash: история заполнилась', (await js(`document.querySelectorAll('#crashHistory .crash-chip').length`)) >= 1);

  /* ── дейли ── */
  await go('#/home');
  check('daily: доступен', await js(`((s) => s.daily.last === '')(LUCKY.store.state)`));
  await js(`document.querySelector('[data-daily] [data-daily-claim]').click()`);
  await sleep(500);
  const daily = await js(`LUCKY.store.state.daily`);
  check('daily: бонус получен', daily.last !== '' && daily.streak === 1, JSON.stringify(daily));
  check('daily: повторно не начисляется', await js(`(async () => {
    const before = LUCKY.store.state.balance;
    document.querySelector('[data-daily] [data-daily-claim]').click();
    await new Promise((r) => setTimeout(r, 150));
    return LUCKY.store.state.balance === before;
  })()`));

  /* ── колесо ── */
  await go('#/bonus');
  const bonusBefore = await balance();
  await js(`document.getElementById('bonusSpinBtn').click()`);
  await sleep(4600);
  const bonusAfter = await balance();
  check('bonus: приз начислен', bonusAfter > bonusBefore, `${bonusBefore} → ${bonusAfter}`);
  check('bonus: кулдаун взведён', (await js(`LUCKY.store.state.bonus.lastSpin`)) > 0);
  check('bonus: кнопка заблокирована', await js(`document.getElementById('bonusSpinBtn').disabled`));

  /* ── профиль ── */
  await go('#/profile');
  check('profile: статистика отрисована', (await js(`document.querySelectorAll('#statsGrid .stat-card').length`)) === 6);
  check('profile: достижения отрисованы', (await js(`document.querySelectorAll('#achievements .ach').length`)) === 6);
  check('profile: баланс совпадает', await js(`(() => {
    const el = document.querySelector('[data-screen="profile"] [data-balance]');
    return el?.textContent?.trim() === LUCKY.store.state.balance.toLocaleString('ru-RU');
  })()`));

  /* ── регрессии по аудиту ── */
  await go('#/roulette');
  await js(`document.getElementById('rouletteClear').click()`);
  await js(`document.querySelector('#rouletteChips [data-chip="100"]').click()`);
  await js(`document.querySelector('[data-outside="red"]').click()`);
  await js(`document.querySelector('#rouletteChips [data-chip="10"]').click()`);
  await js(`document.getElementById('rouletteUndo').click()`);
  check('roulette: undo снимает всю поставленную сумму', (await js(`document.getElementById('rouletteTotal').textContent`)) === '0');

  await go('#/dice');
  await js(`(() => { const s = document.getElementById('diceTarget'); s.value = '4'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const diceMult = await js(`parseFloat(document.getElementById('dicePayout').textContent.replace('×', '').replace(',', '.'))`);
  check('dice: минимальный множитель не ниже 1', diceMult >= 1, '×' + diceMult);

  const crashRoundsBefore = await rounds();
  await go('#/crash');
  await js(`document.getElementById('crashAction').click()`);
  await sleep(700);
  await go('#/home');
  await sleep(300);
  check('crash: выход с экрана завершает раунд, а не возвращает ставку', (await rounds()) === crashRoundsBefore + 1);

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: true });
  await go('#/crash');
  const scroll320 = await js(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)`);
  const presetsRight = await js(`(() => { const r = document.getElementById('crashPresets').getBoundingClientRect(); return Math.round(r.right); })()`);
  check('320px: нет горизонтального переполнения в краше', scroll320 <= 321, 'scrollWidth=' + scroll320);
  check('320px: авто-кэшаут целиком в экране', presetsRight <= 320, 'right=' + presetsRight);

  await go('#/keno');
  const kenoWidth = await js(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)`);
  check('320px: кено без горизонтального переполнения', kenoWidth <= 321, 'scrollWidth=' + kenoWidth);
  check('320px: кнопка кено доступна', await js(`(() => {
    const b = document.getElementById('kenoPlay').getBoundingClientRect();
    return b.top < 700 && b.bottom <= 701;
  })()`));

  await go('#/roulette');
  const rouletteWidth = await js(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)`);
  const outsideRight = await js(`Math.round(document.getElementById('rouletteOutside').getBoundingClientRect().right)`);
  check('320px: ставки рулетки в экране', rouletteWidth <= 321 && outsideRight <= 320, `w=${rouletteWidth}, right=${outsideRight}`);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await go('#/home');
  await js(`document.getElementById('greetName').textContent = 'Оченьдлинноеимя'.repeat(8)`);
  const longNameWidth = await js(`Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)`);
  check('длинное имя не ломает вёрстку', longNameWidth <= 391, 'scrollWidth=' + longNameWidth);
  await js(`document.getElementById('greetName').textContent = 'Гость'`);

  await go('#/slots');
  await js(`document.querySelector('[data-info="slots"]').click()`);
  await sleep(200);
  check('шторка блокирует фон', await js(`document.body.classList.contains('is-sheet') && getComputedStyle(document.body).overflow === 'hidden'`));
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(250);
  check('Escape закрывает шторку', (await js(`document.querySelectorAll('.sheet').length`)) === 0);

  const winsBefore = await js(`LUCKY.store.state.stats.wins`);
  await js(`LUCKY.store.recordRound({ game: 'blackjack', bet: 100, win: 100 })`);
  check('пуш не засчитывается как победа', (await js(`LUCKY.store.state.stats.wins`)) === winsBefore);

  const kenoRoundsBefore = await rounds();
  await go('#/keno');
  check('keno: 80 чисел на поле', (await js(`document.querySelectorAll('#kenoBoard .keno-cell').length`)) === 80);
  await js(`document.getElementById('kenoRandom').click()`);
  check('keno: выбрано 10 чисел', (await js(`document.querySelectorAll('#kenoBoard .is-picked').length`)) === 10);
  const kenoBalanceBefore = await balance();
  await js(`document.getElementById('kenoPlay').click()`);
  await sleep(2300);
  check('keno: раунд записан', (await rounds()) === kenoRoundsBefore + 1);
  check('keno: результат показан', (await js(`document.getElementById('kenoResult').textContent`)).includes('Поймано'));
  check('keno: баланс изменился', (await balance()) !== kenoBalanceBefore);

  /* ── консоль ── */
  const realErrors = errors.filter((e) => !/CloudStorage|favicon|postEvent|Telegram\.WebView/i.test(e));
  check('нет JS-ошибок', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) process.exitCode = 1;
} catch (e) {
  console.error('\nE2E КРАШНУЛСЯ:', e.message);
  if (errors.length) [...new Set(errors)].forEach((x) => console.error('  JS:', x));
  process.exitCode = 1;
} finally {
  browser.close();
}
