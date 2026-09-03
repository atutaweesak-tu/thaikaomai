import { NewsItem, EventItem, Policy, TeamMember, NewsletterSubscriber, ContactMessage, VolunteerItem, SiteSettings, DEFAULT_SETTINGS, NewsCategory, PageBlock, AdminAccount, AnalyticsData, Poll, PopupSettings, PopupItem } from '../types';

// ─── Auth Token ───────────────────────────────────────────────────────────────

const TOKEN_KEY = 'tkm_api_token';
export const getApiToken = () => localStorage.getItem(TOKEN_KEY);
export const setApiToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearApiToken = () => localStorage.removeItem(TOKEN_KEY);

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getApiToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── Generic Server API ───────────────────────────────────────────────────────

type Unsubscribe = () => void;

function subscribeToCollection<T>(col: string, callback: (items: T[]) => void): Unsubscribe {
  let active = true;

  const applyData = (items: T[]) => { if (active) callback(items); };

  const fetchOnce = async () => {
    if (!active || document.visibilityState === 'hidden') return;
    try {
      // ส่ง Authorization header เสมอถ้ามี token — collection ที่เป็นข้อมูลส่วนบุคคล
      // (contact/volunteer/newsletter/users) ฝั่ง server ต้องการ auth ตอนอ่านด้วย
      const res = await fetch(`/api/data/${col}?t=${Date.now()}`, { cache: 'no-store', headers: authHeaders() });
      if (res.ok) applyData(await res.json());
      else console.error(`[dataService] GET ${col} failed: ${res.status}`);
    } catch (err) {
      console.error(`[dataService] GET ${col} network error:`, err);
    }
  };

  // Pause when tab hidden, resume immediately when tab becomes visible
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchOnce(); };
  document.addEventListener('visibilitychange', onVisibilityChange);

  fetchOnce();
  const interval = setInterval(fetchOnce, 8000);

  return () => {
    active = false;
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

async function apiAdd(col: string, item: any): Promise<any> {
  const res = await fetch(`/api/data/${col}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `เพิ่มข้อมูลไม่สำเร็จ (${res.status})`);
  }
  return res.json();
}

async function apiUpdate(col: string, id: string, item: any): Promise<void> {
  const res = await fetch(`/api/data/${col}/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `อัพเดตข้อมูลไม่สำเร็จ (${res.status})`);
  }
}

async function apiDelete(col: string, id: string): Promise<void> {
  const res = await fetch(`/api/data/${col}/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getApiToken() || ''}` },
  });
  if (!res.ok) throw new Error(`ลบข้อมูลไม่สำเร็จ`);
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────

export const subscribeToNews = (cb: (n: NewsItem[]) => void) => subscribeToCollection<NewsItem>('news', cb);
export const addNews = (news: Omit<NewsItem, 'id'>) => apiAdd('news', news);
export const updateNews = (id: string, news: Partial<NewsItem>) => apiUpdate('news', id, news);
export const deleteNews = (id: string) => apiDelete('news', id);

// ─── NEWS CATEGORIES ──────────────────────────────────────────────────────────
// หมวดหมู่เปลี่ยนไม่บ่อย จึง fetch ครั้งเดียว (ไม่ตั้ง interval ต่อเนื่องเหมือน collection อื่น)
// เพื่อไม่เพิ่มจำนวน connection ค้างที่หน้า admin เปิดพร้อมกันไปอีก — เบราว์เซอร์จำกัด
// การเชื่อมต่อพร้อมกันต่อ origin ไว้ที่ ~6 (HTTP/1.1) ถ้าเกินจะทำให้ request อื่น (เช่นตอนกด "บันทึก") ค้างรอคิว

