# ThaID KYC verification broker

โมดูลยืนยันตัวตน (KYC) แยกออกจากระบบสมัคร — **"ยืนยันอย่างเดียว ไม่เก็บข้อมูลผู้สมัคร"**

> **หมายเหตุ (แก้จากที่เข้าใจผิดตอนแรก):** ระบบสมัครสมาชิกพรรค **ไม่ใช่ Laravel** —
> เป็น **Express + Prisma + MySQL** (`/opt/thaikaomai/api`) + SPA React/Vite/Mantine
> (`/opt/thaikaomai/web`). "Laravel" ในเอกสารนี้ = อ่านว่า "ฝั่ง api". โครงสร้าง
> ข้อมูล: `register_log` = ใบสมัครดิบ, `register` = สมาชิกที่อนุมัติแล้ว

โมดูลนี้ให้ api เรียกใช้เพื่อ (1) ยืนยันว่าผู้สมัครเป็นคนไทยจริง (2) ยืนยันว่า
ชื่อ-สกุล / เลขบัตร 13 หลัก / วันเกิด / ที่อยู่ทะเบียนบ้าน ตรงกับฐานกรมการปกครอง

## โหมด (mode)

`POST /api/verify/session` รับ `mode`:

| mode | ใช้เมื่อ | broker ทำ | ผลลัพธ์ |
|---|---|---|---|
| `match` (default) | verify-after — มีใบสมัครแล้ว ส่ง `matchFields` ครบชุดมาเทียบ | เทียบ claim ThaID กับ matchFields | flag `name/birthDate/address match` |
| `prefill` | verify-first ("แบบ B") — ยังไม่มีใบสมัคร ส่งแค่ seed `{ citizenId }` (+ชื่อ/วันเกิด optional) | ThaID คืน identity ที่ยืนยันแล้ว | `profile: VerifiedProfile` ส่งให้ api เก็บ transient (เข้ารหัส+TTL+single-use) ให้ SPA ดึงไปเติมฟอร์ม+ล็อก แล้ว api ลบทิ้ง |

broker ไม่เก็บ `profile` ต่อในทั้งสองโหมด — `verify_sessions` ถูกล้างตอน consume เหมือนเดิม

---

## สถานะปัจจุบัน

- **ปิดอยู่** จนกว่าจะตั้ง `VERIFY_ENABLED=true` — ทุก route ตอบ 404
- driver = `stub` (ยังไม่เรียก ThaID จริง): `GET /verify` แสดงข้อความ "อยู่ระหว่างเชื่อมต่อ
  กับกรมการปกครอง เจ้าหน้าที่จะตรวจสอบเอกสารอีกครั้ง"
- `identityVerifier.ts` → `ThaidOidcVerifier` เป็นโครงว่าง เติมเมื่อได้ Relying Party
  credentials จาก DOPA (ดู `// TODO(go-live)`)

## Flow

### match mode (verify-after — มีใบสมัครแล้ว)

```
[SPA submit ฟอร์ม → api เก็บ register_log (เหมือนเดิม)] ─────────────────────────┐
                                                                                 │
(0) SPA  POST /api/verify/start   { mode:'match', applicationRef, matchFields }   │ api
(1) api  S2S POST {broker}/api/verify/session   ────────────────────────────────►│ broker
         ◄──── { sid, verifyUrl, expiresAt }                                      │
(2) redirect ผู้สมัคร → verifyUrl  (มีแค่ ?sid= ไม่มี PII)                          │
(3) broker: stub page  หรือ  302 → ThaID authorize                                │
(4) ThaID callback → GET /verify/callback → เทียบ claims กับ matchFields           │
(5) broker S2S POST {VERIFY_LARAVEL_INGEST_URL}  { sid, mode, ...flags, hash }  ─►│ api: upsert register_verification
(6) 302 ผู้สมัคร → {VERIFY_DONE_REDIRECT}?ref=<applicationRef>&kyc=verified|failed  │
(7) broker: ลบ match fields, ปิด session (status=consumed)                         ┘
```

### prefill mode (verify-first / "แบบ B" — ยังไม่มีใบสมัคร)

```
(0) SPA  POST /api/verify/start   { mode:'prefill', matchFields:{ citizenId } }   │ api
(1) api  S2S POST {broker}/api/verify/session  ─────────────────────────────────►│ broker (seed = citizenId เท่านั้น)
(2)-(4) เหมือนบน — ThaID คืน VerifiedProfile ที่ยืนยันแล้ว (authoritative)          │
(5) broker S2S POST {VERIFY_LARAVEL_INGEST_URL}  { sid, mode:'prefill',           │ api: upsert register_verification
        ...flags, hash, profile }  ────────────────────────────────────────────►│    + เข้ารหัส profile → verify_prefill_cache (TTL)
(6) 302 ผู้สมัคร → {VERIFY_DONE_REDIRECT}?ref=<sid>&kyc=verified                    │
(7) SPA  GET /api/verify/prefill?vs=<sid>  ────────────────────────────────────►│ api: consume ครั้งเดียว → คืน profile
(8) SPA เติมฟอร์ม + ล็อก → submit → api สร้าง register_log +                       │
        UPDATE register_verification SET register_log_id=? WHERE sid=?            ┘
```

