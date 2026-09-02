// ── ThaID KYC broker — config (อ่านจาก env เดียวกับทั้งแอป: server/env.ts) ──────
// ทุกอย่าง "ปิด" โดย default — ตั้ง VERIFY_ENABLED=true เท่านั้นถึงจะเปิด route
// ค่า ThaID OIDC (THAID_*) เว้นว่างได้จนกว่าจะได้ Relying Party credentials จาก DOPA

export interface ThaidOidcConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;   // ต้องตรงกับที่ลงทะเบียนไว้กับ DOPA เป๊ะ
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  jwksUrl: string;
  issuer: string;        // ค่า iss ที่คาดใน id_token — default = origin ของ authorizeUrl
  scopes: string;        // space-separated
  requiredIal: string;   // เช่น "2.3"
  tokenAuthMethod: 'basic' | 'post'; // client auth ที่ token endpoint (default basic)
  acrValues: string;     // ส่งเป็น acr_values ตอน authorize (ว่าง = ไม่ส่ง)
  clockSkewSeconds: number; // ผ่อนปรนเวลา exp/iat/nbf (default 60)
}

export interface VerifyConfig {
  enabled: boolean;
  driver: 'stub' | 'oidc';
  /** เฉพาะ driver=stub: จำลองผลว่า "ผ่าน" ทันทีที่ callback — ใช้ได้แค่ local/staging */
  stubAutoPass: boolean;

  /** shared secret สำหรับ HMAC ทั้งขาเข้า (Laravel→broker) และขาออก (broker→Laravel) */
  s2sSecret: string;
  /** AES-256-GCM key (32 bytes) เข้ารหัส match fields ตอนพักใน SQLite — hex(64) หรือ base64 */
  fieldKey: Buffer | null;
  /** HMAC pepper สำหรับ hash เลขบัตร 13 หลัก (ไม่เก็บ plaintext) */
  pidPepper: string;

  sessionTtlSeconds: number;
  /** base URL ของ broker เอง สำหรับประกอบ verifyUrl ที่ส่งกลับให้ Laravel */
  publicBase: string;
  /** ปลายทางที่ redirect ผู้สมัครกลับหลัง handoff (หน้า success ของ Laravel) — fixed, ไม่รับจาก query */
  doneRedirect: string;
  /** endpoint ฝั่ง Laravel ที่ broker จะ POST ผลไปให้ */
  laravelIngestUrl: string;

  /** IP ที่อนุญาตให้เรียก endpoint S2S (defense-in-depth — ตัวหลักคือ HMAC) */
  allowedS2sIps: string[];
  trustAllS2sIps: boolean; // testing เท่านั้น

  thaid: ThaidOidcConfig;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function parseKey(raw: string): Buffer | null {
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch { /* fallthrough */ }
  console.warn('[verify] VERIFY_FIELD_KEY ต้องเป็น hex 64 ตัว หรือ base64 ของ 32 bytes — ตอนนี้ถือว่าไม่ได้ตั้ง');
  return null;
}

export function loadVerifyConfig(env: Record<string, string>): VerifyConfig {
  const enabled = env.VERIFY_ENABLED === 'true';
  const driver = env.VERIFY_DRIVER === 'oidc' ? 'oidc' : 'stub';

  const cfg: VerifyConfig = {
    enabled,
    driver,
    stubAutoPass: env.VERIFY_STUB_AUTOPASS === 'true',
    s2sSecret: env.VERIFY_S2S_SECRET || '',
    fieldKey: parseKey(env.VERIFY_FIELD_KEY || ''),
    pidPepper: env.VERIFY_PID_PEPPER || '',
    sessionTtlSeconds: Math.max(60, Math.min(3600, Number(env.VERIFY_SESSION_TTL_SECONDS || 1800))),
    publicBase: (env.VERIFY_PUBLIC_BASE || '').replace(/\/+$/, ''),
    doneRedirect: env.VERIFY_DONE_REDIRECT || '',
    laravelIngestUrl: env.VERIFY_LARAVEL_INGEST_URL || '',
    allowedS2sIps: (env.VERIFY_ALLOWED_S2S_IPS || '127.0.0.1,::1')
      .split(',').map(s => s.trim()).filter(Boolean),
    trustAllS2sIps: env.VERIFY_S2S_TRUST_ALL_IPS === 'true',
    thaid: undefined as unknown as ThaidOidcConfig, // set ด้านล่าง
  } as VerifyConfig;

  const authorizeUrl = env.THAID_AUTHORIZE_URL || '';
  cfg.thaid = {
    clientId: env.THAID_CLIENT_ID || '',
    clientSecret: env.THAID_CLIENT_SECRET || '',
    redirectUri: env.THAID_REDIRECT_URI || '',
    authorizeUrl,
    tokenUrl: env.THAID_TOKEN_URL || '',
    userinfoUrl: env.THAID_USERINFO_URL || '',
    jwksUrl: env.THAID_JWKS_URL || '',
    issuer: env.THAID_ISSUER || originOf(authorizeUrl),
    scopes: env.THAID_SCOPES || 'pid name birthdate address',
    requiredIal: env.THAID_REQUIRED_IAL || '2.3',
    tokenAuthMethod: env.THAID_TOKEN_AUTH === 'post' ? 'post' : 'basic',
    acrValues: env.THAID_ACR_VALUES || '',
    clockSkewSeconds: Math.max(0, Math.min(300, Number(env.THAID_CLOCK_SKEW_SECONDS || 60))),
  };

  if (enabled) validateOnBoot(cfg);
  return cfg;
}

/** เตือน (ไม่ crash) ถ้าเปิดใช้งานแต่ config ยังไม่ครบ — ให้ deploy รู้ตัวเร็ว */
function validateOnBoot(cfg: VerifyConfig) {
  const miss: string[] = [];
  if (!cfg.s2sSecret || cfg.s2sSecret.length < 32) miss.push('VERIFY_S2S_SECRET (>=32 chars)');
  if (!cfg.fieldKey) miss.push('VERIFY_FIELD_KEY');
  if (!cfg.pidPepper || cfg.pidPepper.length < 16) miss.push('VERIFY_PID_PEPPER (>=16 chars)');
  if (!cfg.publicBase) miss.push('VERIFY_PUBLIC_BASE');
  if (!cfg.doneRedirect) miss.push('VERIFY_DONE_REDIRECT');
  if (!cfg.laravelIngestUrl) miss.push('VERIFY_LARAVEL_INGEST_URL');
  if (cfg.driver === 'oidc') {
    const t = cfg.thaid;
    for (const [k, v] of Object.entries({
      THAID_CLIENT_ID: t.clientId, THAID_CLIENT_SECRET: t.clientSecret,
      THAID_REDIRECT_URI: t.redirectUri, THAID_AUTHORIZE_URL: t.authorizeUrl,
      THAID_TOKEN_URL: t.tokenUrl, THAID_USERINFO_URL: t.userinfoUrl, THAID_JWKS_URL: t.jwksUrl,
    })) if (!v) miss.push(k);
    // issuer default = origin ของ authorizeUrl; เตือนเฉพาะเมื่อ derive ไม่ได้
    if (!t.issuer) miss.push('THAID_ISSUER (ตั้ง iss ที่คาดใน id_token — derive จาก THAID_AUTHORIZE_URL ไม่ได้)');
  }
  if (miss.length) {
    console.warn('[verify] VERIFY_ENABLED=true แต่ยังตั้งค่าไม่ครบ — ระบบยืนยันตัวตนจะทำงานไม่สมบูรณ์:\n  - ' + miss.join('\n  - '));
  }
}
