# ก้อน G — Vault (secret manager) สำหรับ VERIFY_FIELD_KEY / VERIFY_S2S_SECRET / VERIFY_PID_PEPPER

ปิด `GO-LIVE.md` ข้อ 2 ("`VERIFY_FIELD_KEY` — AES-256-GCM key จาก **KMS / secret manager** ไม่ใช่
ไฟล์ `.env` ธรรมดา") และลดความเสี่ยง R9 ใน `DPIA.md` (คีย์ลับอยู่ใน `.env` ธรรมดา)

เลือก **HashiCorp Vault แบบ self-hosted** (ไม่ใช่ cloud KMS) เพราะระบบทั้งหมดรันบน VPS
เดี่ยวของพรรคเอง ไม่ได้อยู่บน cloud provider ไหน — เพิ่ม Vault เป็น container บน VPS เดิม
ไม่ต้องผูก vendor/บัญชี cloud ใหม่

## สถาปัตยกรรม

Vault เป็น stack แยก (`compose.vault.yml`) ไม่ได้อยู่ใต้ compose ของเว็บใดเว็บหนึ่ง เพราะ
secret ทั้ง 3 ตัวถูกใช้ร่วมกันระหว่าง **broker** (repo นี้, `/opt/thaikaomai-new`) กับ
**api** (อีก repo, `/opt/thaikaomai`) — เชื่อมกันผ่าน docker network `thaikaomai_appnet`
(external network ที่มีอยู่แล้วก่อนหน้านี้ ทั้งสอง service ต้อง join network นี้)

Vault **ไม่เปิด host port เลย** — เข้าถึงได้เฉพาะจาก container อื่นบน `thaikaomai_appnet`
ผ่าน service name `vault:8200`

## Deploy ครั้งแรก

```sh
# 1) scp ทั้งโฟลเดอร์นี้ขึ้น VPS เช่น /opt/vault/
scp -r server/verify/integration/vault root@<vps>:/opt/vault

# 2) รัน Vault
cd /opt/vault && docker compose -f compose.vault.yml up -d

# 3) ย้าย secret เดิม (ก๊อปค่าจาก .env ปัจจุบันของ broker — VERIFY_S2S_SECRET ต้องตรงกับ
#    ที่ api ใช้อยู่ด้วย, ห้ามใส่ค่าใหม่ ไม่งั้น broker/api จะคุยกันไม่รู้เรื่อง — อ่านคอมเมนต์
#    หัวไฟล์ setup-approle.sh ก่อนรัน)
VERIFY_FIELD_KEY=<ค่าเดิม> VERIFY_S2S_SECRET=<ค่าเดิม> VERIFY_PID_PEPPER=<ค่าเดิม> \
  sh setup-approle.sh
```

สคริปต์จะพิมพ์ `VAULT_ADDR` / `VAULT_ROLE_ID` / `VAULT_SECRET_ID` ออกมาท้ายสุด — เอาไปใส่ใน
`.env` ของ **ทั้งฝั่ง broker และ api** แล้วลบบรรทัด `VERIFY_FIELD_KEY` / `VERIFY_S2S_SECRET` /
`VERIFY_PID_PEPPER` เดิมออกจาก `.env` ทั้งสองไฟล์ได้เลย (โค้ดจะดึงจาก Vault แทนตอน boot —
ดู `server/verify/vaultClient.ts` ฝั่ง broker; ฝั่ง api ต้องเขียน loader แบบเดียวกันเอง
เพราะเป็นคนละ repo)

**สำคัญ**: บันทึกไฟล์ `vault-init.json` (unseal keys + root token ที่สคริปต์สร้างไว้) แยกไว้
นอก VPS นี้ทันที เช่นแบ่งเก็บใน password manager ของกรรมการพรรค 2-3 คน — ไฟล์นี้กู้ Vault
กลับมาได้ทั้งหมดถ้าเครื่องมีปัญหา และเป็นกุญแจเดียวที่ unseal Vault ได้หลัง container restart

## ปัญหาที่เจอจริงตอน deploy ครั้งแรก (2026-09-10) + วิธีแก้

1. **`init` ล้มเหลว: `mkdir /vault/data/core: permission denied`** — named volume
   `vault-data` ถูกสร้างเป็นเจ้าของ `root:root` โดย Docker แต่ Vault process รันเป็น
   uid 100 (`vault`) ไม่ใช่ root แก้ด้วย:
   ```sh
   docker exec -u root thaikaomai-vault chown -R vault:vault /vault/data
   ```
   รันครั้งเดียวหลัง `docker compose up -d` ครั้งแรก ก่อนรัน `setup-approle.sh`

2. **อ่าน secret ได้ `403` แม้ AppRole login ผ่านแล้ว** — `vault kv put`/`vault kv get`
   (CLI) แปลง path `secret/thaikaomai/verify` เป็น `secret/data/thaikaomai/verify`
   ให้อัตโนมัติ แต่ **policy engine ไม่แปลงให้** ต้องเขียน path ใน policy เป็น
   `secret/data/...` ตรง ๆ (มี `/data/`) ไม่งั้น token ที่ได้จาก AppRole จะไม่มีสิทธิ์อ่าน
   จริงแม้ policy จะ "ดูเหมือน" ครอบคลุม path เดียวกัน — `setup-approle.sh` แก้ไขจุดนี้แล้ว
   (แยก `KV_PATH` สำหรับ CLI กับ `KV_API_PATH` สำหรับ policy)

## หลัง restart VPS/container

Vault ใช้ storage backend แบบ `file` (ไม่ใช่ในหน่วยความจำ) — restart container แล้วข้อมูล
ยังอยู่ แต่ Vault จะ **sealed** ทุกครั้งที่ process เริ่มใหม่ ต้อง unseal ด้วยมือก่อน broker/api
จะดึง secret ได้ (นี่คือพฤติกรรมมาตรฐานของ Vault เพื่อความปลอดภัย ไม่ใช่บั๊ก):

```sh
docker exec -it thaikaomai-vault vault operator unseal <key1>
docker exec -it thaikaomai-vault vault operator unseal <key2>   # ต้องครบ threshold (2 จาก 3)
```

**ข้อควรพิจารณา**: เพราะต้อง unseal ด้วยมือ ถ้า Vault container restart (เช่น VPS reboot)
ตอนไม่มีใครอยู่ broker/api จะ boot ไม่ขึ้นจนกว่าจะมีคน unseal — ยอมรับ trade-off นี้ได้
สำหรับสเกลปัจจุบัน แต่ควรมีคนอย่างน้อย 1 คนได้รับแจ้งเตือนเมื่อ broker crash-loop
(เช่น monitoring บน `docker compose ps` / healthcheck)

## Rotate secret (เช่นเปลี่ยน VERIFY_S2S_SECRET ตามรอบ หรือสงสัยว่าหลุด)

```sh
docker exec -e VAULT_TOKEN=<root หรือ token ที่มีสิทธิ์เขียน> thaikaomai-vault \
  vault kv put secret/thaikaomai/verify \
  VERIFY_FIELD_KEY=<ค่าเดิมถ้าไม่เปลี่ยน> VERIFY_S2S_SECRET=<ค่าใหม่> VERIFY_PID_PEPPER=<ค่าเดิมถ้าไม่เปลี่ยน>
```

แล้ว restart broker + api container ทั้งคู่ **พร้อมกัน** (VERIFY_S2S_SECRET ต้องตรงกันเสมอ —
ถ้า restart ไม่พร้อมกัน S2S จะปฏิเสธกันเองชั่วคราวระหว่างที่ค่าไม่ตรงกัน)

การเปลี่ยน `VERIFY_FIELD_KEY` ทำให้ **ถอดรหัสข้อมูลที่เข้ารหัสไว้เดิมไม่ได้อีก** —
ข้อมูลที่กระทบมีแค่ของชั่วคราว (`verify_sessions`, `verify_prefill_cache` อายุสั้นอยู่แล้ว)
ไม่กระทบ `register_verification` ที่เก็บแค่ flag/hash ไม่ได้เข้ารหัสด้วยคีย์นี้

## Rotate AppRole secret_id (ถ้าสงสัยว่า VAULT_SECRET_ID หลุด)

```sh
docker exec -e VAULT_TOKEN=<token> thaikaomai-vault \
  vault write -f auth/approle/role/thaikaomai-verify/secret-id
```

ได้ `secret_id` ใหม่ — เอาไปแทนที่ `VAULT_SECRET_ID` ใน `.env` ทั้งสองฝั่งแล้ว restart
(ค่าเก่ายังใช้ได้จนกว่าจะ revoke ด้วยมือผ่าน `secret-id-accessor` — ถ้าต้องการ invalidate
ค่าเก่าทันทีให้ดูคำสั่ง `vault list` + `vault write .../secret-id-accessor/destroy` ในเอกสาร
Vault AppRole official)
