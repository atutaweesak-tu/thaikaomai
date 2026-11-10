# V2 Final Acceptance Review — Ultra Future Homepage

- **วันที่ตรวจ:** 2026-11-02 · **Branch:** `feature/ultra-future-homepage` (ไม่ commit / ไม่ push / ไม่ merge)
- **สภาพแวดล้อม:** production build (`npm run build` → `server/index.ts`) ที่ `http://localhost:3100` · ข้อมูล = snapshot เนื้อหาสาธารณะจาก production (ไม่มีข้อมูลส่วนบุคคล) · Chrome 1xx headless ผ่าน `puppeteer-core` + Lighthouse 13.6.0 + axe-core 4.14.0 (ติดตั้งใน scratchpad ไม่แตะ `package.json`)
- **รอบนี้ไม่แก้ Source Code** — มีแค่เอกสารนี้ + หลักฐานใน `docs/v2-acceptance/` · ทุกการเปลี่ยน `data/` ชั่วคราว (layout hero, คลิปทดสอบ) คืนค่าแล้ว (ตรวจเทียบ snapshot ทุกไบต์)
- **Production Status: NOT DEPLOYED**

## สรุปผล

| ด้าน | ผล |
|---|---|
| ฟังก์ชัน (Hero 4 กรณี, 9 Sections, Policy 4 ดอก/36 รายการ, Newsroom, YouTube, กิจกรรม, น้องเลม่อน, Keyboard) | ✅ ผ่านทั้งหมด |
| `prefers-reduced-motion` (จำลอง media query จริงผ่าน CDP) | ✅ ผ่าน |
| Accessibility — axe-core WCAG 2.0/2.1 A+AA | ✅ 0 violations (3 หน้า) |
| Accessibility — Lighthouse | ⚠️ 94 / 94 / 90 — พบ 4 จุด (ส่วนใหญ่เป็นโค้ดเดิม) |
| Performance — Lighthouse | ❌ 58 (desktop) / 48 (mobile) — ภาพขนาดใหญ่จากข้อมูลจริง + settings 1.3 MB |
| Type-check / Build / Tests เดิม | ✅ / ✅ / ✅ 65 passed |

**ข้อสรุปตรวจรับ:** ด้านดีไซน์ ฟังก์ชัน และ accessibility **พร้อมรับ** · ด้าน **performance ยังไม่ผ่านเกณฑ์ Blueprint (LCP ≤ 2.5 s)** — สาเหตุหลักไม่ใช่โค้ด V2 แต่เป็นขนาดไฟล์ภาพที่อัปโหลดและรูป base64 ใน settings ควรแก้ก่อน deploy จริง (ดู P1–P3)

---

## 1. Hero — 4 กรณี

| กรณี | Desktop 1440 | Mobile 390 | ผล |
|---|---|---|---|
| **imageOnly** (ค่าจริง production — แบนเนอร์ถวายอาลัย 1920×1080) | สูง 796 · ภาพ 1440×716 `object-fit: contain` (ไม่ครอป) · h1 ซ่อนสำหรับ screen reader | สูง 287 · ภาพ 390×219 ไม่ครอป | ✅ ภาพไม่ถูกเปลี่ยน/ตัด/ซ่อน ไม่มีเอฟเฟกต์ทับ |
| **cinematic** | สูง 848 · h1 + CTA 2 ปุ่ม + ลูกศร SVG 640px | สูง 498 · ลูกศรอยู่หลังข้อความ | ✅ |
| **split** | สูง 820 · การ์ดรูปผู้นำ 525px + จุดสไลด์ | สูง 688 · การ์ดแนวนอน 166px (รูปครบ) | ✅ |
| **ลด Animation** (`prefers-reduced-motion: reduce`) บน cinematic | ที่ 250 ms: CTA opacity 1, ลูกศรครบ (reveal = 1) · ไม่มี animation วนซ้ำ | — | ✅ |

