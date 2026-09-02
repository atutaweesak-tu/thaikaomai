// ── ThaID KYC broker — OIDC primitives (ก้อน D) ──────────────────────────────
// Authorization Code + PKCE flow กับ ThaID (DGA/DOPA) — ไม่มี dependency ภายนอก
// ใช้ node:crypto ตรวจลายเซ็น JWT (RS256/PS256/ES256) + JWKS cache
//
// **ยังไม่ได้ทดสอบกับ ThaID จริง** — โครงตามสเปก OIDC มาตรฐาน; ชื่อ claim บางตัว
// (address ตามทะเบียนบ้าน, ial, geocode) ต้องเทียบสเปก DOPA ตอน onboard RP
// (ดู // TODO(go-live) ใน mapThaidClaims + identityVerifier.ts)
//
// ห้าม log: pid เต็ม, access_token, id_token, ตัว claims
import crypto from 'crypto';

export class OidcError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'OidcError';
  }
}

// ── JWT decode / verify ─────────────────────────────────────────────────────
export interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string; e?: string;      // RSA
  crv?: string; x?: string; y?: string; // EC
}

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
  alg: string;
  kid?: string;
}

function b64url(seg: string): Buffer {
  return Buffer.from(seg, 'base64url');
}

/** แยกส่วน JWT — **ยังไม่ตรวจลายเซ็น** (ใช้ verifyJwt ต่อ) */
export function decodeJwt(token: string): DecodedJwt {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new OidcError('jwt_malformed', 'รูปแบบ JWT ไม่ถูกต้อง');
  }
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'));
    payload = JSON.parse(b64url(parts[1]).toString('utf8'));
  } catch {
    throw new OidcError('jwt_malformed', 'ถอด header/payload ของ JWT ไม่ได้');
  }
  return {
    header,
    payload,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: b64url(parts[2]),
    alg: String(header.alg || ''),
    kid: header.kid ? String(header.kid) : undefined,
  };
}

const HASH_FOR: Record<string, string> = {
  RS256: 'sha256', RS384: 'sha384', RS512: 'sha512',
  PS256: 'sha256', PS384: 'sha384', PS512: 'sha512',
  ES256: 'sha256', ES384: 'sha384', ES512: 'sha512',
};

