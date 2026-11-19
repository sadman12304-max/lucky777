#!/usr/bin/env node
// Проверка рефералки без сервера: ref → +2000, claim → +1000, защита от повторов.
import { launch, sleep } from './cdp.mjs';
import { makeClaimToken } from '../js/math/referral.js';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`);
};

const browser = await launch({ width: 390, height: 844, dpr: 1 });
const { cdp, errors } = browser;
const js = (expr) => cdp.eval(expr);
const state = () => js(`JSON.stringify(LUCKY.store.state)`);

try {
  await browser.navigate(BASE + '?ref=111222333');
  await sleep(900);

  let st = JSON.parse(await state());
  check('ref: приглашённый получил +2000', st.balance === 12000, `balance=${st.balance}`);
  check('ref: пригласивший записан', st.referral.referredBy === '111222333', st.referral.referredBy);
  check('ref: показана шторка «Тебя пригласил друг»', (await js(`document.querySelector('.sheet h3')?.textContent || ''`)).includes('пригласил'));

  await js(`document.querySelectorAll('.sheet,.sheet-backdrop').forEach((n) => n.remove())`);

  const token = makeClaimToken('444555666');
  await browser.navigate(BASE + '?claim=' + encodeURIComponent(token));
  await sleep(900);
  st = JSON.parse(await state());
  check('claim: пригласивший получил +1000', st.balance === 13000, `balance=${st.balance}`);
  check('claim: друг записан в claims', st.referral.claims.includes('444555666'), JSON.stringify(st.referral.claims));
  check('claim: показана шторка «Друг зашёл»', (await js(`document.querySelector('.sheet h3')?.textContent || ''`)).includes('Друг зашёл'));

  await js(`document.querySelectorAll('.sheet,.sheet-backdrop').forEach((n) => n.remove())`);

  // Повторный claim того же друга не начисляет
  await browser.navigate(BASE + '?claim=' + encodeURIComponent(token));
  await sleep(700);
  st = JSON.parse(await state());
  check('claim: повторный токен не начисляет', st.balance === 13000, `balance=${st.balance}`);

  // Просроченный токен
  const oldToken = makeClaimToken('777888999', Date.now() - 40 * 24 * 60 * 60 * 1000);
  await browser.navigate(BASE + '?claim=' + encodeURIComponent(oldToken));
  await sleep(700);
  st = JSON.parse(await state());
  check('claim: просроченный токен не начисляет', st.balance === 13000, `balance=${st.balance}`);

  // Сам себя пригласить нельзя
  const myGuestId = await js(`localStorage.getItem('lucky777.guestId')`);
  const selfToken = makeClaimToken(myGuestId);
  await browser.navigate(BASE + '?claim=' + encodeURIComponent(selfToken));
  await sleep(700);
  st = JSON.parse(await state());
  check('claim: self-claim заблокирован', st.balance === 13000, `balance=${st.balance}`);

  // Карточка в профиле
  await js(`location.hash = '#/profile'`);
  await sleep(500);
  check('профиль: счётчик друзей = 1', (await js(`document.querySelector('[data-ref-count]').textContent`)) === '1 друг');
  check('профиль: заработано 1 000', (await js(`(() => { const t = document.querySelector('[data-ref-earned]').textContent; return Number(t.replace(/[^0-9]/g, '')); })()`)) === 1000);

  const realErrors = errors.filter((e) => !/CloudStorage|favicon|telegram\.org/i.test(e));
  check('нет JS-ошибок', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) process.exitCode = 1;
} catch (e) {
  console.error('REFERRAL TEST FAILED:', e.message);
  if (errors.length) [...new Set(errors)].forEach((x) => console.error('  JS:', x));
  process.exitCode = 1;
} finally {
  browser.close();
}
