import { EventItem } from '../types';

const TZ = 'Asia/Bangkok';

/** วันที่ตามเวลาไทย (YYYY-MM-DD) — ไม่ขึ้นกับ timezone ของเครื่องผู้ชม */
export function bangkokDateKey(d: Date): string {
  // en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export type EventStatus = 'upcoming' | 'ongoing' | 'past' | 'tba';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  upcoming: 'กำลังจะมาถึง',
  ongoing: 'กำลังจัดอยู่',
  past: 'ผ่านไปแล้ว',
  tba: 'รอกำหนดการ',
};

const THAI_MONTHS: [RegExp, number][] = [
  [/มกราคม|ม\.ค\./, 1], [/กุมภาพันธ์|ก\.พ\./, 2], [/มีนาคม|มี\.ค\./, 3], [/เมษายน|เม\.ย\./, 4],
  [/พฤษภาคม|พ\.ค\./, 5], [/มิถุนายน|มิ\.ย\./, 6], [/กรกฎาคม|ก\.ค\./, 7], [/สิงหาคม|ส\.ค\./, 8],
  [/กันยายน|ก\.ย\./, 9], [/ตุลาคม|ต\.ค\./, 10], [/พฤศจิกายน|พ\.ย\./, 11], [/ธันวาคม|ธ\.ค\./, 12],
];
const pad = (n: number) => String(n).padStart(2, '0');

/** อ่านช่วงวันจากข้อความวันที่ที่ admin พิมพ์เอง เช่น "22 ส.ค. 69", "25 ส.ค. 2569", "22–23 ส.ค. 2569", "เมษายน 2569"
 *  คืน { start, end } เป็น YYYY-MM-DD (ค.ศ.) หรือ null ถ้าไม่ชัดเจน — **ต้องมีปีเสมอ** ("22 ส.ค." เฉยๆ ไม่เดาปี)
 *  ปี: 4 หลัก > 2400 = พ.ศ. (−543), 4 หลักอื่น = ค.ศ., 2 หลัก = พ.ศ. ย่อ (69 → 2569) */
export function parseThaiDateText(text: string | undefined): { start: string; end: string } | null {
  if (!text) return null;
  const m = THAI_MONTHS.find(([re]) => re.test(text));
  if (!m) return null;
  const month = m[1];
  const after = text.slice(text.search(m[0]) + (text.match(m[0])?.[0].length ?? 0));
  const before = text.slice(0, text.search(m[0]));
  const yearMatch = after.match(/(\d{4}|\d{2})(?!\d)/);
  if (!yearMatch) return null;
  let year = Number(yearMatch[1]);
  if (yearMatch[1].length === 2) year += 2500;
  if (year > 2400) year -= 543;
  if (year < 2000 || year > 2100) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = (before.match(/\d{1,2}/g) || []).map(Number).filter(d => d >= 1 && d <= lastDay);
  const startDay = days.length ? days[0] : 1;
  const endDay = days.length ? days[days.length - 1] : lastDay;
  return { start: `${year}-${pad(month)}-${pad(startDay)}`, end: `${year}-${pad(month)}-${pad(endDay)}` };
}

/** จัดสถานะกิจกรรมตามวันที่ไทย
 *  1) มี startAt (admin ตั้งวันเวลาจริง) → ใช้ค่านี้ก่อนเสมอ: วันเดียวกับวันนี้ = ongoing (ไม่มีเวลาสิ้นสุด จึงถือทั้งวัน)
 *  2) ไม่มี startAt → อ่านจากข้อความ date ถ้ามีปีชัดเจน: จบก่อนวันนี้ = past, เริ่มหลังวันนี้ = upcoming,
 *     คร่อมวันนี้ = ongoing เฉพาะกรณีระบุวัน (ระบุแค่เดือนที่กำลังเป็นอยู่ = ยังไม่รู้วัน → tba)
 *  3) อ่านไม่ได้ → tba (รอกำหนดการ) — ไม่แก้/เติมข้อมูลกิจกรรมเอง */
export function eventStatus(ev: EventItem, now = new Date()): EventStatus {
  const today = bangkokDateKey(now);
  if (ev.startAt) {
    const start = new Date(ev.startAt);
    if (!isNaN(start.getTime())) {
      const day = bangkokDateKey(start);
      if (day === today) return 'ongoing';
      return day > today ? 'upcoming' : 'past';
    }
  }
  const range = parseThaiDateText(ev.date);
  if (!range) return 'tba';
  if (range.end < today) return 'past';
  if (range.start > today) return 'upcoming';
  const dayGiven = /\d{1,2}\s*(?:[-–]\s*\d{1,2}\s*)?(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)/.test(ev.date);
  return dayGiven ? 'ongoing' : 'tba';
}

/** คีย์เรียงลำดับ (YYYY-MM-DD): startAt ก่อน แล้ววันจากข้อความ — ไม่รู้วัน = '' */
export function eventSortKey(ev: EventItem): string {
  if (ev.startAt) {
    const d = new Date(ev.startAt);
    if (!isNaN(d.getTime())) return bangkokDateKey(d);
  }
  return parseThaiDateText(ev.date)?.start ?? '';
}

/** แสดงวันที่ ISO เป็นภาษาไทย (พ.ศ.) ตามเวลาไทย เช่น "12 ต.ค. 2569" */
export function formatThaiDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
