// ── ThaID KYC broker — shared types ───────────────────────────────────────────
// โมดูลนี้ "ยืนยันตัวตนอย่างเดียว" ไม่เก็บข้อมูลผู้สมัคร: รับ fields ที่จะเทียบจาก
// ระบบสมัคร (Laravel) ผ่าน S2S → พาผู้สมัครไปยืนยันกับ ThaID → เทียบผล → ส่ง flag
// กลับ Laravel → ลบทิ้ง ดู server/verify/README.md สำหรับภาพรวม + สัญญาฝั่ง Laravel

/** ที่อยู่ตามทะเบียนบ้าน (ชุดที่ ThaID/DOPA ส่งกลับมาให้เทียบได้) */
export interface RegisteredAddress {
  houseNo?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subDistrict?: string; // ตำบล/แขวง
  district?: string;     // อำเภอ/เขต
  province?: string;
  postalCode?: string;
}

/**
 * ข้อมูลที่ Laravel ส่งมาให้ broker "เทียบ" กับผลจาก ThaID เท่านั้น
 * broker ไม่เก็บถาวร — เข้ารหัส (AES-256-GCM) พักไว้ใน verify_sessions จนกว่าจะ callback เสร็จ แล้วลบ
 */
export interface MatchFields {
  citizenId: string;       // เลขบัตร 13 หลัก (ตัวเลขล้วน)
  firstNameTh: string;
  middleNameTh?: string;
  lastNameTh: string;
  birthDate: string;       // ISO 8601 (ค.ศ.) YYYY-MM-DD
  address?: RegisteredAddress;
}

export interface KycMatchFlags {
  isThaiNational: boolean;
  nameMatch: boolean;
  birthDateMatch: boolean;
  addressMatch: boolean;
}

export interface KycResult {
  /** ผ่านโดยรวม = เป็นคนไทย และ field ที่บังคับ match ครบ */
  ok: boolean;
  flags: KycMatchFlags;
  ial?: string;                 // Identity Assurance Level ที่ได้จาก IdP
  provider: 'stub' | 'thaid-oidc';
  failureReason?: string;
}

export type VerifyStatus =
  | 'created'    // Laravel เปิด session แล้ว ผู้สมัครยังไม่เริ่ม
  | 'pending'    // ผู้สมัครเริ่มขั้นตอนแล้ว (ถูก redirect ไป IdP / รอ stub)
  | 'verifying'  // callback กลับมาแล้ว กำลังประมวลผล (guard กันใช้ซ้ำ)
  | 'verified'   // เสร็จ ผ่าน
  | 'failed'     // เสร็จ ไม่ผ่าน / ผู้สมัครยกเลิก
  | 'consumed'   // ส่งผลกลับ Laravel แล้ว + ลบ match fields แล้ว
  | 'expired';   // หมดอายุก่อนใช้

export interface VerifySessionRow {
  sid: string;
  application_ref: string;
  status: VerifyStatus;
  match_fields_enc: string | null;
  oidc_state: string | null;
  oidc_nonce: string | null;
  pkce_verifier: string | null;
  result_json: string | null;
  attempts: number;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
}
