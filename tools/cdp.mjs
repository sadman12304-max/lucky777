// Мини-CDP-харнесс без puppeteer: запуск headless Chrome, навигация, eval, скриншоты.
// Chrome запускается с mock-keychain, поэтому не лезет в связку ключей macOS.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(dir, timeout = 20000) {
  const file = path.join(dir, 'DevToolsActivePort');
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (fs.existsSync(file)) {
      const [port] = fs.readFileSync(file, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await sleep(100);
  }
  throw new Error('Chrome did not expose DevTools port');
}

export class CDP {
  constructor(wsUrl) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws = new WebSocket(wsUrl);
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      } else {
        (this.listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  waitFor(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting ' + method)), timeout);
      const fn = (params) => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) || []).filter((x) => x !== fn));
        resolve(params);
      };
      this.on(method, fn);
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }
  async waitForApp(timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await this.eval('Boolean(window.LUCKY && window.LUCKY.store)')) return true;
      } catch { /* контекст ещё не готов */ }
      await sleep(100);
    }
    throw new Error('app did not boot (window.LUCKY missing)');
  }
  close() {
    try { this.ws.close(); } catch { /* noop */ }
  }
}

function killChrome(proc, dir) {
  try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* noop */ }
  try { proc.kill('SIGKILL'); } catch { /* noop */ }
  try {
    const pids = execFileSync('pgrep', ['-f', '--', `--user-data-dir=${dir}`], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    pids.forEach((pid) => {
      if (Number(pid) !== process.pid) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch { /* noop */ }
      }
    });
  } catch { /* никого не нашли */ }
}

/**
 * @returns {Promise<{cdp: CDP, errors: string[], navigate: Function, close: Function, dir: string}>}
 */
export async function launch({ width = 390, height = 844, dpr = 2 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lucky777-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-dev-shm-usage',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--no-default-browser-check',
    '--no-first-run',
    '--noerrdialogs',
    '--hide-scrollbars',
    '--use-mock-keychain',
    '--password-store=basic',
    '--disable-save-password-bubble',
    '--remote-debugging-port=0',
    `--user-data-dir=${dir}`,
    'about:blank',
  ], { env: { ...process.env, HOME: dir }, stdio: 'ignore', detached: true });

  const errors = [];
  const port = await waitForPort(dir);
  const pageResp = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const page = await pageResp.json();
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();

  cdp.on('Runtime.exceptionThrown', (p) => {
    errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception');
  });
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') errors.push(p.entry.text);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  // В тестах не зависим от внешней сети: SDK Telegram не нужен для локального прогона.
  await cdp.send('Network.setBlockedURLs', { urls: ['*://telegram.org/*'] });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });

  async function navigate(url) {
    const loaded = cdp.waitFor('Page.loadEventFired', 25000).catch(() => null);
    await cdp.send('Page.navigate', { url });
    await loaded;
    await cdp.waitForApp();
  }

  function close() {
    cdp.close();
    killChrome(proc, dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }

  return { cdp, errors, navigate, close, dir, width, height };
}
