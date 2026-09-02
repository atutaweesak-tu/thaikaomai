// ─────────────────────────────────────────────────────────────────────────────
// ก้อน B — crypto ฝั่ง api (Express + Prisma @ /opt/thaikaomai/api)
//
// สำเนาแบบ self-contained ของ primitive ที่ broker ใช้ (server/verify/crypto.ts +
// s2s.ts) — api ไม่ import จาก package ของ broker จึงต้องมีชุดนี้ของตัวเอง
// **ต้องตรงไบต์ต่อไบต์กับฝั่ง broker** ไม่งั้น HMAC ไม่ผ่าน / ถอดรหัส profile ไม่ออก
//
// ที่มา:
//   signS2S / verifyIncomingS2S / signOutgoingS2S  ← server/verify/s2s.ts
//   encryptJson / decryptJson (AES-256-GCM)         ← server/verify/crypto.ts
//   parseFieldKey                                    ← server/verify/config.ts (parseKey)
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import type { IncomingMessage } from 'http';

const MAX_SKEW_MS = 5 * 60 * 1000;

// ── random / hash ────────────────────────────────────────────────────────────
export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hmacHex(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** เปรียบเทียบ hex แบบ constant-time (กัน timing side-channel ตอนเช็คลายเซ็น) */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// signature = HMAC-SHA256( `${timestamp}.${nonce}.${rawBody}` , sharedSecret )
export function signS2S(rawBody: string, timestamp: string, nonce: string, secret: string): string {
  return hmacHex(`${timestamp}.${nonce}.${rawBody}`, secret);
}

// ── AES-256-GCM: บล็อบ base64url = iv(12) | authTag(16) | ciphertext ──────────
// รูปแบบเดียวกับ server/verify/crypto.ts — VerifiedProfile ถูกเข้ารหัสด้วย key นี้
// ตอน ingest แล้วถอดตอน SPA มา consume
export function encryptJson(obj: unknown, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64url');
}

export function decryptJson<T = unknown>(blob: string, key: Buffer): T {
  const raw = Buffer.from(blob, 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

/** VERIFY_FIELD_KEY: hex 64 ตัว หรือ base64 ของ 32 bytes → Buffer(32) | null */
export function parseFieldKey(raw: string): Buffer | null {
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch {
    /* fallthrough */
  }
  console.warn('[verify-api] VERIFY_FIELD_KEY ต้องเป็น hex 64 ตัว หรือ base64 ของ 32 bytes — ถือว่าไม่ได้ตั้ง');
  return null;
}

// ── S2S: client IP (หลัง nginx/cloudflare) ───────────────────────────────────
export function clientIp(req: IncomingMessage): string {
  const xf = req.headers['x-forwarded-for'];
  const xff = Array.isArray(xf) ? xf[0] : xf;
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ── S2S: nonce replay cache (in-memory — window สั้นแค่ MAX_SKEW) ─────────────
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

export interface S2SOptions {
  secret: string;
  allowedIps: string[];
  trustAllIps: boolean;
}

export interface S2SResult {
  ok: boolean;
  reason?: string;
}

/** ตรวจ request S2S ขาเข้า (broker → api) — เหมือน verifyIncomingS2S ของ broker */
export function verifyIncomingS2S(req: IncomingMessage, rawBody: string, opt: S2SOptions): S2SResult {
  if (!opt.secret) return { ok: false, reason: 'api_missing_secret' };

  if (!opt.trustAllIps) {
    const ip = clientIp(req).replace(/^::ffff:/, '');
    const allowed = opt.allowedIps.map(a => a.replace(/^::ffff:/, ''));
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
  const expected = signS2S(rawBody, ts, nonce, opt.secret);
  if (!timingSafeEqualHex(sig, expected)) return { ok: false, reason: 'bad_signature' };
  if (!rememberNonce(nonce)) return { ok: false, reason: 'replayed_nonce' };

  return { ok: true };
}

/** เซ็น request S2S ขาออก (api → broker, ใช้ตอนเปิด session) — คืน headers */
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
