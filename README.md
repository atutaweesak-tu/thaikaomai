# พรรคไทยก้าวใหม่ — เว็บไซต์พรรค

เว็บไซต์ + ระบบจัดการเนื้อหา (Admin CMS) ของพรรคไทยก้าวใหม่ สร้างด้วย React + TypeScript + Vite ฝั่ง frontend และ Express server เขียนเองฝั่ง backend เก็บข้อมูลเป็นไฟล์ JSON ธรรมดา (ไม่มีฐานข้อมูลภายนอก ไม่ได้ใช้ Firebase)

## โครงสร้างโปรเจกต์

- `src/` — React app (หน้าเว็บสาธารณะ + หน้า `/admin`)
- `server/` — Express server + API (`server/api.ts`) สำหรับ production และรัน dev
- `data/` — ไฟล์ JSON เก็บข้อมูลจริง (news.json, contact.json, settings.json ฯลฯ) — ไม่ commit เข้า repo
- `public/uploads/` — ไฟล์รูปที่อัปโหลดผ่านหน้า admin
- `scripts/hashPassword.mjs` — เครื่องมือสร้าง bcrypt hash สำหรับรหัสผ่าน admin

## เริ่มต้นใช้งาน (Dev)

**Prerequisites:** Node.js 22+ (ต้อง ≥ 22.13 — ใช้ core module `node:sqlite` ใน `server/verify/`)

1. ติดตั้ง dependencies
   ```
   npm install
   ```

2. คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่า:
   - **บัญชี Admin** (สูงสุด 6 บัญชี, `ADMIN_1` ถึง `ADMIN_6`) — สร้างรหัสผ่านด้วย
     ```
     node scripts/hashPassword.mjs "รหัสผ่านของคุณ"
     ```
     แล้วนำ hash ที่ได้ไปใส่ใน `ADMIN_n_PASSWORD_HASH` (ห้ามใส่รหัสผ่านแบบ plaintext เด็ดขาด)
   - **SMTP** (ไม่บังคับ) — ถ้าตั้งค่า `SMTP_USER`/`SMTP_PASS` ระบบจะส่งอีเมลแจ้งเตือนอัตโนมัติเมื่อมีคนส่งฟอร์มติดต่อ/สมัครรับข่าวสาร/อาสาสมัคร

3. รัน dev server
   ```
   npm run dev
   ```
   เปิดที่ `http://localhost:3001` — Vite dev server รวม API (`/api/*`) ไว้ในตัวผ่าน plugin เดียวกัน ไม่ต้องรัน server แยก

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | รัน dev server (frontend + API) |
| `npm run build` | build production ไปที่ `dist/` |
| `npm run preview` | serve `dist/` ที่ build ไว้เพื่อดูตัวอย่าง |
| `npm run lint` | type-check ด้วย `tsc --noEmit` |
| `node scripts/hashPassword.mjs "pw"` | สร้าง bcrypt hash สำหรับใส่ใน `.env` |

## Production

Build แล้วรัน server ตัวจริง (Express, เสิร์ฟทั้ง static files และ API):

```
npm run build
npx tsx server/index.ts
```

Server อ่าน `PORT` จาก env (default `3001`) และต้องมี `.env` (หรือ `.env.local`) อยู่ข้างๆ กับ `dist/` ที่ build ไว้แล้ว

### Docker / VPS

มี `Dockerfile` และ `compose.vps.yml` ให้ใช้ deploy ตรงบน VPS:

```
docker compose -f compose.vps.yml up -d --build
```

- Base image = `node:22-alpine` (จำเป็นสำหรับ `node:sqlite` ที่ `server/verify/` ใช้ — เดิมเป็น `node:20-alpine`)
- Container ฟัง port 3001 ภายใน, map ออกมาที่ host port `8080`
- Mount `./data`, `./public/uploads` (persist ข้อมูล/ไฟล์อัปโหลด) และ `./.env` (read-only)
- ต้องมี reverse proxy (nginx/Caddy) หน้าบ้านทำ TLS แล้ว proxy เข้า `8080` — ดู `server/api.ts` เรื่องการเชื่อ header `X-Forwarded-For`/`X-Real-IP` เฉพาะจาก proxy ที่ต่อผ่าน private/loopback IP เท่านั้น
- Boot log ปกติจะมี `ExperimentalWarning: SQLite ...` 1 บรรทัด (จาก `node:sqlite`) — ไม่ใช่ error

#### Deploy ขึ้น VPS จริง

VPS: `root@45.136.253.164`, path `/opt/thaikaomai-new` — **ไม่ใช่ git repo** บนเครื่องนั้น (deploy ด้วยการ copy ไฟล์) ระบบ Laravel + MySQL อยู่คนละ path (`/opt/thaikaomai`) ไม่เกี่ยวกัน

```bash
# จากเครื่อง dev — ส่งเฉพาะไฟล์ที่เปลี่ยน (ตัวอย่าง: โมดูล verify)
git archive --format=tar HEAD server/index.ts Dockerfile server/verify -o /tmp/deploy.tar
scp -i ~/.ssh/thaikaomai_deploy /tmp/deploy.tar root@45.136.253.164:/tmp/

ssh -i ~/.ssh/thaikaomai_deploy root@45.136.253.164 'bash -s' <<'SH'
set -e
cd /opt/thaikaomai-new
TS=$(date +%Y%m%d%H%M%S)
mkdir -p backups
tar czf "backups/pre-deploy-$TS.tgz" server/index.ts Dockerfile server/verify 2>/dev/null || true
docker image tag thaikaomai-new-web "thaikaomai-new-web:rollback-$TS" || true
tar xf /tmp/deploy.tar -C /opt/thaikaomai-new && rm /tmp/deploy.tar
docker compose -f compose.vps.yml up -d --build
docker compose -f compose.vps.yml logs --tail=20 web
SH
```

Rollback: `cd /opt/thaikaomai-new && tar xzf backups/pre-deploy-<TS>.tgz && docker compose -f compose.vps.yml up -d --build`
(หรือใช้ image ที่ tag ไว้: `thaikaomai-new-web:rollback-<TS>`)

> หมายเหตุ: `core.autocrlf=true` บนเครื่อง Windows ทำให้ไฟล์ที่ `git archive` ออกมาเป็น CRLF —
> ไม่กระทบ Node/Docker แต่ md5 จะต่างจาก `git show HEAD:<file>`; เทียบแบบ `tr -d '\r'` ถ้าต้องตรวจ

## หน้า Admin

เข้าที่ `/admin` ล็อกอินด้วยบัญชีที่ตั้งไว้ใน `.env` สิทธิ์การเข้าถึงแต่ละแท็บกำหนดผ่าน `ADMIN_n_ROLE`/`ADMIN_n_TABS` (ดูรายละเอียดใน `.env.example`) ไม่มี UI สำหรับเพิ่ม/ลบ admin — ต้องแก้ผ่าน `.env` บนเซิร์ฟเวอร์โดยตรง
