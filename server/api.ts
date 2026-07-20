import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { ServerResponse, IncomingMessage } from 'http';
import nodemailer from 'nodemailer';

// ── Collections ที่เป็นข้อมูลส่วนบุคคล (PII) — อ่านได้เฉพาะ admin ที่ login แล้ว ─────
// หมายเหตุ: 'users' ไม่อยู่ในนี้แล้ว เพราะต้องการ requireTab('users') โดยเฉพาะ ไม่ใช่แค่ login
// ธรรมดา (requireAuth) — ดู branch col === 'users' ใน data() แทน
const PROTECTED_READ_COLLECTIONS = new Set(['contact', 'volunteer', 'newsletter']);
// Collections ที่ใครก็ส่งฟอร์มเข้ามาได้โดยไม่ต้อง login (public forms)
const PUBLIC_POST_COLLECTIONS = new Set(['contact', 'newsletter', 'volunteer']);

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
const _loginFails = new Map<string, { count: number; lockedUntil: number }>();

function isAccountLocked(email: string): boolean {
  const rec = _loginFails.get(email);
  if (!rec) return false;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) return true;
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) { _loginFails.delete(email); return false; }
  return false;
}
function recordLoginFailure(email: string) {
  const rec = _loginFails.get(email) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= LOGIN_MAX_FAILS) rec.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  _loginFails.set(email, rec);
}
function clearLoginFailures(email: string) {
  _loginFails.delete(email);
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

// ── Admin accounts (collection "users") ─────────────────────────────────────────
// ตัด passwordHash ออกก่อนส่งให้ client เสมอ ไม่ว่าจะผ่าน GET/SSE/POST response ใดๆ
function stripPasswordHash(item: any) {
  const { passwordHash, ...rest } = item;
  return rest;
}

// ── Session Store ──────────────────────────────────────────────────────────────
interface Session { email: string; name: string; role: 'super_admin' | 'admin'; allowedTabs: string[]; expiresAt: number }
const sessions = new Map<string, Session>();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 ชั่วโมง

function createSession(user: AdminUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email: user.email, name: user.name, role: user.role, allowedTabs: user.allowedTabs, expiresAt: Date.now() + SESSION_TTL });
  return token;
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, s] of sessions) if (now > s.expiresAt) sessions.delete(token);
}

function getSession(req: IncomingMessage): Session | null {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
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

export function createApiHandlers(env: Record<string, string>, dataDir: string) {
  const mailer = createMailer(env);
  const adminUsers = loadAdminUsers(env);

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

  // SSE clients per collection
  const sseClients: Record<string, Set<ServerResponse>> = {};

  function broadcastCollection(col: string, items: any[]) {
    const payload = col === 'users' ? items.map(stripPasswordHash) : items;
    sseClients[col]?.forEach(client => {
      try { client.write(`data: ${JSON.stringify(payload)}\n\n`); }
      catch { sseClients[col].delete(client); }
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
    if (token) sessions.delete(token);
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

    res.setHeader('Cache-Control', 'no-store');
    const isProtected = PROTECTED_READ_COLLECTIONS.has(col);

    // SSE stream — collections ที่เป็น PII ต้อง auth ก่อนเปิด stream ด้วย
    // "users" ต้องมีสิทธิ์แท็บ users โดยเฉพาะ (เข้มกว่า requireAuth ธรรมดา) และต้องตัด passwordHash ออกก่อนส่งเสมอ
    if (idOrStream === 'stream') {
      if (col === 'users') { if (!requireTab(req, res, 'users')) return; }
      else if (isProtected && !requireAuth(req, res)) return;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const initial = col === 'users' ? readCollection(col).map(stripPasswordHash) : readCollection(col);
      res.write(`data: ${JSON.stringify(initial)}\n\n`);
      if (!sseClients[col]) sseClients[col] = new Set();
      sseClients[col].add(res);
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
    if (req.method === 'GET') {
      if (col === 'users') {
        if (!requireTab(req, res, 'users')) return;
        res.end(JSON.stringify(readCollection(col).map(stripPasswordHash))); return;
      }
      if (isProtected && !requireAuth(req, res)) return;
      res.end(JSON.stringify(readCollection(col))); return;
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

        if (req.method === 'POST') {
          // Rate limit ฟอร์มสาธารณะ (3 requests / 10 min per IP)
          if (PUBLIC_POST_COLLECTIONS.has(col) && isRateLimited(req, `${col}:${getClientIp(req)}`, 3, 600_000)) {
            res.statusCode = 429;
            res.end(JSON.stringify({ error: 'ส่งข้อความบ่อยเกินไป กรุณารอสักครู่' }));
            return;
          }

          const parsedBody = col === 'users' ? usersParsedBody : JSON.parse(body || '{}');
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

          items[idx] = {
            ...items[idx], ...update,
            ...(session ? { updatedBy: session.email, updatedAt: new Date().toISOString() } : {}),
          };
          writeCollection(col, items);
          broadcastCollection(col, items);
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

  // เคลียร์ session ที่หมดอายุเป็นระยะ กันหน่วยความจำโตไม่หยุด
  const cleanupInterval = setInterval(purgeExpiredSessions, 30 * 60_000);
  cleanupInterval.unref?.();

  return { login, logout, settingsStream, settings, upload, data };
}

export type ApiHandlers = ReturnType<typeof createApiHandlers>;
