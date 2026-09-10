# ─────────────────────────────────────────────────────────────────────────────
# ก้อน G — Vault server config (single-node, file storage backend)
#
# เหมาะกับสเกล VPS เดี่ยวของโปรเจกต์นี้ — ไม่ใช้ Consul/HA เพราะมีแค่เครื่องเดียว
# เก็บ persist ไว้ที่ volume `vault-data` (ดู compose.vault.yml) — backup โฟลเดอร์นี้
# เท่ากับ backup ทุก secret ที่เข้ารหัสไว้ (encrypted at rest ด้วย master key อยู่แล้ว)
#
# TLS ปิดไว้ (tls_disable = true) เพราะ Vault ไม่เปิด host port เลย เข้าถึงได้เฉพาะ
# ภายใน docker network เดียวกัน (thaikaomai_appnet) — ถ้าจะเปิดออกนอก VPS ในอนาคต
# (เช่นให้ CI เข้าถึง) ต้องเปิด TLS จริงก่อน
#
# mlock เปิดไว้ตามค่า default (ห้าม swap หน่วยความจำที่ถือ secret ลงดิสก์) — container
# ต้องรันพร้อม cap_add: IPC_LOCK (ตั้งไว้แล้วใน compose.vault.yml) ไม่งั้น Vault start ไม่ขึ้น
# ─────────────────────────────────────────────────────────────────────────────

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr = "http://vault:8200"
ui       = false
