# ThaID KYC verification broker

โมดูลยืนยันตัวตน (KYC) แยกออกจาก API หลัก — **"ยืนยันอย่างเดียว ไม่เก็บข้อมูลผู้สมัคร"**

ระบบรับสมัครสมาชิกพรรค (Laravel, คนละ repo) ยังทำงานเหมือนเดิมทุกอย่าง โมดูลนี้เป็น
ตัวช่วยที่ Laravel เรียกใช้เพื่อ (1) ยืนยันว่าผู้สมัครเป็นคนไทยจริง (2) ยืนยันว่า
ชื่อ-สกุล / เลขบัตร 13 หลัก / วันเกิด / ที่อยู่ทะเบียนบ้าน ตรงกับฐานกรมการปกครอง

---

## สถานะปัจจุบัน

- **ปิดอยู่** จนกว่าจะตั้ง `VERIFY_ENABLED=true` — ทุก route ตอบ 404
- driver = `stub` (ยังไม่เรียก ThaID จริง): `GET /verify` แสดงข้อความ "อยู่ระหว่างเชื่อมต่อ
  กับกรมการปกครอง เจ้าหน้าที่จะตรวจสอบเอกสารอีกครั้ง"
- `identityVerifier.ts` → `ThaidOidcVerifier` เป็นโครงว่าง เติมเมื่อได้ Relying Party
  credentials จาก DOPA (ดู `// TODO(go-live)`)

## Flow

```
[Laravel form submit] ── เก็บข้อมูลดิบ (เหมือนเดิม) ──────────────────────────────┐
                                                                                 │
(1) S2S  POST /api/verify/session   { applicationRef, matchFields }  ────────────►│ broker
         ◄──── { sid, verifyUrl, expiresAt }                                      │
                                                                                 │
(2) redirect ผู้สมัคร → verifyUrl  (มีแค่ ?sid= ไม่มี PII)                          │
(3) broker: stub page  หรือ  302 → ThaID authorize                                │
(4) ThaID callback → GET /verify/callback → เทียบ claims กับ matchFields           │
(5) S2S  POST {laravelIngestUrl}   { sid, ...flags, citizenIdHash }  ────────────►│ Laravel เก็บผล
(6) 302 ผู้สมัคร → {VERIFY_DONE_REDIRECT}?ref=<applicationRef>&kyc=verified|failed  │
(7) broker: ลบ match fields, ปิด session (status=consumed)                         ┘
```

broker เก็บ **เฉพาะ** ตาราง `verify_sessions` (SQLite `data/verify.sqlite`) อายุสั้น —
`match_fields_enc` เข้ารหัส AES-256-GCM, ถูกล้างเป็น NULL ทันทีที่ handoff เสร็จ,
sweep ทิ้งอัตโนมัติทุก 5 นาที **ไม่มีตารางเก็บ claims จาก DOPA / ผล KYC ถาวรที่ฝั่งนี้**

---

## Endpoints

| Method | Path | ผู้เรียก | หมายเหตุ |
|---|---|---|---|
| POST | `/api/verify/session` | Laravel (S2S) | เปิด session, คืน `sid` + `verifyUrl` |
| GET | `/verify?sid=` | เบราว์เซอร์ผู้สมัคร | เริ่มยืนยัน (stub page / 302 ไป ThaID) |
| GET | `/verify/callback` | เบราว์เซอร์ (กลับจาก IdP) | เทียบผล → push Laravel → redirect |
| GET | `/api/verify/status/:sid` | Laravel (S2S) | เช็คสถานะ (flag ล้วน) |

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

---

## Environment variables