เทียบ `no-preference`: ที่ 250 ms CTA = 0 และลูกศร = 0 (timeline 0.4→2.0 s ทำงานตาม Blueprint), ที่ 3 s มี animation วนซ้ำ 5 ตัว (comet, glow, orbit spin, float, bounce) → `reduce` = 0 ตัว · ไม่มี console error ทุกกรณี · ไม่มี scroll แนวนอน

| | ภาพ |
|---|---|
| imageOnly desktop / mobile | `v2-acceptance/acc-hero-imageOnly-desktop.png` · `acc-hero-imageOnly-mobile.png` |
| cinematic desktop / mobile | `acc-hero-cinematic-desktop.png` · `acc-hero-cinematic-mobile.png` |
| split desktop / mobile | `acc-hero-split-desktop.png` · `acc-hero-split-mobile.png` |
| reduced motion: no-preference / reduce | `acc-reduced-motion-no-preference-hero.png` · `acc-reduced-motion-reduce-hero.png` |

## 2. ทั้ง 9 Sections — 1440 / 390

ลำดับ block บน production: Hero → ข่าว (Newsroom + Channel + กิจกรรม) → นโยบาย (Universe + Hub) → แบนเนอร์โปรโมท → CTA (Guide + Join) · ไม่มี block ทีมพรรค

| Section | Blueprint (D / M) | จริง Desktop | จริง Mobile | ผล |
|---|---|---|---|---|
| 01 Navigation | ~80 / ~68 | 81 | 69 | ✅ glass, mega menu, ค้นหา, ปุ่มสมัคร |
| 02 Hero | ~820 / ~710 | 796 (imageOnly) · 848 (cinematic) | 287 / 498 / 688 | ✅ (มือถือกระชับกว่าเป้าตามบรีฟ V2) |
| 03 Quick Discovery | ~430 / ~490 | 332 | 480 | ✅ 4 การ์ด ลิงก์จริงทุกใบ |
| 04 Policy Universe | ~920 / ~830 | 1,025 | 971 | ✅ (สูงกว่าเป้าเล็กน้อย — วง 600px + หัว section) |
| 05 Policy Hub | ~850 / ~820 | 1,108 | 1,359 | ⚠️ สูงกว่าเป้า (การ์ด 6 ใบ + ตัวกรอง) |
| 06 Newsroom | ~850 / ~850 | 867 | 892 | ✅ |
| 06B Channel (YouTube) | — | 179 (ไม่มีคลิป = แถบลิงก์) | 256 | ✅ |
| 07 Activities | ~900 / ~940 | 622 | 835 | ✅ (ไม่มีแผนที่ SVG — รอ asset) |
| 08 Lemon Guide | ~540 / ~600 | 529 | 718 | ✅ |
| 09 Join + Footer | ~760 / ~870 | 637 + 486 | 557 + 884 | ✅ |

ภาพเต็มหน้า: `v2-acceptance/acc-full-desktop.png` · `acc-full-mobile.png` · ความสูงหน้า 7,031 / 7,785 px

## 3. Before / After (V1 → V2)

| จุด | Before | After | สังเกต |
|---|---|---|---|
| Desktop Hero | `before-desktop-1-hero.png` | `after-desktop-1-hero.png` | แบนเนอร์เหมือนเดิม; การ์ดทางลัดโผล่ใต้แบนเนอร์ (ระยะสั้นลง) |
| Desktop Universe | `before-desktop-2-universe.png` | `after-desktop-2-universe.png` | วงโคจรเห็นครบในจอเดียว; ดอกที่เลือก + ลำแสง + เส้นเชื่อมไปแผง |
| Desktop Newsroom | `before-desktop-3-newsroom.png` | `after-desktop-3-newsroom.png` | การ์ดขวาสูงเท่ากัน (เดิมใบที่ 2 ยืดยาว) |
| Desktop Activities | `before-desktop-4-activities.png` | `after-desktop-4-activities.png` | "รอกำหนดการ" → "ผ่านไปแล้ว" (ถูกต้อง) |
| Desktop Hub | `before-desktop-5-hub.png` | `after-desktop-5-hub.png` | ระยะบนสั้นลง ต่อจาก Universe เป็นเรื่องเดียว |
| Mobile Hero | `before-mobile-1-hero.png` | `after-mobile-1-hero.png` | การ์ดทางลัดกระชับขึ้น |
| Mobile Universe | `before-mobile-2-universe.png` | `after-mobile-2-universe.png` | คงเดิม (การ์ดปัด) |
| Mobile Newsroom | `before-mobile-3-newsroom.png` | `after-mobile-3-newsroom.png` | หัวข้อ ≤ 3 บรรทัด |
| Mobile Guide/Join | `before-mobile-4-guide.png` | `after-mobile-4-guide.png` | น้องเลม่อนไม่ถูกขยายจนแตก |