export async function fetchCategories(): Promise<NewsCategory[]> {
  try {
    const res = await fetch(`/api/data/categories?t=${Date.now()}`, { cache: 'no-store', headers: authHeaders() });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}
export const addCategory = (category: Omit<NewsCategory, 'id'>) => apiAdd('categories', category);
export const updateCategory = (id: string, category: Partial<NewsCategory>) => apiUpdate('categories', id, category);
export const deleteCategory = (id: string) => apiDelete('categories', id);

// ─── HOME PAGE BLOCKS (ลำดับ section หน้าแรก) ─────────────────────────────────

// promo block: รวมรูปเดี่ยวเดิม (image) เข้ากับสไลด์ใหม่ (images[]) — คืน images ที่ normalize แล้วเสมอ
function normalizeHomeBlock(b: PageBlock): PageBlock {
  if (b.type !== 'promo') return b;
  const list = Array.isArray(b.images) ? b.images.filter(u => typeof u === 'string' && u) : [];
  const images = list.length ? list : (b.image ? [b.image] : []);
  return { ...b, images };
}
export const subscribeToHomeBlocks = (cb: (b: PageBlock[]) => void) =>
  subscribeToCollection<PageBlock>('homeblocks', blocks => cb(blocks.map(normalizeHomeBlock)));
export const addHomeBlock = (block: Omit<PageBlock, 'id'>) => apiAdd('homeblocks', block);
export const updateHomeBlock = (id: string, block: Partial<PageBlock>) => apiUpdate('homeblocks', id, block);
export const deleteHomeBlock = (id: string) => apiDelete('homeblocks', id);

// ─── EVENTS ───────────────────────────────────────────────────────────────────

export const subscribeToEvents = (cb: (e: EventItem[]) => void) => subscribeToCollection<EventItem>('events', cb);
export const addEvent = (event: Omit<EventItem, 'id'>) => apiAdd('events', event);
export const updateEvent = (id: string, event: Partial<EventItem>) => apiUpdate('events', id, event);
export const deleteEvent = (id: string) => apiDelete('events', id);

// ─── POLICIES ─────────────────────────────────────────────────────────────────

export const subscribeToPolicies = (cb: (p: Policy[]) => void) => subscribeToCollection<Policy>('policies', cb);
export const addPolicy = (policy: Omit<Policy, 'id'>) => apiAdd('policies', policy);
export const updatePolicy = (id: string, policy: Partial<Policy>) => apiUpdate('policies', id, policy);
export const deletePolicy = (id: string) => apiDelete('policies', id);

// ─── POLLS ────────────────────────────────────────────────────────────────────

export const subscribeToPolls = (cb: (p: Poll[]) => void) => subscribeToCollection<Poll>('polls', cb);
export const addPoll = (poll: Omit<Poll, 'id'>) => apiAdd('polls', poll);
export const updatePoll = (id: string, poll: Partial<Poll>) => apiUpdate('polls', id, poll);
export const deletePoll = (id: string) => apiDelete('polls', id);

// โหวตเป็น public endpoint แยกต่างหาก (/api/polls/:id/vote) ไม่ใช่ apiUpdate — เพราะ apiUpdate
// (PUT /api/data/polls/:id) ต้อง login เสมอ ส่วนการโหวตต้องเปิดให้ผู้เข้าชมที่ไม่ login (รวมแอปมือถือ) ยิงได้
export async function castPollVote(pollId: string, optionId: string): Promise<Poll> {
  const res = await fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'โหวตไม่สำเร็จ');
  return body as Poll;
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────

export const subscribeToTeam = (cb: (t: TeamMember[]) => void) => subscribeToCollection<TeamMember>('team', cb);
export const addTeamMember = (member: Omit<TeamMember, 'id'>) => apiAdd('team', member);
export const updateTeamMember = (id: string, member: Partial<TeamMember>) => apiUpdate('team', id, member);
export const deleteTeamMember = (id: string) => apiDelete('team', id);

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────

// พารามิเตอร์ website คือค่าจากฟิลด์ honeypot (ดู src/components/Honeypot.tsx) — ส่งต่อไปให้ server
// เช็คเงียบๆ เอง ไม่ต้อง validate อะไรฝั่ง client เพราะจุดประสงค์คือดักบอทที่ไม่รัน JS ตรวจสอบ
export const addNewsletterSubscriber = (email: string, website?: string) => apiAdd('newsletter', { email, subscribedAt: new Date().toISOString(), website });
export const subscribeToNewsletter = (cb: (s: NewsletterSubscriber[]) => void) => subscribeToCollection<NewsletterSubscriber>('newsletter', cb);

// ─── CONTACT ──────────────────────────────────────────────────────────────────

export const addContactMessage = (msg: Omit<ContactMessage, 'id'>, website?: string) => apiAdd('contact', { ...msg, sentAt: new Date().toISOString(), website });
export const subscribeToContact = (cb: (m: ContactMessage[]) => void) => subscribeToCollection<ContactMessage>('contact', cb);

// ─── VOLUNTEER ────────────────────────────────────────────────────────────────

export const addVolunteer = (item: Omit<VolunteerItem, 'id'>, website?: string) => apiAdd('volunteer', { ...item, submittedAt: new Date().toISOString(), website });
export const subscribeToVolunteer = (cb: (v: VolunteerItem[]) => void) => subscribeToCollection<VolunteerItem>('volunteer', cb);
export const deleteVolunteer = (id: string) => apiDelete('volunteer', id);

// ─── ADMIN ACCOUNTS (users collection − จัดการบัญชีผู้ดูแลผ่าน UI, super_admin เท่านั้น) ─────

export const subscribeToAdminAccounts = (cb: (u: AdminAccount[]) => void) => subscribeToCollection<AdminAccount>('users', cb);
export const addAdminAccount = (account: Partial<AdminAccount> & { password: string }) => apiAdd('users', account);
export const updateAdminAccount = (id: string, account: Partial<AdminAccount> & { password?: string }) => apiUpdate('users', id, account);
export const deleteAdminAccount = (id: string) => apiDelete('users', id);

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

const SETTINGS_LS_KEY = 'tkm_site_settings';
let _settingsCallbacks: ((s: SiteSettings) => void)[] = [];

/** Deep-merge server data with DEFAULT_SETTINGS so new fields always have defaults */
/** รวม popup รูปแบบเดิม (รูปเดียว) เข้ากับรูปแบบใหม่ (items[]) — คืน items ที่ normalize แล้วเสมอ */
function normalizePopup(raw: any): PopupSettings {
  const p = { ...DEFAULT_SETTINGS.popup, ...(raw ?? {}) } as any;
  let items: PopupItem[] = Array.isArray(p.items)
    ? p.items.filter((it: any) => it && typeof it.image === 'string' && it.image)
    : [];
  // ยังไม่เคยมี items แต่มี popup เดิม 1 รูป → ยกมาเป็น item แรก
  if (!items.length && typeof p.image === 'string' && p.image) {
    items = [{ id: 'legacy', image: p.image, link: p.link || '', startDate: p.startDate || '', endDate: p.endDate || '', enabled: true }];
  }
  items = items.map((it, i) => ({
    id: it.id || `p${i}_${Math.random().toString(36).slice(2, 7)}`,
    image: it.image,
    link: it.link || '',
    startDate: it.startDate || '',
    endDate: it.endDate || '',
    enabled: it.enabled !== false,
  }));
  return { enabled: !!p.enabled, items };
}

function mergeSettings(data: any): SiteSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    popup: normalizePopup(data?.popup),
    about: { ...DEFAULT_SETTINGS.about, ...(data?.about ?? {}) },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(data?.privacy ?? {}) },
    hero: { ...DEFAULT_SETTINGS.hero, ...(data?.hero ?? {}) },
    cta: { ...DEFAULT_SETTINGS.cta, ...(data?.cta ?? {}) },
    contact: { ...DEFAULT_SETTINGS.contact, ...(data?.contact ?? {}) },
    footer: { ...DEFAULT_SETTINGS.footer, ...(data?.footer ?? {}) },
    pages: { ...DEFAULT_SETTINGS.pages, ...(data?.pages ?? {}) },
  };
}

