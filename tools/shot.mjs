#!/usr/bin/env node
/**
 * Headless-скриншот LUCKY 777.
 *   node tools/shot.mjs http://127.0.0.1:8765/ shots/home.png
 *   node tools/shot.mjs http://127.0.0.1:8765/#/slots shots/slots.png --seed
 *
 * Опции: --w 390 --h 844 --dpr 2 --full --wait 2500 --seed
 *        --eval "js" --click "css-селектор"
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './cdp.mjs';

const argv = process.argv.slice(2);
const url = argv[0];
const out = argv[1];
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [options]');
  process.exit(1);
}

function flag(name, fallback = null) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const width = Number(flag('w', 390));
const height = Number(flag('h', 844));
const dpr = Number(flag('dpr', 2));
const full = Boolean(flag('full', false));
const wait = Number(flag('wait', 2500));
const seed = Boolean(flag('seed', false));
const evalCode = flag('eval', null);
const clickSel = flag('click', null);

const SEED = `
  (() => {
    const st = LUCKY.store;
    st.setWelcomed();
    st.state.balance = 18450;
    st.state.stats = { rounds: 63, wins: 27, staked: 42000, won: 45750, bestWin: 12500, bestMult: 42, maxBet: 1000 };
    st.state.level = { lvl: 9, xp: 6000, totalXp: 42000, resets: 0 };
    st.state.recent = [
      { game: 'slots', bet: 100, win: 1250, ts: Date.now() - 60000 },
      { game: 'blackjack', bet: 500, win: 1000, ts: Date.now() - 240000 },
      { game: 'crash', bet: 200, win: 0, ts: Date.now() - 600000 },
      { game: 'roulette', bet: 100, win: 200, ts: Date.now() - 900000 }
    ];
    st.state.daily = { last: '', streak: 2 };
    st.state.bonus = { lastSpin: 0, streak: 3 };
    st.touch();
    document.querySelectorAll('.sheet-backdrop,.sheet').forEach((n) => n.remove());
  })()
`;

let browser;
try {
  browser = await launch({ width, height, dpr });
  const { cdp, errors } = browser;
  await browser.navigate(url);

  if (seed) {
    await cdp.eval(SEED);
    await sleep(750);
    await cdp.eval(`document.querySelectorAll('.sheet-backdrop,.sheet').forEach((n) => n.remove())`);
    await sleep(250);
  }

  if (clickSel) {
    await cdp.eval(`document.querySelector(${JSON.stringify(clickSel)})?.click()`);
    await sleep(600);
  }

  if (evalCode) {
    const result = await cdp.eval(evalCode);
    if (result !== undefined) console.log('eval:', typeof result === 'string' ? result : JSON.stringify(result));
    await sleep(300);
  }

  await sleep(wait);

  const metrics = await cdp.send('Page.getLayoutMetrics').catch(() => null);
  const pageHeight = metrics?.cssContentSize?.height || height;
  const clipHeight = Math.min(pageHeight, 5000);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
    clip: full ? { x: 0, y: 0, width, height: clipHeight, scale: 1 } : undefined,
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${out} (${width}x${full ? Math.round(clipHeight) : height} css, dpr ${dpr})`);

  if (errors.length) {
    console.log('\n--- JS ERRORS ---');
    [...new Set(errors)].forEach((e) => console.log(e));
    process.exitCode = 2;
  } else {
    console.log('no JS errors');
  }
} catch (e) {
  console.error('shot failed:', e.message);
  if (browser?.errors?.length) {
    console.error('JS errors:');
    [...new Set(browser.errors)].forEach((x) => console.error('  ' + x));
  }
  process.exitCode = 1;
} finally {
  browser?.close();
}