broker เก็บ **เฉพาะ** ตาราง `verify_sessions` (SQLite `data/verify.sqlite`) อายุสั้น —
`match_fields_enc` เข้ารหัส AES-256-GCM, ถูกล้างเป็น NULL ทันทีที่ handoff เสร็จ,
sweep ทิ้งอัตโนมัติทุก 5 นาที **ไม่มีตารางเก็บ claims จาก DOPA / ผล KYC ถาวรที่ฝั่งนี้**

---

## Endpoints — broker (server/verify/)

| Method | Path | ผู้เรียก | หมายเหตุ |
|---|---|---|---|
| POST | `/api/verify/session` | api (S2S) | เปิด session, คืน `sid` + `verifyUrl` |
| GET | `/verify?sid=` | เบราว์เซอร์ผู้สมัคร | เริ่มยืนยัน (stub page / 302 ไป ThaID) |
| GET | `/verify/callback` | เบราว์เซอร์ (กลับจาก IdP) | เทียบผล → push api → redirect |
| GET | `/api/verify/status/:sid` | api (S2S) | เช็คสถานะ (flag ล้วน) |

## Endpoints — ฝั่ง api (ก้อน B, `integration/verify-api-routes.ts`)

| Method | Path | ผู้เรียก | หมายเหตุ |
|---|---|---|---|
| POST | `/api/verify/callback-ingest` | broker (S2S) | บันทึกผล KYC ลง `register_verification` (idempotent ด้วย `sid`); prefill mode เก็บ `VerifiedProfile` เข้ารหัสใน `verify_prefill_cache` |
| GET | `/api/verify/prefill?vs=<sid>` | เบราว์เซอร์ (SPA) | ดึง `VerifiedProfile` **ครั้งเดียว** (single-use + TTL ~10 นาที) ไปเติมฟอร์ม+ล็อก |
| POST | `/api/verify/start` | เบราว์เซอร์ (SPA) | เปิด broker session (S2S →) คืน `verifyUrl` — ADAPT: ครอบด้วย auth/captcha/rate-limit ของ api |

### S2S auth (ทั้งขาเข้า/ขาออก)

ทุก request S2S แนบ header:

```
X-TKM-Timestamp: <epoch ms>
X-TKM-Nonce: <random>
X-TKM-Signature: hex( HMAC-SHA256( `${timestamp}.${nonce}.${rawBody}` , VERIFY_S2S_SECRET ) )
```

- timestamp เพี้ยนเกิน 5 นาที → ปฏิเสธ
- nonce ซ้ำภายใน window → ปฏิเสธ (กัน replay)
- IP ไม่อยู่ใน `VERIFY_ALLOWED_S2S_IPS` → ปฏิเสธ (ปิดได้ด้วย `VERIFY_S2S_TRUST_ALL_IPS=true` — testing เท่านั้น)
- GET `/status` เซ็นด้วย rawBody = `""`

ฝั่ง api ใช้ HMAC scheme เดียวกัน — `integration/verify-api-crypto.ts` เป็นสำเนา
self-contained ของ `signS2S` / `verifyIncomingS2S` / `signOutgoingS2S` +
`encryptJson`/`decryptJson` (บล็อบ AES-256-GCM รูปแบบเดียวกันเป๊ะ) จึงถอด
`VerifiedProfile` ที่ broker เข้ารหัสไว้ได้

---

## Environment variables