(ไฟล์ทั้งหมดอยู่ใน `docs/v2-acceptance/`)

- **พื้นที่ว่าง:** หน้าแรกสั้นลง 13% (desktop 8,136 → 7,031) / 15% (mobile 9,134 → 7,785) · ช่องว่างใหญ่สุดมือถือ 349 → 174 px · ไม่มี fixed height ที่ตัดเนื้อหา
- **สี:** ใช้ navy `#071326` / lemon `#DDF34B` / cyan `#36D9F5` ชุดเดิม · แบนเนอร์โปรโมทเปลี่ยนจากสีเดิม (`#1b1d33`) มาใช้พื้นผิวชุดเดียวกัน
- **แสง:** แสงเรืองเฉพาะปุ่มหลัก ดอกที่เลือก ลูกศร ปุ่มเล่นคลิป — ไม่มีแสงทับข้อความยาว
- **ความต่อเนื่อง:** ฉากหลัง gradient สลับซ้าย-ขวา + grid จาง + เส้นแสง ต่อกันทั้งหน้า (เห็นชัดใน `acc-full-desktop.png`) — ส่วนที่ยังสะดุด: แบนเนอร์โปรโมท (รูปของ admin สีต่างโทน) และหน้าอื่นนอกหน้าแรกยังเป็นดีไซน์เดิม

## 4. Policy Universe — 4 ดอก / 36 นโยบาย

| ตรวจ | ผล |
|---|---|
| คลิกเลือกทั้ง 4 ดอก (desktop) — `aria-selected`, หัวแผง, ลำแสงจากตำแหน่งดอก | ✅ ดอกที่ 1–4 ตรงกันทุกดอก (นโยบายย่อยในแผง 6/6/6/2 = แสดง 5 + "และอีก N") |
| ปุ่ม "ถัดไป" มือถือ ผ่านครบ 4 การ์ด | ✅ |
| คีย์บอร์ด: ลูกศรขวาย้ายดอก + โฟกัสตาม | ✅ |
| แกนกลางแสดงจำนวน | "36 นโยบาย" ✅ |
| Hub "แสดงทั้งหมด" เทียบชื่อกับข้อมูลจริง | 36/36 — ไม่มีรายการขาด ✅ |
| หน้า `/policies` มี anchor ครบทุกนโยบาย | 36/36 ✅ |
| ค้นหา "หนี้" / คำที่ไม่มี | "พบ 7 นโยบาย" / แสดงสถานะไม่พบ ✅ |

ภาพ: `acc-universe-tab4-desktop.png`

## 5. Newsroom + YouTube/Shorts

| ตรวจ | ผล |
|---|---|
| ข่าว 4 ข่าวบนหน้าแรก = 4 ข่าวแรกของข้อมูลจริง (ลำดับตรง) · รูปจริง · `loading="lazy"` | ✅ |
| ความสมดุล desktop: การ์ดขวา 169×3 + gap = การ์ดเด่น 554 | ✅ |
| จำกัดบรรทัด: หัวข้อ line-clamp 2 ทุกการ์ด (desktop) | ✅ |
| **ไม่มีข้อมูลคลิป** (สถานะจริง production) | แถบ "ไปที่ช่อง YouTube" → `youtube.com/@thaikaomai` ✅ |
| **มีข้อมูล** (fixture ชั่วคราว 5 รายการ) | คลิปเด่น + รายการ + Shorts ✅ · ลิงก์ `javascript:` และคลิปที่ซ่อน **ไม่แสดง** ✅ · ก่อนกด iframe = 0 (lazy) ✅ · กดแล้วฝัง `youtube-nocookie.com/embed/…` ✅ · รูปปก lazy ✅ |

