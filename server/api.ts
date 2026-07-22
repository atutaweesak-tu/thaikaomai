import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { ServerResponse, IncomingMessage } from 'http';
import nodemailer from 'nodemailer';
import { notifyNewsPublished } from './push';

// ── Collections ที่เป็นข้อมูลส่วนบุคคล (PII) — อ่านได้เฉพาะ admin ที่ login แล้ว ─────
// หมายเหตุ: 'users' ไม่อยู่ในนี้แล้ว เพราะต้องการ requireTab('users') โดยเฉพาะ ไม่ใช่แค่ login
// ธรรมดา (requireAuth) — ดู branch col === 'users' ใน data() แทน
const PROTECTED_READ_COLLECTIONS = new Set(['contact', 'volunteer', 'newsletter']);
// Collections ที่ใครก็ส่งฟอร์มเข้ามาได้โดยไม่ต้อง login (public forms)
// "pushTokens" อยู่ในนี้ด้วย — แอปมือถือลงทะเบียน push token ของตัวเองโดยไม่ต้อง login เหมือนกัน
const PUBLIC_POST_COLLECTIONS = new Set(['contact', 'newsletter', 'volunteer', 'pushTokens']);

// ── Rate Limiter (IP-based, ใช้ทั่วไป) ──────────────────────────────────────────
const _rateMap = new Map<string, { count: number; resetAt: number }>();

// ── Client IP resolution (สำหรับ rate limit / login lockout) ───────────────────
// เดิมเชื่อ X-Forwarded-For ตรงๆ จาก client — ปลอมง่ายมาก (สุ่มค่าใหม่ทุก request
// ก็บายพาส rate limit/lockout ได้ทันที) ตอนนี้เชื่อ header นี้เฉพาะตอน connection
// ตรงมาจาก reverse proxy บน host เดียวกัน (nginx/Caddy หน้าบ้าน → private/loopback IP)
// เท่านั้น ถ้า client ต่อเข้า container ตรงๆ (ข้าม proxy) จะใช้ socket.remoteAddress
// ที่ปลอมไม่ได้แทน — nginx/Caddy ต้องตั้ง proxy_set_header X-Real-IP $remote_addr;
// (ค่าเดียว ไม่ append ต่อ จึงเชื่อได้ตรงไปตรงมากว่า X-Forwarded-For ที่บาง config
// อาจแค่ append ต่อท้ายค่าที่ client ปลอมมาโดยไม่ทับ)
const TRUSTED_PROXY_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|::ffff:172\.(1[6-9]|2\d|3[01])\.)/;

function getClientIp(req: IncomingMessage): string {
  const remote = req.socket?.remoteAddress || '';
  if (!TRUSTED_PROXY_IP.test(remote)) return remote || 'unknown'; // ต่อตรง ไม่ผ่าน proxy ที่เชื่อถือได้ — ห้ามเชื่อ header ใดๆ

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  // fallback: X-Forwarded-For — เอาค่าขวาสุด (hop ที่ proxy ของเราเองเป็นคน append ต่อท้าย)
  // ไม่ใช่ค่าซ้ายสุดที่ client ควบคุมได้
  const xff = req.headers['x-forwarded-for'];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  if (xffStr) {
    const parts = xffStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return remote || 'unknown';
}
function isRateLimited(req: IncomingMessage, key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _rateMap.get(key);
  if (!entry || now > entry.resetAt) { _rateMap.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

// ── Login lockout (ต่อบัญชี — กันสลับ IP บรูทฟอร์ซ) ────────────────────────────
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 นาที
// entry ที่ไม่ได้ fail ซ้ำมานานเกินนี้ถือว่าหมดความหมายแล้ว (sweepLoginFails ลบทิ้งได้) — endpoint นี้ไม่ต้อง
// login ก่อน ใครก็ยิงได้ ถ้าไม่เคลียร์เอง entry จะค้างสะสมทีละอีเมล(ปลอมก็ได้ ไม่มีต้นทุน)ไปเรื่อยๆ ไม่มีเพดาน
const LOGIN_FAILS_STALE_MS = 60 * 60 * 1000; // 1 ชั่วโมง
// เพดานกันบวมเร็วเกินไปในช่วงเวลาสั้นๆ ก่อนถึงรอบ sweep ถัดไป (เช่นโดนยิงอีเมลปลอมจำนวนมากรัวๆ จากหลาย IP
// สลับกัน ซึ่ง rate-limit ต่อ IP เพียงอย่างเดียวกันไม่ได้) เกินเพดานนี้ทิ้งความพยายามเงียบๆ ไม่กระทบความปลอดภัย
const LOGIN_FAILS_MAX_ENTRIES = 5000;
const _loginFails = new Map<string, { count: number; lockedUntil: number; lastFailAt: number }>();

function isAccountLocked(email: string): boolean {
  const rec = _loginFails.get(email);
  if (!rec) return false;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) return true;
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) { _loginFails.delete(email); return false; }
  return false;
}
function recordLoginFailure(email: string) {
  if (!_loginFails.has(email) && _loginFails.size >= LOGIN_FAILS_MAX_ENTRIES) return;
  const rec = _loginFails.get(email) || { count: 0, lockedUntil: 0, lastFailAt: 0 };
  rec.count++;
  rec.lastFailAt = Date.now();
  if (rec.count >= LOGIN_MAX_FAILS) rec.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  _loginFails.set(email, rec);
}
function clearLoginFailures(email: string) {
  _loginFails.delete(email);
}
function sweepLoginFails() {
  const now = Date.now();
  for (const [email, rec] of _loginFails) {
    if (now - rec.lastFailAt > LOGIN_FAILS_STALE_MS && now > rec.lockedUntil) _loginFails.delete(email);
  }
}

// ── Email Sender ──────────────────────────────────────────────────────────────
function createMailer(env: Record<string, string>) {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    secure: env.SMTP_SECURE !== 'false',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

// ── HTML Escape ────────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Publish-window check (ตรงกับ logic ฝั่ง client ใน NewsPage.tsx/NewsSection.tsx) ────
function isPublicNow(item: any): boolean {
  if (item.published === false) return false;
  const now = Date.now();
  if (item.publishAt && new Date(item.publishAt).getTime() > now) return false;
  if (item.unpublishAt && new Date(item.unpublishAt).getTime() < now) return false;
  return true;
}

// og:image ต้องเป็น URL จริงให้ crawler ดึงได้ — data: URI (base64) ใช้ไม่ได้ ต้อง fallback เป็นโลโก้แทน
function absoluteImageUrl(host: string, image: string | undefined): string {
  const fallback = `https://${host}/tkm-logo.png`;
  if (!image || image.startsWith('data:')) return fallback;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `https://${host}${image}`;
  return fallback;
}

// ป้องกัน </script> breakout เวลาฝัง JSON-LD ลง <script type="application/ld+json"> — JSON.stringify
// ไม่ escape "<" ให้เอง เผื่อ title/description/ที่อยู่ติดต่อมีข้อความ "</script><script>...</script>"
// ปนอยู่ (admin กรอกเอง ไม่ผ่านการ validate รูปแบบ) จะปิด script tag ก่อนกำหนดแล้วแทรกสคริปต์ใหม่ต่อได้
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// ── Admin accounts (collection "users") ─────────────────────────────────────────
// ตัด passwordHash ออกก่อนส่งให้ client เสมอ ไม่ว่าจะผ่าน GET/SSE/POST response ใดๆ
function stripPasswordHash(item: any) {
  const { passwordHash, ...rest } = item;
  return rest;
}

// ── Session Store ──────────────────────────────────────────────────────────────
// เก็บลงไฟล์ด้วย (ไม่ใช่แค่ memory) กัน restart/deploy ทำให้ admin หลุด login หมดทุกคน — ปัญหาที่เจอซ้ำๆ
// ทุกครั้งที่ deploy ตลอด session ที่ผ่านมา ความเสี่ยงจากการเก็บ token ลงดิสก์ใกล้เคียงกับที่ users.json
// เก็บ passwordHash ไว้อยู่แล้ว ไม่ใช่ความเสี่ยงประเภทใหม่ — sessionsFile ถูกตั้งค่าตอน createApiHandlers
// เรียกครั้งแรก (ต้องรู้ dataDir ซึ่งอยู่นอก scope ของ session store นี้)
interface Session { email: string; name: string; role: 'super_admin' | 'admin'; allowedTabs: string[]; expiresAt: number }
const sessions = new Map<string, Session>();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 ชั่วโมง
let sessionsFile: string | null = null;

function saveSessions() {
  if (!sessionsFile) return;
  try { fs.writeFileSync(sessionsFile, JSON.stringify([...sessions]), 'utf-8'); }
  catch { /* เขียนไม่สำเร็จ — session ยังใช้ได้จาก memory ต่อ แค่ไม่รอดถ้า restart รอบหน้า */ }
}

function loadSessions(file: string) {
  try {
    if (!fs.existsSync(file)) return;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as [string, Session][];
    const now = Date.now();
    for (const [token, s] of raw) if (s.expiresAt > now) sessions.set(token, s); // ข้าม session ที่หมดอายุไปแล้ว
  } catch { /* ไฟล์เสีย/ไม่มี — เริ่มด้วย session ว่างเหมือนพฤติกรรมเดิม */ }
}

function createSession(user: AdminUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email: user.email, name: user.name, role: user.role, allowedTabs: user.allowedTabs, expiresAt: Date.now() + SESSION_TTL });
  saveSessions();
  return token;
}

