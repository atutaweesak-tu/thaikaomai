import { extractYouTubeId, parseYouTubeChannelInput } from '../src/utils/youtube';

/**
 * YouTube Channel Auto Feed — ดึงคลิปจากช่อง YouTube ของพรรคเข้า collection "videos" (ระบบคลิปเดิม) ด้วย adapter 2 แบบ:
 *   1) RSS (ค่าเริ่มต้น ไม่ต้องใช้ key): https://www.youtube.com/feeds/videos.xml?channel_id=UC… — คลิปล่าสุด ~15 รายการ
 *      ตรวจช่องทุกรอบ: yt:channelId ใน feed ต้องตรงกับ Channel ID ที่ตั้งไว้ ไม่ตรง = ไม่นำเข้า
 *      Shorts ยืนยันได้จากลิงก์ /shorts/ ใน entry เท่านั้น — ที่เหลือติด typeUnverified ให้ admin กำหนด
 *   2) YouTube Data API v3 (เมื่อมี YOUTUBE_API_KEY): channels.list → uploads playlist · playlistItems.list · videos.list
 *      จัดประเภทจาก liveBroadcastContent / ความยาว + สัดส่วน player / #shorts
 * - key (ถ้ามี) อยู่ใน .env ฝั่ง server เท่านั้น — ไม่ส่งออกทาง API ใด ข้อความ error ตัด key ทิ้ง
 * - หน้าเว็บอ่านจาก data/videos.json (cache) เสมอ — ผู้เข้าชมไม่ทำให้เกิดการเรียก YouTube API
 * - ซิงก์ล้มเหลว (API ล่ม/โควตาหมด) = ไม่แตะ videos.json เลย, บันทึกสถานะ error ให้ admin เห็น
 * - รวมข้อมูลด้วย YouTube video id: ไม่ลบอะไร, รายการที่ admin ซ่อน/แก้/ลบไว้ไม่กลับมา (ดู mergeSyncedVideos)
 * สถานะ/การตั้งค่าเก็บใน data/youtube-sync.json (อ่านได้เฉพาะ admin ผ่าน /api/youtube/status)
 */

export interface YouTubeSyncState {
  channelInput: string;          // ลิงก์/@handle ที่ admin ใส่
  channelId: string;             // admin ใส่เอง (UC…) หรือได้จาก channels.list — ไม่เดา/ไม่สร้างเอง
  channelVerified: boolean;      // true เมื่อ feed/API ตอบกลับด้วย channel id เดียวกันแล้วอย่างน้อยหนึ่งครั้ง
  channelVerifiedAt: string | null;
  channelTitle: string;
  channelHandle: string;
  uploadsPlaylistId: string;     // ใช้กับ adapter API เท่านั้น
  autoSync: boolean;
  intervalMinutes: 15 | 30 | 60;
  lastAdapter: 'rss' | 'api' | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: { fetched: number; added: number; updated: number } | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  ignoredVideoIds: string[];     // คลิปจาก sync ที่ admin ลบ — sync รอบหน้าไม่เพิ่มกลับ
}

export const DEFAULT_SYNC_STATE: YouTubeSyncState = {
  channelInput: '', channelId: '', channelVerified: false, channelVerifiedAt: null, channelTitle: '', channelHandle: '', uploadsPlaylistId: '',
  autoSync: false, intervalMinutes: 15, lastAdapter: null,
  lastAttemptAt: null, lastSuccessAt: null, lastResult: null, lastError: null, lastErrorAt: null, consecutiveFailures: 0,
  ignoredVideoIds: [],
};

export const normalizeSyncState = (raw: any): YouTubeSyncState => {
  const s = { ...DEFAULT_SYNC_STATE, ...(raw && typeof raw === 'object' ? raw : {}) };
  s.intervalMinutes = [15, 30, 60].includes(s.intervalMinutes) ? s.intervalMinutes : 15;
  s.channelVerified = s.channelVerified === true;
  s.autoSync = s.autoSync === true;
  s.ignoredVideoIds = Array.isArray(s.ignoredVideoIds) ? s.ignoredVideoIds.filter((x: any) => typeof x === 'string').slice(-2000) : [];
  return s;
};

