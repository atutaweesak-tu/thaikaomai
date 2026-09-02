// ─────────────────────────────────────────────────────────────────────────────
// ก้อน C — SPA prefill flow (client)
//
// สำหรับ registration SPA (`/opt/thaikaomai/web`, React/Vite/Mantine — คนละ repo)
// ก๊อปไฟล์นี้ไปวางในโปรเจกต์ web แล้ว import ใช้ในหน้า register
// ไม่มี dependency (ไม่ import react) — ผูกกับฟอร์ม/Mantine ที่ฝั่ง SPA เอง
// ตัวอย่าง hook + ปุ่ม React อยู่ท้าย server/verify/README.md หัวข้อ "ก้อน C"
//
// flow (prefill / verify-first / "แบบ B"):
//   1. ผู้ใช้กรอกเลขบัตร 13 หลัก → กดปุ่ม "ยืนยันด้วย ThaID"
//      → startThaidVerify({ citizenId }) → window.location = verifyUrl
//   2. ThaID เสร็จ → redirect กลับหน้า register ด้วย ?vs=<sid>&kyc=verified&ref=<sid>
//   3. onload: readVerifyReturn() → ถ้า kyc==='verified' && vs → consumePrefill(vs)
//      → toRegisterFormPrefill(profile) → setValues + ล็อกช่อง (readOnly)
//      → เก็บ sid (rememberVerifiedSid) + clearVerifyReturnParams() (กัน refresh ยิงซ้ำ → 410)
//   4. ตอน submit: แนบ sid ไปด้วย → api สร้าง register_log แล้ว
//      UPDATE register_verification SET register_log_id=? WHERE sid=?
// ─────────────────────────────────────────────────────────────────────────────

// ตรงกับ VerifiedProfile ฝั่ง broker (server/verify/matcher.ts) + api (verify-api-routes.ts)
export interface VerifiedProfile {
  citizenId: string;
  firstNameTh: string;
  middleNameTh?: string;
  lastNameTh: string;
  birthDate: string; // YYYY-MM-DD (ค.ศ. / Gregorian)
  isThaiNational: boolean;
  address?: {
    houseNo?: string; moo?: string; soi?: string; road?: string;
    subDistrict?: string; district?: string; province?: string; postalCode?: string;
  };
  geocode?: { provinceCode?: string; districtCode?: string; subDistrictCode?: string };
}

export interface VerifyReturn {
  /** sid จาก ?vs= — ใช้เรียก consumePrefill และแนบตอน submit */
  sid: string | null;
  kyc: 'verified' | 'failed' | 'pending' | null;
  ref: string | null;
}

/** ชุด field ที่เมื่อ prefill สำเร็จต้อง set ค่า + readOnly (ThaID เป็น authoritative) */
export const LOCKED_FIELD_KEYS = [
  'citizenId', 'firstNameTh', 'middleNameTh', 'lastNameTh', 'birthDate',
  'addrHouseNo', 'addrMoo', 'addrSoi', 'addrRoad',
  'addrSubDistrict', 'addrDistrict', 'addrProvince', 'addrPostalCode',
] as const;

export type LockedFieldKey = (typeof LOCKED_FIELD_KEYS)[number];

/** flatten VerifiedProfile → ค่าที่ยัดเข้าฟอร์ม register ได้ตรง ๆ (ADAPT: ปรับชื่อ key ให้ตรงฟอร์มจริง) */
export interface RegisterFormPrefill {
  citizenId: string;
  firstNameTh: string;
  middleNameTh: string;
  lastNameTh: string;
  birthDate: string;        // YYYY-MM-DD (ค.ศ.) — ADAPT: แปลงเป็น พ.ศ./Date ตามที่ฟอร์มใช้
  addrHouseNo: string;
  addrMoo: string;
  addrSoi: string;
  addrRoad: string;
  addrSubDistrict: string;
  addrDistrict: string;
  addrProvince: string;
  addrPostalCode: string;
  /** รหัส TIS-1099 ถ้า IdP ส่งมา — ใช้เลือก dropdown จังหวัด/อำเภอ/ตำบลได้เลย ไม่ต้อง resolve ชื่อ→id */
  geocode: { provinceCode?: string; districtCode?: string; subDistrictCode?: string } | null;
}