ภาพ: `acc-video-with-data-desktop.png` — **พบปัญหา M3:** เมื่อมีคลิปรองแค่ 1 รายการ คอลัมน์ขวาเหลือพื้นที่ว่างมาก

## 6. กิจกรรม — Asia/Bangkok

ข้อมูลจริง: "AI For ALL ครั้งที่ 2" (`22 ส.ค. 69`), "ครั้งที่ 1" (`25 ก.ค. 2569`) — ไม่มี `startAt`

| นาฬิกา (จำลอง) | เขตเวลาผู้ชม | ครั้งที่ 2 | ครั้งที่ 1 | ถูกต้อง |
|---|---|---|---|---|
| วันนี้จริง (2 พ.ย. 2569) | Asia/Bangkok | ผ่านไปแล้ว | ผ่านไปแล้ว | ✅ |
| วันนี้จริง | America/Los_Angeles | ผ่านไปแล้ว | ผ่านไปแล้ว | ✅ |
| 22 ส.ค. 2569 10:00 (ไทย) | Asia/Bangkok | **กำลังจัดอยู่** | ผ่านไปแล้ว | ✅ |
| 21 ส.ค. 20:00 LA (= 22 ส.ค. 10:00 ไทย) | America/Los_Angeles | **กำลังจัดอยู่** | ผ่านไปแล้ว | ✅ ใช้วันที่ไทย ไม่ใช่วันที่ของผู้ชม |
| 21 ส.ค. 2569 23:30 (ไทย) | Asia/Bangkok | กำลังจะมาถึง | ผ่านไปแล้ว | ✅ ขอบเที่ยงคืน |
| 1 ก.ค. 2569 | Asia/Bangkok | กำลังจะมาถึง | กำลังจะมาถึง | ✅ เรียงตามวัน |

หน้า `/news` "กิจกรรมที่กำลังจะมาถึง" = ว่าง (ถูกต้อง — เดิมแสดงกิจกรรมที่ผ่านแล้ว) · `startAt` ของ admin มีลำดับความสำคัญเหนือข้อความวันที่เสมอ (unit test รอบ V2) · ไม่ได้แก้ข้อมูลกิจกรรม

## 7. น้องเลม่อน + ระบบค้นหา

| ตรวจ | ผล |
|---|---|
| ปุ่มลอย: GIF ขนาดจริง 27×49 (ไม่ขยาย) | ✅ |
| Section 08: 54×98 (2× จำนวนเต็ม, `pixelated`) | ✅ ไม่เกิน 2 เท่า |
| แผงผู้ช่วย: 22×40 (ย่อ) | ✅ |
| เปิดด้วยคีย์บอร์ด (Enter) → โฟกัสช่องค้นหา | ✅ |
| ค้นหา "เรียนฟรี" | นโยบาย 4 รายการ ✅ |
| Tab 25 ครั้งไม่หลุดออกจากแผง (focus trap) | ✅ |
| Esc ปิด + โฟกัสกลับปุ่มลอย | ✅ |
| โหมด "หาข่าวล่าสุด" จาก Section 08 | ข่าว 6 รายการ ✅ |

ภาพ: `acc-guide-search-desktop.png` · ไฟล์มาสคอตความละเอียดสูงยังไม่มี (รอทีม — ดู V3)

## 8. prefers-reduced-motion (จำลองจริง)

ใช้ `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value }])` (CDP) เทียบ `no-preference` กับ `reduce` — ผลดูหัวข้อ 1 · หลังเลื่อนทั้งหน้า: element ที่ยังซ่อน (opacity 0) = 0 ทั้งสองโหมด · ลูกศรเลื่อนลง (`motion-safe:animate-bounce`) = none ในโหมด reduce

