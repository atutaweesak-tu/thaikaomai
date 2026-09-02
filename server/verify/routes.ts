// ── ThaID KYC broker — HTTP routes ───────────────────────────────────────────
//   POST /api/verify/session      (S2S) Laravel เปิด session, ส่ง fields ที่จะเทียบ → คืน { sid, verifyUrl }
//   GET  /verify?sid=...          (browser) ผู้สมัครเริ่มยืนยัน → stub page หรือ 302 ไป ThaID
//   GET  /verify/callback         (browser) กลับจาก IdP → เทียบผล → push Laravel → 302 กลับหน้า success
//   GET  /api/verify/status/:sid  (S2S) เช็คสถานะ (flag ล้วน)
//
// เมื่อ VERIFY_ENABLED != 'true' ทุก route ตอบ 404 (ไม่รั่วว่ามีอยู่)
import express, { type Request, type Response } from 'express';
import type { IncomingMessage } from 'http';
import { loadVerifyConfig, type VerifyConfig } from './config';
import { VerifyStore } from './store';
import { makeVerifier, VerifierError } from './identityVerifier';
import { verifyIncomingS2S, clientIp } from './s2s';
import { buildIngestPayload, pushResultToLaravel } from './laravelClient';
import { encryptJson, decryptJson, randomToken } from './crypto';
import type { MatchFields, VerifyMode } from './types';
import type { CallbackResult } from './identityVerifier';

// ── utils ────────────────────────────────────────────────────────────────────
function readRawBody(req: IncomingMessage, limitBytes = 16 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      data += c.toString('utf8');
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

function page(res: Response, status: number, title: string, bodyHtml: string): void {
  res.status(status).type('html').send(
    `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0a1a2f;color:#fff;
       margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:460px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
        border-radius:24px;padding:36px;text-align:center;line-height:1.7}
  h1{font-size:22px;margin:0 0 12px}
  p{color:rgba(255,255,255,.75);font-size:15px;margin:8px 0}
  a.btn{display:inline-block;margin-top:20px;background:#E6FF00;color:#0a1a2f;font-weight:800;
        text-decoration:none;padding:12px 28px;border-radius:999px}
</style></head><body><div class="card">${bodyHtml}</div></body></html>`,
  );
}

// in-memory rate limiter (per key) — พอสำหรับ broker; หน้าบ้านมี nginx อีกชั้น
const rl = new Map<string, { n: number; resetAt: number }>();
function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.resetAt) {
    rl.set(key, { n: 1, resetAt: now + windowMs });
    return false;
  }
  if (e.n >= max) return true;
  e.n++;
  return false;
}

function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── validation ของ payload ที่ Laravel ส่งมา ─────────────────────────────────
function parseMatchFields(input: unknown): MatchFields | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const s = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const citizenId = (s(o.citizenId) || '').replace(/\D/g, '');
  const firstNameTh = s(o.firstNameTh)?.trim() || '';
  const lastNameTh = s(o.lastNameTh)?.trim() || '';
  const birthDate = s(o.birthDate)?.trim() || '';
  if (citizenId.length !== 13) return null;
  if (!firstNameTh || !lastNameTh) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  let address: MatchFields['address'];
  if (o.address && typeof o.address === 'object') {
    const a = o.address as Record<string, unknown>;
    address = {
      houseNo: s(a.houseNo), moo: s(a.moo), soi: s(a.soi), road: s(a.road),
      subDistrict: s(a.subDistrict), district: s(a.district),
      province: s(a.province), postalCode: s(a.postalCode),
    };
  }
  return {
    citizenId,
    firstNameTh,
    middleNameTh: s(o.middleNameTh)?.trim() || undefined,
    lastNameTh,
    birthDate,
    address,
  };
}

/** ความยินยอม PDPA — { version: <=16 ตัว, acceptedAt: ISO } หรือ null */
function parseConsent(input: unknown): { version: string; acceptedAt: string } | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const version = typeof o.version === 'string' ? o.version.trim().slice(0, 16) : '';
  if (!version) return null;
  const rawAt = typeof o.acceptedAt === 'string' ? o.acceptedAt.trim() : '';
  const d = new Date(rawAt);
  const acceptedAt = rawAt && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
  return { version, acceptedAt };
}

/**
 * mode='prefill' — ยังไม่มีข้อมูลผู้สมัคร ต้องการแค่ citizenId 13 หลักเพื่อเริ่ม ThaID
 * (name/birthDate ถ้าส่งมาด้วยจะใช้เป็น echo ของ stub เท่านั้น)
 */
function parseSeedFields(input: unknown): MatchFields | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const s = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const citizenId = (s(o.citizenId) || '').replace(/\D/g, '');
  if (citizenId.length !== 13) return null;
  const birthDate = s(o.birthDate)?.trim() || '';
  return {
    citizenId,
    firstNameTh: s(o.firstNameTh)?.trim() || '',
    middleNameTh: s(o.middleNameTh)?.trim() || undefined,
    lastNameTh: s(o.lastNameTh)?.trim() || '',
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : '',
  };
}