export type PrefillErrorCode = 'gone' | 'network' | 'bad_response' | 'not_configured';

export class PrefillError extends Error {
  constructor(public code: PrefillErrorCode, message: string, public status?: number) {
    super(message);
    this.name = 'PrefillError';
  }
}

const VS_PARAM = 'vs';
const KYC_PARAM = 'kyc';
const REF_PARAM = 'ref';
const SID_STORE_KEY = 'thaid_verify_sid';

function joinUrl(base: string, path: string): string {
  return `${(base || '').replace(/\/+$/, '')}${path}`;
}

// ── (1) เริ่มยืนยัน ─────────────────────────────────────────────────────────
export interface StartInput {
  citizenId: string;
  /** default 'prefill' (verify-first). 'match' = มี register_log แล้ว ต้องส่ง applicationRef + matchFields ครบ */
  mode?: 'prefill' | 'match';
  applicationRef?: string;
  /** เพิ่ม field อื่นเข้า matchFields (mode='match') */
  matchFields?: Record<string, unknown>;
  /** base ของ api — default '' (same origin) */
  apiBase?: string;
}

export interface StartResult {
  sid: string;
  verifyUrl: string;
  expiresAt: number;
}

/** POST /api/verify/start → คืน verifyUrl (ผู้เรียกทำ window.location.assign(verifyUrl) ต่อ) */
export async function startThaidVerify(input: StartInput): Promise<StartResult> {
  const citizenId = String(input.citizenId || '').replace(/\D/g, '');
  const mode = input.mode === 'match' ? 'match' : 'prefill';
  if (mode === 'prefill' && citizenId.length !== 13) {
    throw new PrefillError('bad_response', 'ต้องกรอกเลขบัตรประชาชน 13 หลักก่อนเริ่มยืนยัน');
  }
  const body = JSON.stringify({
    mode,
    applicationRef: input.applicationRef,
    matchFields: { citizenId, ...(input.matchFields || {}) },
  });

  let res: Response;
  try {
    res = await fetch(joinUrl(input.apiBase || '', '/api/verify/start'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      credentials: 'same-origin',
    });
  } catch (e) {
    throw new PrefillError('network', `เชื่อมต่อระบบยืนยันตัวตนไม่ได้: ${(e as Error).message}`);
  }
  if (res.status === 503) throw new PrefillError('not_configured', 'ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน', 503);
  if (!res.ok) throw new PrefillError('bad_response', `เปิดคำขอยืนยันไม่สำเร็จ (${res.status})`, res.status);

  const data = (await res.json().catch(() => null)) as StartResult | null;
  if (!data || typeof data.verifyUrl !== 'string' || !data.sid) {
    throw new PrefillError('bad_response', 'ผลลัพธ์จากระบบยืนยันไม่ถูกต้อง');
  }
  return data;
}

// ── (2)(3) อ่านผลตอน redirect กลับ ─────────────────────────────────────────
export function readVerifyReturn(search?: string): VerifyReturn {
  const raw =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const q = new URLSearchParams(raw);
  const kycRaw = q.get(KYC_PARAM);
  const kyc =
    kycRaw === 'verified' || kycRaw === 'failed' || kycRaw === 'pending' ? kycRaw : null;
  return { sid: q.get(VS_PARAM), kyc, ref: q.get(REF_PARAM) };
}

/** ลบ ?vs=&kyc=&ref= ออกจาก URL (history.replaceState) — refresh แล้วจะได้ไม่ยิง consume ซ้ำ → 410 */
export function clearVerifyReturnParams(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const p of [VS_PARAM, KYC_PARAM, REF_PARAM]) {
    if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
  }
  if (changed) window.history.replaceState(window.history.state, '', url.toString());
}

// ── (3) ดึง profile มาเติมฟอร์ม (single-use) ───────────────────────────────
export interface ConsumeResult {
  sid: string;
  profile: VerifiedProfile;
}