```bash
# --- เปิด/ปิด + โหมด ---
VERIFY_ENABLED=false               # true เท่านั้นถึงเปิด route
VERIFY_DRIVER=stub                 # stub | oidc
VERIFY_STUB_AUTOPASS=false         # stub จำลองผล "ผ่าน" — local/staging เท่านั้น

# --- ความปลอดภัย (บังคับเมื่อ enabled) ---
VERIFY_S2S_SECRET=                 # shared secret กับ Laravel, >= 32 ตัวอักษร
VERIFY_FIELD_KEY=                  # AES-256-GCM key: hex 64 ตัว หรือ base64 ของ 32 bytes
VERIFY_PID_PEPPER=                 # HMAC pepper สำหรับ hash เลขบัตร, >= 16 ตัวอักษร

# --- URLs ---
VERIFY_PUBLIC_BASE=https://thaikaomai.or.th        # base ของ broker (ประกอบ verifyUrl)
VERIFY_DONE_REDIRECT=https://www.thaikaomai.or.th/register/verify-done   # หน้า success ของ Laravel
VERIFY_LARAVEL_INGEST_URL=http://127.0.0.1:9000/api/verify/callback-ingest

# --- S2S allowlist ---
VERIFY_ALLOWED_S2S_IPS=127.0.0.1,::1              # IP ของ Laravel เมื่อเรียก broker
VERIFY_S2S_TRUST_ALL_IPS=false

VERIFY_SESSION_TTL_SECONDS=1800

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

## สิ่งที่ฝั่ง Laravel ต้องเพิ่ม (footprint ที่ตกลงกันไว้)

### 1 ตาราง — `applicant_verifications`

```php
Schema::create('applicant_verifications', function (Blueprint $t) {
    $t->id();
    $t->string('application_ref')->index();        // id/ref ใบสมัครในระบบเดิม
    $t->string('sid')->unique();                   // จาก broker — ใช้กัน ingest ซ้ำ (idempotent)
    $t->enum('status', ['pending','verified','failed'])->default('pending');
    $t->string('provider')->nullable();            // 'stub' | 'thaid-oidc'
    $t->boolean('is_thai_national')->nullable();
    $t->boolean('name_match')->nullable();
    $t->boolean('birthdate_match')->nullable();
    $t->boolean('address_match')->nullable();
    $t->boolean('overall_pass')->nullable();
    $t->string('ial')->nullable();
    $t->string('failure_reason')->nullable();
    $t->char('citizen_id_hash', 64)->nullable();   // HMAC(pid, VERIFY_PID_PEPPER) — ไม่ใช่ pid เต็ม
    $t->timestamp('verified_at')->nullable();
    $t->timestamps();
});
```

ตารางข้อมูลดิบเดิม **ไม่แตะ** — Model `Application` เพิ่มแค่ relation:

```php
public function verification() { return $this->hasOne(ApplicantVerification::class, 'application_ref', 'ref'); }
```

### 2 endpoint (= 1 route + 1 controller 2 method)

**(ก) ขาออก — เปิด session** (เรียกตอน render ปุ่ม หรือตอนผู้สมัครกดปุ่ม):

```
POST {VERIFY_PUBLIC_BASE}/api/verify/session   + S2S headers
body: {
  "applicationRef": "APP-2569-000123",
  "matchFields": {
    "citizenId": "1234567890123",
    "firstNameTh": "สมชาย", "middleNameTh": null, "lastNameTh": "ใจดี",
    "birthDate": "1990-05-20",
    "address": { "houseNo":"...", "moo":"...", "subDistrict":"...", "district":"...", "province":"...", "postalCode":"..." }
  }
}
→ 201 { "sid": "...", "verifyUrl": "https://.../verify?sid=...", "expiresAt": 1712345678000 }
```

จากนั้น redirect ผู้สมัครไป `verifyUrl`

**(ข) ขาเข้า — รับผล** `POST /api/verify/callback-ingest` (ตรวจ S2S signature เหมือนกัน):

```json
{
  "sid": "...", "applicationRef": "APP-2569-000123",
  "citizenIdHash": "<hex64>",
  "isThaiNational": true, "nameMatch": true, "birthDateMatch": true, "addressMatch": true,
  "overallPass": true, "ial": "2.3", "provider": "thaid-oidc",
  "failureReason": null, "verifiedAt": "2026-09-01T10:00:00.000Z"
}
```

Laravel: ตรวจ signature → `updateOrCreate(['sid' => ...], [...])` (idempotent) → 200

### 1 ปุ่มใน Blade หน้า success

```blade
@if(config('thaid.enabled'))
  <a href="{{ route('kyc.start', ['ref' => $application->ref]) }}" class="btn-primary">
    ยืนยันตัวตนด้วย ThaID (ช่วยให้ตรวจสอบเร็วขึ้น)
  </a>
@endif
```

`kyc.start` = controller ที่เรียก endpoint (ก) แล้ว `redirect()->away($verifyUrl)`

### ระบบหลังบ้าน (ส่วนที่ 2)

`join applicant_verifications` แล้วโชว์ badge — ✅ ThaID ยืนยันแล้ว / ⏳ รอ / ❌ ไม่ผ่าน / — ไม่ได้ทำ
ของเดิมยังตรวจ manual ได้ทุกใบ

---

## ค้างไว้ก่อน go-live (ดูบทสนทนาออกแบบ)

- DPIA + หน้าขอความยินยอม PDPA (สมาชิกพรรค = ข้อมูลอ่อนไหว ม.26) + retention policy
- `VERIFY_FIELD_KEY` ควรมาจาก KMS/secret manager ไม่ใช่ไฟล์ `.env` ธรรมดา
- ลงทะเบียน `THAID_REDIRECT_URI` (โดเมน apex สุดท้าย) กับ DOPA ตอนยื่น RP
- เติม `ThaidOidcVerifier.handleCallback()` + map claims จริงตามสเปก DOPA
- security assessment / pen-test ตามที่ DOPA/DGA กำหนดตอน onboard RP
