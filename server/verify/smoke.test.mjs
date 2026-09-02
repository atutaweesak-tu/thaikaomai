// ── ThaID KYC broker — smoke tests ──────────────────────────────────────────
// รัน: npm run test:verify   (= tsx server/verify/smoke.test.mjs)
// ไม่ใช่ unit test ครบทุกมุม — เช็คว่า flow หลักไม่พังหลังแก้โค้ด
//   A. crypto interop (broker ⇄ integration/verify-api-crypto)
//   B. broker stub flow ผ่าน routes.ts + store.ts (match + prefill + consent)
//   C. OIDC driver กับ mock IdP (token/JWKS/userinfo, happy + fail paths)
//   D. api routes (integration/verify-api-routes): ingest + prefill consume + start
//   E. SPA client (integration/verify-prefill-client): helpers + full round trip
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (p) => import(pathToFileURL(path.join(HERE, p)).href);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  ✗', m)); };
const section = (n) => console.log(`\n── ${n} ──`);
const b64url = (s) => Buffer.from(s).toString('base64url');
const servers = [];
const listen = (app) => new Promise((res) => { const s = app.listen(0, () => res(s)); servers.push(s); });

// ═══ A. crypto interop ═══════════════════════════════════════════════════════
section('A. crypto interop');
{
  const B = await load('./crypto.ts');
  const A = await load('./integration/verify-api-crypto.ts');
  const key = Buffer.from('ab'.repeat(32), 'hex');
  const obj = { citizenId: '1101700207366', name: 'สมชาย ใจดี' };
  ok(JSON.stringify(A.decryptJson(B.encryptJson(obj, key), key)) === JSON.stringify(obj), 'broker encrypt → api decrypt');
  ok(JSON.stringify(B.decryptJson(A.encryptJson(obj, key), key)) === JSON.stringify(obj), 'api encrypt → broker decrypt');
  const raw = JSON.stringify({ a: 1 }), ts = '1712345678000', n = 'nonce1', sec = 's'.repeat(40);
  ok(B.signS2S(raw, ts, n, sec) === A.signS2S(raw, ts, n, sec), 'signS2S parity');
  ok(A.parseFieldKey('ab'.repeat(32))?.length === 32 && A.parseFieldKey('x') === null, 'parseFieldKey hex/junk');
}