/**
 * GET /api/verify/prefill?vs=<sid> — เรียกได้ครั้งเดียวต่อ sid
 * โยน PrefillError('gone') ถ้า sid ถูกใช้ไปแล้ว / หมดอายุ / ไม่มี
 */
export async function consumePrefill(
  sid: string,
  opts?: { apiBase?: string },
): Promise<ConsumeResult> {
  if (!sid) throw new PrefillError('bad_response', 'ไม่มีรหัสอ้างอิงการยืนยัน (sid)');
  let res: Response;
  try {
    res = await fetch(
      joinUrl(opts?.apiBase || '', `/api/verify/prefill?vs=${encodeURIComponent(sid)}`),
      { headers: { accept: 'application/json' }, credentials: 'same-origin' },
    );
  } catch (e) {
    throw new PrefillError('network', `ดึงข้อมูลที่ยืนยันแล้วไม่ได้: ${(e as Error).message}`);
  }
  if (res.status === 410) {
    throw new PrefillError('gone', 'ลิงก์ยืนยันถูกใช้ไปแล้วหรือหมดอายุ กรุณาเริ่มยืนยันใหม่', 410);
  }
  if (res.status === 503) {
    throw new PrefillError('not_configured', 'ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน', 503);
  }
  if (!res.ok) {
    throw new PrefillError('bad_response', `ดึงข้อมูลไม่สำเร็จ (${res.status})`, res.status);
  }
  const data = (await res.json().catch(() => null)) as ConsumeResult | null;
  if (!data || !data.profile || typeof data.profile.citizenId !== 'string') {
    throw new PrefillError('bad_response', 'ข้อมูลที่ยืนยันแล้วไม่ถูกต้อง');
  }
  return data;
}

// ── (3) flatten → ค่าฟอร์ม ────────────────────────────────────────────────
export function toRegisterFormPrefill(p: VerifiedProfile): RegisterFormPrefill {
  const a = p.address || {};
  const g = p.geocode || {};
  return {
    citizenId: String(p.citizenId || '').replace(/\D/g, ''),
    firstNameTh: p.firstNameTh || '',
    middleNameTh: p.middleNameTh || '',
    lastNameTh: p.lastNameTh || '',
    birthDate: p.birthDate || '',
    addrHouseNo: a.houseNo || '',
    addrMoo: a.moo || '',
    addrSoi: a.soi || '',
    addrRoad: a.road || '',
    addrSubDistrict: a.subDistrict || '',
    addrDistrict: a.district || '',
    addrProvince: a.province || '',
    addrPostalCode: a.postalCode || '',
    geocode:
      g.provinceCode || g.districtCode || g.subDistrictCode
        ? { provinceCode: g.provinceCode, districtCode: g.districtCode, subDistrictCode: g.subDistrictCode }
        : null,
  };
}

// ── (4) sid ข้ามรอบ redirect → แนบตอน submit ──────────────────────────────
export function rememberVerifiedSid(sid: string): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(SID_STORE_KEY, sid);
  } catch { /* private mode / disabled — เรียก getVerifiedSid จะคืน null */ }
}

export function getVerifiedSid(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SID_STORE_KEY) : null;
  } catch {
    return null;
  }
}

export function clearVerifiedSid(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(SID_STORE_KEY);
  } catch { /* noop */ }
}

// ── utils ────────────────────────────────────────────────────────────────────

/** checksum เลขบัตรประชาชนไทย 13 หลัก — ใช้ gate ปุ่มก่อนเรียก startThaidVerify */
export function isValidThaiCitizenId(input: string): boolean {
  const id = String(input || '').replace(/\D/g, '');
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** YYYY-MM-DD (ค.ศ.) → { day, month, yearBE } สำหรับฟอร์มที่ใช้ พ.ศ. */
export function toThaiDateParts(iso: string): { day: number; month: number; yearBE: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return { yearBE: Number(m[1]) + 543, month: Number(m[2]), day: Number(m[3]) };
}
