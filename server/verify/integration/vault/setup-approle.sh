#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# ก้อน G — ตั้งค่า Vault ครั้งแรก: init, unseal, เปิด KV v2, เขียน secret เดิม,
# สร้าง policy อ่านอย่างเดียว + AppRole ให้ broker/api ใช้ login
#
# รันครั้งเดียวตอน setup — รันซ้ำได้ปลอดภัย (idempotent) ยกเว้นขั้นตอน init
# ซึ่งจะข้ามให้เองถ้า Vault init ไปแล้ว (เช่นรันสคริปต์นี้ซ้ำเพื่อ rotate AppRole)
#
# ข้อสำคัญ — นี่คือการ "ย้าย" secret ที่มีอยู่แล้วเข้า Vault ไม่ใช่สร้างใหม่:
#   ต้องตั้งตัวแปรแวดล้อม VERIFY_FIELD_KEY / VERIFY_S2S_SECRET / VERIFY_PID_PEPPER
#   เป็นค่า "เดิม" ที่ broker+api ใช้อยู่ตอนนี้ (ก๊อปจาก .env ปัจจุบัน) ก่อนรันสคริปต์นี้
#   ถ้าใส่ค่าใหม่แทนค่าเดิม: VERIFY_S2S_SECRET เปลี่ยน = broker/api คุยกันไม่รู้เรื่องทันที,
#   VERIFY_FIELD_KEY เปลี่ยน = ถอดรหัสข้อมูลที่เข้ารหัสไว้เดิมไม่ได้อีกเลย
#
# ใช้: (จากเครื่องที่ scp โฟลเดอร์นี้ขึ้น VPS แล้ว, อยู่โฟลเดอร์เดียวกับ compose.vault.yml)
#   VERIFY_FIELD_KEY=<ค่าเดิม> VERIFY_S2S_SECRET=<ค่าเดิม> VERIFY_PID_PEPPER=<ค่าเดิม> \
#     sh setup-approle.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

VAULT_CONTAINER=thaikaomai-vault
KV_PATH=secret/thaikaomai/verify           # ใช้กับ `vault kv put/get` เท่านั้น — CLI แปลง
                                            # เป็น secret/data/... ให้เองตอนคุยกับ KV v2
KV_API_PATH=secret/data/thaikaomai/verify  # raw HTTP API path จริง (ที่ vaultClient.ts เรียกตรง ๆ)
                                            # — policy engine ไม่ auto-translate ให้เหมือน CLI
                                            # ต้องเขียน path นี้ใน policy ตรง ๆ ไม่งั้นได้ 403
POLICY_NAME=thaikaomai-verify-read
ROLE_NAME=thaikaomai-verify

