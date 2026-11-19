// Обёртка над Telegram.WebApp. В обычном браузере всё тихо деградирует.

import { store } from './store.js';

const wa = window.Telegram?.WebApp ?? null;

export const telegram = {
  app: wa,
  /** Реально ли мы внутри Telegram (а не просто загружен SDK). */
  get isTelegram() {
    return Boolean(wa && (wa.initData || wa.initDataUnsafe?.user));
  },
  get user() {
    return wa?.initDataUnsafe?.user ?? null;
  },
  get name() {
    const u = this.user;
    if (!u) return 'Гость';
    const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return full || u.username || 'Игрок';
  },
  get initials() {
    const name = this.name;
    return (name[0] || 'И').toUpperCase();
  },
  get colorScheme() {
    return wa?.colorScheme || 'dark';
  },
};

export function initTelegram() {
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    if (typeof wa.disableVerticalSwipes === 'function') wa.disableVerticalSwipes();
    if (typeof wa.setHeaderColor === 'function') wa.setHeaderColor('#07070d');
    if (typeof wa.setBackgroundColor === 'function') wa.setBackgroundColor('#05050a');
    if (typeof wa.enableClosingConfirmation === 'function') wa.enableClosingConfirmation();
  } catch (e) {
    console.warn('telegram init', e);
  }
}

export function haptic(kind = 'light') {
  if (!wa?.HapticFeedback) return;
  if (!store.get().settings.haptics) return;
  try {
    if (kind === 'success' || kind === 'error' || kind === 'warning') {
      wa.HapticFeedback.notificationOccurred(kind);
    } else if (kind === 'select') {
      wa.HapticFeedback.selectionChanged();
    } else {
      wa.HapticFeedback.impactOccurred(kind);
    }
  } catch (e) { /* noop */ }
}

export function setBackButton(visible, onClick) {
  if (!wa?.BackButton) return;
  try {
    if (visible) {
      wa.BackButton.show();
      if (onClick) {
        wa.BackButton.offClick(wa.__backHandler || (() => {}));
        wa.__backHandler = onClick;
        wa.BackButton.onClick(onClick);
      }
    } else {
      wa.BackButton.hide();
      if (wa.__backHandler) {
        wa.BackButton.offClick(wa.__backHandler);
        wa.__backHandler = null;
      }
    }
  } catch (e) { /* noop */ }
}

/** CloudStorage API → простые промисы. */
const cloudSupported =
  Boolean(wa?.CloudStorage) &&
  (typeof wa.isVersionAtLeast !== 'function' || wa.isVersionAtLeast('6.9'));

export const cloud = cloudSupported
  ? {
      getItem(key) {
        return new Promise((resolve) => {
          wa.CloudStorage.getItem(key, (err, value) => resolve(err ? null : value || null));
        });
      },
      setItem(key, value) {
        return new Promise((resolve) => {
          wa.CloudStorage.setItem(key, value, (err) => resolve(!err));
        });
      },
    }
  : null;

export function shareUrl(targetUrl, text = '') {
  const share = 'https://t.me/share/url?url=' + encodeURIComponent(targetUrl) + '&text=' + encodeURIComponent(text);
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(share);
  } else {
    window.open(share, '_blank');
  }
}

export function share(text) {
  shareUrl(location.href.split('#')[0], text);
}