// ── router factory ───────────────────────────────────────────────────────────
export function createVerifyRouter(env: Record<string, string>, dataDir: string) {
  const router = express.Router();
  const cfg: VerifyConfig = loadVerifyConfig(env);

  if (!cfg.enabled) {
    console.log('[verify] disabled (ตั้ง VERIFY_ENABLED=true เพื่อเปิด)');
    const notFound = (_req: Request, res: Response) =>
      res.status(404).type('json').send('{"error":"not found"}');
    router.all('/api/verify', notFound);
    router.all('/api/verify/*', notFound);
    router.all('/verify', notFound);
    router.all('/verify/*', notFound);
    return router;
  }

  const store = new VerifyStore(dataDir);
  const verifier = makeVerifier(cfg);
  console.log(`[verify] enabled — driver=${cfg.driver}${cfg.stubAutoPass ? ' (stub autopass)' : ''}`);

  const sweepTimer = setInterval(() => {
    try {
      const n = store.sweep();
      if (n) console.log(`[verify] sweep ล้าง ${n} session`);
    } catch (e) {
      console.error('[verify] sweep error:', (e as Error).message);
    }
  }, 5 * 60 * 1000);
  sweepTimer.unref?.();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ── POST /api/verify/session (S2S) ─────────────────────────────────────────
  router.post('/api/verify/session', async (req, res) => {
    if (rateLimited(`sess:${clientIp(req)}`, 60, 60_000)) {
      return res.status(429).type('json').send('{"error":"rate_limited"}');
    }
    let raw = '';
    try {
      raw = await readRawBody(req);
    } catch {
      return res.status(413).type('json').send('{"error":"payload_too_large"}');
    }
    const s2s = verifyIncomingS2S(req, raw, cfg);
    if (!s2s.ok) {
      console.warn(`[verify] S2S session rejected: ${s2s.reason}`);
      return res.status(401).type('json').send('{"error":"unauthorized"}');
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw || '{}');
    } catch {
      return res.status(400).type('json').send('{"error":"bad_json"}');
    }
    const applicationRef = String(parsed.applicationRef || '').trim();
    if (!applicationRef || applicationRef.length > 128) {
      return res.status(400).type('json').send('{"error":"bad_application_ref"}');
    }
    const mode: VerifyMode = parsed.mode === 'prefill' ? 'prefill' : 'match';
    const fields = mode === 'prefill' ? parseSeedFields(parsed.matchFields) : parseMatchFields(parsed.matchFields);
    if (!fields) {
      return res.status(400).type('json').send(
        JSON.stringify({ error: mode === 'prefill' ? 'bad_seed_fields' : 'bad_match_fields' }),
      );
    }
    if (!cfg.fieldKey) {
      console.error('[verify] VERIFY_FIELD_KEY ไม่ได้ตั้ง — ปฏิเสธการเปิด session');
      return res.status(503).type('json').send('{"error":"broker_not_configured"}');
    }

    const consent = parseConsent(parsed.consent);

    const sid = randomToken(24);
    const ttl = Math.min(
      cfg.sessionTtlSeconds,
      Math.max(60, Number(parsed.ttlSeconds) || cfg.sessionTtlSeconds),
    );
    const expiresAt = Date.now() + ttl * 1000;
    store.create({
      sid,
      applicationRef,
      mode,
      matchFieldsEnc: encryptJson(fields, cfg.fieldKey),
      expiresAt,
      consentVersion: consent?.version ?? null,
      consentAt: consent?.acceptedAt ?? null,
    });

    const base = cfg.publicBase || `${req.protocol}://${req.get('host')}`;
    return res.status(201).type('json').send(
      JSON.stringify({ sid, verifyUrl: `${base}/verify?sid=${encodeURIComponent(sid)}`, expiresAt }),
    );
  });

  // ── GET /verify?sid=... (browser) ─────────────────────────────────────────
  router.get('/verify', (req, res) => {
    const sid = String(req.query.sid || '');
    if (rateLimited(`start:${clientIp(req)}`, 30, 60_000)) {
      return page(res, 429, 'ลองใหม่อีกครั้ง', '<h1>คำขอมากเกินไป</h1><p>กรุณารอสักครู่แล้วลองใหม่</p>');
    }
    const s = sid && store.get(sid);
    if (!s || s.status === 'consumed' || s.status === 'expired' || s.expires_at < Date.now()) {
      return page(res, 410, 'ลิงก์หมดอายุ',
        '<h1>ลิงก์ยืนยันตัวตนหมดอายุหรือถูกใช้ไปแล้ว</h1><p>กรุณากลับไปที่หน้าสมัครแล้วเริ่มยืนยันตัวตนใหม่</p>');
    }

    let outcome;
    try {
      outcome = verifier.start(sid, cfg);
    } catch (e) {
      console.error('[verify] start error:', (e as Error).message);
      return page(res, 500, 'เกิดข้อผิดพลาด', '<h1>ไม่สามารถเริ่มการยืนยันตัวตนได้</h1><p>กรุณาลองใหม่ภายหลัง</p>');
    }

    store.markPending(sid, outcome.oidc);

    if (outcome.redirectUrl) return res.redirect(302, outcome.redirectUrl);

    if (outcome.stub) {
      const sim = outcome.stub.simulateUrl
        ? `<a class="btn" href="${esc(outcome.stub.simulateUrl)}">จำลองผลยืนยัน (staging)</a>`
        : '';
      const back = isHttpUrl(cfg.doneRedirect)
        ? `<a class="btn" href="${esc(cfg.doneRedirect)}?ref=${encodeURIComponent(s.application_ref)}&kyc=pending">กลับไปที่หน้าสมัคร</a>`
        : '';
      return page(res, 200, 'ยืนยันตัวตนด้วย ThaID',
        `<h1>ยืนยันตัวตนด้วย ThaID</h1><p>${esc(outcome.stub.message)}</p>${sim || back}`);
    }
    return page(res, 500, 'เกิดข้อผิดพลาด', '<h1>การตั้งค่าไม่สมบูรณ์</h1>');
  });

  // ── GET /verify/callback (browser) ───────────────────────────────────────
  router.get('/verify/callback', async (req, res) => {
    const q: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query)) q[k] = Array.isArray(v) ? String(v[0]) : (v as string | undefined);

    // หา session: oidc ใช้ state, stub ใช้ sid
    const s = q.state ? store.getByState(q.state) : q.sid ? store.get(q.sid) : undefined;
    if (!s) {
      return page(res, 400, 'คำขอไม่ถูกต้อง', '<h1>ไม่พบคำขอยืนยันตัวตน</h1><p>ลิงก์อาจหมดอายุ กรุณาเริ่มใหม่จากหน้าสมัคร</p>');
    }
    if (!store.claimForCallback(s.sid)) {
      // ถูกประมวลผลไปแล้ว / หมดอายุ — เด้งกลับตามสถานะที่มี
      const kyc = s.status === 'verified' || s.status === 'consumed' ? 'verified' : 'failed';
      return finishRedirect(res, s.application_ref, kyc);
    }

    let cb: CallbackResult;
    try {
      const applicant = decryptJson<MatchFields>(s.match_fields_enc || '', cfg.fieldKey!);
      cb = await verifier.handleCallback(
        { query: q, mode: s.mode, applicant, session: { sid: s.sid, oidcState: s.oidc_state, oidcNonce: s.oidc_nonce, pkceVerifier: s.pkce_verifier } },
        cfg,
      );
      store.setResult(s.sid, cb.result.ok ? 'verified' : 'failed', JSON.stringify(cb.result.flags));

      const payload = buildIngestPayload(
        s.sid, s.application_ref, s.mode, cb.profile.citizenId, cb.result, cfg, cb.profile,
        s.consent_version ? { version: s.consent_version, acceptedAt: s.consent_at ?? undefined } : null,
      );
      const push = await pushResultToLaravel(payload, cfg);
      if (!push.ok) console.error(`[verify] push ไป api ไม่สำเร็จ sid=${s.sid}: ${push.error}`);
    } catch (e) {
      const msg = e instanceof VerifierError ? `${e.code}: ${e.message}` : (e as Error).message;
      console.error('[verify] callback error:', msg);
      store.setResult(s.sid, 'failed', JSON.stringify({ error: e instanceof VerifierError ? e.code : 'internal' }));
      store.finalizeConsumed(s.sid);
      return finishRedirect(res, s.application_ref, 'failed');
    }

    store.finalizeConsumed(s.sid);
    return finishRedirect(res, s.application_ref, cb.result.ok ? 'verified' : 'failed');
  });

  function finishRedirect(res: Response, ref: string, kyc: 'verified' | 'failed' | 'pending') {
    if (isHttpUrl(cfg.doneRedirect)) {
      const u = new URL(cfg.doneRedirect);
      u.searchParams.set('ref', ref);
      u.searchParams.set('kyc', kyc);
      return res.redirect(302, u.toString());
    }
    const ok = kyc === 'verified';
    return page(
      res,
      200,
      ok ? 'ยืนยันตัวตนสำเร็จ' : 'ยืนยันตัวตนไม่สำเร็จ',
      ok
        ? '<h1>ยืนยันตัวตนสำเร็จ</h1><p>ข้อมูลของท่านผ่านการตรวจสอบกับกรมการปกครองแล้ว ท่านสามารถปิดหน้านี้ได้</p>'
        : '<h1>ยืนยันตัวตนไม่สำเร็จ</h1><p>ใบสมัครของท่านยังถูกบันทึกไว้ เจ้าหน้าที่จะตรวจสอบเอกสารของท่านด้วยวิธีปกติ</p>',
    );
  }

  // ── GET /api/verify/status/:sid (S2S) ────────────────────────────────────
  router.get('/api/verify/status/:sid', async (req, res) => {
    const s2s = verifyIncomingS2S(req, '', cfg);
    if (!s2s.ok) return res.status(401).type('json').send('{"error":"unauthorized"}');
    const s = store.get(req.params.sid);
    if (!s) return res.status(404).type('json').send('{"error":"not_found"}');
    return res.type('json').send(JSON.stringify({
      status: s.status,
      flags: s.result_json ? safeParse(s.result_json) : null,
    }));
  });

  return router;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