// ═══ B. broker stub flow (routes.ts + store.ts) ══════════════════════════════
section('B. broker stub flow');
{
  const { createVerifyRouter } = await load('./routes.ts');
  const { signOutgoingS2S } = await load('./s2s.ts');
  const SECRET = 's'.repeat(40);

  // fake api ingest endpoint — เก็บ payload ที่ broker push มา
  let ingested = null;
  const apiApp = express();
  apiApp.use(express.json());
  apiApp.post('/api/verify/callback-ingest', (req, res) => { ingested = req.body; res.json({ ok: true }); });
  const apiSrv = await listen(apiApp);
  const ingestUrl = `http://127.0.0.1:${apiSrv.address().port}/api/verify/callback-ingest`;

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-smoke-'));
  const env = {
    VERIFY_ENABLED: 'true', VERIFY_DRIVER: 'stub', VERIFY_STUB_AUTOPASS: 'true',
    VERIFY_S2S_SECRET: SECRET, VERIFY_FIELD_KEY: 'cd'.repeat(32), VERIFY_PID_PEPPER: 'p'.repeat(20),
    VERIFY_PUBLIC_BASE: 'https://broker.test', VERIFY_DONE_REDIRECT: 'https://web.test/done',
    VERIFY_LARAVEL_INGEST_URL: ingestUrl,
    VERIFY_ALLOWED_S2S_IPS: '127.0.0.1,::1', VERIFY_S2S_TRUST_ALL_IPS: 'true',
  };
  const brokerApp = express();
  brokerApp.use(createVerifyRouter(env, dataDir));
  const brokerSrv = await listen(brokerApp);
  const base = `http://127.0.0.1:${brokerSrv.address().port}`;

  const s2sGet = async (url) => fetch(url, { headers: signOutgoingS2S('', SECRET) });
  const openSession = async (body) => {
    const raw = JSON.stringify(body);
    const r = await fetch(`${base}/api/verify/session`, { method: 'POST', headers: signOutgoingS2S(raw, SECRET), body: raw });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  // disabled-safety: bad S2S → 401
  {
    const r = await fetch(`${base}/api/verify/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    ok(r.status === 401, `session without S2S → 401 (got ${r.status})`);
  }

  // prefill + consent
  const sess = await openSession({
    applicationRef: 'prefill-1', mode: 'prefill',
    matchFields: { citizenId: '1101700207366' },
    consent: { version: '2026-09-v1', acceptedAt: '2026-09-02T09:00:00.000Z' },
  });
  ok(sess.status === 201 && sess.body?.sid && sess.body?.verifyUrl.includes('?sid='), `prefill session 201 (${sess.status})`);
  const sid = sess.body.sid;

  // GET /verify?sid= → stub page w/ simulate link
  const startPage = await (await fetch(`${base}/verify?sid=${sid}`)).text();
  ok(startPage.includes('/verify/callback?sid=') && startPage.includes('stub=1'), 'stub page has simulate link');

  // GET /verify/callback?sid=&stub=1 → 302 back + push to api
  const cb = await fetch(`${base}/verify/callback?sid=${sid}&stub=1`, { redirect: 'manual' });
  ok(cb.status === 302 && (cb.headers.get('location') || '').includes('kyc=verified'), `callback 302 kyc=verified (${cb.status})`);
  await new Promise(r => setTimeout(r, 100)); // ให้ push เสร็จ
  ok(ingested?.sid === sid && ingested?.mode === 'prefill' && ingested?.overallPass === true, 'api got ingest: sid/mode/overallPass');
  ok(ingested?.consentVersion === '2026-09-v1' && ingested?.consentAt === '2026-09-02T09:00:00.000Z', `ingest carries consent (${ingested?.consentVersion} / ${ingested?.consentAt})`);
  ok(ingested?.profile?.citizenId === '1101700207366' && !JSON.stringify(ingested).includes('match_fields_enc'), 'ingest has profile, no raw fields leaked');
  ok(/^[0-9a-f]{64}$/.test(ingested?.citizenIdHash || ''), 'ingest citizenIdHash is peppered hex, not the PID');

  // reuse consumed sid → 410 gone
  const reuse = await fetch(`${base}/verify?sid=${sid}`);
  ok(reuse.status === 410, `reuse consumed sid → 410 (${reuse.status})`);

  // match mode happy path (stub echoes applicant → flags true); ไม่ส่ง consent
  // (failure paths ของ match ทดสอบใน section C ด้วย mock IdP — stub echo กันไม่ให้ mismatch)
  ingested = null;
  const m = await openSession({
    applicationRef: 'app-2', mode: 'match',
    matchFields: { citizenId: '1101700207366', firstNameTh: 'สมชาย', lastNameTh: 'ใจดี', birthDate: '1990-01-01' },
  });
  await fetch(`${base}/verify?sid=${m.body.sid}`);
  await fetch(`${base}/verify/callback?sid=${m.body.sid}&stub=1`, { redirect: 'manual' });
  await new Promise(r => setTimeout(r, 100));
  ok(ingested?.mode === 'match' && ingested?.overallPass === true && ingested?.nameMatch === true, 'match mode → overallPass=true');
  ok(ingested?.profile === null, 'match mode → ingest carries no profile');
  ok(ingested?.consentVersion === null && ingested?.consentAt === null, 'no consent sent → ingest consent null');

  // status endpoint (S2S)
  const st = await s2sGet(`${base}/api/verify/status/${m.body.sid}`);
  const stBody = await st.json();
  ok(st.status === 200 && (stBody.status === 'consumed' || stBody.status === 'failed'), `status endpoint ok (${stBody.status})`);

  // disabled broker → 404
  {
    const off = express();
    off.use(createVerifyRouter({ ...env, VERIFY_ENABLED: 'false' }, fs.mkdtempSync(path.join(os.tmpdir(), 'verify-off-'))));
    const offSrv = await listen(off);
    const r = await fetch(`http://127.0.0.1:${offSrv.address().port}/verify?sid=x`);
    ok(r.status === 404, `VERIFY_ENABLED=false → 404 (${r.status})`);
  }
}

// ═══ C. OIDC driver + mock IdP ══════════════════════════════════════════════
section('C. OIDC driver');
{
  const { makeVerifier } = await load('./identityVerifier.ts');
  const { loadVerifyConfig } = await load('./config.ts');
  const oidc = await load('./oidc.ts');

  ok(oidc.ialAtLeast('2.3', '2.3') && !oidc.ialAtLeast('2.1', '2.3') && oidc.ialAtLeast('3', '2.3'), 'ialAtLeast compare');
  ok(oidc.normalizeBirthdate('25330520') === '1990-05-20' && oidc.normalizeBirthdate('1990-05-20') === '1990-05-20', 'normalizeBirthdate พ.ศ./ค.ศ.');
  ok(oidc.pickIal({ acr: 'urn:go.th:ial:2.3' }) === '2.3', 'pickIal from acr urn');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const KID = 'k1';
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };
  const challenges = new Map();
  let idp;
  const resetIdp = () => { idp = {
    sub: 'sub-1', ial: '2.3', pid: '1101700207366',
    given_name: 'สมชาย', family_name: 'ใจดี', birthdate: '25330520', nationality: 'TH',
    exp: () => Math.floor(Date.now() / 1e3) + 300, iat: () => Math.floor(Date.now() / 1e3),
    signKey: privateKey, forceNonce: undefined,
    userinfo: { address: { house_no: '9/1', sub_district: 'บางรัก', district: 'บางรัก', province: 'กรุงเทพมหานคร', postal_code: '10500' }, province_code: '10' },
  }; };
  resetIdp();
  const signJwt = (payload, key = idp.signKey) => {
    const h = b64url(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
    const p = b64url(JSON.stringify(payload));
    return `${h}.${p}.${crypto.sign('sha256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
  };

  const idpApp = express();
  idpApp.use(express.urlencoded({ extended: false }));
  idpApp.get('/jwks', (_q, r) => r.json({ keys: [jwk] }));
  idpApp.post('/token', (req, res) => {
    const { code, code_verifier } = req.body;
    if (!(req.headers.authorization || '').startsWith('Basic ')) return res.status(401).json({ error: 'invalid_client' });
    const calc = crypto.createHash('sha256').update(code_verifier || '').digest('base64url');
    if (challenges.get(code) !== calc) return res.status(400).json({ error: 'invalid_grant' });
    const nonce = idp.forceNonce !== undefined ? idp.forceNonce : challenges.get('n:' + code);
    res.json({
      access_token: 'AT', token_type: 'Bearer',
      id_token: signJwt({ iss: ISSUER, aud: 'cid', sub: idp.sub, exp: idp.exp(), iat: idp.iat(), nonce, ial: idp.ial, pid: idp.pid, given_name: idp.given_name, family_name: idp.family_name, birthdate: idp.birthdate, nationality: idp.nationality }),
    });
  });
  idpApp.get('/userinfo', (req, res) => (req.headers.authorization || '').startsWith('Bearer ') ? res.json({ sub: idp.sub, ...idp.userinfo }) : res.status(401).end());
  const idpSrv = await listen(idpApp);
  const ISSUER = `http://127.0.0.1:${idpSrv.address().port}`;

  const cfg = loadVerifyConfig({
    VERIFY_ENABLED: 'true', VERIFY_DRIVER: 'oidc',
    VERIFY_S2S_SECRET: 's'.repeat(40), VERIFY_FIELD_KEY: 'ab'.repeat(32), VERIFY_PID_PEPPER: 'p'.repeat(20),
    VERIFY_PUBLIC_BASE: 'https://b.test', VERIFY_DONE_REDIRECT: 'https://w.test/d', VERIFY_LARAVEL_INGEST_URL: 'http://127.0.0.1:1/x',
    THAID_CLIENT_ID: 'cid', THAID_CLIENT_SECRET: 'csec', THAID_REDIRECT_URI: 'https://b.test/verify/callback',
    THAID_AUTHORIZE_URL: `${ISSUER}/authorize`, THAID_TOKEN_URL: `${ISSUER}/token`,
    THAID_USERINFO_URL: `${ISSUER}/userinfo`, THAID_JWKS_URL: `${ISSUER}/jwks`, THAID_REQUIRED_IAL: '2.3',
  });
  ok(cfg.thaid.issuer === ISSUER, 'config derives issuer from authorize origin');
  const verifier = makeVerifier(cfg);
  ok(verifier.name === 'thaid-oidc', 'driver=oidc → ThaidOidcVerifier');

  const runFlow = ({ mode = 'prefill', applicant, mutate } = {}) => {
    const out = verifier.start('sid', cfg);
    const u = new URL(out.redirectUrl);
    const state = u.searchParams.get('state');
    challenges.set(state, u.searchParams.get('code_challenge'));
    challenges.set('n:' + state, u.searchParams.get('nonce'));
    const session = { sid: 'sid', oidcState: state, oidcNonce: u.searchParams.get('nonce'), pkceVerifier: out.oidc.pkceVerifier };
    if (mutate) mutate(session);
    return verifier.handleCallback({
      query: { code: state, state }, mode,
      applicant: applicant || { citizenId: idp.pid, firstNameTh: idp.given_name, lastNameTh: idp.family_name, birthDate: '1990-05-20' },
      session,
    }, cfg);
  };

  resetIdp();
  let r = await runFlow({ mode: 'prefill' });
  ok(r.profile.citizenId === '1101700207366' && r.profile.birthDate === '1990-05-20' && r.profile.isThaiNational, 'prefill: pid + birthdate normalized + Thai');
  ok(r.profile.address?.province === 'กรุงเทพมหานคร' && r.profile.geocode?.provinceCode === '10', 'prefill: address + geocode from userinfo');
  ok(r.result.ok && r.result.provider === 'thaid-oidc' && r.result.ial === '2.3', 'prefill: result ok');

  resetIdp();
  r = await runFlow({ mode: 'match', applicant: { citizenId: '1101700207366', firstNameTh: 'สมชาย', lastNameTh: 'ใจดี', birthDate: '1990-05-20' } });
  ok(r.result.ok && r.result.flags.nameMatch && r.result.flags.birthDateMatch, 'match: flags true');

  resetIdp();
  r = await runFlow({ mode: 'match', applicant: { citizenId: '1101700207366', firstNameTh: 'สมชาย', lastNameTh: 'อื่น', birthDate: '1990-05-20' } });
  ok(!r.result.ok && r.result.failureReason === 'name_mismatch' && r.profile.lastNameTh === 'ใจดี', 'match mismatch → name_mismatch, profile still returned');

  const throws = async (fn, code, label) => {
    try { await fn(); ok(false, `${label} (ไม่ throw)`); }
    catch (e) { ok(e.name === 'VerifierError' && e.code === code, `${label} (${e.code})`); }
  };
  await throws(() => runFlow({ mutate: (s) => { s.oidcState = 'X'; } }), 'state_mismatch', 'state mismatch throws');
  resetIdp(); idp.forceNonce = 'BAD';
  await throws(() => runFlow({}), 'nonce_mismatch', 'bad nonce throws');
  resetIdp(); idp.exp = () => Math.floor(Date.now() / 1e3) - 3600;
  await throws(() => runFlow({}), 'id_token_expired', 'expired id_token throws');
  resetIdp(); idp.ial = '2.1';
  await throws(() => runFlow({}), 'ial_too_low', 'low IAL throws');
  resetIdp(); idp.signKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await throws(() => runFlow({}), 'jwt_signature_invalid', 'wrong signing key throws');
  await throws(async () => {
    const out = verifier.start('s', cfg);
    const st = new URL(out.redirectUrl).searchParams.get('state');
    return verifier.handleCallback({ query: { error: 'access_denied', state: st }, mode: 'prefill', applicant: {}, session: { sid: 's', oidcState: st, oidcNonce: 'n', pkceVerifier: out.oidc.pkceVerifier } }, cfg);
  }, 'user_cancelled', 'access_denied → user_cancelled');
}

// ═══ D. api routes (integration/verify-api-routes) ══════════════════════════
section('D. api routes');
{
  const { createVerifyApiRoutes } = await load('./integration/verify-api-routes.ts');
  const cx = await load('./integration/verify-api-crypto.ts');
  const SECRET = 's'.repeat(40), KEY = 'cd'.repeat(32);

  const rv = new Map(), pc = new Map();
  const prisma = {
    register_verification: { async upsert({ where, create, update }) { rv.has(where.sid) ? Object.assign(rv.get(where.sid), update) : rv.set(where.sid, { ...create }); return rv.get(where.sid); } },
    verify_prefill_cache: {
      async findUnique({ where }) { return pc.get(where.sid) ?? null; },
      async upsert({ where, create, update }) { pc.has(where.sid) ? Object.assign(pc.get(where.sid), update) : pc.set(where.sid, { ...create, consumed_at: null }); return pc.get(where.sid); },
      async updateMany({ where, data }) { const r = pc.get(where.sid); if (r && r.consumed_at === null) { r.consumed_at = data.consumed_at; return { count: 1 }; } return { count: 0 }; },
    },
  };
  // fake broker for /start
  const brokerApp = express();
  brokerApp.use(express.raw({ type: () => true }));
  let brokerSaw = null;
  brokerApp.post('/api/verify/session', (req, res) => {
    brokerSaw = JSON.parse(req.body.toString('utf8'));
    res.status(201).json({ sid: 'BSID' + 'x'.repeat(18), verifyUrl: 'https://b/verify?sid=BSID', expiresAt: Date.now() + 6e5 });
  });
  const brokerSrv = await listen(brokerApp);

  const app = express();
  app.use(createVerifyApiRoutes({ prisma, env: {
    VERIFY_ENABLED: 'true', VERIFY_S2S_SECRET: SECRET, VERIFY_FIELD_KEY: KEY, VERIFY_S2S_TRUST_ALL_IPS: 'true',
    VERIFY_PUBLIC_BASE: `http://127.0.0.1:${brokerSrv.address().port}`, VERIFY_PREFILL_TTL_SECONDS: '600',
  } }));
  const srv = await listen(app);
  const apiBase = `http://127.0.0.1:${srv.address().port}`;

  const sid = 'SID' + 'a'.repeat(20);
  const ingest = {
    sid, applicationRef: '42', mode: 'prefill', citizenIdHash: 'a'.repeat(64),
    isThaiNational: true, nameMatch: true, birthDateMatch: true, addressMatch: true,
    overallPass: true, ial: '2.3', provider: 'stub', ndidRequestId: null, failureReason: null,
    verifiedAt: new Date().toISOString(),
    consentVersion: '2026-09-v1', consentAt: '2026-09-02T09:00:00.000Z',
    profile: { citizenId: '1101700207366', firstNameTh: 'สมชาย', middleNameTh: '', lastNameTh: 'ใจดี', birthDate: '1990-05-20', isThaiNational: true, address: { province: 'กรุงเทพมหานคร' }, geocode: { provinceCode: '10' } },
  };
  const ib = JSON.stringify(ingest);
  let r = await fetch(`${apiBase}/api/verify/callback-ingest`, { method: 'POST', headers: cx.signOutgoingS2S(ib, SECRET), body: ib });
  ok(r.status === 200 && (await r.json()).prefillCached, 'ingest prefill → 200 prefillCached');
  ok(rv.get(sid)?.register_log_id === 42 && rv.get(sid)?.status === 'verified', 'register_verification: register_log_id=42, verified');
  ok(rv.get(sid)?.consent_version === '2026-09-v1' && rv.get(sid)?.consent_at instanceof Date, 'register_verification: consent_at/version written');

  r = await fetch(`${apiBase}/api/verify/callback-ingest`, { method: 'POST', headers: cx.signOutgoingS2S(ib, SECRET), body: ib });
  ok(r.status === 200 && rv.size === 1, 'ingest retry idempotent');
  r = await fetch(`${apiBase}/api/verify/callback-ingest`, { method: 'POST', headers: cx.signOutgoingS2S(ib, 'wrong'), body: ib });
  ok(r.status === 401, 'ingest bad signature → 401');

  r = await fetch(`${apiBase}/api/verify/prefill?vs=${sid}`);
  ok(r.status === 200 && (await r.json()).profile?.firstNameTh === 'สมชาย', 'prefill consume → profile');
  r = await fetch(`${apiBase}/api/verify/prefill?vs=${sid}`);
  ok(r.status === 410, 'prefill second consume → 410');
  r = await fetch(`${apiBase}/api/verify/prefill?vs=${'z'.repeat(24)}`);
  ok(r.status === 410, 'prefill unknown vs → 410');

  r = await fetch(`${apiBase}/api/verify/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'prefill', matchFields: { citizenId: '1101700207366' }, consent: { version: '2026-09-v1' } }) });
  const sj = await r.json();
  ok(r.status === 201 && sj.verifyUrl?.includes('sid='), 'start → 201 verifyUrl');
  ok(brokerSaw?.mode === 'prefill' && brokerSaw?.consent?.version === '2026-09-v1' && typeof brokerSaw?.consent?.acceptedAt === 'string', 'start forwards consent w/ server acceptedAt');
}

// ═══ E. SPA client (integration/verify-prefill-client) ══════════════════════
section('E. SPA client');
{
  const store = new Map();
  let href = 'https://web.test/register';
  globalThis.window = {
    get location() { return new URL(href); },
    history: { state: null, replaceState: (_s, _t, u) => { href = String(u); } },
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  };
  const C = await load('./integration/verify-prefill-client.ts');

  ok(C.isValidThaiCitizenId('1101700207366') && !C.isValidThaiCitizenId('1234567890123'), 'isValidThaiCitizenId checksum');
  ok(C.toThaiDateParts('1990-05-20')?.yearBE === 2533, 'toThaiDateParts → พ.ศ.');
  const vr = C.readVerifyReturn('?vs=S1&kyc=verified&ref=S1');
  ok(vr.sid === 'S1' && vr.kyc === 'verified', 'readVerifyReturn parses');
  ok(typeof C.DEFAULT_CONSENT_VERSION === 'string' && C.DEFAULT_CONSENT_VERSION.length <= 16, 'DEFAULT_CONSENT_VERSION exported, <=16 chars');

  // full round trip against a fake api
  const rv = new Map(), pc = new Map();
  const { createVerifyApiRoutes } = await load('./integration/verify-api-routes.ts');
  const cx = await load('./integration/verify-api-crypto.ts');
  const SECRET = 's'.repeat(40), KEY = 'ef'.repeat(32);
  const prisma = {
    register_verification: { async upsert({ where, create, update }) { rv.has(where.sid) ? Object.assign(rv.get(where.sid), update) : rv.set(where.sid, { ...create }); } },
    verify_prefill_cache: {
      async findUnique({ where }) { return pc.get(where.sid) ?? null; },
      async upsert({ where, create }) { pc.set(where.sid, { ...create, consumed_at: null }); },
      async updateMany({ where, data }) { const r = pc.get(where.sid); if (r && r.consumed_at === null) { r.consumed_at = data.consumed_at; return { count: 1 }; } return { count: 0 }; },
    },
  };
  const brokerApp = express(); brokerApp.use(express.raw({ type: () => true }));
  brokerApp.post('/api/verify/session', (_q, r) => r.status(201).json({ sid: 'RTSID' + 'x'.repeat(16), verifyUrl: 'https://b/verify?sid=RTSID', expiresAt: Date.now() + 6e5 }));
  const brokerSrv = await listen(brokerApp);
  const app = express();
  app.use(createVerifyApiRoutes({ prisma, env: { VERIFY_ENABLED: 'true', VERIFY_S2S_SECRET: SECRET, VERIFY_FIELD_KEY: KEY, VERIFY_S2S_TRUST_ALL_IPS: 'true', VERIFY_PUBLIC_BASE: `http://127.0.0.1:${brokerSrv.address().port}`, VERIFY_PREFILL_TTL_SECONDS: '600' } }));
  const srv = await listen(app);
  const apiBase = `http://127.0.0.1:${srv.address().port}`;

  const started = await C.startThaidVerify({ citizenId: '1101700207366', apiBase, consent: { version: C.DEFAULT_CONSENT_VERSION } });
  ok(started.verifyUrl && started.sid, 'startThaidVerify → verifyUrl+sid');

  // simulate broker ingest so cache exists
  const sid = started.sid;
  const ib = JSON.stringify({
    sid, applicationRef: 'x', mode: 'prefill', citizenIdHash: 'a'.repeat(64),
    isThaiNational: true, nameMatch: true, birthDateMatch: true, addressMatch: true, overallPass: true,
    ial: '2.3', provider: 'stub', ndidRequestId: null, failureReason: null, verifiedAt: new Date().toISOString(),
    consentVersion: C.DEFAULT_CONSENT_VERSION, consentAt: new Date().toISOString(),
    profile: { citizenId: '1101700207366', firstNameTh: 'สมชาย', middleNameTh: '', lastNameTh: 'ใจดี', birthDate: '1990-05-20', isThaiNational: true, address: { province: 'กรุงเทพมหานคร', postalCode: '10500' }, geocode: {} },
  });
  await fetch(`${apiBase}/api/verify/callback-ingest`, { method: 'POST', headers: cx.signOutgoingS2S(ib, SECRET), body: ib });

  href = `https://web.test/register?vs=${sid}&kyc=verified&ref=${sid}`;
  const consumed = await C.consumePrefill(C.readVerifyReturn().sid, { apiBase });
  const vals = C.toRegisterFormPrefill(consumed.profile);
  ok(vals.addrProvince === 'กรุงเทพมหานคร' && vals.addrPostalCode === '10500' && vals.citizenId === '1101700207366', 'toRegisterFormPrefill flattens');
  C.rememberVerifiedSid(sid);
  ok(C.getVerifiedSid() === sid, 'rememberVerifiedSid/getVerifiedSid');
  C.clearVerifyReturnParams();
  ok(!window.location.search.includes('vs='), 'clearVerifyReturnParams strips vs');
  try { await C.consumePrefill(sid, { apiBase }); ok(false, 'second consume should be gone'); }
  catch (e) { ok(e.code === 'gone', `second consume → PrefillError gone (${e.code})`); }
}

// ═══ done ═══════════════════════════════════════════════════════════════════
for (const s of servers) s.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
