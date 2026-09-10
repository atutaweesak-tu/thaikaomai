// ─────────────────────────────────────────────────────────────────────────────
// ก้อน B — routes ฝั่ง api (Express + Prisma + MySQL @ /opt/thaikaomai/api)
//
// **ระบบสมัครไม่ใช่ Laravel** — ไฟล์นี้เป็น reference implementation ที่ก๊อปขึ้นไป
// วางในโปรเจกต์ api บน VPS (คนละ repo) แล้ว mount เข้า Express app ของ api
// เหมือนที่ ก้อน A ให้ .sql + apply-verify-tables.sh ไว้รันตรงกับ MySQL
//
// ต้องมีตาราง (ก้อน A):  register_verification, verify_prefill_cache, verify_access_log
// ต้องมี Prisma model:   integration/schema.verify.prisma
// ต้องแชร์ env กับ broker: VERIFY_S2S_SECRET, VERIFY_FIELD_KEY
//
// 4 endpoint:
//   POST /api/verify/callback-ingest   (S2S ← broker)  บันทึกผล KYC (idempotent ด้วย sid)
//                                                      + prefill mode: เก็บ VerifiedProfile
//                                                        ที่เข้ารหัสไว้ใน verify_prefill_cache
//   GET  /api/verify/prefill?vs=<sid>  (browser ← SPA) ดึง VerifiedProfile ครั้งเดียว
//                                                      (single-use + TTL) เอาไปเติมฟอร์ม+ล็อก
//   POST /api/verify/start             (browser ← SPA) เปิด broker session (S2S →) คืน verifyUrl
//   GET  /api/verify/status/:registerLogId (browser ← หลังบ้าน/staff) คืน badge ผล KYC
//                                                      + บันทึก verify_access_log ทุกครั้ง (DPIA R5)
//
// ── ADAPT: เมื่อวางในโปรเจกต์ api ─────────────────────────────────────────────
//   1) import PrismaClient จริง แทน interface VerifyPrismaClient ด้านล่าง
//   2) ต่อ resolveRegisterLogId ให้ map applicationRef → register_log.id ตามสคีมา api
//      (แนะนำ: ตอนเปิด session ส่ง applicationRef = String(registerLog.id) ไปเลย
//       ก้อนนี้ default parse เป็น int ให้)
//   3) mount: app.use(createVerifyApiRoutes({ prisma, env: process.env }))
//      อย่าเอา express.json() ของ api ครอบ path /api/verify/callback-ingest
//      (route นี้ต้องอ่าน raw body เองเพื่อเช็ค HMAC) — ก้อนนี้ใส่ express.raw ให้เฉพาะจุด
//   4) ใส่ auth/anti-abuse ของ api หน้า POST /api/verify/start ตามระบบเดิม
//      (captcha / rate-limit / เช็คว่าเป็นคำขอจากหน้า register จริง)
//   5) GET /api/verify/status/:registerLogId ต้อง mount หลัง middleware auth ของเจ้าหน้าที่
//      (ห้ามเปิดสาธารณะ) + ส่ง deps.getAccessor คืน identity ผู้ล็อกอิน ไม่งั้น access log
//      จะบันทึกเป็น 'unknown' ทุกแถว (ดู DPIA.md ความเสี่ยง R5)
// ─────────────────────────────────────────────────────────────────────────────
import express, { type Request, type Response, type Router } from 'express';

// ── shape ที่ broker ส่งมาที่ /api/verify/callback-ingest ────────────────────
// ตรงกับ IngestPayload ใน server/verify/laravelClient.ts
interface IngestPayload {
  sid: string;
  applicationRef: string;
  mode: 'match' | 'prefill';
  citizenIdHash: string; // HMAC(pid, VERIFY_PID_PEPPER) — ไม่มี pid เต็ม
  isThaiNational: boolean;
  nameMatch: boolean;
  birthDateMatch: boolean;
  addressMatch: boolean;
  overallPass: boolean;
  ial: string | null;
  provider: string;
  ndidRequestId: string | null;
  failureReason: string | null;
  verifiedAt: string; // ISO
  consentVersion: string | null; // ความยินยอม PDPA (จาก verify_sessions ของ broker)
  consentAt: string | null;      // ISO
  profile: VerifiedProfile | null; // เฉพาะ mode='prefill'
}