function broadcastSettings(s: SiteSettings) {
  _settingsCallbacks.forEach(cb => cb(s));
}

async function fetchAndBroadcastSettings() {
  try {
    const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.hero) {
        const merged = mergeSettings(data);
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(merged));
        broadcastSettings(merged);
      }
    }
  } catch (err) {
    console.error('[dataService] settings fetch error:', err);
  }
}

export const subscribeToSiteSettings = (callback: (settings: SiteSettings) => void): Unsubscribe => {
  const raw = localStorage.getItem(SETTINGS_LS_KEY);
  if (raw) { try { callback(mergeSettings(JSON.parse(raw))); } catch { callback(DEFAULT_SETTINGS); } }
  else { callback(DEFAULT_SETTINGS); }

  _settingsCallbacks.push(callback);

  // ยิง fetch ตรงครั้งเดียวคู่กับ SSE เสมอ — ไม่รอผลจาก SSE อย่างเดียว เพราะบนเน็ตมือถือ/หลัง Cloudflare
  // การเชื่อมต่อ SSE บางครั้งค้างหรือหลุดช้ากว่าจะ error (ยิ่งถ้าเพิ่งเปิดเว็บครั้งแรกบนเครื่องนั้น
  // ค่าที่โชว์จาก localStorage ด้านบนอาจเป็นค่าเก่าที่ค้างมาจากการเข้าชมครั้งก่อนๆ) request ตรงนี้ทำให้ได้
  // ค่าสดมาทับภายในหนึ่ง round-trip ปกติ โดยไม่ต้องพึ่งว่า SSE จะต่อติดเร็วแค่ไหน
  fetchAndBroadcastSettings();

  let es: EventSource | null = null;
  let fallback: ReturnType<typeof setInterval> | null = null;

  function connect() {
    es = new EventSource('/api/settings/stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.hero && data?.cta && data?.contact && data?.footer) {
          const merged = mergeSettings(data);
          localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(merged));
          broadcastSettings(merged);
        }
      } catch (err) {
        console.error('[dataService] settings SSE parse error:', err);
      }
    };
    es.onerror = () => {
      es?.close(); es = null;
      if (!fallback) fallback = setInterval(fetchAndBroadcastSettings, 3000);
    };
  }

  connect();

  return () => {
    es?.close();
    if (fallback) clearInterval(fallback);
    _settingsCallbacks = _settingsCallbacks.filter(c => c !== callback);
  };
};

