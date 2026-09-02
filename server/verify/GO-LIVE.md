# ThaID KYC — go-live checklist

รวมทุกอย่างที่ยัง **ทำในโค้ดตอนนี้ไม่ได้** ต้องรอ DOPA / infra / กฎหมาย
โค้ด broker + api routes + SPA client + OIDC driver + consent plumbing (ก้อน A–E) เสร็จแล้ว
ดูภาพรวมที่ [`README.md`](./README.md)

---

## 1. DOPA / ThaID onboarding (Relying Party)

- [ ] ยื่นขอเป็น Relying Party กับ DOPA/DGA — ได้ `client_id` / `client_secret`
- [ ] ลงทะเบียน `redirect_uri` = `https://<โดเมน apex สุดท้าย>/verify/callback` ให้ตรงเป๊ะ
      (ดู [`vps_domain_swap_plan`] — ต้องรู้โดเมนสุดท้ายก่อน)
- [ ] ได้ endpoint จริง: `authorize` / `token` / `userinfo` / `jwks` + ค่า `issuer` (`iss`)
- [ ] รู้วิธี client auth ที่ token endpoint — `basic` หรือ `post` → ตั้ง `THAID_TOKEN_AUTH`
- [ ] รู้ว่าต้องส่ง `acr_values` / `claims` param แบบไหน → เติมใน `ThaidOidcVerifier.start()`
- [ ] รู้ IAL ที่ได้จริง + ชื่อ claim ที่ถือ IAL (`ial` / `acr` / `amr`) → ตั้ง `THAID_REQUIRED_IAL`
- [ ] **ยืนยันชื่อ claim จริง** แล้วแก้ `mapThaidClaims()` ใน `identityVerifier.ts`:
  - [ ] เลขบัตร 13 หลัก (`pid`?)
  - [ ] ชื่อ-กลาง-สกุล ภาษาไทย (`given_name` / `middle_name` / `family_name`?)
  - [ ] `birthdate` — รูปแบบจริง (ค.ศ./พ.ศ.?) `normalizeBirthdate()` รองรับหลายแบบแล้ว แต่ยืนยันก่อน
  - [ ] address ตามทะเบียนบ้าน — OIDC `address` object หรือ sub-claim (`house_no`/`village_no`/…)
  - [ ] `nationality` — ตอนนี้ fallback: ไม่มี claim + เลข 13 หลัก → ถือว่าคนไทย
  - [ ] geocode TIS-1099 (`*_code`) ถ้า IdP ส่งมา
  - [ ] `ndid_request_id` / transaction ref สำหรับ audit
- [ ] security assessment / pen-test ตามที่ DOPA/DGA กำหนดตอน onboard
- [ ] ทดสอบ end-to-end กับ ThaID staging → แล้วสลับ `VERIFY_DRIVER=oidc` + `VERIFY_ENABLED=true`

## 2. Infra / secrets

- [ ] `VERIFY_S2S_SECRET` — สุ่ม >= 32 ตัว ตั้ง **ค่าเดียวกัน** ทั้ง broker และ api
- [ ] `VERIFY_FIELD_KEY` — AES-256-GCM key จาก **KMS / secret manager** ไม่ใช่ไฟล์ `.env` ธรรมดา
- [ ] `VERIFY_PID_PEPPER` — สุ่ม >= 16 ตัว (ฝั่ง broker); เก็บแยกจาก DB
- [ ] Docker base image `node:22-alpine`+ (broker ใช้ `node:sqlite` core module)
- [ ] api: mount `createVerifyApiRoutes()` — **อย่าเอา `express.json()` ครอบ `/api/verify/callback-ingest`**
- [ ] api: ต่อ `resolveRegisterLogId` ให้ map `applicationRef` → `register_log.id` ตามสคีมาจริง
- [ ] api: ตอน SPA submit ฟอร์ม (prefill) → `UPDATE register_verification SET register_log_id=? WHERE sid=? AND register_log_id IS NULL`
- [ ] api: `/api/verify/start` — ครอบ captcha / rate-limit / เช็ค origin
- [ ] cron/sweep ฝั่ง api: `DELETE FROM verify_prefill_cache WHERE expires_at < NOW() - INTERVAL 1 DAY`
- [ ] `VERIFY_ALLOWED_S2S_IPS` — ตั้ง IP จริงของอีกฝั่ง (ปิด `VERIFY_S2S_TRUST_ALL_IPS`)
- [ ] `VERIFY_DONE_REDIRECT` — หน้า register จริงที่รับ `?vs=&kyc=&ref=`

## 3. PDPA / กฎหมาย

- [~] **DPIA** — ร่าง v0.1 อยู่ที่ [`DPIA.md`](./DPIA.md); **ต้องให้ DPO + ที่ปรึกษากฎหมายรับรอง**
      (เติมข้อมูลทางการพรรคในช่อง `[...]`, กำหนด retention เป็นตัวเลข, ลงนามในข้อ 8)
- [~] **ข้อความขอความยินยอม** — ร่าง v0.1 อยู่ที่ [`CONSENT.md`](./CONSENT.md); หมวด A ใส่ใน
      `ThaidVerifyButton` ใน README แล้ว (ยังชี้ `PRIVACY_NOTICE_URL` placeholder) — ต้อง DPO รับรอง +
      ทำหน้าแสดงหมวด B + ยืนยัน `DEFAULT_CONSENT_VERSION` = `2026-09-v1`
- [ ] api: **ปฏิเสธคำขอ `/api/verify/start` ที่ไม่มี consent** / `version` ไม่อยู่ในตาราง `CONSENT.md` หมวด D
      (plumbing เก็บ `consent_at`/`consent_version` ครบสายแล้ว — ก้อน E)
- [ ] retention policy — กำหนดตัวเลข `[X]` ปีใน `DPIA.md`/`CONSENT.md` + ทำงานลบ/anonymize อัตโนมัติ
- [ ] เปิด access log การเข้าถึงผล KYC (DPIA ความเสี่ยง R5)
- [ ] ขั้นตอนใช้สิทธิเจ้าของข้อมูล (DPIA ข้อ 7) + ขั้นตอนแจ้งเหตุละเมิด 72 ชม. (ม.37)
- [ ] แต่งตั้ง DPO + ประกาศช่องทางติดต่อ; แจ้ง/ปรึกษา สคส. ตามที่ DPO วินิจฉัย (DPIA ข้อ 8)

## 4. หลังบ้าน (ส่วนที่ 2)

- [ ] `register_log LEFT JOIN register_verification` → badge ✅/⏳/❌/— ในหน้าตรวจใบสมัคร
- [ ] เช็คแค่ `overall_pass`; manual review ยังทำได้ทุกใบเหมือนเดิม
- [ ] export/รายงาน — ใส่คอลัมน์สถานะ KYC (ไม่ต้องมี PII เพิ่ม)

---

## สลับเปิดจริง (ลำดับ)

1. ตั้ง secrets (ข้อ 2) + `VERIFY_ENABLED=true` ยัง `VERIFY_DRIVER=stub` → ทดสอบ flow ทั้งเส้น (stub autopass)
2. เปิด consent gate ฝั่ง api (ข้อ 3)
3. ได้ RP + แก้ `mapThaidClaims()` (ข้อ 1) → `VERIFY_DRIVER=oidc` บน staging
4. pen-test → production