// ตรงกับ VerifiedProfile ใน server/verify/matcher.ts
interface VerifiedProfile {
  citizenId: string;
  firstNameTh: string;
  middleNameTh?: string;
  lastNameTh: string;
  birthDate: string; // YYYY-MM-DD (ค.ศ.)
  isThaiNational: boolean;
  address?: {
    houseNo?: string; moo?: string; soi?: string; road?: string;
    subDistrict?: string; district?: string; province?: string; postalCode?: string;
  };
  geocode?: { provinceCode?: string; districtCode?: string; subDistrictCode?: string };
}

// เวอร์ชันข้อความ consent ที่ยอมรับ — ต้องตรงกับตารางใน server/verify/CONSENT.md หมวด D
// และ DEFAULT_CONSENT_VERSION ใน integration/verify-prefill-client.ts (คนละ repo กัน อัปเดตมือ
// ทั้งสามที่ทุกครั้งที่ DPO รับรองข้อความ consent เวอร์ชันใหม่)
const VALID_CONSENT_VERSIONS = new Set(['2026-09-v1']);

// ── Prisma delegate ที่ route นี้เรียก (ADAPT: แทนด้วย PrismaClient จริง) ─────
// สมมติ model ชื่อ register_verification / verify_prefill_cache (สไตล์ introspection)
// ถ้า api ใช้ @@map + ชื่อ model แบบ camelCase ให้ปรับชื่อ delegate ตาม
export interface RegisterVerificationData {
  register_log_id: number | null;
  sid: string;
  mode: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  provider: string | null;
  ndid_request_id: string | null;
  ial: string | null;
  is_thai_national: boolean | null;
  name_match: boolean | null;
  birthdate_match: boolean | null;
  address_match: boolean | null;
  overall_pass: boolean | null;
  failure_reason: string | null;
  id_card_hash: string | null;
  consent_at: Date | null;
  consent_version: string | null;
  requester_ip: string | null;
  verified_at: Date | null;
}

