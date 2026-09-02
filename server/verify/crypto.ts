// ── ThaID KYC broker — crypto helpers ────────────────────────────────────────
import crypto from 'crypto';

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Base64Url(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function hmacHex(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** เปรียบเทียบสตริง hex แบบ constant-time (กัน timing side-channel ตอนเช็คลายเซ็น) */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** constant-time string compare (ใช้เทียบ OIDC state/nonce) — hash ก่อนเทียบ กันหลุด length */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ── S2S request signing (ใช้ทั้ง Laravel→broker และ broker→Laravel) ────────────
// signature = HMAC-SHA256( `${timestamp}.${nonce}.${rawBody}` , sharedSecret )
export function signS2S(rawBody: string, timestamp: string, nonce: string, secret: string): string {
  return hmacHex(`${timestamp}.${nonce}.${rawBody}`, secret);
}

// ── HMAC hash เลขบัตร 13 หลัก (peppered — SHA-256 เปล่า brute-force กลับได้) ────
export function pepperedPidHash(pid: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(pid).digest('hex');
}

// ── AES-256-GCM: เข้ารหัส match fields ตอนพักใน SQLite ────────────────────────
// รูปแบบ blob (base64url): iv(12) | authTag(16) | ciphertext
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

// ── PKCE (RFC 7636) — ใช้ตอนต่อ ThaID OIDC จริง ──────────────────────────────
export function genPkce(): { verifier: string; challenge: string; method: 'S256' } {
  const verifier = randomToken(32);
  return { verifier, challenge: sha256Base64Url(verifier), method: 'S256' };
}