> **หมายเหตุสภาพแวดล้อม:** Windows Server เครื่องนี้ปิด animation ระดับ OS — Chrome headless รายงาน `reduce` เป็นค่าเริ่มต้น จึงต้องจำลองทั้งสองค่าอย่างชัดเจน (ผลการทดสอบ animation ในรอบก่อนๆ ที่ไม่ได้ระบุค่าอาจอยู่ในโหมด reduce)

## 9. Lighthouse

สภาพแวดล้อม: production build บนเครื่องเดียวกัน, throttling แบบ simulate (มาตรฐาน Lighthouse), การเข้าชมครั้งแรก (มี popup โปรโมท) · **ข้อจำกัด:** server ในเครื่องไม่บีบอัด (ไม่มี gzip/br) — ขนาด JS/JSON บน production ที่ผ่าน Cloudflare จะเล็กกว่านี้ (JS หลัก 462 → ~140 KB) แต่ **ภาพซึ่งเป็นน้ำหนักหลักบีบอัดไม่ได้** · ไม่ได้รัน Lighthouse กับ production ตามข้อห้าม

| หน้า | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | น้ำหนักรวม |
|---|---|---|---|---|---|---|---|---|
| `/` Desktop | **58** | 94 | 100 | 100 | 6.9 s | 350 ms | 0.072 | 13.6 MB |
| `/` Mobile | **48** | 94 | 96 | 100 | 49.0 s* | 1,150 ms | 0 | 16.0 MB |
| `/policies` Mobile | **57** | 90 | 96 | 100 | 41.6 s* | 590 ms | 0.037 | 7.5 MB |

\* LCP มือถือสูงผิดปกติเพราะ simulate 4G กับภาพ 12.5 MB — ตัวเลขสัมบูรณ์เกินจริง แต่ทิศทางถูก: **ภาพใหญ่เกินไปมาก** · รายงานเต็ม: `v2-acceptance/lh-home-desktop.html`, `lh-home-mobile.html`, `lh-policies-mobile.html`

**ไฟล์ที่หนักที่สุด (mobile):** ภาพประกอบนโยบาย PNG 2.7 / 2.3 / 2.1 / 1.9 / 1.7 MB · `/api/settings` 1.33 MB **×2** (fetch + SSE payload แรก — รูป base64 ใน hero) · ภาพ popup 961 KB · แบนเนอร์ 628 KB · JS หลัก 452 KB

## 10. Bundle `/policies`

| | |
|---|---|
| Chunk | `PoliciesPage-*.js` **832 KB** (gzip 156 KB) — Lighthouse ตั้งธงทั้ง "unused JavaScript" และ "unminified JavaScript" |
| สาเหตุ | `import * as Icons from 'lucide-react'` ใน `src/pages/PoliciesPage.tsx` (+ `PoliciesSection.tsx` ที่ไม่ได้ใช้แล้ว) แล้วเลือกไอคอนจากชื่อ `policy.icon` ตอน runtime → bundler ตัดไอคอนไม่ได้เลย: **1,578 ไอคอน** อยู่ใน chunk |
| ใช้จริง | ข้อมูล production 36 นโยบาย ใช้ **36 ชื่อ** (BookOpen, GraduationCap, Apple, …, Gamepad2) |

**ข้อเสนอ (ไม่เปลี่ยนพฤติกรรม):**
1. สร้าง `src/lib/policyIcons.ts` — map ชื่อ → คอมโพเนนต์ สำหรับไอคอนที่ใช้จริง (36 ชื่อจากข้อมูล + ชุดใน `constants.ts` + ค่าเริ่มต้นของ admin `BookOpen`) import แบบระบุชื่อ
2. ชื่ออื่นที่ admin พิมพ์เอง (ไม่อยู่ใน map) → ใช้ `DynamicIcon` จาก `lucide-react/dynamic` (โหลดไอคอนเดียวตามชื่อแบบ lazy — ต้องแปลง PascalCase → kebab-case) → **admin ยังใส่ชื่อไอคอน Lucide ใดก็ได้เหมือนเดิม**
3. ลบ `PoliciesSection.tsx` (ไม่มีใครใช้แล้ว)
- **ประมาณการ:** ~0.53 KB/ไอคอน → 36 ไอคอน ≈ 20 KB → chunk จาก 832 KB เหลือ ~25–30 KB (ลด ~800 KB / ~150 KB gzip) — ควรวัดจริงหลังแก้
- ทางเลือกระยะยาว: เปลี่ยนช่อง icon ใน admin เป็นตัวเลือกจากรายการ (เปลี่ยนพฤติกรรม — ต้องอนุมัติ)