vexec() { docker exec -i "$VAULT_CONTAINER" env VAULT_ADDR=http://127.0.0.1:8200 "$@"; }

[ -n "$VERIFY_FIELD_KEY" ] && [ -n "$VERIFY_S2S_SECRET" ] && [ -n "$VERIFY_PID_PEPPER" ] || {
  echo "ERROR: ต้องตั้ง VERIFY_FIELD_KEY, VERIFY_S2S_SECRET, VERIFY_PID_PEPPER เป็นค่าเดิมก่อนรัน (ดูคอมเมนต์หัวไฟล์)"
  exit 1
}

INIT_FILE="./vault-init.json"

echo "=== 1) init (ข้ามถ้า init ไปแล้ว) ==="
if vexec vault status -format=json 2>/dev/null | grep -q '"initialized": true'; then
  echo "Vault init ไปแล้ว — ข้ามขั้นตอนนี้ (ถ้าต้อง unseal ใหม่หลัง restart ต้องมี $INIT_FILE เดิมอยู่)"
else
  # -key-shares/-key-threshold=3/2: ต้องมีอย่างน้อย 2 ใน 3 คนถือ unseal key ร่วมกันถึงจะ unseal ได้
  # (ทีมเล็กมาก ๆ จะปรับเป็น 1/1 ก็ได้ แต่เสียคุณสมบัติ "ต้องมีมากกว่า 1 คนยินยอม" ของ Vault ไป)
  vexec vault operator init -key-shares=3 -key-threshold=2 -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "!!! บันทึกไฟล์ $INIT_FILE (unseal keys + root token) ไว้ในที่ปลอดภัยแยกจาก VPS นี้ทันที !!!"
  echo "!!! เช่นแยกเก็บใน password manager ของกรรมการพรรค 2-3 คน — ไฟล์นี้กู้ Vault กลับมาได้ทั้งหมด !!!"
fi

echo "=== 2) unseal (ต้องมี $INIT_FILE จากขั้นตอน init) ==="
if vexec vault status -format=json | grep -q '"sealed": true'; then
  [ -f "$INIT_FILE" ] || { echo "ERROR: ไม่มี $INIT_FILE ให้ unseal — ต้องเอา unseal key ที่เก็บไว้มาใส่เอง"; exit 1; }
  for key in $(jq -r '.unseal_keys_b64[0:2][]' "$INIT_FILE"); do
    vexec vault operator unseal "$key" > /dev/null
  done
  echo "unsealed"
else
  echo "unsealed อยู่แล้ว"
fi

ROOT_TOKEN=$( [ -f "$INIT_FILE" ] && jq -r '.root_token' "$INIT_FILE" || true )
[ -n "$ROOT_TOKEN" ] || { echo "ERROR: ไม่มี root token — ใส่ VAULT_TOKEN=<root token เดิม> มาด้วยตอนรัน"; ROOT_TOKEN="$VAULT_TOKEN"; }
[ -n "$ROOT_TOKEN" ] || exit 1

vexecT() { docker exec -i -e VAULT_TOKEN="$ROOT_TOKEN" "$VAULT_CONTAINER" env VAULT_ADDR=http://127.0.0.1:8200 "$@"; }

echo "=== 3) เปิด KV v2 ที่ path secret/ (ข้ามถ้าเปิดแล้ว) ==="
vexecT vault secrets enable -path=secret kv-v2 2>&1 | grep -q "already in use" && echo "เปิดไว้แล้ว" || true

echo "=== 4) เขียน secret เดิมเข้า Vault ==="
vexecT vault kv put "$KV_PATH" \
  VERIFY_FIELD_KEY="$VERIFY_FIELD_KEY" \
  VERIFY_S2S_SECRET="$VERIFY_S2S_SECRET" \
  VERIFY_PID_PEPPER="$VERIFY_PID_PEPPER"

echo "=== 5) policy อ่านอย่างเดียว เฉพาะ path นี้ ==="
cat <<POLICY | vexecT vault policy write "$POLICY_NAME" -
path "$KV_API_PATH" {
  capabilities = ["read"]
}
POLICY

echo "=== 6) เปิด AppRole auth + สร้าง role ==="
vexecT vault auth enable approle 2>&1 | grep -q "already in use" && echo "เปิดไว้แล้ว" || true
vexecT vault write "auth/approle/role/$ROLE_NAME" \
  token_policies="$POLICY_NAME" \
  token_ttl=15m token_max_ttl=30m \
  secret_id_ttl=0 secret_id_num_uses=0

ROLE_ID=$(vexecT vault read -field=role_id "auth/approle/role/$ROLE_NAME/role-id")
SECRET_ID=$(vexecT vault write -f -field=secret_id "auth/approle/role/$ROLE_NAME/secret-id")

echo ""
echo "=== เสร็จแล้ว — เติมค่าต่อไปนี้ลงใน .env ทั้งฝั่ง broker (/opt/thaikaomai-new) และ api (/opt/thaikaomai) ==="
echo "VAULT_ADDR=http://vault:8200"
echo "VAULT_ROLE_ID=$ROLE_ID"
echo "VAULT_SECRET_ID=$SECRET_ID"
echo ""
echo "แล้ว LB VERIFY_FIELD_KEY / VERIFY_S2S_SECRET / VERIFY_PID_PEPPER ออกจาก .env ทั้งสองไฟล์ได้เลย"
echo "(broker จะดึงมาจาก Vault ตอน boot แทน — ดู server/verify/vaultClient.ts)"
echo ""
echo "ทั้งสอง service ต้องอยู่ network thaikaomai_appnet เดียวกับ Vault ถึงจะต่อ VAULT_ADDR=http://vault:8200 ได้"