```bash
# --- เปิด/ปิด + โหมด ---
VERIFY_ENABLED=false               # true เท่านั้นถึงเปิด route
VERIFY_DRIVER=stub                 # stub | oidc
VERIFY_STUB_AUTOPASS=false         # stub จำลองผล "ผ่าน" — local/staging เท่านั้น

# --- ความปลอดภัย (บังคับเมื่อ enabled) ---
# VERIFY_S2S_SECRET + VERIFY_FIELD_KEY ต้องตั้ง "ค่าเดียวกัน" ทั้งฝั่ง broker และฝั่ง api
VERIFY_S2S_SECRET=                 # shared secret broker⇄api, >= 32 ตัวอักษร
VERIFY_FIELD_KEY=                  # AES-256-GCM key: hex 64 ตัว หรือ base64 ของ 32 bytes (broker เข้ารหัส profile / api ถอด)
VERIFY_PID_PEPPER=                 # HMAC pepper สำหรับ hash เลขบัตร, >= 16 ตัวอักษร (ฝั่ง broker เท่านั้น)

# --- URLs ---
VERIFY_PUBLIC_BASE=https://thaikaomai.or.th        # base ของ broker (ประกอบ verifyUrl / api เรียก /api/verify/session)
VERIFY_DONE_REDIRECT=https://www.thaikaomai.or.th/register/verify-done   # หน้า success ของฝั่ง api/SPA
VERIFY_LARAVEL_INGEST_URL=http://127.0.0.1:9000/api/verify/callback-ingest   # endpoint ingest ฝั่ง api (ชื่อ env ยังขึ้นต้น _LARAVEL_ ตามของเดิม)

# --- S2S allowlist ---
VERIFY_ALLOWED_S2S_IPS=127.0.0.1,::1              # broker: IP ของ api / api: IP ของ broker (loopback ถ้าอยู่ VPS เดียวกัน)
VERIFY_S2S_TRUST_ALL_IPS=false

VERIFY_SESSION_TTL_SECONDS=1800   # อายุ broker session
VERIFY_PREFILL_TTL_SECONDS=600    # (ฝั่ง api) อายุ verify_prefill_cache — SPA ต้อง consume ภายในเวลานี้

# --- ThaID OIDC (เว้นว่างจนกว่าจะได้ RP จาก DOPA) ---
THAID_CLIENT_ID=
THAID_CLIENT_SECRET=
THAID_REDIRECT_URI=https://thaikaomai.or.th/verify/callback
THAID_AUTHORIZE_URL=
THAID_TOKEN_URL=
THAID_USERINFO_URL=
THAID_JWKS_URL=
THAID_SCOPES=pid name birthdate address
THAID_REQUIRED_IAL=2.3
```

> **Docker:** ต้องใช้ base image `node:22-alpine` ขึ้นไป — `node:sqlite` เป็น core module
> ตั้งแต่ Node 22.13 (เดิม Dockerfile เป็น node:20 → เปลี่ยนแล้ว)

---

## สิ่งที่ฝั่ง api (Express + Prisma @ `/opt/thaikaomai/api`) ต้องเพิ่ม

ไฟล์อ้างอิงทั้งหมดอยู่ใน `server/verify/integration/` — ก๊อปขึ้น VPS วางในโปรเจกต์ api

### ก้อน A — 2 ตาราง (ทำแล้ว)

- `integration/register_verification.sql` — DDL อ้างอิง
- `integration/apply-verify-tables.sh` — runner (`sh apply-verify-tables.sh` บน VPS, additive + rollback ท้ายไฟล์)
- `integration/schema.verify.prisma` — 2 Prisma model + 1 enum (ต่อท้าย `api/prisma/schema.prisma` แล้ว `yarn prisma generate`)

| ตาราง | เก็บอะไร | อายุ |
|---|---|---|
| `register_verification` | ผล KYC ต่อครั้ง keyed ด้วย `sid` (unique → idempotent), `id_card_hash` = HMAC ไม่ใช่เลขบัตรจริง, ไม่มีชื่อ/ที่อยู่ | ถาวร (audit) |
| `verify_prefill_cache` | `VerifiedProfile` เข้ารหัส (prefill mode) | ~10 นาที, single-use |

`register_verification.register_log_id` **ไม่ตั้ง FK** (decouple) — api ส่ง
`applicationRef = String(register_log.id)` ตอนเปิด session, ก้อน B parse กลับเป็น int
prefill mode (verify-first) ยังไม่มี `register_log` → เก็บเป็น `NULL` ก่อน แล้ว
`UPDATE register_verification SET register_log_id=? WHERE sid=?` ตอน SPA submit ฟอร์ม (ก้อน C)

### ก้อน B — 3 route (`integration/verify-api-routes.ts` + `verify-api-crypto.ts`)

mount ครั้งเดียว:

```ts
import { createVerifyApiRoutes } from './verify/verify-api-routes'; // ปรับ path ตาม api
app.use(createVerifyApiRoutes({ prisma, env: process.env }));
// อย่าเอา express.json() ของ api ครอบ /api/verify/callback-ingest (ต้องอ่าน raw body เช็ค HMAC)
// ก้อนนี้ใส่ express.raw ให้เฉพาะจุดแล้ว
```

**(1) `POST /api/verify/callback-ingest`** — broker push ผลมา (S2S HMAC เหมือน `/session`)