export interface PrefillCacheRow {
  sid: string;
  payload_enc: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

// แถว audit ทุกครั้งที่มีการดูผล KYC ของใบสมัครหนึ่ง ๆ (DPIA.md R5 / GO-LIVE.md ข้อ 3)
export interface AccessLogRow {
  register_log_id: number;
  sid: string | null;
  accessed_by: string;
  ip: string | null;
}

export interface VerifyPrismaClient {
  register_verification: {
    upsert(args: {
      where: { sid: string };
      create: RegisterVerificationData;
      update: Partial<RegisterVerificationData>;
    }): Promise<unknown>;
    findFirst(args: {
      where: { register_log_id: number };
      orderBy: { verified_at: 'desc' };
    }): Promise<RegisterVerificationData | null>;
  };
  verify_prefill_cache: {
    findUnique(args: { where: { sid: string } }): Promise<PrefillCacheRow | null>;
    upsert(args: {
      where: { sid: string };
      create: { sid: string; payload_enc: string; expires_at: Date };
      update: { payload_enc: string; expires_at: Date; consumed_at: null };
    }): Promise<unknown>;
    updateMany(args: {
      where: { sid: string; consumed_at: null };
      data: { consumed_at: Date };
    }): Promise<{ count: number }>;
  };
  verify_access_log: {
    create(args: { data: AccessLogRow }): Promise<unknown>;
  };
}

import {
  clientIp,
  decryptJson,
  encryptJson,
  parseFieldKey,
  signOutgoingS2S,
  verifyIncomingS2S,
  type S2SOptions,
} from './verify-api-crypto';

export interface VerifyApiDeps {
  prisma: VerifyPrismaClient;
  env: Record<string, string | undefined>;
  /**
   * map applicationRef (ที่ api เองส่งไปตอนเปิด session) → register_log.id
   * default: Number(applicationRef) ถ้าเป็นเลขล้วน ไม่งั้น null
   * prefill mode (verify-first): ยังไม่มี register_log → คืน null ได้ แล้วค่อย
   * UPDATE register_verification SET register_log_id=? WHERE sid=? ตอน SPA submit ฟอร์ม
   */
  resolveRegisterLogId?: (applicationRef: string) => Promise<number | null>;
  /**
   * ระบุตัวเจ้าหน้าที่ที่ล็อกอินอยู่ (สำหรับ access log ตอนดูผล KYC — DPIA.md R5)
   * ADAPT: อ่านจาก session/JWT ของระบบ auth เดิมของ api (เช่น req.user?.email)
   * default: คืน null → บันทึกเป็น 'unknown' (ยังบันทึกการเข้าถึงไว้ แต่ไม่รู้ว่าใคร —
   * ควรต่อให้เสร็จก่อน go-live ไม่ให้ log ไร้ประโยชน์)
   */
  getAccessor?: (req: Request) => string | null;
}

interface VerifyApiConfig {
  enabled: boolean;
  s2s: S2SOptions;
  fieldKey: Buffer | null;
  brokerBase: string; // VERIFY_PUBLIC_BASE — ประกอบ URL /api/verify/session ของ broker
  prefillTtlSeconds: number;
}

function loadConfig(env: Record<string, string | undefined>): VerifyApiConfig {
  return {
    enabled: env.VERIFY_ENABLED === 'true',
    s2s: {
      secret: env.VERIFY_S2S_SECRET || '',
      allowedIps: (env.VERIFY_ALLOWED_S2S_IPS || '127.0.0.1,::1')
        .split(',').map(s => s.trim()).filter(Boolean),
      trustAllIps: env.VERIFY_S2S_TRUST_ALL_IPS === 'true',
    },
    fieldKey: parseFieldKey(env.VERIFY_FIELD_KEY || ''),
    brokerBase: (env.VERIFY_PUBLIC_BASE || '').replace(/\/+$/, ''),
    prefillTtlSeconds: Math.max(60, Math.min(1800, Number(env.VERIFY_PREFILL_TTL_SECONDS || 600))),
  };
}

const json = (res: Response, status: number, body: unknown): void => {
  res.status(status).type('json').send(JSON.stringify(body));
};

function bufToStr(b: unknown): string {
  if (Buffer.isBuffer(b)) return b.toString('utf8');
  if (typeof b === 'string') return b;
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
export function createVerifyApiRoutes(deps: VerifyApiDeps): Router {
  const { prisma } = deps;
  const cfg = loadConfig(deps.env);
  const router = express.Router();

  const resolveLogId =
    deps.resolveRegisterLogId ||
    (async (ref: string) => {
      const n = Number(String(ref).trim());
      return Number.isInteger(n) && n > 0 ? n : null;
    });
  const getAccessor = deps.getAccessor || (() => null);

  if (!cfg.enabled) {
    console.log('[verify-api] disabled (ตั้ง VERIFY_ENABLED=true เพื่อเปิด)');
    const notFound = (_req: Request, res: Response) => json(res, 404, { error: 'not_found' });
    router.all('/api/verify/callback-ingest', notFound);
    router.all('/api/verify/prefill', notFound);
    router.all('/api/verify/start', notFound);
    router.all('/api/verify/status/:registerLogId', notFound);
    return router;
  }
  console.log('[verify-api] enabled — ingest + prefill-consume + start + status');

  router.use('/api/verify', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ── POST /api/verify/callback-ingest (S2S ← broker) ───────────────────────
  // raw body เฉพาะ path นี้ (ต้องเช็ค HMAC กับ byte ดิบ)
  router.post(
    '/api/verify/callback-ingest',
    express.raw({ type: () => true, limit: '32kb' }),
    async (req: Request, res: Response) => {
      const raw = bufToStr(req.body);

      const s2s = verifyIncomingS2S(req, raw, cfg.s2s);
      if (!s2s.ok) {
        console.warn(`[verify-api] ingest S2S rejected: ${s2s.reason}`);
        return json(res, 401, { error: 'unauthorized' });
      }

      let p: IngestPayload;
      try {
        p = JSON.parse(raw) as IngestPayload;
      } catch {
        return json(res, 400, { error: 'bad_json' });
      }
      if (!p || typeof p.sid !== 'string' || p.sid.length < 8 || p.sid.length > 64) {
        return json(res, 400, { error: 'bad_sid' });
      }
      if (typeof p.applicationRef !== 'string' || p.applicationRef.length > 128) {
        return json(res, 400, { error: 'bad_application_ref' });
      }
      const mode: 'match' | 'prefill' = p.mode === 'prefill' ? 'prefill' : 'match';
      const b = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
      const str = (v: unknown, max: number): string | null =>
        typeof v === 'string' && v.length <= max ? v : null;

      const verifiedAt = (() => {
        const d = new Date(String(p.verifiedAt || ''));
        return Number.isNaN(d.getTime()) ? new Date() : d;
      })();

      let registerLogId: number | null = null;
      try {
        registerLogId = await resolveLogId(p.applicationRef);
      } catch (e) {
        console.warn(`[verify-api] resolveRegisterLogId ล้มเหลว ref=${p.applicationRef}: ${(e as Error).message}`);
      }

      const data: RegisterVerificationData = {
        register_log_id: registerLogId,
        sid: p.sid,
        mode,
        status: p.overallPass === true ? 'verified' : 'failed',
        provider: str(p.provider, 32),
        ndid_request_id: str(p.ndidRequestId, 128),
        ial: str(p.ial, 8),
        is_thai_national: b(p.isThaiNational),
        name_match: b(p.nameMatch),
        birthdate_match: b(p.birthDateMatch),
        address_match: b(p.addressMatch),
        overall_pass: b(p.overallPass),
        failure_reason: str(p.failureReason, 64),
        id_card_hash: /^[0-9a-f]{64}$/i.test(p.citizenIdHash || '') ? p.citizenIdHash : null,
        // consent มาจาก SPA (กดก่อนเริ่ม verify) → broker session → ingest payload
        consent_version: str(p.consentVersion, 16),
        consent_at: (() => {
          const d = new Date(String(p.consentAt || ''));
          return p.consentAt && !Number.isNaN(d.getTime()) ? d : null;
        })(),
        // requester_ip: broker ไม่ได้ส่งมา — เก็บฝั่ง api ตอน /start ได้ถ้าต้องการ audit ละเอียด
        requester_ip: null,
        verified_at: verifiedAt,
      };

      try {
        // idempotent — broker retry ได้ (unique key = sid) last-write-wins
        const { sid: _sid, ...update } = data;
        await prisma.register_verification.upsert({
          where: { sid: p.sid },
          create: data,
          update,
        });

        // prefill mode: เก็บ VerifiedProfile ที่ยืนยันแล้ว แบบ transient (เข้ารหัส + TTL + single-use)
        if (mode === 'prefill' && p.overallPass === true && p.profile && typeof p.profile === 'object') {
          if (!cfg.fieldKey) {
            console.error('[verify-api] VERIFY_FIELD_KEY ไม่ได้ตั้ง — prefill cache เก็บไม่ได้');
            // ผล KYC บันทึกแล้ว ไม่ถือว่า ingest fail — SPA จะ prefill ไม่ได้เท่านั้น
            return json(res, 200, { ok: true, prefillCached: false });
          }
          const payloadEnc = encryptJson(sanitizeProfile(p.profile), cfg.fieldKey);
          const expiresAt = new Date(Date.now() + cfg.prefillTtlSeconds * 1000);
          await prisma.verify_prefill_cache.upsert({
            where: { sid: p.sid },
            create: { sid: p.sid, payload_enc: payloadEnc, expires_at: expiresAt },
            update: { payload_enc: payloadEnc, expires_at: expiresAt, consumed_at: null },
          });
          return json(res, 200, { ok: true, prefillCached: true });
        }

        return json(res, 200, { ok: true, prefillCached: false });
      } catch (e) {
        // 5xx → broker retry (transient DB error)
        console.error(`[verify-api] ingest DB error sid=${p.sid}: ${(e as Error).message}`);
        return json(res, 500, { error: 'ingest_persist_failed' });
      }
    },
  );

  // ── GET /api/verify/prefill?vs=<sid> (browser ← SPA) ──────────────────────
  // single-use: consume ครั้งเดียว, TTL ~10 นาที, กันเดา sid (24 bytes base64url)
  router.get('/api/verify/prefill', async (req: Request, res: Response) => {
    const sid = String(req.query.vs || '');
    if (!sid || sid.length < 8 || sid.length > 64) {
      return json(res, 400, { error: 'bad_vs' });
    }
    if (!cfg.fieldKey) {
      return json(res, 503, { error: 'prefill_not_configured' });
    }

    let row: PrefillCacheRow | null;
    try {
      row = await prisma.verify_prefill_cache.findUnique({ where: { sid } });
    } catch (e) {
      console.error(`[verify-api] prefill lookup error: ${(e as Error).message}`);
      return json(res, 500, { error: 'prefill_lookup_failed' });
    }
    const now = Date.now();
    if (!row || row.consumed_at || row.expires_at.getTime() < now) {
      return json(res, 410, { error: 'prefill_gone' }); // ใช้ไปแล้ว / หมดอายุ / ไม่มี
    }

    // อ้าง consume แบบ atomic — ถ้าแข่งกันหลาย request จะมีแค่อันเดียวได้ count=1
    let claimed: { count: number };
    try {
      claimed = await prisma.verify_prefill_cache.updateMany({
        where: { sid, consumed_at: null },
        data: { consumed_at: new Date() },
      });
    } catch (e) {
      console.error(`[verify-api] prefill claim error: ${(e as Error).message}`);
      return json(res, 500, { error: 'prefill_claim_failed' });
    }
    if (claimed.count !== 1) {
      return json(res, 410, { error: 'prefill_gone' });
    }

    let profile: VerifiedProfile;
    try {
      profile = decryptJson<VerifiedProfile>(row.payload_enc, cfg.fieldKey);
    } catch (e) {
      console.error(`[verify-api] prefill decrypt error sid=${sid}: ${(e as Error).message}`);
      return json(res, 500, { error: 'prefill_decrypt_failed' });
    }

    return json(res, 200, { sid, profile, source: 'thaid' });
  });

  // ── POST /api/verify/start (browser ← SPA) ───────────────────────────────
  // เปิด broker session แล้วคืน verifyUrl ให้ SPA พาผู้ใช้ไป (window.location = verifyUrl)
  // ADAPT: ใส่ auth/captcha/rate-limit ของ api หน้า handler นี้
  router.post('/api/verify/start', express.json({ limit: '8kb' }), async (req: Request, res: Response) => {
    if (!cfg.s2s.secret || !cfg.brokerBase) {
      return json(res, 503, { error: 'verify_not_configured' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mode: 'match' | 'prefill' = body.mode === 'prefill' ? 'prefill' : 'match';

    // applicationRef: match mode = String(register_log.id) ที่มีอยู่แล้ว
    //                 prefill mode = ref ชั่วคราว (ยังไม่มี register_log)
    const applicationRef = String(body.applicationRef || `prefill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 128);

    const seed = body.matchFields && typeof body.matchFields === 'object'
      ? (body.matchFields as Record<string, unknown>)
      : {};
    const citizenId = String((seed.citizenId as string) || '').replace(/\D/g, '');
    if (mode === 'prefill' && citizenId.length !== 13) {
      return json(res, 400, { error: 'bad_citizen_id' });
    }

    // ความยินยอม PDPA: SPA ส่ง version มา — api set acceptedAt เป็นเวลา server เอง (ไม่เชื่อ client)
    // ปฏิเสธคำขอที่ไม่มี consent หรือ version ไม่อยู่ใน VALID_CONSENT_VERSIONS ด้านล่าง
    // (ต้องตรงกับ server/verify/CONSENT.md หมวด D — ปิด GO-LIVE.md ข้อ 3)
    const consentIn = (body.consent && typeof body.consent === 'object' ? body.consent : {}) as Record<string, unknown>;
    const consentVersion = typeof consentIn.version === 'string' ? consentIn.version.trim().slice(0, 16) : '';
    if (!consentVersion) {
      return json(res, 400, { error: 'consent_required' });
    }
    if (!VALID_CONSENT_VERSIONS.has(consentVersion)) {
      return json(res, 400, { error: 'consent_version_unknown' });
    }
    const consent = { version: consentVersion, acceptedAt: new Date().toISOString() };

    const brokerBody = JSON.stringify({ applicationRef, mode, matchFields: seed, consent });
    const headers = signOutgoingS2S(brokerBody, cfg.s2s.secret);
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(`${cfg.brokerBase}/api/verify/session`, {
        method: 'POST',
        headers,
        body: brokerBody,
        signal: ac.signal,
      });
      clearTimeout(timer);
      const text = await r.text();
      if (!r.ok) {
        console.warn(`[verify-api] broker session ${r.status}: ${text.slice(0, 200)}`);
        return json(res, 502, { error: 'broker_rejected', status: r.status });
      }
      const parsed = JSON.parse(text) as { sid: string; verifyUrl: string; expiresAt: number };
      console.log(`[verify-api] start ok ref=${applicationRef} mode=${mode} ip=${clientIp(req)}`);
      return json(res, 201, { sid: parsed.sid, verifyUrl: parsed.verifyUrl, expiresAt: parsed.expiresAt });
    } catch (e) {
      console.error(`[verify-api] broker session error: ${(e as Error).message}`);
      return json(res, 502, { error: 'broker_unreachable' });
    }
  });

  // ── GET /api/verify/status/:registerLogId (browser ← หลังบ้าน/staff) ──────
  // คืน badge ผล KYC (✅/⏳/❌/—) ให้เจ้าหน้าที่ตรวจใบสมัคร — ไม่มี PID/ชื่อ/ที่อยู่
  // ให้เปิดเผยอยู่แล้ว (register_verification ไม่เก็บสิ่งเหล่านี้ตาม DPIA.md ข้อ 2.2)
  // แต่ยังต้องบันทึกว่า "ใครเข้าถึงเมื่อไหร่" (DPIA.md R5) เพราะเป็นข้อมูลเกี่ยวกับ
  // สถานะสมาชิกภาพ/การเมืองของบุคคล (ข้อมูลอ่อนไหว ม.26) แม้จะเป็นแค่ flag ก็ตาม
  //
  // ADAPT: mount เส้นนี้หลัง middleware auth ของเจ้าหน้าที่ในระบบ api เดิม (ห้ามเปิดสาธารณะ)
  // แล้วส่ง deps.getAccessor ให้คืน identity ของผู้ใช้ที่ login อยู่ (เช่น req.user.email)
  router.get('/api/verify/status/:registerLogId', async (req: Request, res: Response) => {
    const registerLogId = Number(req.params.registerLogId);
    if (!Number.isInteger(registerLogId) || registerLogId <= 0) {
      return json(res, 400, { error: 'bad_register_log_id' });
    }

    let row: RegisterVerificationData | null;
    try {
      row = await prisma.register_verification.findFirst({
        where: { register_log_id: registerLogId },
        orderBy: { verified_at: 'desc' },
      });
    } catch (e) {
      console.error(`[verify-api] status lookup error: ${(e as Error).message}`);
      return json(res, 500, { error: 'status_lookup_failed' });
    }

    // บันทึก access log ก่อนตอบ ไม่ว่าจะเจอผลหรือไม่ (เจ้าหน้าที่ "ดู" ใบสมัครนี้จริง)
    const accessedBy = getAccessor(req) || 'unknown';
    try {
      await prisma.verify_access_log.create({
        data: { register_log_id: registerLogId, sid: row?.sid ?? null, accessed_by: accessedBy, ip: clientIp(req) },
      });
    } catch (e) {
      // ห้ามให้การบันทึก log ที่ล้มเหลวไปบล็อกไม่ให้เจ้าหน้าที่เห็นผล KYC — แค่ log แจ้งเตือนไว้
      console.error(`[verify-api] access log write failed (register_log_id=${registerLogId}): ${(e as Error).message}`);
    }
    if (accessedBy === 'unknown') {
      console.warn(`[verify-api] status accessed by UNKNOWN staff — ต่อ deps.getAccessor ให้เสร็จก่อน go-live`);
    }

    if (!row) {
      return json(res, 200, { status: 'none', overallPass: null });
    }
    return json(res, 200, {
      status: row.status,
      mode: row.mode,
      overallPass: row.overall_pass,
      nameMatch: row.name_match,
      birthdateMatch: row.birthdate_match,
      addressMatch: row.address_match,
      ial: row.ial,
      verifiedAt: row.verified_at,
    });
  });

  return router;
}

/** เก็บเฉพาะ field ที่ SPA ต้องใช้เติมฟอร์ม — ไม่ให้ payload บวมด้วย key แปลกปลอม */
function sanitizeProfile(p: VerifiedProfile): VerifiedProfile {
  const a = p.address || {};
  const g = p.geocode || {};
  return {
    citizenId: String(p.citizenId || '').replace(/\D/g, ''),
    firstNameTh: String(p.firstNameTh || ''),
    middleNameTh: p.middleNameTh ? String(p.middleNameTh) : undefined,
    lastNameTh: String(p.lastNameTh || ''),
    birthDate: String(p.birthDate || ''),
    isThaiNational: p.isThaiNational === true,
    address: {
      houseNo: a.houseNo, moo: a.moo, soi: a.soi, road: a.road,
      subDistrict: a.subDistrict, district: a.district,
      province: a.province, postalCode: a.postalCode,
    },
    geocode: (g.provinceCode || g.districtCode || g.subDistrictCode)
      ? { provinceCode: g.provinceCode, districtCode: g.districtCode, subDistrictCode: g.subDistrictCode }
      : undefined,
  };
}
