// Общие UI-компоненты: тосты, шторки, конфетти, всплывающие выигрыши.

import { $, el, icon, clamp } from './util.js';

const toastsRoot = () => document.getElementById('toasts');

export function toast(text, kind = '', duration = 2400) {
  const root = toastsRoot();
  if (!root) return;
  const node = el('div', 'toast' + (kind ? ` is-${kind}` : ''), text);
  root.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, duration);
}

/* ───────────── bottom sheet ───────────── */

let sheetEls = null;
let lastFocus = null;
let activeOnClose = null;

function teardownSheet() {
  if (!sheetEls) return false;
  sheetEls.backdrop.remove();
  sheetEls.sheet.remove();
  sheetEls = null;
  document.body.classList.remove('is-sheet');
  document.removeEventListener('keydown', onKey);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  return true;
}

function onKey(e) {
  if (e.key === 'Escape') closeSheet({ notify: true });
}

/** @param {{notify?: boolean}} opts */
export function closeSheet({ notify = false } = {}) {
  const onClose = activeOnClose;
  activeOnClose = null;
  const had = teardownSheet();
  if (had && notify && onClose) onClose();
}

/**
 * @param {{title?: string, body?: string, actions?: Array<{label:string, kind?:string, onClick?:Function, keepOpen?:boolean}>, onClose?:Function}} opts
 */
export function openSheet({ title = '', body = '', actions = [], onClose = null, closable = true } = {}) {
  teardownSheet();
  lastFocus = document.activeElement;

  const backdrop = el('div', 'sheet-backdrop');
  const sheet = el('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  document.body.classList.add('is-sheet');
  activeOnClose = onClose;

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    ${closable ? `<button class="sheet-close" aria-label="Закрыть">${icon('i-close')}</button>` : ''}
    ${title ? `<h3>${title}</h3>` : ''}
    ${body ? `<div class="sheet-body">${body}</div>` : ''}
    <div class="sheet-actions"></div>
  `;

  const actionsRoot = sheet.querySelector('.sheet-actions');
  actions.forEach((a) => {
    const btn = el('button', `btn ${a.kind || 'ghost'}`, a.label);
    btn.addEventListener('click', () => {
      if (a.onClick) a.onClick();
      if (!a.keepOpen) closeSheet();
    });
    actionsRoot.appendChild(btn);
  });

  sheet.querySelector('.sheet-close')?.addEventListener('click', () => {
    closeSheet({ notify: true });
  });
  if (closable) {
    backdrop.addEventListener('click', () => closeSheet({ notify: true }));
  }

  document.getElementById('sheetRoot').append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  sheetEls = { backdrop, sheet };
  return { close: closeSheet, sheet };
}

export function confirmSheet(title, text, okLabel = 'Да') {
  return new Promise((resolve) => {
    openSheet({
      title,
      body: `<p>${text}</p>`,
      actions: [
        {
          label: okLabel,
          kind: 'primary',
          onClick: () => resolve(true),
        },
        {
          label: 'Отмена',
          kind: 'ghost',
          onClick: () => resolve(false),
        },
      ],
      onClose: () => resolve(false),
    });
  });
}

/* ───────────── fx ───────────── */

const CONFETTI_COLORS = ['#ffd166', '#ff9f1c', '#ff4d9d', '#8b5cf6', '#22d3ee', '#34d399', '#fff'];

export function confetti(count = 46, origin = null) {
  const root = document.getElementById('confettiRoot');
  if (!root) return;
  const cx = origin?.x ?? window.innerWidth / 2;
  const cy = origin?.y ?? window.innerHeight * 0.32;
  for (let i = 0; i < count; i++) {
    const node = el('i', 'confetti');
    node.style.left = `${cx + (Math.random() - 0.5) * 80}px`;
    node.style.top = `${cy}px`;
    node.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    node.style.opacity = String(0.75 + Math.random() * 0.25);
    root.appendChild(node);
    const dx = (Math.random() - 0.5) * 260;
    const dy = 180 + Math.random() * 320;
    const rot = (Math.random() - 0.5) * 900;
    node.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.15,.65,.35,1)', fill: 'forwards' }
    ).finished.then(() => node.remove()).catch(() => node.remove());
  }
}

export function floatWin(text, x, y, isLoss = false) {
  const node = el('div', 'float-win' + (isLoss ? ' loss' : ''), text);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}

export function popBalance() {
  document.querySelectorAll('.balance-value, .wallet-value span').forEach((n) => {
    n.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.14)', offset: 0.35 },
        { transform: 'scale(1)' },
      ],
      { duration: 280, easing: 'ease-out' }
    );
  });
}

export function clampBet(value, min, max) {
  return clamp(Math.round(value / 10) * 10, min, max);
}

export { $ };
