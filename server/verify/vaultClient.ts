// ── HashiCorp Vault client — ดึง VERIFY_FIELD_KEY / VERIFY_S2S_SECRET / VERIFY_PID_PEPPER ──
// จาก Vault (KV v2) แทนการเก็บเป็น plaintext ถาวรใน .env (GO-LIVE.md ข้อ 2, DPIA.md R9)
//
// เปิดใช้เมื่อตั้ง VAULT_ADDR ใน .env — ไม่ตั้งไว้ (local/dev/test) จะข้ามไปใช้ค่าจาก .env
// ตรงๆ ตามเดิมทุกอย่าง ไม่กระทบ workflow เดิม (ดู server/index.ts จุดที่เรียกไฟล์นี้)
//
// วิธี auth: AppRole (role_id + secret_id) → login ได้ client token อายุสั้น → อ่าน secret
// ครั้งเดียวตอน boot แล้วปิดทิ้ง ไม่ cache token ไว้ยาว — ถ้า process restart ก็ login ใหม่
// ดู server/verify/integration/vault/ สำหรับสคริปต์ตั้งค่า Vault + AppRole + policy

export interface VaultSecretsConfig {
  /** เช่น http://vault:8200 — ปกติเป็น service name ภายใน docker network เดียวกัน (thaikaomai_appnet) */
  addr: string;
  roleId: string;
  secretId: string;
  /** KV v2 path พร้อม /data/ แทรก เช่น secret/data/thaikaomai/verify */
  path: string;
  /** timeout กัน boot ค้างถ้า Vault ไม่ตอบ (ms) */
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Login ด้วย AppRole แล้วอ่าน secret จาก Vault คืนเป็น { KEY: value } ธรรมดา
 * — โยน Error เสมอถ้าล้มเหลวจุดใดจุดหนึ่ง (fail closed: ห้ามให้ระบบ boot ต่อด้วย
 *   secret ที่ดึงไม่สำเร็จ/ว่างเปล่า เพราะเท่ากับปิดการเข้ารหัสโดยไม่มีใครรู้)
 */
export async function fetchVaultSecrets(cfg: VaultSecretsConfig): Promise<Record<string, string>> {
  const addr = cfg.addr.replace(/\/+$/, '');
  const timeoutMs = cfg.timeoutMs ?? 5000;

  if (!cfg.roleId || !cfg.secretId) {
    throw new Error('VAULT_ROLE_ID / VAULT_SECRET_ID ไม่ได้ตั้ง');
  }

  const loginRes = await fetchWithTimeout(`${addr}/v1/auth/approle/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role_id: cfg.roleId, secret_id: cfg.secretId }),
  }, timeoutMs);
  if (!loginRes.ok) {
    throw new Error(`vault approle login failed: HTTP ${loginRes.status}`);
  }
  const loginJson = (await loginRes.json()) as { auth?: { client_token?: string } };
  const token = loginJson?.auth?.client_token;
  if (!token) {
    throw new Error('vault approle login: ไม่มี auth.client_token ใน response');
  }

  const secretRes = await fetchWithTimeout(`${addr}/v1/${cfg.path.replace(/^\/+/, '')}`, {
    headers: { 'X-Vault-Token': token },
  }, timeoutMs);
  if (!secretRes.ok) {
    throw new Error(`vault read secret failed (${cfg.path}): HTTP ${secretRes.status}`);
  }
  const secretJson = (await secretRes.json()) as { data?: { data?: unknown } };
  const data = secretJson?.data?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`vault read secret (${cfg.path}): รูปแบบ response ไม่ตรง (คาด KV v2 data.data object)`);
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