## 11. Accessibility + Keyboard

| ตรวจ | ผล |
|---|---|
| axe-core WCAG 2.0/2.1 A+AA — home desktop / home mobile / `/policies` | **0 violations** (passes 30 / 29 / 24, incomplete 1 ต่อหน้า — ต้องตรวจด้วยตา) |
| Tab 45 จุดแรกของหน้า | focus มองเห็นได้ทุกจุด (outline 2 px), ไม่มีจุดที่โฟกัสแล้วมองไม่เห็นบนจอ |
| Mega menu ด้วยคีย์บอร์ด | Enter เปิด → Tab เข้าเมนู → Esc ปิด + โฟกัสกลับปุ่ม ✅ |
| Tablist นโยบาย | ลูกศรขวาย้ายดอก + เลือก ✅ |
| เมนูมือถือ | Enter เปิด → โฟกัสลิงก์แรก, ล็อก scroll → Esc ปิด + โฟกัสกลับ ✅ |
| แผงผู้ช่วย | focus trap + Esc ✅ |
| Lighthouse พบเพิ่ม | ⚠️ ดูปัญหา A1–A4 |

---

## ตรงและไม่ตรง Blueprint

| ตรง Blueprint | ไม่ตรง / ปรับต่างไป (เหตุผล) |
|---|---|
| ครบ 9 sections ตามลำดับ (ลำดับ block ยังให้ admin จัดได้) | 3D เป็น SVG/CSS pseudo-3D ไม่ใช่ WebGL (Blueprint ระบุเป็นตัวเลือก; เบากว่า, เนื้อหาเป็น HTML) |
| สี navy/lemon/cyan, grid 1248/96 → 350/20, type scale 76/48/24 → 42/30/20 | ฟอนต์ Noto Sans Thai (Blueprint แนะนำ IBM Plex/Prompt — เปลี่ยนแล้วกระทบทุกหน้า) |
| Hero timeline 0.4/0.9/1.5/2.0 s + idle; ลูกศรแยกจากโลโก้ | ข้อความ CTA ใช้ค่าจาก admin ("ดูนโยบาย ธนู 4 ดอก") แทน "สำรวจนโยบาย" — แก้ได้ใน admin |
| Policy Universe โต้ตอบได้ + การ์ดปัดบนมือถือ + ไม่ใช่ทางเดียวที่เข้าถึง | Section 07 **ไม่มีแผนที่ SVG / ข้อมูลสาขา** (ไม่มีข้อมูลจริง — ไม่สร้างขึ้นเอง) |
| Policy Hub ค้นหาไทย/debounce/สถานะครบ, 36 รายการ | Section 08 มาสคอต GIF ความละเอียดต่ำ (รอไฟล์ต้นฉบับ) |
| Newsroom ข่าวจริง, Activities Asia/Bangkok, reduced motion, keyboard | **LCP ≤ 2.5 s / Lighthouse 90+ ไม่ผ่าน** (ภาพ/settings) |
| ไม่สร้างนโยบาย/ข่าว/กิจกรรมปลอม, ไม่แตะระบบสมาชิก, ไม่ deploy | ความสูง section เป็นค่าประมาณ — Universe/Hub สูงกว่าเป้า, Activities/Join เตี้ยกว่า (ไม่บังคับ fixed height ตามข้อกำหนด) |

---

## ปัญหาที่พบ + ระดับความสำคัญ + แนวทางแก้ (ยังไม่แก้ในรอบนี้)

### 🔴 High — ควรแก้ก่อน deploy

