import { parseInstagramUrl, OFFICIAL_INSTAGRAM_USERNAME } from '../src/utils/instagram';

/**
 * เตรียมเชื่อม Instagram API อย่างเป็นทางการของ Meta (Instagram API with Instagram Login — graph.instagram.com)
 * สำหรับดึงโพสต์ของบัญชี @thaikaomaiparty เข้า collection "instagram" — ไม่ scrape, ไม่ใช้ endpoint ที่ไม่เป็นทางการ
 *
 * สถานะปัจจุบัน: ปิดอยู่ (ค่าเริ่มต้น) — ไม่มี scheduler/cron ใดๆ เรียกโมดูลนี้อัตโนมัติ
 * เงื่อนไขก่อน sync ได้ (ตรวจทุกครั้งที่กด):
 *   1) ตั้ง INSTAGRAM_ACCESS_TOKEN ใน .env ฝั่ง server (ห้ามใส่ใน VITE_* / React — token ไม่ถูกส่งออกทาง API ใดๆ)
 *   2) INSTAGRAM_SYNC_ENABLED=true
 *   3) ตรวจบัญชีผ่าน /me แล้ว: username ตรง INSTAGRAM_EXPECTED_USERNAME และเป็น Business/Creator (ไม่ใช่ PERSONAL)
 * ดูขั้นตอนขอสิทธิ์/token ใน docs/INSTAGRAM_INTEGRATION_V3.md
 */

export interface InstagramSyncConfig {
  token: string;
  enabled: boolean;
  autoPublish: boolean;
  expectedUsername: string;
  apiBase: string;
  limit: number;
}

export function readInstagramConfig(env: Record<string, string>): InstagramSyncConfig {
  return {
    token: (env.INSTAGRAM_ACCESS_TOKEN || '').trim(),
    enabled: env.INSTAGRAM_SYNC_ENABLED === 'true',
    autoPublish: env.INSTAGRAM_SYNC_AUTO_PUBLISH === 'true',
    expectedUsername: (env.INSTAGRAM_EXPECTED_USERNAME || OFFICIAL_INSTAGRAM_USERNAME).replace(/^@/, '').toLowerCase(),
    apiBase: (env.INSTAGRAM_API_BASE || 'https://graph.instagram.com').replace(/\/+$/, ''),
    limit: Math.min(50, Math.max(1, Number(env.INSTAGRAM_SYNC_LIMIT) || 24)),
  };
}

