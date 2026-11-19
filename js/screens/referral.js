// Карточка «Пригласи друга» в профиле.

import { store } from '../core/store.js';
import { fmt } from '../core/util.js';
import { toast } from '../core/ui.js';
import {
  REFERRAL,
  shareInvite,
  shareClaim,
  copyInviteLink,
  referralSummary,
} from '../core/referral.js';

function friendsLabel(n) {
  const tail = n % 100;
  if (tail >= 11 && tail <= 14) return `${n} друзей`;
  switch (n % 10) {
    case 1: return `${n} друг`;
    case 2:
    case 3:
    case 4: return `${n} друга`;
    default: return `${n} друзей`;
  }
}

export function setupReferral(ctx) {
  const card = document.querySelector('[data-referral]');
  if (!card) return { render() {} };

  const countEl = card.querySelector('[data-ref-count]');
  const amountEl = card.querySelector('[data-ref-amount]');
  const subEl = card.querySelector('[data-ref-sub]');
  const earnedEl = card.querySelector('[data-ref-earned]');
  const noteEl = card.querySelector('[data-ref-note]');
  const inviteBtn = card.querySelector('[data-ref-invite]');
  const copyBtn = card.querySelector('[data-ref-copy]');
  const referredEl = card.querySelector('[data-ref-referred]');
  const sendBtn = card.querySelector('[data-ref-send]');

  amountEl.textContent = `+${fmt(REFERRAL.inviterBonus)}`;
  subEl.textContent = `тебе · друг получит +${fmt(REFERRAL.inviteeBonus)}`;

  function render() {
    const summary = referralSummary();
    countEl.textContent = friendsLabel(summary.invited);
    earnedEl.textContent = `Заработано: ${fmt(summary.earned)}`;

    referredEl.hidden = !summary.referredBy;

    if (summary.linkMode === 'web') {
      noteEl.hidden = false;
      noteEl.textContent = 'Ссылка пока ведёт на сайт. После создания бота впиши его username в js/config.js — и она начнёт открывать мини-аппу.';
    } else {
      noteEl.hidden = true;
    }
  }

  inviteBtn.addEventListener('click', () => {
    shareInvite();
    ctx.sfx.click();
  });

  sendBtn.addEventListener('click', () => {
    shareClaim();
    toast('Отправь сообщение другу — он получит бонус');
    ctx.sfx.click();
  });

  copyBtn.addEventListener('click', async () => {
    const ok = await copyInviteLink();
    if (ok) toast('Ссылка скопирована');
    else toast('Не удалось скопировать — выдели ссылку вручную', 'loss');
    ctx.sfx.click();
  });

  store.addEventListener('change', render);
  render();
  return { render };
}
