#!/usr/bin/env node
// Проверка клиентской синхронизации с Supabase на локальном mock-PostgREST.
// Подменяет Telegram.WebApp и LUCKY_CONFIG до загрузки страницы.
import http from 'node:http';
import { launch, sleep } from './cdp.mjs';

const PORT = 8766;
const state = { player: null, chats: [] };

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/rest/v1/players' && req.method === 'GET') {
    const id = url.searchParams.get('telegram_id')?.replace('eq.', '');
    const rows = state.player && String(state.player.telegram_id) === id ? [state.player] : [];
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows));
  }
  if (url.pathname === '/rest/v1/players' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      state.player = JSON.parse(body || '{}');
      res.writeHead(201, { 'Content-Type': 'application/json' }).end('[]');
    });
    return;
  }
  if (url.pathname === '/rest/v1/chat_players' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const row = JSON.parse(body || '{}');
      if (!state.chats.some((x) => x.chat_id === row.chat_id && x.telegram_id === row.telegram_id)) state.chats.push(row);
      res.writeHead(201, { 'Content-Type': 'application/json' }).end('[]');
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' }).end('{}');
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const stub = `(() => {
  const wa = {
    initData: 'test',
    initDataUnsafe: { user: { id: 123, first_name: 'Test', username: 'tester' }, chat: { id: -100500, type: 'group' } },
    ready(){}, expand(){}, setHeaderColor(){}, setBackgroundColor(){}, enableClosingConfirmation(){}, disableVerticalSwipes(){},
    openTelegramLink(){}, isVersionAtLeast(){ return true; },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
  };
  window.Telegram = { WebApp: wa };
  let cfg = {};
  Object.defineProperty(window, 'LUCKY_CONFIG', {
    configurable: true,
    get(){ return cfg; },
    set(v){ cfg = { ...v, supabaseUrl: 'http://127.0.0.1:${PORT}', supabaseAnonKey: 'test' }; },
  });
})();`;

let browser;
const results = [];
const check = (name, ok, extra = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`);
};

try {
  browser = await launch({ width: 390, height: 844, dpr: 1 });
  const { cdp } = browser;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stub });
  await browser.navigate('http://127.0.0.1:8765/?v=' + Date.now());
  await sleep(2200);

  check('sync: клиент отправил игрока', state.player?.telegram_id === 123, JSON.stringify(state.player));
  check('sync: клиент отправил чат', state.chats.some((c) => c.chat_id === -100500), JSON.stringify(state.chats));
  check('sync: стартовый баланс на сервере', state.player?.balance === 10000, String(state.player?.balance));

  // Серверный прогресс новее локального → должен примениться
  state.player = {
    telegram_id: 123,
    first_name: 'Test',
    level: 7,
    xp: 250,
    total_xp: 12000,
    balance: 54321,
    resets: 1,
    stats: { rounds: 99, wins: 40, staked: 5000, won: 6000, bestWin: 900, bestMult: 9, maxBet: 500 },
    updated_at: new Date().toISOString(),
  };
  await cdp.eval('localStorage.clear()');
  await browser.navigate('http://127.0.0.1:8765/?v=' + Date.now());
  await sleep(2200);

  const remote = await cdp.eval(`JSON.stringify({ balance: LUCKY.store.state.balance, level: LUCKY.store.state.level, rounds: LUCKY.store.state.stats.rounds })`);
  const r = JSON.parse(remote);
  check('restore: баланс с сервера', r.balance === 54321, remote);
  check('restore: уровень с сервера', r.level.lvl === 7 && r.level.xp === 250, remote);
  check('restore: статистика с сервера', r.rounds === 99, remote);

  const failed = results.filter((x) => !x).length;
  console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
  if (failed) process.exitCode = 1;
} catch (e) {
  console.error('SYNC TEST FAILED:', e.message);
  process.exitCode = 1;
} finally {
  browser?.close();
  server.close();
}
