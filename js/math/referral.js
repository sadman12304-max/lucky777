// Чистая логика реферальных ссылок: парсинг start_param и проверка claim-токена.

/** 'ref_123' → {kind:'ref', value:'123'}; 'claim_123_ts_nonce' → {kind:'claim', value:'...'} */
export function parseStartParam(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw;
  try { text = decodeURIComponent(raw); } catch { /* оставляем как есть */ }
  if (text.startsWith('ref_')) {
    const id = text.slice(4).replace(/\D/g, '').slice(0, 20);
    return id ? { kind: 'ref', value: id } : null;
  }
  if (text.startsWith('claim_')) {
    const value = text.slice(6);
    return value ? { kind: 'claim', value } : null;
  }
  return null;
}

/** claim-токен: <inviteeId>_<timestamp base36>_<nonce> */
export function makeClaimToken(inviteeId, now = Date.now(), nonce = null) {
  const rand = nonce || Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${String(inviteeId)}_${now.toString(36)}_${rand}`;
}

export function parseClaimToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('_');
  if (parts.length !== 3) return null;
  const [invitee, ts, nonce] = parts;
  if (!/^\d{5,20}$/.test(invitee)) return null;
  const time = parseInt(ts, 36);
  if (!Number.isFinite(time)) return null;
  if (!/^[a-z0-9]{6,12}$/.test(nonce)) return null;
  return { invitee, time, nonce };
}

/**
 * @returns {'ok'|'self'|'expired'|'already'|'limit'|'bad'}
 */
export function claimStatus(token, {
  myId,
  claims = [],
  maxClaims = 50,
  ttlDays = 30,
  now = Date.now(),
} = {}) {
  const parsed = typeof token === 'string' ? parseClaimToken(token) : token;
  if (!parsed) return 'bad';
  if (String(parsed.invitee) === String(myId)) return 'self';
  if (now - parsed.time > ttlDays * 24 * 60 * 60 * 1000) return 'expired';
  if (parsed.time > now + 60_000) return 'bad';
  if (claims.includes(parsed.invitee)) return 'already';
  if (claims.length >= maxClaims) return 'limit';
  return 'ok';
}