/** สถานะสำหรับหน้า admin — ห้ามมี token หรือส่วนใดของ token */
export function publicStatus(cfg: InstagramSyncConfig) {
  return {
    mode: cfg.token && cfg.enabled ? 'api' : 'manual',
    tokenConfigured: !!cfg.token,
    syncEnabled: cfg.enabled,
    autoPublish: cfg.autoPublish,
    expectedUsername: cfg.expectedUsername,
    automaticSchedule: false, // ยังไม่มีการ sync ตามเวลา — ต้องกดจากหน้า admin เท่านั้น
  };
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

/** ข้อความ error จาก Graph API อาจสะท้อน URL ที่มี access_token กลับมา — ตัดออกก่อนส่งให้ client/log */
const scrub = (msg: string, token: string) => (token ? msg.split(token).join('[token]') : msg).replace(/access_token=[^&\s"]+/g, 'access_token=[token]').slice(0, 300);

async function graphGet(cfg: InstagramSyncConfig, pathAndQuery: string, fetchImpl: FetchLike) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetchImpl(`${cfg.apiBase}${pathAndQuery}${sep}access_token=${encodeURIComponent(cfg.token)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) throw new Error(scrub(String(body?.error?.message || `HTTP ${res.status}`), cfg.token));
  return body;
}

export interface VerifyResult { ok: boolean; username?: string; accountType?: string; problems: string[] }

/** ตรวจว่า token ใช้ได้ + เป็นบัญชีที่ถูกต้อง + เป็น Business/Creator ก่อนอนุญาต sync */
export async function verifyInstagramAccount(cfg: InstagramSyncConfig, fetchImpl: FetchLike = fetch as any): Promise<VerifyResult> {
  if (!cfg.token) return { ok: false, problems: ['ยังไม่ได้ตั้ง INSTAGRAM_ACCESS_TOKEN ฝั่ง server — ใช้ Manual Mode ไปก่อน'] };
  try {
    const me = await graphGet(cfg, '/me?fields=user_id,username,account_type', fetchImpl);
    const username = String(me.username || '').toLowerCase();
    const accountType = String(me.account_type || '');
    const problems: string[] = [];
    if (username !== cfg.expectedUsername) problems.push(`token เป็นของบัญชี @${username || '?'} ไม่ใช่ @${cfg.expectedUsername}`);
    if (!['BUSINESS', 'MEDIA_CREATOR'].includes(accountType)) problems.push(`บัญชีประเภท ${accountType || 'ไม่ทราบ'} — API รองรับเฉพาะบัญชี Business/Creator`);
    return { ok: problems.length === 0, username, accountType, problems };
  } catch (e) {
    return { ok: false, problems: [`เรียก Instagram API ไม่สำเร็จ: ${(e as Error).message}`] };
  }
}

const MEDIA_TYPE: Record<string, 'image' | 'video' | 'carousel'> = { IMAGE: 'image', VIDEO: 'video', CAROUSEL_ALBUM: 'carousel' };

/** แปลง media object จาก API → InstagramItem (ยังไม่มี id/order) — ข้ามรายการที่ permalink ไม่ใช่ /p/ หรือ /reel/ */
export function mapInstagramMedia(m: any, autoPublish: boolean) {
  const ref = parseInstagramUrl(m?.permalink);
  if (!ref || !m?.id) return null;
  const firstLine = String(m.caption || '').split('\n').map((s: string) => s.trim()).find(Boolean) || '';
  return {
    url: m.permalink as string,
    kind: ref.kind,
    mediaType: MEDIA_TYPE[m.media_type] || 'image',
    title: firstLine ? firstLine.slice(0, 120) : (ref.kind === 'reel' ? 'Reels จาก Instagram' : 'โพสต์จาก Instagram'),
    // URL รูปจาก CDN ของ Instagram มีอายุจำกัด — การ์ดหน้าเว็บ fallback เป็นการ์ดแบรนด์เมื่อรูปหมดอายุ (sync ใหม่ = ได้ URL ใหม่)
    cover: (m.thumbnail_url || (m.media_type !== 'VIDEO' ? m.media_url : '') || '') as string,
    postedAt: m.timestamp as string | undefined,
    externalId: String(m.id),
    source: 'api' as const,
    published: autoPublish,
  };
}

/** รวมผล sync เข้ากับรายการเดิม: รายการ api เดิม (externalId ตรง) อัปเดตแค่ cover/postedAt — คงชื่อ/ลำดับ/ปักหมุด/สถานะที่ admin แก้ไว้
 *  โพสต์ที่ admin ใส่ลิงก์เองไว้แล้ว (shortcode เดียวกัน) ไม่สร้างซ้ำ · รายการใหม่ต่อท้ายตามเวลาโพสต์ */
export function mergeInstagramItems(existing: any[], mapped: NonNullable<ReturnType<typeof mapInstagramMedia>>[], newId: () => string, now: string) {
  const items = existing.map(i => ({ ...i }));
  const byExternal = new Map(items.filter(i => i.externalId).map(i => [String(i.externalId), i]));
  const codes = new Set(items.map(i => parseInstagramUrl(i.url)?.code).filter(Boolean));
  let maxOrder = items.reduce((m, i) => Math.max(m, i.order ?? 0), 0);
  let added = 0, updated = 0;
  for (const m of mapped) {
    const hit = byExternal.get(m.externalId);
    if (hit) { hit.cover = m.cover || hit.cover; hit.postedAt = m.postedAt || hit.postedAt; hit.updatedAt = now; updated++; continue; }
    const code = parseInstagramUrl(m.url)?.code;
    if (code && codes.has(code)) continue;
    items.push({ id: newId(), ...m, order: ++maxOrder, createdAt: now, createdBy: 'instagram-sync' });
    if (code) codes.add(code);
    added++;
  }
  return { items, added, updated };
}

export async function fetchInstagramMedia(cfg: InstagramSyncConfig, fetchImpl: FetchLike = fetch as any) {
  const body = await graphGet(cfg, `/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=${cfg.limit}`, fetchImpl);
  return (Array.isArray(body?.data) ? body.data : []).map((m: any) => mapInstagramMedia(m, cfg.autoPublish)).filter(Boolean) as NonNullable<ReturnType<typeof mapInstagramMedia>>[];
}
