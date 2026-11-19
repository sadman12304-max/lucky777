// Мелкие утилиты.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const nf = new Intl.NumberFormat('ru-RU');

export function fmt(n) {
  return nf.format(Math.round(n));
}

export function fmtMult(n) {
  return '×' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

export function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

/** Иконка из спрайта: icon('i-coin', 'coin') */
export function icon(id, cls = '') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function hapticTap() {
  if (navigator.vibrate) navigator.vibrate(8);
}
