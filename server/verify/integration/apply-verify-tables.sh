#!/bin/sh
# ── ก้อน A: สร้างตารางฝั่ง KYC ในDB จริง (docker thaikaomai-mysql-1) ───────────
# ใช้: scp ไฟล์นี้ขึ้น VPS แล้ว  sh apply-verify-tables.sh
# additive + IF NOT EXISTS + reversible (rollback ท้ายไฟล์)
set -e

PW=$(grep -E '^MYSQL_ROOT_PASSWORD=' /opt/thaikaomai/.env.vps | cut -d= -f2)
[ -n "$PW" ] || { echo "ERROR: อ่าน MYSQL_ROOT_PASSWORD จาก /opt/thaikaomai/.env.vps ไม่ได้"; exit 1; }

docker exec -i thaikaomai-mysql-1 mysql -uroot -p"$PW" thaikaomai --default-character-set=utf8mb4 <<'SQL'
CREATE TABLE IF NOT EXISTS `register_verification` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `register_log_id`  INT NULL,                       -- register_log.id (ไม่ตั้ง FK, decouple)
  `sid`              VARCHAR(64) NOT NULL,           -- broker session id → ingest idempotent
  `mode`             VARCHAR(16) NOT NULL DEFAULT 'prefill',   -- 'prefill' | 'match'
  `status`           ENUM('pending','verified','failed','expired') NOT NULL DEFAULT 'pending',
  `provider`         VARCHAR(32) NULL,              -- 'stub' | 'thaid-oidc'
  `ndid_request_id`  VARCHAR(128) NULL,            -- reference ธุรกรรม NDID (audit/dispute)
  `ial`              VARCHAR(8) NULL,
  `is_thai_national` TINYINT(1) NULL,
  `name_match`       TINYINT(1) NULL,
  `birthdate_match`  TINYINT(1) NULL,
  `address_match`    TINYINT(1) NULL,
  `overall_pass`     TINYINT(1) NULL,              -- ← หลังบ้าน/export เช็คแค่ field นี้
  `failure_reason`   VARCHAR(64) NULL,
  `id_card_hash`     CHAR(64) NULL,                -- HMAC-SHA256(pid, pepper) ไม่ใช่เลขบัตรจริง
  `consent_at`       DATETIME NULL,               -- ยินยอมต่อธุรกรรม (เงื่อนไข NDID)
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

-- โปรไฟล์ที่ยืนยันแล้ว (prefill mode) — transient: SPA ดึงครั้งเดียวแล้ว api ลบ/หมดอายุ
CREATE TABLE IF NOT EXISTS `verify_prefill_cache` (
  `sid`          VARCHAR(64) NOT NULL,
  `payload_enc`  TEXT NOT NULL,                    -- VerifiedProfile + addressIds เข้ารหัส (AES-256-GCM)
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`   DATETIME NOT NULL,               -- ~10 นาที
  `consumed_at`  DATETIME NULL,                   -- set ตอน SPA ดึงไปแล้ว (single-use)
  PRIMARY KEY (`sid`),
  KEY `idx_verify_prefill_cache_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
SQL

echo "--- ตารางที่มีตอนนี้ ---"
docker exec thaikaomai-mysql-1 mysql -uroot -p"$PW" thaikaomai -N -e \
  "SHOW TABLES LIKE 'register_verification'; SHOW TABLES LIKE 'verify_prefill_cache';"
echo "--- columns ของ register_verification ---"
docker exec thaikaomai-mysql-1 mysql -uroot -p"$PW" thaikaomai -N -e \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='thaikaomai' AND table_name='register_verification';"

# ── ROLLBACK (ถ้าต้องถอน) ────────────────────────────────────────────────────
# docker exec -i thaikaomai-mysql-1 mysql -uroot -p"$PW" thaikaomai -e \
#   "DROP TABLE IF EXISTS register_verification, verify_prefill_cache;"
