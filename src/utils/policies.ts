import { Policy } from '../types';

/** ผ่าน publish window หรือยัง — logic เดียวกับที่ PoliciesSection/PoliciesPage ใช้อยู่ */
export function isPolicyVisible(p: Policy, now = new Date()): boolean {
  if (p.published === false) return false;
  if (p.publishAt && new Date(p.publishAt) > now) return false;
  if (p.unpublishAt && new Date(p.unpublishAt) < now) return false;
  return true;
}

export function visiblePolicies(policies: Policy[]): Policy[] {
  const now = new Date();
  return [...policies].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).filter(p => isPolicyVisible(p, now));
}

export type PolicyGroup = { header: Policy; items: Policy[] };

/** ธนูดอกใหญ่ (featuredHome) เป็นหัวกลุ่ม ส่วนนโยบายที่ตามมาจนถึงดอกถัดไปคือนโยบายย่อยของดอกนั้น
 *  — ข้อมูลไม่มีฟิลด์ parent จึงอิงลำดับ (order) แบบเดียวกับหน้า /policies */
export function groupPolicies(sorted: Policy[]): PolicyGroup[] {
  const groups: PolicyGroup[] = [];
  for (const policy of sorted) {
    if (policy.featuredHome || groups.length === 0) groups.push({ header: policy, items: [] });
    else groups[groups.length - 1].items.push(policy);
  }
  return groups;
}

/** "ธนูดอกที่ 1 — สร้างคนใหม่ พลิกโฉมการศึกษา" → { label: "ธนูดอกที่ 1", name: "สร้างคนใหม่ พลิกโฉมการศึกษา" } */
export function splitPillarTitle(title: string): { label: string; name: string } {
  const m = title.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  return m ? { label: m[1].trim(), name: m[2].trim() } : { label: '', name: title };
}

/** ทำให้ข้อความค้นหาเทียบกันได้: ตัด zero-width, NFC, ตัวเล็ก, ช่องว่างซ้ำ */
export function normalizeThai(s: string): string {
  return s.normalize('NFC').replace(/[​-‍﻿]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** ภาษาไทยไม่เว้นวรรคระหว่างคำ — จับแบบ substring ทุกคำที่ผู้ใช้พิมพ์ (คั่นด้วยช่องว่าง) ต้องเจอครบ */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeThai(query);
  if (!q) return true;
  const h = normalizeThai(haystack);
  return q.split(' ').every(term => h.includes(term));
}
