import { EventItem } from '../types';
import { eventStatus, eventSortKey } from './bangkokTime';

/** ผ่าน publish window หรือยัง (published / publishAt / unpublishAt) */
export function isPublished(ev: EventItem, now = new Date()): boolean {
  if (ev.published === false) return false;
  if (ev.publishAt && new Date(ev.publishAt) > now) return false;
  if (ev.unpublishAt && new Date(ev.unpublishAt) < now) return false;
  return true;
}

/** กิจกรรมที่ยัง "มาไม่ถึง" (กำลังจะมาถึง / กำลังจัด / รอกำหนดการ) — เผยแพร่อยู่ และสถานะไม่ใช่ past
 *  สถานะคิดตามเวลาไทยด้วย eventStatus (startAt ก่อน แล้ววันจากข้อความที่มีปีชัดเจน) — เดิมกิจกรรมไม่มี startAt
 *  ถูกนับเป็น "ที่จะถึง" เสมอ แม้ข้อความวันที่จะผ่านมาแล้ว (เช่น "25 ส.ค. 2569")
 *  เรียง: รู้วันก่อน (ใกล้สุดขึ้นก่อน) → ตามด้วยที่ยังรอกำหนดการ */
export function upcomingEvents(events: EventItem[]): EventItem[] {
  const now = new Date();
  return events
    .filter(ev => isPublished(ev, now) && eventStatus(ev, now) !== 'past')
    .sort((a, b) => (eventSortKey(a) || '9999').localeCompare(eventSortKey(b) || '9999'));
}

/** กิจกรรมที่ผ่านมาแล้ว — เผยแพร่อยู่ + สถานะ past เรียงล่าสุดก่อน */
export function pastEvents(events: EventItem[]): EventItem[] {
  const now = new Date();
  return events
    .filter(ev => isPublished(ev, now) && eventStatus(ev, now) === 'past')
    .sort((a, b) => eventSortKey(b).localeCompare(eventSortKey(a)));
}

/** แยก date string เป็น 2 บรรทัดสำหรับ badge (เช่น "22 ส.ค." → ["22","ส.ค."]) */
export function dateBadgeParts(dateStr: string): [string, string] {
  const parts = (dateStr || '').trim().split(/\s+/);
  return [parts[0] || '', (parts[1] || '').replace(',', '')];
}
