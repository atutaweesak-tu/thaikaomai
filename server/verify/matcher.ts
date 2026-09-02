// ── ThaID KYC broker — เทียบ claims จาก IdP กับข้อมูลที่ผู้สมัครกรอก ─────────────
// ใช้ตอน callback: เอา verified profile จาก ThaID มาเทียบ field ต่อ field
// เกณฑ์ "match" ตั้งแบบผ่อนปรนพอประมาณ (trim + ตัดช่องว่างซ้อน) เพราะระบบต้นทาง
// สะกดเว้นวรรคไม่เหมือนกัน — แต่ "ชื่อ/สกุล/เลขบัตร/วันเกิด" ยังต้องตรงตัวอักษร
import type { MatchFields, RegisteredAddress, KycMatchFlags } from './types';

export interface VerifiedProfile {
  citizenId: string;
  firstNameTh: string;
  middleNameTh?: string;
  lastNameTh: string;
  birthDate: string; // YYYY-MM-DD (ค.ศ.)
  isThaiNational: boolean;
  address?: RegisteredAddress;
  /**
   * รหัสภูมิศาสตร์มาตรฐาน (TIS-1099) ถ้า IdP ส่งมาด้วย — ถ้ามี ฝั่ง api ข้ามขั้น
   * resolve ชื่อ→id ได้เลย (ดู server/verify/README.md ข้อ "resolve-address")
   */
  geocode?: {
    provinceCode?: string;    // 2 หลัก
    districtCode?: string;     // 4 หลัก
    subDistrictCode?: string;  // 6 หลัก
  };
}

const norm = (s?: string): string =>
  (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

const digits = (s?: string): string => (s ?? '').replace(/\D/g, '');

function nameMatches(a: MatchFields, b: VerifiedProfile): boolean {
  return (
    norm(a.firstNameTh) === norm(b.firstNameTh) &&
    norm(a.lastNameTh) === norm(b.lastNameTh) &&
    norm(a.middleNameTh) === norm(b.middleNameTh)
  );
}

function addressMatches(a?: RegisteredAddress, b?: RegisteredAddress): boolean {
  // ที่อยู่ไม่ได้ถูกร้องขอมาเทียบ → ถือว่า "ไม่ขัด" (true) ให้ flag อื่นเป็นตัวตัดสิน
  if (!a || !b) return true;
  const keys: (keyof RegisteredAddress)[] = [
    'houseNo', 'moo', 'soi', 'road', 'subDistrict', 'district', 'province', 'postalCode',
  ];
  // เทียบเฉพาะ field ที่ผู้สมัครกรอกมา (a มีค่า) — ที่เหลือปล่อยผ่าน
  return keys.every(k => !norm(a[k]) || norm(a[k]) === norm(b[k]));
}

export function computeFlags(applicant: MatchFields, verified: VerifiedProfile): KycMatchFlags {
  return {
    isThaiNational: verified.isThaiNational === true,
    nameMatch: nameMatches(applicant, verified),
    birthDateMatch: !!applicant.birthDate && applicant.birthDate === verified.birthDate,
    addressMatch: addressMatches(applicant.address, verified.address),
  };
}

/** เลขบัตรที่ผู้สมัครกรอก ต้องตรงกับเลขบัตรของเจ้าของตัวตนที่ยืนยัน — เงื่อนไขบังคับเสมอ */
export function citizenIdMatches(applicant: MatchFields, verified: VerifiedProfile): boolean {
  const x = digits(applicant.citizenId);
  return x.length === 13 && x === digits(verified.citizenId);
}

/** ผ่านโดยรวม: เลขบัตรตรง + เป็นคนไทย + ชื่อ-สกุล ตรง + วันเกิดตรง (ที่อยู่เป็น advisory) */
export function isOverallPass(flags: KycMatchFlags, citizenIdOk: boolean): boolean {
  return citizenIdOk && flags.isThaiNational && flags.nameMatch && flags.birthDateMatch;
}