```json
{
  "sid": "...", "applicationRef": "123", "mode": "prefill",
  "citizenIdHash": "<hex64>",
  "isThaiNational": true, "nameMatch": true, "birthDateMatch": true, "addressMatch": true,
  "overallPass": true, "ial": "2.3", "provider": "thaid-oidc",
  "ndidRequestId": "...", "failureReason": null, "verifiedAt": "2026-09-02T10:00:00.000Z",
  "profile": { "citizenId": "...", "firstNameTh": "...", "lastNameTh": "...",
               "birthDate": "1990-05-20", "isThaiNational": true,
               "address": { ... }, "geocode": { "provinceCode": "..", ... } }
}
```

api: เช็ค signature → `upsert` `register_verification` by `sid` (last-write-wins) →
ถ้า `mode='prefill'` และ `overallPass` → เข้ารหัส `profile` (AES-256-GCM, `VERIFY_FIELD_KEY`)
เก็บ `verify_prefill_cache` (`expires_at` = now + `VERIFY_PREFILL_TTL_SECONDS`) → `200 {ok:true}`
(4xx = broker เลิก retry, 5xx = broker retry)

**(2) `GET /api/verify/prefill?vs=<sid>`** — SPA เรียกครั้งเดียวหลัง redirect กลับ

- ไม่ต้อง S2S (เบราว์เซอร์เรียก) — กันด้วย `sid` เดายาก (24 bytes) + single-use + TTL
- claim แบบ atomic (`updateMany WHERE consumed_at IS NULL`) → ถ้าได้ → ถอดรหัสคืน
  `{ sid, profile, source: "thaid" }` ; ถ้าใช้ไปแล้ว/หมดอายุ/ไม่มี → `410`
- SPA เอา `profile` ไป prefill + `readOnly` ทุกช่อง (ชื่อ/สกุล/เลขบัตร/วันเกิด/ที่อยู่)

**(3) `POST /api/verify/start`** — SPA กดปุ่ม "ยืนยันตัวตนด้วย ThaID"

```json
// prefill (verify-first): { "mode": "prefill", "matchFields": { "citizenId": "1234567890123" } }
// match  (verify-after) : { "mode": "match", "applicationRef": "123", "matchFields": { ...ครบชุด } }
→ 201 { "sid": "...", "verifyUrl": "https://thaikaomai.or.th/verify?sid=...", "expiresAt": 1712345678000 }
```

api: S2S-sign → `POST {VERIFY_PUBLIC_BASE}/api/verify/session` → คืน `verifyUrl` ให้ SPA
(`window.location = verifyUrl`) — **ADAPT:** ครอบ handler นี้ด้วย captcha / rate-limit /
เช็ค origin ของ api ตามระบบเดิม

### หลังบ้าน (ส่วนที่ 2)

`register_log LEFT JOIN register_verification ON register_verification.register_log_id = register_log.id`
(หรือ join ด้วย `sid` ที่เก็บคู่ใบสมัคร) → badge: ✅ ThaID ยืนยันแล้ว / ⏳ รอ / ❌ ไม่ผ่าน / — ไม่ได้ทำ
เช็คแค่ `overall_pass` — ของเดิมยังตรวจ manual ได้ทุกใบ

---

## ก้อนถัดไป

- **ก้อน C — SPA:** ปุ่ม "ยืนยันด้วย ThaID" บนหน้า register → `POST /api/verify/start` →
  หลัง redirect กลับ (`?vs=<sid>`) เรียก `GET /api/verify/prefill` → เติมฟอร์ม + ล็อก
  → ตอน submit ให้ api `UPDATE register_verification SET register_log_id=? WHERE sid=?`
- **ก้อน D — OIDC จริง:** เติม `ThaidOidcVerifier.handleCallback()` เมื่อได้ RP จาก DOPA

## ค้างไว้ก่อน go-live (ดูบทสนทนาออกแบบ)

- DPIA + หน้าขอความยินยอม PDPA (สมาชิกพรรค = ข้อมูลอ่อนไหว ม.26) + retention policy
  — เก็บ `consent_at` / `consent_version` ลง `register_verification` ตอนผู้ใช้กดยินยอมก่อนเริ่ม verify
  (ตอนนี้ ก้อน B ปล่อยเป็น `NULL` เพราะ broker ไม่ได้ส่งมาใน ingest payload)
- `VERIFY_FIELD_KEY` ควรมาจาก KMS/secret manager ไม่ใช่ไฟล์ `.env` ธรรมดา
- ลงทะเบียน `THAID_REDIRECT_URI` (โดเมน apex สุดท้าย) กับ DOPA ตอนยื่น RP
- เติม `ThaidOidcVerifier.handleCallback()` + map claims จริงตามสเปก DOPA
- security assessment / pen-test ตามที่ DOPA/DGA กำหนดตอน onboard RP
