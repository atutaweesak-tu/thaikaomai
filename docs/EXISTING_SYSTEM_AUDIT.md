# Existing System Audit — Thai Kao Mai website

สำรวจเมื่อ 2026-11-02 บน branch `master` (commit `e02dffe`) ก่อนเริ่มงาน Ultra Future 2035

## สถาปัตยกรรม

| ส่วน | ใช้อะไร |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 (SPA, `react-router-dom` 7) |
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`), token ใน `src/index.css` (`@theme`) |
| Animation | `motion` 12 (Framer Motion) |
| Icons | `lucide-react` |
| Backend | Express ที่เขียนเอง `server/index.ts` + `server/api.ts` (dev: ฝังใน Vite ผ่าน plugin ใน `vite.config.ts`) |
| ฐานข้อมูล | **ไม่มี DB** — เก็บเป็นไฟล์ JSON ใน `data/<collection>.json` (gitignored) |
| ไฟล์อัปโหลด | `public/uploads/` (gitignored) |
| CMS | หน้า `/admin` (`src/pages/AdminPage.tsx`) — CRUD ทุก collection, ตั้งค่าเว็บ, จัดลำดับ block หน้าแรก |
| Auth | Bearer token ของ admin (session ฝั่ง server), บัญชีจาก `.env` (`ADMIN_n_*`, bcrypt) + `data/users.json`; สิทธิ์รายแท็บ (`ALL_TABS`/`COLLECTION_TAB` ใน `server/api.ts`) |
| สมัครสมาชิก | **ไม่อยู่ใน repo นี้** — `/register` เป็นหน้าข้อมูลที่ลิงก์ไประบบเก่า `new.thaikaomai.or.th/register` |
| SEO | `index.html` meta + server แทน canonical/og:url รายหน้า (`renderSpaHtml`), 404 สำหรับ path ที่ไม่รู้จัก (`SPA_STATIC_PATHS` ต้องตรงกับ route ใน `App.tsx`) |

## โครงสร้างโฟลเดอร์หลัก

```
src/App.tsx              route ทั้งหมด (หน้า lazy ยกเว้น HomePage)
src/pages/HomePage.tsx   หน้าแรก — render ตาม PageBlock ที่ admin จัด (hero/policies/team/news/cta/promo) + PollWidget
src/components/          Navbar, Footer, Hero, PoliciesSection, NewsSection, CTASection, TeamSection, PopupBanner ฯลฯ
src/services/dataService.ts  ชั้นดึงข้อมูล — poll /api/data/<col> ทุก 8 วิ, settings ผ่าน SSE
src/types.ts / src/constants.ts  type + ข้อมูลสำรอง (fallback) ที่ใช้ระหว่างโหลด
server/api.ts            handler ทั้งหมด (collections, settings, upload, polls, analytics, SPA render)
data/                    news, events, policies (36), categories, team, settings
```

## ข้อมูลที่มีจริง (local snapshot)

- **policies**: 36 รายการ = ธนู 4 ดอก (`featuredHome: true`) + นโยบายย่อย 32 — ไม่มีฟิลด์ parent ใช้ลำดับ `order` จัดกลุ่ม
- **news**: 3 ข่าว (วันที่เป็นข้อความไทยอิสระ เช่น "3 ตุลาคม 2568")
- **events**: 2 รายการ ไม่มี `startAt` ไม่มีฟิลด์จังหวัด
- **settings**: snapshot วันที่ 2026-04-07 (เก่ากว่า production)
- ไม่มีข้อมูลสาขาพรรค / พิกัด / คลิปวิดีโอ

## คำสั่ง local

| คำสั่ง | ผล |
|---|---|
| `npm run dev` | Vite + API ที่ `http://localhost:3001` (ในเครื่องนี้เปิดผ่าน LAN IP) |
| `npm run lint` | `tsc --noEmit` |
| `npm run build` | build ไป `dist/` |
| `npm run test:verify` | smoke test ของโมดูล verify (ต้อง Node ≥ 22.13) |

## ความเสี่ยงที่พบ

1. `.env` มี SMTP จริง → ฟอร์มทดสอบจะส่งอีเมลจริง — **แก้แล้ว**: สร้าง `.env.local` (gitignored) ปิด SMTP เฉพาะเครื่องนี้
2. ข้อมูลใน `data/` เก่ากว่า production — หน้าตาตอน local อาจไม่ตรงกับเว็บจริง
3. หน้าแรกจัดลำดับได้จาก admin + มีธีมที่ปรับได้จาก admin → ดีไซน์ใหม่ต้องไม่ทำลายระบบนี้
4. ไม่มี unit test ฝั่ง frontend
5. `import * as Icons from 'lucide-react'` ทำให้ bundle หลักใหญ่ (1.25 MB) — ดู LOCAL_TEST_RESULTS

## แนวทางที่เลือก

คง stack เดิมทั้งหมด (ไม่ย้ายไป Next.js, ไม่เพิ่ม three.js), สร้าง section ใหม่เป็นชุดคอมโพเนนต์ `src/components/uf/` แล้ว map จาก block type เดิม เพื่อให้ admin ยังจัดลำดับ/ซ่อนได้เหมือนเดิม
