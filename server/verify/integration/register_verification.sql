-- ─────────────────────────────────────────────────────────────────────────────
-- ก้อน A — ตารางฝั่ง KYC ในระบบสมัคร (Express + Prisma + MySQL @ /opt/thaikaomai/api)
--
-- **ระบบสมัครไม่ใช่ Laravel** — Prisma ใช้แบบ introspection (db pull) ไม่มี migration
--   1) รัน SQL นี้กับ MySQL โดยตรง  (ตัวช่วย: apply-verify-tables.sh)
--   2) เพิ่ม 2 model + 1 enum ใน api/prisma/schema.prisma (hand-written ตาม style)
--   3) rebuild service `api` → Dockerfile.vps รัน `yarn prisma generate` ให้เอง
--
-- ออกแบบตาม data-minimization ของ NDID: เก็บผล ไม่เก็บข้อมูลตัวตนซ้ำ,
-- ไม่เก็บเลข 13 หลัก plaintext (ใช้ id_card_hash = HMAC+pepper),
-- audit: consent_at/version, ndid_request_id, requester_ip, verified_at,
-- sid UNIQUE → ingest idempotent, retry ได้หลายแถวต่อ 1 ใบสมัคร (ใช้แถวล่าสุด verified)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `register_verification` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `register_log_id`  INT NULL,                       -- register_log.id (ไม่ตั้ง FK, decouple)
  `sid`              VARCHAR(64) NOT NULL,           -- broker session id
  `mode`             VARCHAR(16) NOT NULL DEFAULT 'prefill',   -- 'prefill' (verify-first) | 'match'
  `status`           ENUM('pending','verified','failed','expired') NOT NULL DEFAULT 'pending',
  `provider`         VARCHAR(32) NULL,              -- 'stub' | 'thaid-oidc'
  `ndid_request_id`  VARCHAR(128) NULL,
  `ial`              VARCHAR(8) NULL,
  `is_thai_national` TINYINT(1) NULL,
  `name_match`       TINYINT(1) NULL,
  `birthdate_match`  TINYINT(1) NULL,
  `address_match`    TINYINT(1) NULL,
  `overall_pass`     TINYINT(1) NULL,              -- ← หลังบ้าน/export เช็คแค่ field นี้
  `failure_reason`   VARCHAR(64) NULL,
  `id_card_hash`     CHAR(64) NULL,                -- HMAC-SHA256(pid, VERIFY_PID_PEPPER)
  `consent_at`       DATETIME NULL,
  `consent_version`  VARCHAR(16) NULL,
  `requester_ip`     VARCHAR(45) NULL,
  `verified_at`      DATETIME NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_register_verification_sid` (`sid`),
  KEY `idx_register_verification_log` (`register_log_id`),
  KEY `idx_register_verification_idhash` (`id_card_hash`),
  KEY `idx_register_verification_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- prefill mode: VerifiedProfile + resolved address ids ที่ยืนยันแล้ว — transient
-- SPA ดึงครั้งเดียว (?vs=<sid>) แล้ว api set consumed_at / sweep เมื่อ expires_at ผ่าน
CREATE TABLE IF NOT EXISTS `verify_prefill_cache` (
  `sid`          VARCHAR(64) NOT NULL,
  `payload_enc`  TEXT NOT NULL,                    -- AES-256-GCM (key = VERIFY_FIELD_KEY)
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`   DATETIME NOT NULL,               -- ~10 นาที
  `consumed_at`  DATETIME NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_verify_prefill_cache_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ROLLBACK: DROP TABLE IF EXISTS register_verification, verify_prefill_cache;