function purgeExpiredSessions() {
  const now = Date.now();
  let changed = false;
  for (const [token, s] of sessions) if (now > s.expiresAt) { sessions.delete(token); changed = true; }
  if (changed) saveSessions();
}

function getSession(req: IncomingMessage): Session | null {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); saveSessions(); return null; }
  return session;
}

function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!getSession(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'กรุณาเข้าสู่ระบบก่อน' }));
    return false;
  }
  return true;
}

// ── Tab-based permissions ───────────────────────────────────────────────────────
// รายชื่อแท็บทั้งหมดในหน้า Admin — ใช้กำหนดสิทธิ์ต่อ admin แต่ละคน (ผ่าน ADMIN_n_TABS ใน .env)
const ALL_TABS = ['news', 'events', 'policies', 'team', 'newsletter', 'contact', 'volunteer', 'users', 'settings'];
// Admin ทั่วไป (role=admin) ที่ไม่ได้ตั้ง ADMIN_n_TABS เอง จะได้สิทธิ์ทุกแท็บ ยกเว้น settings/users
const DEFAULT_ADMIN_TABS = ALL_TABS.filter(t => t !== 'settings' && t !== 'users');
// collection (/api/data/:col) แต่ละอันผูกกับแท็บไหนในหน้า admin
const COLLECTION_TAB: Record<string, string> = {
  news: 'news', categories: 'news', events: 'events', policies: 'policies', team: 'team',
  newsletter: 'newsletter', contact: 'contact', volunteer: 'volunteer', users: 'users',
  homeblocks: 'settings',
};

function requireTab(req: IncomingMessage, res: ServerResponse, tab: string): boolean {
  const session = getSession(req);
  if (!session) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'กรุณาเข้าสู่ระบบก่อน' }));
    return false;
  }
  if (!session.allowedTabs.includes(tab)) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'บัญชีนี้ไม่มีสิทธิ์จัดการส่วนนี้' }));
    return false;
  }
  return true;
}

// จัดการบัญชีผู้ดูแล (เพิ่ม/แก้/ลบ) ต้องเป็น super_admin เท่านั้น — ไม่ใช่แค่มีสิทธิ์แท็บ "ผู้ดูแล"
// กันกรณี admin ธรรมดาที่ถูกให้สิทธิ์แท็บ users ผ่าน .env สร้าง/เลื่อนบัญชีตัวเองเป็น super_admin ได้
function requireSuperAdmin(req: IncomingMessage, res: ServerResponse): boolean {
  const session = getSession(req);
  if (!session) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'กรุณาเข้าสู่ระบบก่อน' }));
    return false;
  }
  if (session.role !== 'super_admin') {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'ต้องเป็น Super Admin เท่านั้นถึงจะจัดการบัญชีผู้ดูแลได้' }));
    return false;
  }
  return true;
}

async function sendNotification(mailer: nodemailer.Transporter | null, env: Record<string, string>, subject: string, html: string) {
  if (!mailer || !env.SMTP_TO) return;
  try {
    await mailer.sendMail({ from: env.SMTP_USER, to: env.SMTP_TO, subject, html });
  } catch (e) {
    console.error('[email] ส่งอีเมลไม่สำเร็จ:', e);
  }
}

interface AdminUser { email: string; passwordHash: string; name: string; role: 'super_admin' | 'admin'; allowedTabs: string[] }

// bcrypt.compare กับ hash จริงใช้เวลานานกว่าการข้ามไปเลยตอนหาอีเมลไม่เจอ (fast path) — ต่างกันพอให้
// วัด response time แล้วเดาได้ว่าอีเมลนี้มีในระบบหรือไม่ (user enumeration) จึงต้องมี hash หลอกไว้
// เทียบแทนเสมอตอนหาไม่เจอ ให้เวลาตอบใกล้เคียงกันไม่ว่าอีเมลจะมีอยู่จริงหรือไม่
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

