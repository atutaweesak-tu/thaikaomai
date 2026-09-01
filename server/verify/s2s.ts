// ── ThaID KYC broker — server-to-server auth (broker ⇄ Laravel) ───────────────
// อยู่ VPS เดียวกัน คุยผ่าน network ภายใน — ความปลอดภัยหลักคือ HMAC ต่อ request
// (timestamp + nonce กัน replay), IP allowlist เป็น defense-in-depth
import type { IncomingMessage } from 'http';
import type { VerifyConfig } from './config';
import { signS2S, timingSafeEqualHex, randomToken } from './crypto';

const MAX_SKEW_MS = 5 * 60 * 1000;

// nonce ที่เพิ่งเห็น (กัน replay ในกรอบ MAX_SKEW) — เก็บ in-memory พอ เพราะ window สั้น
const seenNonces = new Map<string, number>();
function rememberNonce(nonce: string): boolean {
  const now = Date.now();
  if (seenNonces.has(nonce)) return false;
  seenNonces.set(nonce, now);
  if (seenNonces.size > 5000) {
    for (const [n, t] of seenNonces) if (now - t > MAX_SKEW_MS) seenNonces.delete(n);
  }
  return true;
}

export function clientIp(req: IncomingMessage): string {
  const xf = req.headers['x-forwarded-for'];
  const xff = Array.isArray(xf) ? xf[0] : xf;
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

export interface S2SVerifyResult {
  ok: boolean;
  reason?: string;
}

/** ตรวจ request S2S ขาเข้า (Laravel → broker) */
export function verifyIncomingS2S(
  req: IncomingMessage,
  rawBody: string,
  cfg: VerifyConfig,
): S2SVerifyResult {
  if (!cfg.s2sSecret) return { ok: false, reason: 'broker_missing_secret' };

  if (!cfg.trustAllS2sIps) {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const allowed = cfg.allowedS2sIps.map(a => a.replace(/^::ffff:/, ''));
    if (!allowed.includes(ip)) return { ok: false, reason: `ip_not_allowed:${ip}` };
  }

  const ts = String(req.headers['x-tkm-timestamp'] || '');
  const nonce = String(req.headers['x-tkm-nonce'] || '');
  const sig = String(req.headers['x-tkm-signature'] || '');
  if (!ts || !nonce || !sig) return { ok: false, reason: 'missing_headers' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) {
    return { ok: false, reason: 'stale_timestamp' };
  }
  const expected = signS2S(rawBody, ts, nonce, cfg.s2sSecret);
  if (!timingSafeEqualHex(sig, expected)) return { ok: false, reason: 'bad_signature' };
  if (!rememberNonce(nonce)) return { ok: false, reason: 'replayed_nonce' };

  return { ok: true };
}

/** เซ็น request S2S ขาออก (broker → Laravel) — คืน headers ที่ต้องแนบ */
export function signOutgoingS2S(rawBody: string, secret: string): Record<string, string> {
  const ts = String(Date.now());
  const nonce = randomToken(16);
  return {
    'content-type': 'application/json',
    'x-tkm-timestamp': ts,
    'x-tkm-nonce': nonce,
    'x-tkm-signature': signS2S(rawBody, ts, nonce, secret),
  };
}