function verifyWithJwk(d: DecodedJwt, jwk: Jwk): boolean {
  const hash = HASH_FOR[d.alg];
  if (!hash) throw new OidcError('jwt_alg_unsupported', `ไม่รองรับ alg=${d.alg}`);
  let key: crypto.KeyObject;
  try {
    key = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' });
  } catch (e) {
    throw new OidcError('jwk_invalid', `JWK แปลงเป็น public key ไม่ได้: ${(e as Error).message}`);
  }
  const data = Buffer.from(d.signingInput, 'utf8');
  if (d.alg.startsWith('RS')) {
    return crypto.verify(hash, data, key, d.signature);
  }
  if (d.alg.startsWith('PS')) {
    return crypto.verify(hash, data, {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, d.signature);
  }
  // ES* — JOSE ใช้ raw r||s (IEEE P1363) ไม่ใช่ DER
  return crypto.verify(hash, data, { key, dsaEncoding: 'ieee-p1363' }, d.signature);
}

/** ตรวจลายเซ็น JWT กับชุด JWKS — คืน payload; โยน OidcError ถ้าไม่ผ่าน */
export function verifyJwt(token: string, jwks: Jwk[]): Record<string, unknown> {
  const d = decodeJwt(token);
  if (d.alg === 'none') throw new OidcError('jwt_alg_none', 'JWT alg=none ไม่ยอมรับ');
  const candidates = d.kid ? jwks.filter(k => k.kid === d.kid) : jwks;
  if (!candidates.length) {
    throw new OidcError('jwt_kid_unknown', `ไม่พบ JWKS key สำหรับ kid=${d.kid ?? '(ไม่มี)'}`);
  }
  for (const jwk of candidates) {
    try {
      if (verifyWithJwk(d, jwk)) return d.payload;
    } catch (e) {
      if (e instanceof OidcError && (e.code === 'jwt_alg_unsupported' || e.code === 'jwt_alg_none')) throw e;
      // ลอง key ถัดไป
    }
  }
  throw new OidcError('jwt_signature_invalid', 'ลายเซ็น id_token ไม่ผ่านการตรวจสอบ');
}

// ── JWKS fetch + cache ──────────────────────────────────────────────────────
interface JwksCacheEntry { keys: Jwk[]; fetchedAt: number }
const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_TTL_MS = 10 * 60 * 1000;

async function httpJson(url: string, init: RequestInit, timeoutMs = 8000): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new OidcError('http_status', `${url} → ${res.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new OidcError('http_bad_json', `${url} คืนค่าที่ไม่ใช่ JSON`);
    }
  } catch (e) {
    if (e instanceof OidcError) throw e;
    throw new OidcError('http_error', `เรียก ${url} ล้มเหลว: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** โหลด JWKS (cache 10 นาที) — force=true บังคับ refetch (ใช้ตอนเจอ kid ที่ไม่รู้จัก) */
export async function getJwks(jwksUrl: string, force = false): Promise<Jwk[]> {
  const hit = jwksCache.get(jwksUrl);
  if (!force && hit && Date.now() - hit.fetchedAt < JWKS_TTL_MS) return hit.keys;
  const body = (await httpJson(jwksUrl, { headers: { accept: 'application/json' } })) as { keys?: Jwk[] };
  if (!body || !Array.isArray(body.keys) || !body.keys.length) {
    throw new OidcError('jwks_empty', `JWKS ที่ ${jwksUrl} ว่างหรือรูปแบบผิด`);
  }
  jwksCache.set(jwksUrl, { keys: body.keys, fetchedAt: Date.now() });
  return body.keys;
}

/** verifyJwt + auto-refetch JWKS หนึ่งครั้งถ้า kid ไม่รู้จัก (key rotation) */
export async function verifyJwtWithJwksUrl(token: string, jwksUrl: string): Promise<Record<string, unknown>> {
  const keys = await getJwks(jwksUrl);
  try {
    return verifyJwt(token, keys);
  } catch (e) {
    if (e instanceof OidcError && e.code === 'jwt_kid_unknown') {
      return verifyJwt(token, await getJwks(jwksUrl, true));
    }
    throw e;
  }
}

// ── id_token claim validation ──────────────────────────────────────────────
export interface IdTokenCheck {
  issuer: string;
  audience: string;
  nonce: string;
  clockSkewSeconds: number;
}

export function validateIdTokenClaims(payload: Record<string, unknown>, chk: IdTokenCheck): void {
  const now = Math.floor(Date.now() / 1000);
  const skew = chk.clockSkewSeconds;

  if (chk.issuer && payload.iss !== chk.issuer) {
    throw new OidcError('iss_mismatch', `iss ไม่ตรง (ได้ ${String(payload.iss)})`);
  }
  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(chk.audience) : aud === chk.audience;
  if (!audOk) throw new OidcError('aud_mismatch', 'aud ไม่ตรง client_id');
  if (Array.isArray(aud) && aud.length > 1 && payload.azp && payload.azp !== chk.audience) {
    throw new OidcError('azp_mismatch', 'azp ไม่ตรง client_id');
  }

  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || now - skew > exp) throw new OidcError('id_token_expired', 'id_token หมดอายุ');
  const iat = Number(payload.iat);
  if (!Number.isFinite(iat) || iat - skew > now) throw new OidcError('id_token_future', 'iat ของ id_token อยู่ในอนาคต');
  if (payload.nbf !== undefined && Number(payload.nbf) - skew > now) {
    throw new OidcError('id_token_not_yet', 'id_token ยังไม่ถึงเวลาใช้ (nbf)');
  }
  if (chk.nonce) {
    if (typeof payload.nonce !== 'string' || payload.nonce !== chk.nonce) {
      throw new OidcError('nonce_mismatch', 'nonce ไม่ตรง (อาจ replay / token คนละคำขอ)');
    }
  }
}

// ── token exchange ─────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  [k: string]: unknown;
}