// ใช้ normalize role/allowedTabs ตอนสร้าง/แก้บัญชีผู้ดูแลผ่าน UI (collection "users") — super_admin
// ได้ทุกแท็บเสมอ (เชื่อ client ไม่ได้), admin ที่ไม่ได้เลือกแท็บเลยได้ค่า default เหมือน .env-based account
function normalizeAdminRoleTabs(role: any, allowedTabs: any): { role: 'admin' | 'super_admin'; allowedTabs: string[] } {
  const normRole: 'admin' | 'super_admin' = role === 'super_admin' ? 'super_admin' : 'admin';
  if (normRole === 'super_admin') return { role: normRole, allowedTabs: [...ALL_TABS] };
  const filtered = Array.isArray(allowedTabs) ? allowedTabs.filter((t: any) => ALL_TABS.includes(t)) : [];
  return { role: normRole, allowedTabs: filtered.length ? filtered : [...DEFAULT_ADMIN_TABS] };
}

// แปลงข้อมูลดิบจาก data/users.json (บัญชีที่สร้างผ่าน UI) ให้เป็นรูปแบบเดียวกับ AdminUser ที่มาจาก .env
// ป้องกันแบบ defensive เผื่อไฟล์ถูกแก้มือจนข้อมูลผิดรูป (role/allowedTabs ไม่ใช่ค่าที่คาดไว้)
function mapStoredToAdminUser(u: any): AdminUser {
  const role: 'super_admin' | 'admin' = u.role === 'super_admin' ? 'super_admin' : 'admin';
  const allowedTabs = Array.isArray(u.allowedTabs) && u.allowedTabs.length
    ? u.allowedTabs
    : (role === 'super_admin' ? ALL_TABS : DEFAULT_ADMIN_TABS);
  return { email: String(u.email || ''), passwordHash: String(u.passwordHash || ''), name: String(u.name || ''), role, allowedTabs };
}

function loadAdminUsers(rawEnv: Record<string, string>): AdminUser[] {
  return [1, 2, 3, 4, 5, 6].map(i => {
    const role: 'super_admin' | 'admin' = rawEnv[`ADMIN_${i}_ROLE`] === 'super_admin' || (i === 1 && !rawEnv[`ADMIN_${i}_ROLE`]) ? 'super_admin' : 'admin';
    const tabsRaw = rawEnv[`ADMIN_${i}_TABS`];
    const allowedTabs = tabsRaw
      ? tabsRaw.split(',').map(t => t.trim()).filter(t => ALL_TABS.includes(t))
      : (role === 'super_admin' ? ALL_TABS : DEFAULT_ADMIN_TABS);
    return {
      email: rawEnv[`ADMIN_${i}_EMAIL`] || '',
      passwordHash: rawEnv[`ADMIN_${i}_PASSWORD_HASH`] || '',
      name: rawEnv[`ADMIN_${i}_NAME`] || `Admin ${i}`,
      role,
      allowedTabs,
    };
  }).filter(u => u.email && u.passwordHash);
}

