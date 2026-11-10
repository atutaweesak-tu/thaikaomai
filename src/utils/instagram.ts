export type InstagramKind = 'post' | 'reel';
export type InstagramRef = { kind: InstagramKind; code: string };

// shortcode ของ Instagram — ตัวอักษร/ตัวเลข/-/_ (ยาวจริงประมาณ 11 ตัว — เผื่อช่วงไว้)
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;
// ชื่อบัญชี: a-z 0-9 . _ ไม่เกิน 30 ตัว
const USER_RE = /^[A-Za-z0-9._]{1,30}$/;
const HOSTS = new Set(['instagram.com', 'www.instagram.com']);
// path ที่ไม่ใช่ชื่อบัญชี — กันไม่ให้ /explore/, /stories/ ฯลฯ ถูกอ่านเป็นโปรไฟล์หรือโพสต์
const RESERVED = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'developer', 'web']);

/** แปลงลิงก์โพสต์/Reels สาธารณะเป็น { kind, code } — ไม่รู้จัก = null (ห้ามนำ URL ใดๆ ไปเป็น iframe src ตรงๆ)
 *  รองรับ: instagram.com/p/CODE, /reel/CODE, /reels/CODE, /tv/CODE และแบบมีชื่อบัญชีนำหน้า /USER/p/CODE, /USER/reel/CODE
 *  ไม่รองรับ: stories (ฝังไม่ได้/หมดอายุ), โปรไฟล์, highlights, ลิงก์ย่อ instagr.am */
export function parseInstagramUrl(value: string | undefined | null): InstagramRef | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // ตัดชื่อบัญชีที่นำหน้าออก (ลิงก์แชร์รูปแบบใหม่ /USER/p/CODE/)
  if (parts.length >= 3 && USER_RE.test(parts[0]) && !RESERVED.has(parts[0].toLowerCase())) parts.shift();
  if (parts.length < 2) return null;
  const [type, code] = parts;
  if (!CODE_RE.test(code)) return null;
  if (type === 'p' || type === 'tv') return { kind: 'post', code };
  if (type === 'reel' || type === 'reels') return { kind: 'reel', code };
  return null;
}

/** ลิงก์ทางการสำหรับเปิดบน Instagram (สร้างใหม่จาก code — ไม่ใช้ URL ที่ผู้ใช้กรอกตรงๆ) */
export const instagramPermalink = (r: InstagramRef) => `https://www.instagram.com/${r.kind === 'reel' ? 'reel' : 'p'}/${r.code}/`;

/** URL ฝังอย่างเป็นทางการ (endpoint /embed ที่ embed.js ของ Instagram ใช้เอง) — ไม่โหลด embed.js เพิ่ม
 *  captioned = แสดงคำบรรยายใต้โพสต์ */
export const instagramEmbedUrl = (r: InstagramRef) => `https://www.instagram.com/${r.kind === 'reel' ? 'reel' : 'p'}/${r.code}/embed/captioned/`;

/** บัญชี Instagram ทางการของพรรค — ใช้เมื่อ settings.contact.instagram ยังไม่ได้ตั้ง (ค่า "#"/ว่าง) */
export const OFFICIAL_INSTAGRAM_USERNAME = 'thaikaomaiparty';
export const OFFICIAL_INSTAGRAM_PROFILE = `https://www.instagram.com/${OFFICIAL_INSTAGRAM_USERNAME}/`;

/** URL โปรไฟล์ทางการ: https://www.instagram.com/USERNAME/ — คืน URL มาตรฐาน หรือ null */
export function normalizeInstagramProfile(value: string | undefined | null): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 1 || !USER_RE.test(parts[0]) || RESERVED.has(parts[0].toLowerCase())) return null;
  return `https://www.instagram.com/${parts[0]}/`;
}