| # | ปัญหา | หลักฐาน | แนวทางแก้ |
|---|---|---|---|
| P1 | ภาพที่อัปโหลดใหญ่มาก: ภาพประกอบนโยบาย PNG 1.7–2.7 MB × 5, popup 961 KB → หน้าแรก 13.6–16 MB, LCP มือถือแย่มาก | Lighthouse "image delivery" ประหยัดได้ ~9.6 MB | (ก) ระยะสั้น: ทีม export ภาพเดิมใหม่เป็น WebP/JPEG ≤ 300 KB แล้วอัปโหลดแทน (ไม่ต้องแก้โค้ด) (ข) V3: ให้ server ย่อ/แปลงภาพตอนอัปโหลด (หลายขนาด) + `srcset`/`sizes` ฝั่งหน้าเว็บ |
| P2 | `settings.json` 1.33 MB (รูปผู้นำ base64 ใน hero) ถูกโหลด 2 ครั้งต่อหน้า (fetch + SSE ครั้งแรก) และ parse/เขียน localStorage ทุกครั้ง | network: 1,331 KB × 2 | (ก) ย้ายรูป base64 ไปเป็นไฟล์ใน `/uploads` (admin อัปโหลดใหม่) → settings เหลือไม่กี่ KB (ข) ให้ SSE ไม่ส่ง payload แรกถ้า client เพิ่ง fetch แล้ว หรือใช้ ETag |
| P3 | `/policies` JS 832 KB จากไอคอน 1,578 ตัว | หัวข้อ 10 | icon registry + `DynamicIcon` fallback (หัวข้อ 10) |

### 🟠 Medium

| # | ปัญหา | แนวทางแก้ |
|---|---|---|
| A1 | ปุ่ม × ของแถบคุกกี้ไม่มีชื่อสำหรับ screen reader (Lighthouse `button-name`) — โค้ดเดิม `SiteNoticeBar.tsx` | เพิ่ม `aria-label="ปิด"` |
| A2 | ลำดับหัวข้อข้ามขั้น h2 → h4 ในการ์ดกิจกรรม (`heading-order`) — `ActivitiesMap.tsx` | เปลี่ยน `h4` เป็น `h3` (หน้าตาเดิม) |
| A3 | ลิงก์ "นโยบายความเป็นส่วนตัว" ในแถบคุกกี้แยกจากข้อความด้วยสีอย่างเดียว (`link-in-text-block`) | ใส่ขีดเส้นใต้ถาวร |
| A4 | `<img>` ไม่มี width/height (โลโก้, แบนเนอร์, popup) → CLS desktop 0.072 | ใส่ขนาดจริง (โลโก้ 3419×3419 → ใช้ไฟล์เล็ก 96×96/192×192) |
| M1 | TBT 350 ms (desktop) / 1,150 ms (mobile) — JS หลัก 462 KB + parse settings 1.3 MB | แก้ P2 ก่อน แล้ววัดใหม่; แยก chunk `motion`/คอมโพเนนต์ใต้ fold แบบ lazy |
| M2 | ไฟล์ static ที่มี hash ส่ง `Cache-Control: max-age=0`; เอกสาร/API `no-store` → ไม่เข้า bfcache | ตั้ง `immutable, max-age=31536000` ให้ `/assets/*` (ตรวจกฎ Cloudflare ด้วย) |
| M3 | ส่วนคลิป: มีคลิปรองแค่ 1 รายการ คอลัมน์ขวาเหลือพื้นที่ว่างมาก | ≤ 1 คลิปรอง → เปลี่ยนเป็นเลย์เอาต์คอลัมน์เดียว หรือเติมการ์ด "ไปที่ช่อง YouTube" |
| M4 | แบนเนอร์ 16:9 บนมือถือ ตัวอักษรในภาพเล็กมาก (390 px) | เพิ่มช่อง "แบนเนอร์สำหรับมือถือ" (เช่น 4:5) ใน admin ใช้ `<picture>` |
| M5 | แท็บ admin ใหม่ (คลิปวิดีโอ, hero cinematic, โหมดสำรวม) ยังไม่ได้ทดสอบผ่านหน้าจอ (ไม่มีรหัส admin ในเครื่อง) | ทดสอบบน staging ด้วยบัญชีทดสอบ |