// fetch ครั้งเดียว (ไม่ subscribe ต่อเนื่อง) — ใช้ตอนเปิดหน้า Admin settings เพื่อโหลดค่าปัจจุบันมาแก้ไข
// ถ้าใช้ subscribeToSiteSettings (live) แทน การเชื่อมต่อ SSE ที่หลุดแล้ว fallback ไป poll ทุก 3 วิ จะเขียนทับ
// draft ที่ยังไม่ได้กด "บันทึก" กลับเป็นค่าเดิมจาก server กลางคัน (อาการ: กดปุ่มเปลี่ยนสถานะ แล้ววิ่งกลับเป็นเดิมเอง)
export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) return mergeSettings(await res.json());
  } catch (err) {
    console.error('[dataService] fetchSiteSettings error:', err);
  }
  return DEFAULT_SETTINGS;
}

export const updateSiteSettings = async (settings: SiteSettings) => {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `บันทึกไม่สำเร็จ (${res.status})`);
  }
  // อัพเดต local cache/broadcast หลังยืนยันกับ server สำเร็จแล้วเท่านั้น — เดิมทำก่อนเรียก fetch
  // เลยแสดงผล "บันทึกแล้ว" ในหน้า admin ได้ทั้งที่ server ปฏิเสธ (เช่น session หมดอายุ, 401)
  localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settings));
  broadcastSettings(settings);
};

// ─── ANALYTICS (pageview นับสด — aggregate เท่านั้น ไม่มี tracking รายคน) ─────────
export async function fetchAnalytics(days: number): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?days=${days}&t=${Date.now()}`, { cache: 'no-store', headers: authHeaders() });
  if (!res.ok) throw new Error(`โหลดข้อมูลสถิติไม่สำเร็จ (${res.status})`);
  return res.json();
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

export const seedInitialData = async (
  policies: Omit<Policy, 'id'>[],
  team: Omit<TeamMember, 'id'>[],
  news: Omit<NewsItem, 'id'>[],
  events: Omit<EventItem, 'id'>[]
) => {
  for (const p of policies) await addPolicy(p);
  for (const m of team) await addTeamMember(m);
  for (const n of news) await addNews(n);
  for (const e of events) await addEvent(e);
};
