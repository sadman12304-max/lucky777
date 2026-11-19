// Реферальная система без сервера.
//
// Приглашение: t.me/<bot>/<app>?startapp=ref_<id>  (или ?ref=<id> в браузере)
// Друг открыл → +2000 ему. Затем он жмёт «Отправить другу бонус»:
// ссылка t.me/...?startapp=claim_<inviteeId>_<ts>_<nonce> уходит тебе в чат.
// Ты открываешь её → +1000 тебе. Токен одноразовый и живёт 30 дней.
//
// Это клиентская схема: подделать claim-ссылку технически можно, поэтому
// есть лимит наград и срок жизни. Для реальных денег нужен сервер.

import { store } from './store.js';
import { telegram, shareUrl } from './telegram.js';
import { fmt } from './util.js';
import { parseStartParam, parseClaimToken, makeClaimToken, claimStatus } from '../math/referral.js';

const CFG = window.LUCKY_CONFIG || {};
export const REFERRAL = {
  inviteeBonus: 2000,
  inviterBonus: 1000,
  maxClaims: 50,
  ttlDays: 30,
  ...(CFG.referral || {}),
};

const GUEST_KEY = 'lucky777.guestId';

function ensureReferralState() {
  const st = store.get();
  if (!st.referral || typeof st.referral !== 'object') {
    st.referral = { referredBy: null, joinedAt: 0, claims: [], earned: 0 };
  }
  if (!Array.isArray(st.referral.claims)) st.referral.claims = [];
  return st.referral;
}

function guestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = String(Math.floor(100000000 + Math.random() * 900000000));
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return String(Math.floor(100000000 + Math.random() * 900000000));
  }
}

export function myId() {
  const tgId = telegram.user?.id;
  return tgId ? String(tgId) : guestId();
}

export function isTelegramUser() {
  return Boolean(telegram.user?.id);
}

function buildLink(kind, value) {
  const bot = String(CFG.botUsername || '').replace(/^@/, '').trim();
  const short = String(CFG.appShortName || 'lucky777').trim();
  if (bot) {
    return `https://t.me/${bot}/${short}?startapp=${kind}_${value}`;
  }
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set(kind, value);
  return url.toString();
}

export function inviteLink() {
  return buildLink('ref', myId());
}

export function makeClaimLink(inviteeId = myId()) {
  return buildLink('claim', makeClaimToken(inviteeId));
}

export function claimCount() {
  return ensureReferralState().claims.length;
}

export function earnedPoints() {
  return ensureReferralState().earned || 0;
}

export function referredBy() {
  return ensureReferralState().referredBy || null;
}

function readParam() {
  const startParam = telegram.app?.initDataUnsafe?.start_param;
  if (startParam) {
    const parsed = parseStartParam(String(startParam));
    if (parsed) return parsed;
  }
  const url = new URL(location.href);
  const ref = url.searchParams.get('ref');
  if (ref) return { kind: 'ref', value: ref };
  const claim = url.searchParams.get('claim');
  if (claim) return { kind: 'claim', value: claim };
  return null;
}

function clearUrlParam() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('ref') && !url.searchParams.has('claim')) return;
    url.searchParams.delete('ref');
    url.searchParams.delete('claim');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* noop */ }
}

/**
 * Обрабатывает ref/claim из start_param или URL.
 * @returns {{invited:boolean, inviterId?:string, claimed:boolean, error?:string}}
 */
export function initReferral() {
  const ref = ensureReferralState();
  const result = { invited: false, claimed: false };
  const param = readParam();
  if (!param) return result;

  if (param.kind === 'ref') {
    const inviter = String(param.value).replace(/\D/g, '').slice(0, 20);
    if (inviter && inviter !== myId() && !ref.referredBy) {
      ref.referredBy = inviter;
      ref.joinedAt = Date.now();
      store.addPoints(REFERRAL.inviteeBonus);
      store.touch();
      result.invited = true;
      result.inviterId = inviter;
    }
  } else {
    const status = claimStatus(param.value, {
      myId: myId(),
      claims: ref.claims,
      maxClaims: REFERRAL.maxClaims,
      ttlDays: REFERRAL.ttlDays,
    });
    if (status === 'ok') {
      const parsed = parseClaimToken(param.value);
      ref.claims.push(parsed.invitee);
      ref.earned = (ref.earned || 0) + REFERRAL.inviterBonus;
      store.addPoints(REFERRAL.inviterBonus);
      store.touch();
      result.claimed = true;
    } else {
      result.error = status;
    }
  }

  clearUrlParam();
  return result;
}

export function shareInvite() {
  const text = `🎰 Залетай в LUCKY 777 — казино на виртуальные очки. Тебе +${fmt(REFERRAL.inviteeBonus)} по моей ссылке:`;
  shareUrl(inviteLink(), text);
}

/** Друг отправляет пригласившему бонус-ссылку. */
export function shareClaim() {
  const text = `Я зашёл в LUCKY 777 по твоей ссылке 🎰 Забери бонус +${fmt(REFERRAL.inviterBonus)}:`;
  shareUrl(makeClaimLink(myId()), text);
}

export async function copyInviteLink() {
  const link = inviteLink();
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    try {
      window.prompt('Скопируй ссылку:', link);
      return true;
    } catch {
      return false;
    }
  }
}

export function referralSummary() {
  const ref = ensureReferralState();
  return {
    invited: ref.claims.length,
    earned: ref.earned || 0,
    referredBy: ref.referredBy || null,
    isTelegram: isTelegramUser(),
    linkMode: CFG.botUsername ? 'telegram' : 'web',
  };
}