### 🟡 Low

| # | ปัญหา | แนวทางแก้ |
|---|---|---|
| L1 | h1 ซ่อนในโหมด imageOnly อ่านเป็น "ก้าวใหม่ ให้ไทย สตรอง" (มีเว้นวรรค) ต่างจากโหมดอื่น | ต่อข้อความแบบไม่เว้นวรรค |
| L2 | Policy Hub สูงกว่าเป้า Blueprint (1,108 / 1,359 px) | แสดง 3 ใบบนเดสก์ท็อปด้วย หรือแถวเลื่อนแนวนอน |
| L3 | หน้าอื่น (/policies, /news ฯลฯ) ยังเป็นดีไซน์เดิม สีพื้น `#1b1d33` ต่างจาก Navbar/Footer ใหม่ | รีดีไซน์หน้าอื่นใน V3 |
| L4 | ไฟล์ legacy ไม่ได้ใช้: `Hero.tsx`, `PoliciesSection.tsx`, `NewsSection.tsx`, `CTASection.tsx` | ลบหลังอนุมัติ V2 |
| L5 | หลักฐานตรวจรับใน `docs/v2-acceptance/` 17 MB | ตัดสินใจว่าจะ commit หรือเก็บนอก repo |
| L6 | Lighthouse 13 หมวด "Agentic Browsing" 48–50 (หมวดใหม่ ไม่อยู่ใน Blueprint) | พิจารณาภายหลัง |

---

## งานค้างสำหรับ V3 (เรียงตามลำดับที่แนะนำ)

1. **Performance (P1–P3, M1, M2)** — ระบบภาพ (ย่อ/WebP/srcset), เอารูป base64 ออกจาก settings, icon registry `/policies`, cache headers — แล้วรัน Lighthouse ซ้ำ (เป้า LCP ≤ 2.5 s)
2. **Accessibility A1–A4** — แก้เล็ก ใช้เวลาไม่มาก
3. **Assets จากทีม:** น้องเลม่อนต้นฉบับ (PNG/WebP โปร่งใส ≥ 800 px + ไอคอน 256 px; ไม่บังคับ: ท่าทาง/Lottie), แผนที่ SVG รายจังหวัด (สัญญาอนุญาตใช้ได้), ข้อมูลสาขา, รายการคลิป YouTube ที่อนุมัติ, แบนเนอร์มือถือ
4. **Section 07** — แผนที่ SVG + collection สาขา + ฟิลด์จังหวัด/`endAt` ในกิจกรรม (admin)
5. **UX:** ส่วนคลิปเมื่อมีน้อย (M3), แบนเนอร์มือถือ (M4), ความสูง Hub (L2)
6. **ทดสอบ admin บน staging** (M5) + อุปกรณ์จริง iOS/Android + Safari/Firefox
7. **รีดีไซน์หน้าอื่นให้เข้าชุด** (L3) + ลบไฟล์ legacy (L4)
8. ตัดสินใจเรื่องที่ค้างจากรอบก่อน: ข้อความ CTA ตาม Blueprint vs admin, ฟอนต์, ความคล้ายลูกศรกับโลโก้ (ฝ่ายแบรนด์)

---

## ผล Type-check / Build / Tests (รันใหม่รอบนี้)

| คำสั่ง | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ ไม่มี error |
| `npm run build` | ✅ 8.10 s — JS หลัก 462 KB (gzip 140 KB), `/policies` 832 KB (gzip 156 KB, เตือนเกิน 500 KB) |
| `npm run test:verify` | ✅ 65 passed, 0 failed |
| Console errors (ทุกหน้าที่ทดสอบ) | ไม่มี |
| `git status` | ไม่มีการแก้ source รอบนี้ — มีแค่ไฟล์เอกสารใหม่ใน `docs/` |

**Production Status: NOT DEPLOYED**
