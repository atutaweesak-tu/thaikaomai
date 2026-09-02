-- ─────────────────────────────────────────────────────────────────────────────
-- register_verification — ผล KYC (ThaID/NDID) ต่อ 1 ใบสมัคร
--
-- ฝั่งระบบสมัคร (Express + Prisma + MySQL ที่ /opt/thaikaomai/api) — ไม่ใช่ Laravel
-- โปรเจกต์นั้นใช้ Prisma แบบ introspection (db pull) ไม่มี migration:
--   1) รัน CREATE TABLE นี้กับ MySQL โดยตรง
--   2) cd api && npx prisma db pull && npx prisma generate
--   3) เพิ่ม route/controller/service + rebuild service `api`
--
-- ออกแบบตามหลัก data-minimization ของ NDID/DOPA:
--   • เก็บ "ผลลัพธ์" ไม่เก็บข้อมูลตัวตนซ้ำ — ตัวข้อมูลจริง (ชื่อ/เลขบัตร/ที่อยู่/วันเกิด)
--     อยู่ใน register_log อยู่แล้ว ตารางนี้เก็บแค่ flag ว่า DOPA "ยืนยันตรง" หรือไม่
--   • ไม่เก็บเลขบัตร 13 หลัก plaintext — เก็บ id_card_hash = HMAC-SHA256(pid, server pepper)
--     ไว้จับคู่/กันสมัครซ้ำเท่านั้น
--   • มี audit: consent_at/version (ยินยอมต่อ transaction ตามเงื่อนไข NDID),
--     ndid_request_id (อ้างอิงธุรกรรมไว้สอบทาน/ข้อพิพาท), requester_ip, verified_at
--   • sid UNIQUE → ingest จาก broker เป็น idempotent (ยิงซ้ำไม่ทำข้อมูลซ้ำ)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `register_verification` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- ผูกกับใบสมัครดิบ (register_log.id) — ไม่ตั้ง FK constraint เพื่อ decouple
  -- จากสคีมาเดิม (introspection จะไม่พังถ้าแถวแม่ถูกลบ) เก็บได้หลายแถวต่อ 1 ใบ
  -- (retry ได้ — ใช้แถวล่าสุดที่ status='verified')
  `register_log_id`  INT NULL,

  -- broker session id — คีย์กันซ้ำของ ingest
  `sid`              VARCHAR(64) NOT NULL,

  `status`           ENUM('pending','verified','failed','expired') NOT NULL DEFAULT 'pending',
  `provider`         VARCHAR(32) NULL,          -- 'stub' | 'thaid-oidc'
  `ndid_request_id`  VARCHAR(128) NULL,         -- reference ธุรกรรม NDID/ThaID (audit/dispute)
  `ial`              VARCHAR(8) NULL,           -- Identity Assurance Level ที่ได้ เช่น '2.3'

  -- ผลเทียบราย field (จาก DOPA เทียบกับข้อมูลใน register_log) — boolean ล้วน
  `is_thai_national` TINYINT(1) NULL,
  `name_match`       TINYINT(1) NULL,
  `birthdate_match`  TINYINT(1) NULL,
  `address_match`    TINYINT(1) NULL,
  `overall_pass`     TINYINT(1) NULL,          -- ← field เดียวที่หลังบ้าน/ระบบ export ต้องเช็ค
  `failure_reason`   VARCHAR(64) NULL,         -- เช่น 'user_cancelled', 'citizen_id_mismatch'

  -- ไม่เก็บเลขบัตร plaintext — HMAC-SHA256(pid, VERIFY_PID_PEPPER)
  `id_card_hash`     CHAR(64) NULL,

  -- ยินยอมต่อ transaction (บันทึกตอนผู้สมัครกดปุ่ม "ยืนยันด้วย ThaID")
  `consent_at`       DATETIME NULL,
  `consent_version`  VARCHAR(16) NULL,

  `requester_ip`     VARCHAR(45) NULL,         -- IP ที่เรียก /verify/start
  `verified_at`      DATETIME NULL,

  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_register_verification_sid` (`sid`),
  KEY `idx_register_verification_log` (`register_log_id`),
  KEY `idx_register_verification_idhash` (`id_card_hash`),
  KEY `idx_register_verification_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