export interface YouTubeApiConfig { apiKey: string; apiBase: string; rssBase: string }
export const readYouTubeApiConfig = (env: Record<string, string>): YouTubeApiConfig => ({
  apiKey: (env.YOUTUBE_API_KEY || '').trim(),
  apiBase: (env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3').replace(/\/+$/, ''),
  rssBase: (env.YOUTUBE_RSS_BASE || 'https://www.youtube.com/feeds/videos.xml').replace(/\/+$/, ''),
});
/** adapter ที่ใช้: มี key = Data API (ข้อมูลครบกว่า จัดประเภทได้แม่นกว่า) · ไม่มี = RSS */
export const activeAdapter = (cfg: YouTubeApiConfig): 'rss' | 'api' => (cfg.apiKey ? 'api' : 'rss');

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export class YouTubeApiError extends Error {
  constructor(message: string, public quota = false) { super(message); }
}

async function ytGet(cfg: YouTubeApiConfig, resource: string, params: Record<string, string>, fetchImpl: FetchLike) {
  if (!cfg.apiKey) throw new YouTubeApiError('ยังไม่ได้ตั้ง YOUTUBE_API_KEY ฝั่ง server');
  const qs = new URLSearchParams({ ...params, key: cfg.apiKey }).toString();
  let res;
  try { res = await fetchImpl(`${cfg.apiBase}/${resource}?${qs}`); }
  catch (e) { throw new YouTubeApiError(`เชื่อมต่อ YouTube API ไม่ได้: ${scrub((e as Error).message, cfg.apiKey)}`); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    const reason = String(body?.error?.errors?.[0]?.reason || '');
    const quota = /quotaExceeded|dailyLimitExceeded|rateLimitExceeded/.test(reason);
    const msg = quota ? 'โควตา YouTube API หมด (ใช้ข้อมูล cache เดิมไปก่อน)' : String(body?.error?.message || `HTTP ${res.status}`);
    throw new YouTubeApiError(scrub(`${msg}${reason && !quota ? ` [${reason}]` : ''}`, cfg.apiKey), quota);
  }
  return body;
}

const scrub = (msg: string, key: string) => (key ? msg.split(key).join('[key]') : msg).replace(/key=[^&\s"]+/g, 'key=[key]').slice(0, 300);

export interface ResolvedChannel { channelId: string; title: string; handle: string; uploadsPlaylistId: string }

/** แปลงลิงก์ช่อง / @handle / channel id → channel id จริงจาก channels.list (forHandle / id / forUsername) */
export async function resolveChannel(cfg: YouTubeApiConfig, input: string, fetchImpl: FetchLike = fetch as any): Promise<ResolvedChannel> {
  const parsed = parseYouTubeChannelInput(input);
  if (!parsed) throw new YouTubeApiError('รูปแบบไม่รองรับ — ใช้ลิงก์ youtube.com/@handle, youtube.com/channel/UC…, หรือ @handle');
  if (parsed.kind === 'custom') throw new YouTubeApiError('ลิงก์แบบ /c/ชื่อ ไม่มีวิธีทางการแปลงเป็น channel id — ใช้ลิงก์ @handle หรือ /channel/UC… ของช่องแทน');
  const param = parsed.kind === 'id' ? { id: parsed.value } : parsed.kind === 'handle' ? { forHandle: '@' + parsed.value } : { forUsername: parsed.value };
  const body = await ytGet(cfg, 'channels', { part: 'snippet,contentDetails', ...param }, fetchImpl);
  const ch = body?.items?.[0];
  if (!ch?.id) throw new YouTubeApiError('ไม่พบช่องนี้บน YouTube');
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new YouTubeApiError('ช่องนี้ไม่มี uploads playlist');
  return { channelId: ch.id, title: String(ch.snippet?.title || ''), handle: String(ch.snippet?.customUrl || ''), uploadsPlaylistId: uploads };
}

/** ISO 8601 duration (PT1H2M3S) → วินาที */
export function parseIsoDuration(d: string | undefined): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(d || '');
  if (!m) return null;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

export type VideoKind = 'video' | 'short' | 'live' | 'upcoming';

/** จัดประเภทจากข้อมูลที่ API ยืนยันได้ — ห้ามใช้ความยาวอย่างเดียวตัดสิน Shorts:
 *  live/upcoming: snippet.liveBroadcastContent (ค่าจาก YouTube โดยตรง)
 *  short: ยาว ≤ 180 วิ **และ** มีหลักฐานอีกอย่าง — player แนวตั้ง (embedHeight > embedWidth) หรือ #shorts ในชื่อ/คำอธิบาย/แท็ก
 *  ที่เหลือ = video (admin แก้เองได้ในแท็บคลิป และจะล็อกไม่ให้ sync เปลี่ยนกลับ) */
export function classifyVideo(v: any): { type: VideoKind; durationSec: number | null; evidence: string } {
  const live = v?.snippet?.liveBroadcastContent;
  const durationSec = parseIsoDuration(v?.contentDetails?.duration);
  if (live === 'live') return { type: 'live', durationSec, evidence: 'liveBroadcastContent=live' };
  if (live === 'upcoming') return { type: 'upcoming', durationSec, evidence: 'liveBroadcastContent=upcoming' };
  const w = Number(v?.player?.embedWidth), h = Number(v?.player?.embedHeight);
  const vertical = w > 0 && h > w;
  const text = [v?.snippet?.title, v?.snippet?.description, ...(v?.snippet?.tags || [])].join(' ');
  const tagged = /#shorts?\b/i.test(text);
  if (durationSec !== null && durationSec > 0 && durationSec <= 180 && (vertical || tagged)) {
    return { type: 'short', durationSec, evidence: [vertical && 'vertical-player', tagged && '#shorts'].filter(Boolean).join('+') };
  }
  return { type: 'video', durationSec, evidence: durationSec !== null && durationSec <= 180 ? 'short-length-but-no-second-signal' : 'default' };
}

export interface SyncedVideo {
  youtubeId: string; url: string; title: string; date: string; type: VideoKind;
  durationSec: number | null; classifyEvidence: string; scheduledStart?: string;
  thumbnail?: string;
  typeUnverified?: boolean;   // แหล่งข้อมูลยืนยันประเภทไม่ได้ (RSS ที่ไม่มีลิงก์ /shorts/) → admin กำหนดเอง
}

// ── Adapter 1: RSS (ไม่ต้องใช้ key) ──────────────────────────────────────────

const decodeXml = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tag = (xml: string, name: string) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml); return m ? decodeXml(m[1].trim()) : ''; };
const attr = (xml: string, name: string, a: string, where = '') => {
  const m = new RegExp(`<${name}\\b[^>]*${where}[^>]*\\b${a}="([^"]*)"`).exec(xml);
  return m ? decodeXml(m[1]) : '';
};

export interface RssFeed { channelId: string; title: string; channelUrl: string; videos: SyncedVideo[] }

/** แปลง Atom feed ของ YouTube — ไม่มี dependency ใหม่ รูปแบบ feed คงที่ (yt:/media: namespace) */
export function parseYouTubeRss(xml: string): RssFeed {
  if (!/<feed[\s>]/.test(xml)) throw new YouTubeApiError('RSS ตอบกลับไม่ใช่ feed (อาจเป็นหน้า error ของ YouTube)');
  const head = xml.split('<entry')[0];
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  const videos: SyncedVideo[] = [];
  for (const e of entries) {
    const id = tag(e, 'yt:videoId');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    const link = attr(e, 'link', 'href', 'rel="alternate"');
    // ลิงก์ /shorts/ ใน feed = YouTube ระบุเองว่าเป็น Shorts (หลักฐานที่ตรวจสอบได้) · ลิงก์ /watch ยืนยันไม่ได้ว่าไม่ใช่ Shorts
    const isShortLink = /^https:\/\/(www\.)?youtube\.com\/shorts\//.test(link);
    const title = tag(e, 'title').slice(0, 200);
    const description = tag(e, 'media:description');
    const tagged = /#shorts?\b/i.test(`${title} ${description}`);
    videos.push({
      youtubeId: id,
      url: isShortLink ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      title, date: tag(e, 'published'),
      type: isShortLink || tagged ? 'short' : 'video',
      durationSec: null,
      classifyEvidence: isShortLink ? 'rss-shorts-link' : tagged ? 'rss-#shorts-unverified' : 'rss-watch-link-unverified',
      typeUnverified: !isShortLink,
      thumbnail: attr(e, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return { channelId: tag(head, 'yt:channelId'), title: tag(head, 'title'), channelUrl: attr(head.split('<entry')[0], 'link', 'href', 'rel="alternate"'), videos };
}

type TextFetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** ดึง RSS ของช่อง + ตรวจว่า feed เป็นของ channelId ที่ตั้งไว้จริง (ไม่ตรง/ล้มเหลว = throw, ไม่นำเข้าอะไร) */
export async function fetchRssFeed(cfg: YouTubeApiConfig, channelId: string, fetchImpl: TextFetch = fetch as any): Promise<RssFeed> {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new YouTubeApiError('Channel ID ไม่ถูกต้อง (ต้องขึ้นต้นด้วย UC และยาว 24 ตัวอักษร)');
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 15_000) : null;
  let res;
  try { res = await fetchImpl(`${cfg.rssBase}?channel_id=${encodeURIComponent(channelId)}`, ctrl ? { signal: ctrl.signal } : undefined); }
  catch (e) { throw new YouTubeApiError(`เชื่อมต่อ YouTube RSS ไม่ได้: ${(e as Error).name === 'AbortError' ? 'หมดเวลา 15 วินาที' : (e as Error).message}`); }
  finally { if (timer) clearTimeout(timer); }
  // 404 จาก RSS แยกไม่ได้ว่า Channel ID ผิด หรือ feed ของ YouTube ขัดข้องชั่วคราว (เกิดขึ้นจริงเป็นช่วงๆ)
  if (res.status === 404) throw new YouTubeApiError('YouTube RSS ตอบ 404 — Channel ID อาจไม่ถูกต้อง หรือ feed ของ YouTube ขัดข้องชั่วคราว');
  if (!res.ok) throw new YouTubeApiError(`YouTube RSS ตอบ HTTP ${res.status}`);
  const feed = parseYouTubeRss(await res.text());
  if (feed.channelId !== channelId) throw new YouTubeApiError(`feed ที่ได้เป็นของช่อง ${feed.channelId || '?'} ไม่ตรงกับ Channel ID ที่ตั้งไว้ — ไม่นำเข้า`);
  return feed;
}

// ── Adapter 2: YouTube Data API v3 (เมื่อมี YOUTUBE_API_KEY) ───────────────────

/** ดึงคลิปล่าสุดจาก uploads playlist (สูงสุด max) แล้วขอรายละเอียดจาก videos.list ทีละ 50 */
export async function fetchChannelVideos(cfg: YouTubeApiConfig, uploadsPlaylistId: string, max: number, fetchImpl: FetchLike = fetch as any): Promise<SyncedVideo[]> {
  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < max) {
    const body = await ytGet(cfg, 'playlistItems', { part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: String(Math.min(50, max - ids.length)), ...(pageToken ? { pageToken } : {}) }, fetchImpl);
    for (const it of body?.items || []) {
      const id = it?.contentDetails?.videoId;
      if (typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id) && !ids.includes(id)) ids.push(id);
    }
    pageToken = body?.nextPageToken || '';
    if (!pageToken) break;
  }
  const out: SyncedVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    // maxWidth ทำให้ player.embedWidth/embedHeight สะท้อนสัดส่วนจริงของคลิป (ใช้แยกคลิปแนวตั้ง)
    const body = await ytGet(cfg, 'videos', { part: 'snippet,contentDetails,liveStreamingDetails,player,status', id: ids.slice(i, i + 50).join(','), maxWidth: '480' }, fetchImpl);
    for (const v of body?.items || []) {
      if (v?.status && v.status.privacyStatus && v.status.privacyStatus !== 'public') continue; // ไม่ดึงคลิป private/unlisted
      const c = classifyVideo(v);
      out.push({
        youtubeId: v.id,
        url: c.type === 'short' ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
        title: String(v.snippet?.title || '').slice(0, 200),
        date: String(v.snippet?.publishedAt || ''),
        type: c.type, durationSec: c.durationSec, classifyEvidence: c.evidence, typeUnverified: false,
        thumbnail: v.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        ...(v.liveStreamingDetails?.scheduledStartTime ? { scheduledStart: v.liveStreamingDetails.scheduledStartTime } : {}),
      });
    }
  }
  return out;
}

/** รวมผล sync เข้ากับ videos.json
 *  - คีย์ = YouTube video id (รายการ sync: youtubeId · รายการที่ admin ใส่เอง: id จาก url) → ไม่มีรายการซ้ำ
 *  - รายการที่มีอยู่แล้ว (manual หรือ sync): ไม่แตะ ชื่อ/สถานะซ่อน/ปักหมุด/ลำดับ/คลิปเด่น/หมวด
 *    อัปเดตเฉพาะรายการ sync: ประเภท (ถ้า admin ไม่ได้ล็อก) + url ให้ตรงประเภท + ความยาว/เวลาไลฟ์
 *  - คลิปที่อยู่ใน ignoredVideoIds (admin ลบ) ไม่เพิ่มกลับ · ไม่มีการลบรายการใดๆ จาก sync
 *  - คลิปใหม่: เรียงเก่า→ใหม่ แล้วให้ order = min−1 ทีละรายการ → คลิปใหม่สุดขึ้นก่อน (เหมือนเพิ่มเอง) */
export function mergeSyncedVideos(existing: any[], synced: SyncedVideo[], ignored: string[], newId: () => string, now: string) {
  const items = existing.map(i => ({ ...i }));
  const byYt = new Map<string, any>();
  for (const i of items) { const id = i.youtubeId || extractYouTubeId(i.url); if (id && !byYt.has(id)) byYt.set(id, i); }
  const skip = new Set(ignored);
  let minOrder = items.reduce((m, i) => Math.min(m, i.order ?? 0), 0);
  let added = 0, updated = 0;
  const fresh = [...synced].sort((a, b) => a.date.localeCompare(b.date));
  for (const v of fresh) {
    if (skip.has(v.youtubeId)) continue;
    const hit = byYt.get(v.youtubeId);
    if (hit) {
      if (hit.source !== 'youtube-sync') continue; // รายการที่ admin เพิ่มเองเป็นของ admin ทั้งหมด
      const next = { ...hit, ...(v.durationSec !== null ? { durationSec: v.durationSec } : {}), scheduledStart: v.scheduledStart, ...(v.thumbnail ? { thumbnail: v.thumbnail } : {}) };
      // ไม่เปลี่ยนประเภทเมื่อ admin ล็อกไว้ และไม่เอาข้อมูลที่ "ยืนยันไม่ได้" (RSS) ไปทับประเภทที่ยืนยันแล้ว (API/ลิงก์ /shorts/)
      const downgrade = v.typeUnverified && hit.typeUnverified === false;
      if (!hit.typeLocked && !downgrade) { next.type = v.type; next.url = v.url; next.classifyEvidence = v.classifyEvidence; next.typeUnverified = !!v.typeUnverified; }
      if (next.scheduledStart === undefined) delete next.scheduledStart;
      if (JSON.stringify(next) !== JSON.stringify(hit)) { Object.assign(hit, next, { updatedAt: now, updatedBy: 'youtube-sync' }); updated++; }
      continue;
    }
    const item = {
      id: newId(), url: v.url, title: v.title || 'คลิปจาก YouTube', type: v.type, date: v.date,
      featured: false, pinned: false, published: true, order: --minOrder,
      source: 'youtube-sync', youtubeId: v.youtubeId, durationSec: v.durationSec, classifyEvidence: v.classifyEvidence,
      typeUnverified: !!v.typeUnverified, ...(v.thumbnail ? { thumbnail: v.thumbnail } : {}),
      ...(v.scheduledStart ? { scheduledStart: v.scheduledStart } : {}),
      createdAt: now, createdBy: 'youtube-sync',
    };
    items.push(item);
    byYt.set(v.youtubeId, item);
    added++;
  }
  return { items, added, updated };
}

/** พร้อมซิงก์ไหม: RSS ต้องมี Channel ID · API ต้องมี uploads playlist (ได้ตอนตรวจช่องผ่าน channels.list) */
export const canSync = (s: YouTubeSyncState, cfg: YouTubeApiConfig) => (activeAdapter(cfg) === 'api' ? !!s.uploadsPlaylistId : !!s.channelId);

/** ซิงก์หนึ่งรอบด้วย adapter ที่ใช้งานอยู่ — คืนรายการคลิป + ข้อมูลช่องที่ยืนยันแล้ว (ไม่เขียนไฟล์ใดๆ) */
export async function fetchLatestVideos(cfg: YouTubeApiConfig, s: YouTubeSyncState, max: number, fetchImpl?: any): Promise<{ adapter: 'rss' | 'api'; videos: SyncedVideo[]; channelTitle?: string }> {
  if (activeAdapter(cfg) === 'api') {
    if (!s.uploadsPlaylistId) throw new YouTubeApiError('ยังไม่ได้ตรวจช่องผ่าน YouTube API — กด "ตรวจสอบ & บันทึก" อีกครั้ง');
    return { adapter: 'api', videos: await fetchChannelVideos(cfg, s.uploadsPlaylistId, max, fetchImpl) };
  }
  if (!s.channelId) throw new YouTubeApiError('ยังไม่ได้ตั้ง Channel ID');
  const feed = await fetchRssFeed(cfg, s.channelId, fetchImpl);
  return { adapter: 'rss', videos: feed.videos.slice(0, max), channelTitle: feed.title };
}

/** สถานะที่ส่งให้หน้า admin — ไม่มี API key */
export const publicSyncStatus = (s: YouTubeSyncState, cfg: YouTubeApiConfig, running: boolean) => ({
  apiKeyConfigured: !!cfg.apiKey, adapter: activeAdapter(cfg), lastAdapter: s.lastAdapter,
  channelInput: s.channelInput, channelId: s.channelId, channelTitle: s.channelTitle, channelHandle: s.channelHandle,
  channelVerified: s.channelVerified, channelVerifiedAt: s.channelVerifiedAt,
  autoSync: s.autoSync, intervalMinutes: s.intervalMinutes,
  lastAttemptAt: s.lastAttemptAt, lastSuccessAt: s.lastSuccessAt, lastResult: s.lastResult,
  lastError: s.lastError, lastErrorAt: s.lastErrorAt, consecutiveFailures: s.consecutiveFailures,
  ignoredCount: s.ignoredVideoIds.length, running,
  nextAutoSyncAt: s.autoSync && canSync(s, cfg)
    ? new Date((s.lastAttemptAt ? Date.parse(s.lastAttemptAt) : Date.now()) + s.intervalMinutes * 60_000).toISOString()
    : null,
});