export interface ExchangeInput {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  authMethod: 'basic' | 'post';
}

export async function exchangeCode(input: ExchangeInput): Promise<TokenResponse> {
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };
  if (input.authMethod === 'basic') {
    headers.authorization =
      'Basic ' + Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64');
  } else {
    form.set('client_id', input.clientId);
    form.set('client_secret', input.clientSecret);
  }
  const body = (await httpJson(input.tokenUrl, { method: 'POST', headers, body: form.toString() }, 10000)) as TokenResponse;
  if (body.error) {
    throw new OidcError('token_endpoint_error', `token endpoint: ${String(body.error)} ${String(body.error_description || '')}`.trim());
  }
  return body;
}

// ── userinfo ───────────────────────────────────────────────────────────────
/** ดึง userinfo — รองรับทั้ง JSON และ signed JWT (application/jwt) */
export async function fetchUserinfo(
  userinfoUrl: string,
  accessToken: string,
  jwksUrl: string,
): Promise<Record<string, unknown>> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(userinfoUrl, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new OidcError('userinfo_status', `userinfo → ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/jwt') || (!ct.includes('json') && text.split('.').length === 3)) {
      return await verifyJwtWithJwksUrl(text.trim(), jwksUrl);
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new OidcError('userinfo_bad_json', 'userinfo คืนค่าที่ไม่ใช่ JSON/JWT');
    }
  } catch (e) {
    if (e instanceof OidcError) throw e;
    throw new OidcError('userinfo_error', `เรียก userinfo ล้มเหลว: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ── claim helpers ──────────────────────────────────────────────────────────
const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** YYYY-MM-DD | YYYYMMDD | DD/MM/YYYY(พ.ศ. หรือ ค.ศ.) → YYYY-MM-DD (ค.ศ.) */
export function normalizeBirthdate(v: unknown): string {
  let raw = s(v).replace(/[.ก-๛]/g, '').trim();
  if (!raw) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return yearToCE(+m[1]) + `-${m[2]}-${m[3]}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (m) return yearToCE(+m[1]) + `-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
    return `${yearToCE(+m[3])}-${mo}-${d}`;
  }
  return '';
}
function yearToCE(y: number): string {
  // ปี > 2450 ถือว่าเป็น พ.ศ. (ค.ศ. ปัจจุบันยังไม่ถึง) — ลบ 543
  return String(y > 2450 ? y - 543 : y);
}

/** ดึงค่า IAL จาก claim ต่าง ๆ ("2.3" | "urn:...:ial:2.3" | number) */
export function pickIal(claims: Record<string, unknown>): string | undefined {
  for (const k of ['ial', 'IAL', 'aal', 'acr']) {
    const raw = s(claims[k]);
    if (!raw) continue;
    const m = /(\d(?:\.\d+)?)\s*$/.exec(raw) || /(\d\.\d+)/.exec(raw);
    if (m) return m[1];
  }
  return undefined;
}

/** "2.3" >= "2.3" แบบเทียบ segment ตัวเลข */
export function ialAtLeast(got: string | undefined, required: string): boolean {
  if (!required) return true;
  if (!got) return false;
  const a = got.split('.').map(Number);
  const b = required.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

/** ref ธุรกรรม NDID/ThaID สำหรับ audit — เดาจาก claim ที่พบได้บ่อย */
export function pickTransactionRef(claims: Record<string, unknown>): string | undefined {
  for (const k of ['ndid_request_id', 'request_id', 'transaction_id', 'txn_id', 'jti']) {
    const v = s(claims[k]);
    if (v) return v.slice(0, 128);
  }
  return undefined;
}

export { s as claimStr };