export function createApiHandlers(env: Record<string, string>, dataDir: string, distDir: string) {
  const mailer = createMailer(env);
  const adminUsers = loadAdminUsers(env);

  // โหลด session ที่ persist ไว้จาก process ก่อนหน้า (ถ้ามี) ก่อนรับ request แรก
  sessionsFile = path.join(dataDir, 'sessions.json');
  loadSessions(sessionsFile);

  // ── Per-collection write queue ──────────────────────────────────
  // readCollection()/writeCollection() คือ read-modify-write บนไฟล์ JSON แบบ sync ไม่มี lock ใดๆ
  // ถ้ามี 2 request มาเขียน collection เดียวกันพร้อมกัน (เช่น browser ค้างแล้วยิง request ซ้อนกันหลายอัน)
  // request ที่ read ก่อนแล้ว write ทีหลังจะทับข้อมูลที่ request อื่นเพิ่งเขียนไปทิ้งได้ (lost update)
  // จึงต้อง serialize เฉพาะงานเขียนของ collection เดียวกันให้รันทีละอันตามลำดับที่มาถึง
  const collectionQueues = new Map<string, Promise<void>>();
  function runExclusive(col: string, fn: () => void) {
    const prev = collectionQueues.get(col) || Promise.resolve();
    const next = prev.then(fn, fn); // รันต่อจากคิวเดิมเสมอ ไม่ว่าอันก่อนหน้าจะสำเร็จหรือ throw
    collectionQueues.set(col, next.catch(() => {}));
  }

  // SSE clients per collection — ค่า boolean คือ client นี้ login แล้วหรือไม่ ใช้กรอง item ที่ยังไม่
  // เผยแพร่ (isPublicNow) ออกก่อนส่งให้ client ที่ไม่ได้ login เวลามีการแก้ไขสด (ดู broadcastCollection)
  const sseClients: Record<string, Map<ServerResponse, boolean>> = {};

  function broadcastCollection(col: string, items: any[]) {
    const clients = sseClients[col];
    if (!clients) return;
    const fullPayload = col === 'users' ? items.map(stripPasswordHash) : items;
    // client สาธารณะ (ไม่ login) เห็นเฉพาะ item ที่เผยแพร่จริงเท่านั้น — กันหลุด draft ผ่าน live update
    const publicPayload = col === 'users' ? [] : items.filter(isPublicNow);
    clients.forEach((isAuthed, client) => {
      try { client.write(`data: ${JSON.stringify(isAuthed ? fullPayload : publicPayload)}\n\n`); }
      catch { clients.delete(client); }
    });
  }

  function readCollection(col: string): any[] {
    const file = path.join(dataDir, `${col}.json`);
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
  }

  function writeCollection(col: string, items: any[]) {
    const file = path.join(dataDir, `${col}.json`);
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf-8');
  }

  function readSettings(): string {
    const file = path.join(dataDir, 'settings.json');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '{}';
  }

  const settingsSseClients = new Set<ServerResponse>();
  function broadcastSettings(data: string) {
    settingsSseClients.forEach(client => {
      try { client.write(`data: ${data}\n\n`); }
      catch { settingsSseClients.delete(client); }
    });
  }

  // ── Auth Login ─────────────────────────────────────────────────
  async function login(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }

    if (isRateLimited(req, `login:${getClientIp(req)}`, 8, 15 * 60_000)) {
      res.statusCode = 429;
      res.end(JSON.stringify({ error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่' }));
      return;
    }

    let body = '';
    req.on('data', c => { body += c.toString().slice(0, 500); });
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body || '{}');
        const normalizedEmail = String(email || '').toLowerCase();

        if (isAccountLocked(normalizedEmail)) {
          res.statusCode = 429;
          res.end(JSON.stringify({ error: 'บัญชีถูกล็อกชั่วคราวจากการเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาที' }));
          return;
        }

        // บัญชีจาก .env เช็คก่อนเสมอ (ชนะถ้าอีเมลซ้ำ) ต่อด้วยบัญชีที่สร้างผ่าน UI (data/users.json)
        // อ่านไฟล์สดใหม่ทุกครั้งที่ login — ต่างจาก adminUsers (.env) ที่ cache ไว้ตอน server เริ่มทำงาน
        // เพราะทั้งหมดของฟีเจอร์นี้คือให้เพิ่ม/แก้บัญชีได้โดยไม่ต้อง restart server
        const jsonAdmins = readCollection('users').map(mapStoredToAdminUser);
        const match = [...adminUsers, ...jsonAdmins].find(u => u.email.toLowerCase() === normalizedEmail);
        // เทียบ hash เสมอ (ของจริงถ้าเจอ, ของหลอกถ้าไม่เจอ) กัน timing side-channel — ดู DUMMY_PASSWORD_HASH ด้านบน
        const ok = await bcrypt.compare(String(password || ''), match ? match.passwordHash : DUMMY_PASSWORD_HASH);

        if (!ok) {
          recordLoginFailure(normalizedEmail);
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }));
          return;
        }

        clearLoginFailures(normalizedEmail);
        const token = createSession(match!);
        res.end(JSON.stringify({ token, user: { email: match!.email, name: match!.name, role: match!.role, allowedTabs: match!.allowedTabs } }));
      } catch {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  }

  // ── Auth Logout ────────────────────────────────────────────────
  function logout(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
    const token = (req.headers['authorization'] || '').toString().replace(/^Bearer\s+/i, '');
    if (token) { sessions.delete(token); saveSessions(); }
    res.end('{"ok":true}');
  }

  // ── Settings SSE ──────────────────────────────────────────────
  function settingsStream(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${readSettings()}\n\n`);
    settingsSseClients.add(res);
    req.on('close', () => settingsSseClients.delete(res));
  }

  // ── Settings GET/POST ─────────────────────────────────────────
  function settings(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.statusCode = 204; res.end(); return;
    }
    if (req.method === 'GET') { res.end(readSettings()); return; }
    if (req.method === 'POST') {
      if (!requireTab(req, res, 'settings')) return;
      let body = '';
      const MAX_SETTINGS_SIZE = 2 * 1024 * 1024; // 2 MB
      req.on('data', c => {
        body += c;
        if (body.length > MAX_SETTINGS_SIZE) {
          req.destroy();
          res.statusCode = 413; res.end('{"error":"Payload too large"}');
        }
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        try {
          JSON.parse(body); // validate JSON before saving
          fs.writeFileSync(path.join(dataDir, 'settings.json'), body, 'utf-8');
          broadcastSettings(body);
          res.end('{"ok":true}');
        } catch { res.statusCode = 400; res.end('{"error":"เกิดข้อผิดพลาด"}'); }
      });
      return;
    }
    res.statusCode = 405; res.end('{}');
  }

  // ── File Upload ───────────────────────────────────────────────
  function upload(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.statusCode = 204; res.end(); return;
    }
    if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
    if (!requireAuth(req, res)) return;

    const contentType = req.headers['content-type'] || '';
    const allowedMime: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png',
      'image/gif': 'gif', 'image/webp': 'webp',
    };
    const mimeKey = contentType.split(';')[0].trim();
    if (!allowedMime[mimeKey]) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, GIF, WebP)' }));
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const uploadsDir = path.resolve(dataDir, '..', 'public/uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = allowedMime[mimeKey] || 'jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        req.destroy();
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'ไฟล์ใหญ่เกิน 5 MB' }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        fs.writeFileSync(filepath, Buffer.concat(chunks));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: `/uploads/${filename}` }));
      } catch {
        res.statusCode = 500; res.end(JSON.stringify({ error: 'อัพโหลดไม่สำเร็จ' }));
      }
    });
  }

  // ── Media Library ────────────────────────────────────────────
  // filesystem (public/uploads) คือ source of truth เดียว — ไม่เก็บ collection แยกมา track รายชื่อไฟล์
  // เพราะจะ drift จากของจริงได้ (เช่นไฟล์ถูกลบนอกระบบ) requireAuth เดียวกับ /api/upload (admin ที่ login แล้วคนไหนก็ได้)
  function media(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
    if (!requireAuth(req, res)) return;

    const uploadsDir = path.resolve(dataDir, '..', 'public/uploads');
    if (!fs.existsSync(uploadsDir)) { res.end('[]'); return; }

    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    const files = fs.readdirSync(uploadsDir)
      .filter(name => allowedExt.has(path.extname(name).toLowerCase()))
      .map(name => {
        const stat = fs.statSync(path.join(uploadsDir, name));
        return { url: `/uploads/${name}`, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 200); // พอสำหรับ picker ในหน้า admin — ไม่ต้อง paginate เพิ่มความซับซ้อนตอนนี้

    res.end(JSON.stringify(files));
  }

  // ── Collection API (+ SSE) ────────────────────────────────────
  function data(req: IncomingMessage, res: ServerResponse) {
    const urlPath = (req.url || '').split('?')[0]; // strip query string
    const parts = urlPath.split('/').filter(Boolean);
    const col = parts[0];
    const idOrStream = parts[1];

    if (!col) { res.statusCode = 400; res.end('[]'); return; }

    // "settings" ไม่ใช่ collection ทั่วไป — มี endpoint ของตัวเอง (/api/settings) ที่เก็บเป็น object
    // เดียว ไม่ใช่ array แบบ collection อื่น และบังคับ requireTab('settings') โดยเฉพาะ ถ้าปล่อยให้
    // เส้นทางนี้จัดการ col="settings" ต่อไป จะไปอ่าน/เขียนไฟล์ settings.json ไฟล์เดียวกันด้วย logic
    // คนละแบบ (array) ทำให้ admin ที่ไม่มีสิทธิ์แท็บ "ตั้งค่าเว็บ" หลุดผ่าน requireAuth ธรรมดาแทน
    // requireTab ไปแตะไฟล์นี้ได้ — จึงต้องกันไว้ตรงนี้เลย
    if (col === 'settings') { res.statusCode = 404; res.end(JSON.stringify({ error: 'ไม่พบ endpoint นี้ — ใช้ /api/settings แทน' })); return; }
    // "sessions" ไม่ใช่ collection สาธารณะ — เป็นไฟล์ persist bearer token ของ admin (ดู Session Store
    // ด้านบน) ถ้าปล่อยให้เส้นทางนี้อ่าน sessions.json ตรงๆ จะหลุด token ทุกคนออกทาง GET ที่ไม่ต้อง login เลย
    if (col === 'sessions') { res.statusCode = 404; res.end(JSON.stringify({ error: 'ไม่พบ endpoint นี้' })); return; }
    // "pushTokens" เก็บ push token ของเครื่องผู้ใช้แต่ละคน — ไม่ใช่ collection สาธารณะสำหรับอ่านเหมือน
    // news/events (ที่ยอม GET แบบเผยแพร่แล้วได้) มี endpoint POST สำหรับลงทะเบียน token เท่านั้น เพราะ
    // item พวกนี้ไม่มี field "published" เลย ถ้าปล่อยให้ไหลลง GET path ทั่วไปด้านล่าง isPublicNow จะมองว่า
    // "เผยแพร่" หมดทุกอัน หลุด token ทุกเครื่องออกทาง GET ที่ไม่ต้อง login เลย
    if (col === 'pushTokens' && req.method !== 'POST') { res.statusCode = 404; res.end(JSON.stringify({ error: 'ไม่พบ endpoint นี้' })); return; }

    res.setHeader('Cache-Control', 'no-store');
    const isProtected = PROTECTED_READ_COLLECTIONS.has(col);

    // SSE stream — collections ที่เป็น PII ต้อง auth ก่อนเปิด stream ด้วย
    // "users" ต้องมีสิทธิ์แท็บ users โดยเฉพาะ (เข้มกว่า requireAuth ธรรมดา) และต้องตัด passwordHash ออกก่อนส่งเสมอ
    if (idOrStream === 'stream') {
      if (col === 'users') { if (!requireTab(req, res, 'users')) return; }
      else if (isProtected && !requireAuth(req, res)) return;
      // client ที่ไม่ได้ login (เว็บสาธารณะ) เห็นเฉพาะ item ที่เผยแพร่จริง — ตัด draft/unpublished ออกทั้ง
      // payload แรกตอนเปิด stream และทุกครั้งที่มีการแก้ไขสดผ่าน broadcastCollection ด้านบน
      const isAuthed = col !== 'users' && !!getSession(req);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const allItems = readCollection(col);
      const initial = col === 'users' ? allItems.map(stripPasswordHash) : (isAuthed ? allItems : allItems.filter(isPublicNow));
      res.write(`data: ${JSON.stringify(initial)}\n\n`);
      if (!sseClients[col]) sseClients[col] = new Map();
      sseClients[col].set(res, isAuthed);
      req.on('close', () => sseClients[col]?.delete(res));
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.statusCode = 204; res.end(); return;
    }

    // GET — collections ที่เป็น PII (contact/volunteer/newsletter) ต้อง login ก่อนอ่าน
    // "users" ต้องมีสิทธิ์แท็บ users โดยเฉพาะ และตัด passwordHash ออกก่อนส่งเสมอ
    // มี /:id ต่อท้ายก็ได้ (เช่น GET /api/data/news/abc123) — ดึงทีละชิ้นแทนทั้ง collection สำหรับ
    // แอปมือถือ/deep-link ในอนาคตที่ไม่อยากโหลดทั้ง collection แค่เพื่อเปิดข่าวชิ้นเดียว
    if (req.method === 'GET') {
      if (col === 'users') {
        if (!requireTab(req, res, 'users')) return;
        const usersList = readCollection(col).map(stripPasswordHash);
        if (idOrStream) {
          const item = usersList.find((u: any) => u.id === idOrStream);
          if (!item) { res.statusCode = 404; res.end(JSON.stringify({ error: 'ไม่พบข้อมูล' })); return; }
          res.end(JSON.stringify(item)); return;
        }
        res.end(JSON.stringify(usersList)); return;
      }
      if (isProtected && !requireAuth(req, res)) return;
      // ไม่ login (เว็บสาธารณะ/มือถือในอนาคต) เห็นเฉพาะ item ที่เผยแพร่จริง — เดิมโค้ดจุดนี้ส่งทั้ง
      // collection กลับไปตรงๆ ไม่กรอง published/publishAt/unpublishAt เลย ทำให้ draft หลุดผ่าน API ได้
      // แม้หน้าเว็บจะกรองด้วย client-side logic อยู่แล้วก็ตาม (เข้าถึงตรงผ่าน curl/มือถือได้อยู่ดี)
      const visible = getSession(req) ? readCollection(col) : readCollection(col).filter(isPublicNow);
      if (idOrStream) {
        const item = visible.find((i: any) => i.id === idOrStream);
        // ไม่พบ = ไม่มีจริง หรือมีแต่ยังไม่เผยแพร่ (กรองออกไปแล้วข้างบน) ตอบ 404 เหมือนกันทั้งสองกรณี
        // ไม่ให้แยกแยะได้ว่า id นี้มีอยู่จริงแต่แค่ยังไม่เผยแพร่หรือไม่มีเลย
        if (!item) { res.statusCode = 404; res.end(JSON.stringify({ error: 'ไม่พบข้อมูล' })); return; }
        res.end(JSON.stringify(item)); return;
      }
      res.end(JSON.stringify(visible)); return;
    }

    if (col === 'users') {
      // เพิ่ม/แก้/ลบบัญชีผู้ดูแล ต้องเป็น super_admin เท่านั้น ไม่ใช่แค่มีสิทธิ์แท็บ users (ดู requireSuperAdmin)
      if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !requireSuperAdmin(req, res)) return;
    } else {
      const tabForCol = COLLECTION_TAB[col];
      // PUT / DELETE ต้อง auth + มีสิทธิ์แท็บของ collection นี้เสมอ
      if ((req.method === 'PUT' || req.method === 'DELETE') && !(tabForCol ? requireTab(req, res, tabForCol) : requireAuth(req, res))) return;
      // POST ต้อง auth + มีสิทธิ์แท็บ ยกเว้นฟอร์มสาธารณะ (contact / newsletter / volunteer)
      if (req.method === 'POST' && !PUBLIC_POST_COLLECTIONS.has(col) && !(tabForCol ? requireTab(req, res, tabForCol) : requireAuth(req, res))) return;
    }

    const session = getSession(req); // มีค่าเฉพาะ request ที่ login แล้ว — ใช้ประทับ audit trail

    let body = '';
    const MAX_BODY = 1 * 1024 * 1024; // 1 MB
    req.on('data', c => {
      body += c;
      if (body.length > MAX_BODY) {
        req.destroy();
        res.statusCode = 413; res.end('{"error":"Payload too large"}');
      }
    });
    req.on('end', async () => {
      if (res.writableEnded) return;

      // "users": ต้อง hash รหัสผ่านแบบ async ก่อนเข้า runExclusive (sync) — parse body ล่วงหน้าที่นี่
      let usersParsedBody: any = null;
      let usersNewPasswordHash: string | undefined;
      if (col === 'users' && (req.method === 'POST' || req.method === 'PUT')) {
        try {
          usersParsedBody = JSON.parse(body || '{}');
        } catch {
          res.statusCode = 400; res.end(JSON.stringify({ error: 'ข้อมูลไม่ถูกต้อง' })); return;
        }
        const password = usersParsedBody.password;
        if (req.method === 'POST' || password) {
          if (!password || String(password).length < 8) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร' })); return;
          }
          usersNewPasswordHash = await bcrypt.hash(String(password), 12);
        }
      }

      runExclusive(col, () => {
      try {
        let items = readCollection(col);

        if (req.method === 'POST' && col === 'pushTokens') {
          // limit หลวมกว่าฟอร์มสาธารณะทั่วไป (contact/newsletter/volunteer) เพราะแอปอาจลงทะเบียนซ้ำ
          // ทุกครั้งที่เปิดแอป และหลายเครื่องอาจอยู่หลัง IP เดียวกัน (NAT บ้าน/ออฟฟิศ)
          if (isRateLimited(req, `pushTokens:${getClientIp(req)}`, 20, 600_000)) {
            res.statusCode = 429; res.end(JSON.stringify({ error: 'ลงทะเบียนบ่อยเกินไป กรุณารอสักครู่' })); return;
          }
          const parsedBody = JSON.parse(body || '{}');
          const token = String(parsedBody.token || '');
          const platform = parsedBody.platform === 'ios' || parsedBody.platform === 'android' ? parsedBody.platform : null;
          if (!/^ExponentPushToken\[.+\]$/.test(token) || !platform) {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'ข้อมูล token ไม่ถูกต้อง' })); return;
          }
          const nowIso = new Date().toISOString();
          const existingIdx = items.findIndex((t: any) => t.token === token);
          if (existingIdx >= 0) {
            items[existingIdx] = { ...items[existingIdx], platform, lastSeenAt: nowIso };
          } else {
            items = [{ id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, token, platform, createdAt: nowIso, lastSeenAt: nowIso }, ...items];
          }
          writeCollection(col, items);
          res.statusCode = 201; res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (req.method === 'POST') {
          // Rate limit ฟอร์มสาธารณะ (3 requests / 10 min per IP)
          if (PUBLIC_POST_COLLECTIONS.has(col) && isRateLimited(req, `${col}:${getClientIp(req)}`, 3, 600_000)) {
            res.statusCode = 429;
            res.end(JSON.stringify({ error: 'ส่งข้อความบ่อยเกินไป กรุณารอสักครู่' }));
            return;
          }

          const parsedBody = col === 'users' ? usersParsedBody : JSON.parse(body || '{}');

          // Honeypot (เฉพาะฟอร์มสาธารณะ) — ฟิลด์ "website" คนจริงมองไม่เห็น (ดู src/components/Honeypot.tsx)
          // ถ้ามีค่าแปลว่าเป็นบอทที่กรอกทุกช่อง input ที่เจอแบบไม่สนใจ CSS ตอบเหมือนสำเร็จแต่ไม่บันทึก/
          // ไม่ส่งอีเมลแจ้งเตือนอะไรเลย เงียบๆ ไม่ tip off ให้บอทรู้ว่าโดนจับ
          if (PUBLIC_POST_COLLECTIONS.has(col) && parsedBody.website) {
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          delete parsedBody.website;

          delete parsedBody.createdBy; delete parsedBody.updatedBy; delete parsedBody.createdAt; delete parsedBody.updatedAt;

          if (col === 'users') {
            const email = String(parsedBody.email || '').trim().toLowerCase();
            if (!email || !parsedBody.name) {
              res.statusCode = 400; res.end(JSON.stringify({ error: 'กรุณากรอกอีเมลและชื่อ' })); return;
            }
            const emailTaken = adminUsers.some(u => u.email.toLowerCase() === email)
              || items.some((u: any) => String(u.email || '').toLowerCase() === email);
            if (emailTaken) {
              res.statusCode = 409; res.end(JSON.stringify({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' })); return;
            }
            const { role, allowedTabs } = normalizeAdminRoleTabs(parsedBody.role, parsedBody.allowedTabs);
            delete parsedBody.password;
            parsedBody.email = email;
            parsedBody.role = role;
            parsedBody.allowedTabs = allowedTabs;
            parsedBody.passwordHash = usersNewPasswordHash;
          }

          const nowIso = new Date().toISOString();
          const newItem = {
            ...parsedBody,
            id: `${col}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ...(session ? { createdBy: session.email, createdAt: nowIso, updatedBy: session.email, updatedAt: nowIso } : {}),
          };
          items = [newItem, ...items];
          writeCollection(col, items);
          broadcastCollection(col, items);

          // Send email notification (ผ่าน escapeHtml เพื่อป้องกัน HTML injection)
          if (col === 'contact') {
            const { name, email: from, message } = newItem;
            sendNotification(mailer, env,
              `[ไทยก้าวใหม่] ข้อความใหม่จาก ${escapeHtml(name)}`,
              `<h2>ข้อความใหม่จากฟอร์มติดต่อ</h2>
               <p><b>ชื่อ:</b> ${escapeHtml(name)}</p>
               <p><b>อีเมล:</b> ${escapeHtml(from)}</p>
               <p><b>ข้อความ:</b></p><p>${escapeHtml(message)}</p>`
            );
          } else if (col === 'newsletter') {
            sendNotification(mailer, env,
              `[ไทยก้าวใหม่] สมาชิกใหม่: ${escapeHtml(newItem.email)}`,
              `<h2>มีผู้สมัครรับข่าวสารใหม่</h2><p><b>อีเมล:</b> ${escapeHtml(newItem.email)}</p>`
            );
          } else if (col === 'volunteer') {
            sendNotification(mailer, env,
              `[ไทยก้าวใหม่] อาสาสมัครใหม่: ${escapeHtml(newItem.name || '')}`,
              `<h2>มีผู้สมัครอาสาสมัครใหม่</h2>
               <p><b>ชื่อ:</b> ${escapeHtml(newItem.name || '')}</p>
               <p><b>เบอร์โทร:</b> ${escapeHtml(newItem.phone || '')}</p>
               <p><b>อีเมล:</b> ${escapeHtml(newItem.email || '')}</p>
               <p><b>จังหวัด:</b> ${escapeHtml(newItem.province || '')}</p>`
            );
          }

          // ข่าวที่สร้างใหม่แล้วเผยแพร่เลย (ไม่ใช่ draft) — แจ้งเตือน push ทันที ทำแบบ fire-and-forget
          // ไม่ await เพื่อไม่ให้การตอบกลับ admin ช้าลงหรือ fail ตามไปด้วยถ้า push service ล่ม
          if (col === 'news' && isPublicNow(newItem)) notifyNewsPublished(dataDir, newItem);

          res.statusCode = 201;
          res.end(JSON.stringify(col === 'users' ? stripPasswordHash(newItem) : newItem));

        } else if (req.method === 'PUT' && idOrStream) {
          const update = col === 'users' ? usersParsedBody : JSON.parse(body || '{}');
          delete update.createdBy; delete update.createdAt; delete update.updatedBy; delete update.updatedAt;
          const idx = items.findIndex((i: any) => i.id === idOrStream);
          if (idx < 0) {
            // เดิม code ตรงนี้จะเขียนไฟล์ทับด้วยข้อมูลเดิม (ไม่เปลี่ยนอะไร) แล้วตอบ ok:true กลับไปเฉยๆ
            // ทำให้ผู้ใช้กด "บันทึก" แล้วเข้าใจว่าสำเร็จ ทั้งที่จริงไม่มีอะไรถูกแก้เลย — ตอบ 404 แทน
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้วจากที่อื่น)' }));
            return;
          }

          if (col === 'users') {
            const target = items[idx];
            const isSelf = !!session && String(target.email || '').toLowerCase() === session.email.toLowerCase();

            if ('email' in update) {
              const newEmail = String(update.email || '').trim().toLowerCase();
              if (!newEmail) { res.statusCode = 400; res.end(JSON.stringify({ error: 'กรุณากรอกอีเมล' })); return; }
              if (newEmail !== String(target.email || '').toLowerCase()) {
                const emailTaken = adminUsers.some(u => u.email.toLowerCase() === newEmail)
                  || items.some((u: any, i: number) => i !== idx && String(u.email || '').toLowerCase() === newEmail);
                if (emailTaken) {
                  res.statusCode = 409; res.end(JSON.stringify({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' })); return;
                }
              }
              update.email = newEmail;
            }

            const effectiveRole = update.role !== undefined ? update.role : target.role;
            const effectiveTabsInput = update.allowedTabs !== undefined ? update.allowedTabs : target.allowedTabs;
            const { role, allowedTabs } = normalizeAdminRoleTabs(effectiveRole, effectiveTabsInput);

            if (isSelf && (role !== 'super_admin' || !allowedTabs.includes('users'))) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'ไม่สามารถลดสิทธิ์หรือถอดสิทธิ์จัดการผู้ดูแลของบัญชีตัวเองได้' }));
              return;
            }

            update.role = role;
            update.allowedTabs = allowedTabs;
            delete update.password;
            if (usersNewPasswordHash) update.passwordHash = usersNewPasswordHash;
            else delete update.passwordHash; // กันไม่ให้ client ส่ง passwordHash มาทับเองได้
          }

          const wasPublicBefore = col === 'news' && isPublicNow(items[idx]);
          items[idx] = {
            ...items[idx], ...update,
            ...(session ? { updatedBy: session.email, updatedAt: new Date().toISOString() } : {}),
          };
          writeCollection(col, items);
          broadcastCollection(col, items);
          // แจ้งเตือนเฉพาะตอนข่าว "เปลี่ยนจาก draft เป็นเผยแพร่" ในการบันทึกครั้งนี้เท่านั้น — กันไม่ให้ยิงซ้ำ
          // ทุกครั้งที่ admin แก้ไขข่าวที่เผยแพร่อยู่แล้ว (เช่น แก้ตัวสะกด)
          if (col === 'news' && !wasPublicBefore && isPublicNow(items[idx])) notifyNewsPublished(dataDir, items[idx]);
          res.end('{"ok":true}');

        } else if (req.method === 'DELETE' && idOrStream) {
          if (col === 'users' && session) {
            const target = items.find((i: any) => i.id === idOrStream);
            if (target && String(target.email || '').toLowerCase() === session.email.toLowerCase()) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }));
              return;
            }
          }
          items = items.filter((i: any) => i.id !== idOrStream);
          writeCollection(col, items);
          broadcastCollection(col, items);
          res.end('{"ok":true}');

        } else {
          res.statusCode = 405; res.end('{}');
        }
      } catch {
        res.statusCode = 500; res.end(JSON.stringify({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }));
      }
      });
    });
  }

  // ── SPA HTML renderer (SEO: meta injection สำหรับหน้าข่าว + JSON-LD พื้นฐานทุกหน้า) ──
  // ทำงานแทน app.get('*', res.sendFile(...)) เดิมใน server/index.ts — อ่าน dist/index.html สดทุก
  // request (ไฟล์เล็ก ไม่คุ้มทำ cache ให้ซับซ้อนเพิ่ม) แล้วแทนที่ meta tag เฉพาะตอนเป็นหน้าข่าวที่เผยแพร่จริง
  // เหตุผลที่ต้องทำแบบนี้ (ไม่ใช่แค่แก้ document.title ฝั่ง client เหมือนเดิม): บอทของ Facebook/LINE/Twitter
  // ที่ดึง preview ตอนแชร์ลิงก์ไม่รัน JavaScript เลย เห็นแค่ HTML ที่ server ส่งมาตรงๆ
  function renderSpaHtml(req: IncomingMessage, res: ServerResponse) {
    trackPageview((req.url || '/').split('?')[0]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const indexPath = path.join(distDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');
    const host = req.headers.host || '';
    const urlPath = (req.url || '').split('?')[0];

    const newsMatch = urlPath.match(/^\/news\/([^/]+)\/?$/);
    if (newsMatch) {
      const item = readCollection('news').find((n: any) => n.id === newsMatch[1]);
      if (item && isPublicNow(item)) {
        const title = escapeHtml(item.seoTitle || item.title || '');
        const description = escapeHtml(item.seoDescription || item.summary || '');
        // image เป็นค่าที่ admin กรอกเอง (แม้แค่สิทธิ์แท็บ "news" ธรรมดา) ไม่ผ่านการ validate รูปแบบ
        // URL เลย — เก็บค่าดิบไว้ใช้ใน JSON-LD (safeJsonLd จัดการ escape ของมันเองแบบเหมาะกับ JSON)
        // ส่วนที่แทรกลง HTML attribute (content="...") ต้อง escapeHtml แยกต่างหาก ไม่งั้นหลุดออกจาก
        // attribute ได้ (เช่น image ที่มี "><script>...</script> ปนอยู่)
        const imageUrl = absoluteImageUrl(host, item.image);
        const image = escapeHtml(imageUrl);
        html = html
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
          .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
          .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1article$2`)
          .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
          .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`)
          .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`);

        const articleLd = {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: item.title,
          description: item.summary || '',
          image: imageUrl,
          datePublished: item.createdAt || item.date || '',
          dateModified: item.updatedAt || item.createdAt || item.date || '',
        };
        html = html.replace('</head>', `<script type="application/ld+json">${safeJsonLd(articleLd)}</script></head>`);
      }
    }

    // Organization JSON-LD — ใส่ทุกหน้า ใช้ข้อมูลจาก settings.contact ที่มีอยู่แล้ว
    try {
      const siteSettings = JSON.parse(readSettings());
      const contact = siteSettings?.contact || {};
      const orgLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'พรรคไทยก้าวใหม่',
        url: `https://${host}`,
        logo: `https://${host}/tkm-logo.png`,
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.phone ? { telephone: contact.phone } : {}),
        ...(contact.address ? { address: contact.address } : {}),
        sameAs: [contact.facebook, contact.twitter, contact.instagram, contact.youtube].filter((u: string) => u && u !== '#'),
      };
      html = html.replace('</head>', `<script type="application/ld+json">${safeJsonLd(orgLd)}</script></head>`);
    } catch { /* settings.json แปลกๆ — ข้าม JSON-LD องค์กรไปเฉยๆ ไม่ทำให้หน้าเว็บพังทั้งหน้า */ }

    res.end(html);
  }

  // ── sitemap.xml — generate สดจากข่าวที่เผยแพร่จริง (เนื้อหาเปลี่ยนตลอดผ่าน admin ทำเป็น static ไม่ได้) ──
  function sitemap(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    const host = req.headers.host || '';
    const base = `https://${host}`;
    const staticPaths = ['/', '/about', '/policies', '/team', '/news', '/contact', '/volunteer', '/privacy'];
    const newsUrls = readCollection('news').filter(isPublicNow).map((n: any) => `/news/${n.id}`);
    const urls = [...staticPaths, ...newsUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map(u => `  <url><loc>${base}${u}</loc></url>`).join('\n')
    }\n</urlset>\n`;
    res.end(xml);
  }

  // ── Visitor analytics (ฝังเอง, aggregate เท่านั้น — ไม่มี cookie/fingerprint/เก็บ IP รายคน) ──
  // นับ pageview ต่อ (วันที่, path) ใน memory ก่อน แล้ว flush ลง data/analytics.json เป็นระยะ (ไม่เขียน
  // ไฟล์ทุก request เพราะ IO ถี่เกินจำเป็นสำหรับข้อมูลระดับนี้) — trigger จาก renderSpaHtml เท่านั้น จึงนับ
  // เฉพาะ request หน้าเว็บจริง ไม่รวม /api/*, ไฟล์ static (express.static เสิร์ฟไปก่อนถึง catch-all แล้ว),
  // /sitemap.xml, /robots.txt เพราะ route พวกนั้นไม่ผ่าน renderSpaHtml
  const ANALYTICS_MAX_PATHS_PER_DAY = 500; // กัน path สุ่ม (บอทยิงมั่ว) ทำให้ memory บวมไม่มีเพดานระหว่างรอ flush
  const ANALYTICS_RETENTION_DAYS = 90;
  const _pageviews = new Map<string, Map<string, number>>(); // date(YYYY-MM-DD) -> path -> count, ล้างทุกครั้งที่ flush

  function trackPageview(urlPath: string) {
    const date = new Date().toISOString().slice(0, 10);
    let dayMap = _pageviews.get(date);
    if (!dayMap) { dayMap = new Map(); _pageviews.set(date, dayMap); }
    let key = urlPath || '/';
    if (key.length > 200 || (!dayMap.has(key) && dayMap.size >= ANALYTICS_MAX_PATHS_PER_DAY)) key = '/__other__';
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }

  function flushAnalytics() {
    if (_pageviews.size === 0) return;
    const file = path.join(dataDir, 'analytics.json');
    let stored: Record<string, Record<string, number>> = {};
    try { if (fs.existsSync(file)) stored = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { stored = {}; }

    for (const [date, dayMap] of _pageviews) {
      const existing = stored[date] || {};
      for (const [p, count] of dayMap) existing[p] = (existing[p] || 0) + count;
      stored[date] = existing;
    }
    _pageviews.clear();

    const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const date of Object.keys(stored)) if (date < cutoff) delete stored[date];

    fs.writeFileSync(file, JSON.stringify(stored), 'utf-8');
  }

  // GET /api/analytics?days=30 — ใช้สิทธิ์แท็บ "ตั้งค่าเว็บ" (settings) เดียวกัน ไม่สร้าง permission tier ใหม่
  function analytics(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end('{}'); return; }
    if (!requireTab(req, res, 'settings')) return;

    flushAnalytics(); // ให้เห็นข้อมูลล่าสุดทันทีตอนเปิดดู ไม่ต้องรอรอบ flush ถัดไป

    const url = new URL(req.url || '', 'http://x');
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 30));

    const file = path.join(dataDir, 'analytics.json');
    let stored: Record<string, Record<string, number>> = {};
    try { if (fs.existsSync(file)) stored = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { stored = {}; }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dates = Object.keys(stored).filter(d => d >= cutoff).sort();

    // สร้างครบทุกวันในช่วงที่เลือกเสมอ (เติม 0 ให้วันที่ไม่มี pageview) ไม่ใช่แค่วันที่มีข้อมูลจริง —
    // ถ้าไม่ทำแบบนี้ แท่งกราฟจะยืดเต็มความกว้างเวลามีข้อมูลแค่ไม่กี่วัน ดูเหมือนกราฟพัง — วันนี้อยู่ขวาสุดเสมอ
    const byDate: { date: string; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const total = Object.values(stored[date] || {}).reduce((a, b) => a + b, 0);
      byDate.push({ date, total });
    }

    const topPagesMap = new Map<string, number>();
    for (const date of dates) {
      for (const [p, count] of Object.entries(stored[date])) {
        topPagesMap.set(p, (topPagesMap.get(p) || 0) + count);
      }
    }
    const topPages = [...topPagesMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p, count]) => ({ path: p, count }));

    res.end(JSON.stringify({ byDate, topPages }));
  }

  // เคลียร์ session ที่หมดอายุ + login-failure entry ที่ค้างนานเกินไปเป็นระยะ กันหน่วยความจำโตไม่หยุด
  const cleanupInterval = setInterval(() => { purgeExpiredSessions(); sweepLoginFails(); }, 30 * 60_000);
  cleanupInterval.unref?.();
  // flush pageview counter ลงไฟล์ทุก 5 นาที (ถี่กว่า cleanupInterval เพราะอยากให้กราฟใน admin ค่อนข้างสด)
  const analyticsFlushInterval = setInterval(() => flushAnalytics(), 5 * 60_000);
  analyticsFlushInterval.unref?.();

  return { login, logout, settingsStream, settings, upload, data, renderSpaHtml, sitemap, analytics, media };
}

export type ApiHandlers = ReturnType<typeof createApiHandlers>;
