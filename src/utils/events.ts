import { EventItem } from '../types';

/** เที่ยงคืนของวันนี้ — กิจกรรมที่ startAt ก่อนหน้านี้ถือว่าผ่านไปแล้ว */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** ผ่าน publish window หรือยัง (published / publishAt / unpublishAt) */
export function isPublished(ev: EventItem, now = new Date()): boolean {
  if (ev.published === false) return false;
  if (ev.publishAt && new Date(ev.publishAt) > now) return false;
  if (ev.unpublishAt && new Date(ev.unpublishAt) < now) return false;
  return true;
}

/** กิจกรรมที่ยัง "มาไม่ถึง" — เผยแพร่อยู่ + (ไม่มี startAt หรือ startAt ยังไม่ผ่าน)
 *  เรียง: มีวันที่ก่อน (ใกล้สุดขึ้นก่อน) → ตามด้วยที่ยังรอกำหนดการ */
export function upcomingEvents(events: EventItem[]): EventItem[] {
  const today = startOfToday();
  return events
    .filter(ev => isPublished(ev) && (!ev.startAt || new Date(ev.startAt).getTime() >= today))
    .sort((a, b) => {
      const ta = a.startAt ? new Date(a.startAt).getTime() : Infinity;
      const tb = b.startAt ? new Date(b.startAt).getTime() : Infinity;
      return ta - tb;
    });
}

/** กิจกรรมที่ผ่านมาแล้ว — เผยแพร่อยู่ + startAt ผ่านไปแล้ว เรียงล่าสุดก่อน */
export function pastEvents(events: EventItem[]): EventItem[] {
  const today = startOfToday();
  return events
    .filter(ev => isPublished(ev) && ev.startAt && new Date(ev.startAt).getTime() < today)
    .sort((a, b) => new Date(b.startAt!).getTime() - new Date(a.startAt!).getTime());
}

/** แยก date string เป็น 2 บรรทัดสำหรับ badge (เช่น "22 ส.ค." → ["22","ส.ค."]) */
export function dateBadgeParts(dateStr: string): [string, string] {
  const parts = (dateStr || '').trim().split(/\s+/);
  return [parts[0] || '', (parts[1] || '').replace(',', '')];
}
