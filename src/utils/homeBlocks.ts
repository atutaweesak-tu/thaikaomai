import { HomeBlockType, PageBlock } from '../types';

/** ส่วนย่อยของหน้าแรกที่ admin เปิด/ปิด และย้ายตำแหน่งได้ทีละส่วน (แท็บ "หน้าแรก") */
export const SECTION_TYPES = [
  'heroMain', 'quickDiscovery', 'policyUniverse', 'policyHub', 'team', 'newsroom', 'videos', 'instagram',
  'activities', 'poll', 'guide', 'join',
] as const satisfies readonly HomeBlockType[];

/** บล็อกแบบเดิมที่รวมหลายส่วนไว้ในแถวเดียว (ข้อมูลก่อนแยกส่วน) — ยังแสดงผลได้ตามเดิม */
export const LEGACY_EXPANSION: Partial<Record<HomeBlockType, HomeBlockType[]>> = {
  hero: ['heroMain', 'quickDiscovery'],
  policies: ['policyUniverse', 'policyHub'],
  news: ['newsroom', 'videos', 'activities'],
  cta: ['guide', 'join'],
};

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  heroMain: 'Hero (แบนเนอร์หลัก)',
  quickDiscovery: 'ทางลัด "ค้นหาสิ่งที่สนใจ"',
  policyUniverse: 'นโยบาย — ธนู 4 ดอก',
  policyHub: 'นโยบาย — ค้นหา/รายการนโยบาย',
  team: 'ทีมพรรค',
  newsroom: 'ข่าวสาร',
  videos: 'คลิป YouTube / Shorts',
  instagram: 'Instagram (โพสต์ & Reels)',
  activities: 'แผนที่กิจกรรม',
  poll: 'โพลความคิดเห็น',
  guide: 'ผู้ช่วยค้นหา (น้องเลม่อน)',
  join: 'ชวนสมัครสมาชิก (CTA)',
  promo: 'แบนเนอร์โปรโมท',
  // แบบเดิม (รวมหลายส่วน)
  hero: 'Hero + ทางลัด (แบบเดิม รวม 2 ส่วน)',
  policies: 'นโยบาย (แบบเดิม รวม 2 ส่วน)',
  news: 'ข่าวสาร & กิจกรรม (แบบเดิม รวม 3 ส่วน)',
  cta: 'ผู้ช่วยค้นหา + สมัครสมาชิก (แบบเดิม รวม 2 ส่วน)',
};

/** ลำดับเริ่มต้นแบบแยกส่วน — ตรงกับหน้าตาปัจจุบัน (โพลอยู่ก่อนผู้ช่วยค้นหา, Instagram ต่อจาก YouTube) */
export const DEFAULT_SECTION_BLOCKS: PageBlock[] = SECTION_TYPES.map((type, order) => ({ id: `default_${type}`, type, order, published: true }));

export const isLegacyLayout = (blocks: PageBlock[]) => !blocks.some(b => (SECTION_TYPES as readonly string[]).includes(b.type));

/** แผนแปลงข้อมูลลำดับแบบเดิม → แยกส่วน โดย "หน้าตาเหมือนเดิมทุกอย่าง":
 *  บล็อกรวมแตกเป็นส่วนย่อยตรงตำแหน่งเดิม (คงสถานะซ่อน/ตั้งเวลาของบล็อกเดิม) · โพลเดิมแสดงอัตโนมัติก่อน cta → ใส่ไว้ตรงนั้น
 *  ส่วนที่เดิมไม่มี (เช่น Instagram ที่ยังไม่เพิ่ม, ทีมพรรคที่ถูกลบ) → เพิ่มท้ายสุดแบบ "ซ่อน" ให้ admin เปิดเอง
 *  คืน: rows = ลำดับใหม่ทั้งหมด (keep = บล็อกเดิมที่คงไว้ / add = บล็อกใหม่), remove = id บล็อกรวมที่ต้องลบ */
export function planSectionSplit(blocks: PageBlock[]) {
  const sorted = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows: ({ kind: 'keep'; block: PageBlock } | { kind: 'add'; block: Omit<PageBlock, 'id'> })[] = [];
  const present = new Set<string>();
  const remove: string[] = [];
  const pick = (b: PageBlock) => ({ published: b.published !== false, ...(b.publishAt ? { publishAt: b.publishAt } : {}), ...(b.unpublishAt ? { unpublishAt: b.unpublishAt } : {}) });
  const hasCta = sorted.some(b => b.type === 'cta');
  const consumed = new Set<string>();
  sorted.forEach((b, i) => {
    if (consumed.has(b.id)) return;
    const parts = LEGACY_EXPANSION[b.type];
    if (!parts) { rows.push({ kind: 'keep', block: b }); present.add(b.type); return; }
    remove.push(b.id);
    // บล็อก Instagram ที่อยู่ถัดจาก "ข่าวสาร" พอดี เดิมแสดงระหว่าง YouTube กับแผนที่กิจกรรม → คงตำแหน่งนั้น
    const igNext = b.type === 'news' && sorted[i + 1]?.type === 'instagram' ? sorted[i + 1] : null;
    // โพลเดิม: แทรกอัตโนมัติก่อน cta เสมอ (ไม่ขึ้นกับสถานะของ cta)
    if (b.type === 'cta' && !present.has('poll')) { rows.push({ kind: 'add', block: { type: 'poll', order: 0, published: true } }); present.add('poll'); }
    for (const t of parts) {
      if (t === 'activities' && igNext) { rows.push({ kind: 'keep', block: igNext }); present.add('instagram'); consumed.add(igNext.id); }
      if (present.has(t)) continue;
      rows.push({ kind: 'add', block: { type: t, order: 0, ...pick(b) } });
      present.add(t);
    }
  });
  if (!hasCta && !present.has('poll')) { rows.push({ kind: 'add', block: { type: 'poll', order: 0, published: true } }); present.add('poll'); } // เดิมต่อท้ายสุด
  for (const t of SECTION_TYPES) if (!present.has(t)) rows.push({ kind: 'add', block: { type: t, order: 0, published: false } });
  return { rows: rows.map((r, order) => ({ ...r, order })), remove };
}
