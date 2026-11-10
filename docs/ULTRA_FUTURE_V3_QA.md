# Ultra Future V3 — QA

- **สภาพแวดล้อม:** production build ในเครื่อง (`npm run build` → `server/index.ts` พอร์ต 3100) + dev server 3001 · ข้อมูล = snapshot เนื้อหาสาธารณะ production · Chrome headless ผ่าน `puppeteer-core` 25.16, Lighthouse 13.6, axe-core 4.14 (ติดตั้งใน scratchpad)
- ข้อมูลทดสอบชั่วคราว (คลิป/กิจกรรม/layout hero/บัญชี admin ทดสอบ) **คืนค่าทั้งหมดแล้ว** — ตรวจซ้ำ: ข่าว 14, กิจกรรม 2, นโยบาย 36, ทีม 6, หมวด 5, block 5, โพล 0, คลิป 0, settings = snapshot ทุกไบต์
- **Production Status: NOT DEPLOYED**

## สรุป

| รายการ | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ ไม่มี error |
| `npm run build` | ✅ JS หลัก 477 KB (gzip 144 KB; V2 462/140) · `/policies` 832 KB (เดิม — ยังไม่แก้ ดูปัญหาค้าง) |
| `npm run test:verify` (เทสต์เดิม) | ✅ 65 passed, 0 failed |
| Unit checks ใหม่ (สคริปต์ชั่วคราว ลบแล้ว) | ✅ 6 ภาค = 77 จังหวัด ไม่ซ้ำ, `regionOf`, `provincesInText` + กฎขอบคำ |
| Console errors (หน้าแรก/ทุกโหมด/ทุกความกว้าง) | ✅ ไม่มี (ยกเว้น 404 รูปปกของ ID คลิปปลอมใน fixture — คาดไว้) |
| axe-core WCAG 2.0/2.1 A+AA — หน้าแรก D/M, `/policies` | ✅ 0 violations (V2 0 → พบ 1 ใหม่ระหว่างพัฒนา แก้แล้ว) |
| Lighthouse Accessibility | ✅ **100 / 100 / 100** (V2 94 / 94 / 90) |
| Scroll แนวนอน 8 ความกว้าง × 2 โหมด hero | ✅ ไม่มี |

## Hero

| ตรวจ | ผล |
|---|---|
| 4 โหมดแสดงถูก (1440/390): imageOnly (ค่าจริง), cinematic, split, full | ✅ |
| **Admin สลับโหมดผ่านหน้าจอจริง** (super_admin ทดสอบ): Cinematic → 2 คอลัมน์ → ข้อความซ้อนทับ → ไม่มีข้อความ — บันทึกแล้ว `settings.hero.layout` เปลี่ยน และหน้าแรกแสดงโหมดนั้น | ✅ 8/8 |
| `prefers-reduced-motion` **จำลองจริง** — `no-preference`: CTA opacity 1 ที่ 250ms, ฉากลูกศรยังไม่ขึ้น (เริ่ม 0.4s), ที่ 3s วนซ้ำ 7 ตัว (comet, glow, orbit, float, pulse, particle, bounce) | ✅ |
| — `reduce`: CTA 1, ฉากครบทันที, วนซ้ำ 0, ลูกศรเลื่อนลง bounce = none | ✅ |
| ความสูง cinematic: 1440 = 848 · 1024 = 820 · 768 = 754 · 430 = 614 · **390 = 610** · 360/320 = 672 (ปุ่มขึ้นสองแถว) | ✅ เป้า 500–650 ที่ 390/430 |
| imageOnly: แบนเนอร์ไม่ครอป (1440: กรอบ 1440×716 contain · 390: 390×219) | ✅ |

## Lemon Guide

| ตรวจ | ผล |
|---|---|
| มาสคอต: ปุ่มลอย 27×49 (ขนาดจริง) · Section 54×98 (2× pixelated) · แผง 22×40 | ✅ ไม่ขยายเกิน 2× |
| เปิดผู้ช่วยด้วย Enter → โฟกัสช่องค้นหา · ค้น "เรียนฟรี" = นโยบาย 4 · focus trap 25 Tab ไม่หลุด · Esc ปิด + โฟกัสกลับ · ปุ่ม "ข่าวล่าสุด" → ข่าว 6 | ✅ |
| จำนวนเนื้อหาในคอนโซล = ข้อมูลจริง (36 / 14 / 2 / 0) | ✅ |

## YouTube / Shorts

| ตรวจ | ผล |
|---|---|
| ไม่มีคลิป (สถานะจริง): แผงช่องทางการ + ลิงก์ `youtube.com/@thaikaomai`, ไม่มีส่วนคลิปว่าง | ✅ |
| มีคลิป (fixture 5 รายการ): คลิปเด่น + แถวคลิปทั้งหมด + แถว Shorts · iframe ก่อนกด = 0 · กดแล้ว `youtube-nocookie.com/embed/…` · รูปปก lazy | ✅ |
| **Admin ผ่าน UI จริง** (บัญชีทดสอบในเครื่อง สิทธิ์เริ่มต้น): ลิงก์ไม่ใช่ YouTube ถูกปฏิเสธ · เพิ่ม Shorts ได้ + รูปปก + ป้าย · ขึ้นใน API สาธารณะ · แก้ชื่อได้ · ซ่อน → API ไม่เห็น · เผยแพร่กลับ · ลบได้ | ✅ 9/9 |
| สิทธิ์: บัญชี `tabs=events` ไม่เห็นแท็บคลิป + API POST = 403 · ไม่ login = 401 | ✅ 3/3 |

หมายเหตุ: รายการในหน้า admin อัปเดตด้วย polling ทุก 8 วินาที (พฤติกรรมเดิมทุกแท็บ) — บัญชีทดสอบอยู่ใน `.env.local` ชั่วคราว ลบแล้ว (ไฟล์คืนค่าตรงกับก่อนทดสอบ, ไม่มีรหัสผ่านในเอกสาร/แชท)

## กิจกรรม (Asia/Bangkok)

| นาฬิกา / เขตเวลาผู้ชม | AI For ALL #2 (`22 ส.ค. 69`) | #1 (`25 ก.ค. 2569`) |
|---|---|---|
| วันนี้ · Bangkok / Los Angeles | ผ่านไปแล้ว / ผ่านไปแล้ว | ผ่านไปแล้ว / ผ่านไปแล้ว |
| 22 ส.ค. 10:00 ไทย · Bangkok / LA (21 ส.ค. 20:00) | **กำลังจัดอยู่** / **กำลังจัดอยู่** | ผ่านไปแล้ว |
| 21 ส.ค. 23:30 ไทย | กำลังจะมาถึง | ผ่านไปแล้ว |
| 1 ก.ค. 2569 | กำลังจะมาถึง | กำลังจะมาถึง |

แผนผังภูมิภาค (fixture กทม. + ขอนแก่น): จุดนีออนเฉพาะกลาง/อีสาน ✅ · "ธันวาคม 2569" = กำลังจะมาถึง ✅ · ข้อมูลจริงไม่มีจังหวัด → ไม่มีจุด + ข้อความแจ้ง ✅ · `/news` "ที่จะถึง" ว่าง (ถูกต้อง) ✅

## Policy / Newsroom / Keyboard (regression)

- Policy Universe 4 ดอก (แผง 6/6/6/2), แกน "36 นโยบาย", Hub 36/36 ไม่ขาด, ค้น "หนี้" = 7, `/policies` anchor 36/36, มือถือ 4 การ์ด ✅
- Newsroom = 4 ข่าวแรกของข้อมูลจริง, การ์ดขวา 169×3 สมดุลกับการ์ดเด่น 554, line-clamp 2 ✅
- Keyboard: Tab 45 จุดเห็น focus ทุกจุด · mega menu Enter/Tab/Esc · tablist ลูกศร · เมนูมือถือ Enter/Esc + ล็อก scroll ✅

## Responsive (หน้าแรกเต็มหน้า)

| กว้าง | imageOnly (สูงหน้า / hero) | cinematic (สูงหน้า / hero) | scroll แนวนอน |
|---|---|---|---|
| 320 | 8,364 / 248 | 8,788 / 672 | ไม่มี |
| 360 | 8,062 / 271 | 8,463 / 672 | ไม่มี |
| 390 | 7,905 / 287 | 8,227 / 610 | ไม่มี |
| 430 | 7,883 / 310 | 8,188 / 614 | ไม่มี |
| 768 | 7,963 / 500 | 8,217 / 754 | ไม่มี |
| 1024 | 7,058 / 656 | 7,222 / 820 | ไม่มี |
| 1440 | 7,390 / 796 | 7,442 / 848 | ไม่มี |
| 1920 | 7,390 / 796 | 7,442 / 848 | ไม่มี |

หน้าแรกยาวขึ้นจาก V2 (1440: 7,031 → 7,390 · 390: 7,785 → 7,905) จากส่วนกิจกรรม (แผนผัง + กลุ่มสถานะ) และคอนโซลผู้ช่วย — ตั้งใจเพิ่มเนื้อหา/ฟังก์ชัน ไม่ใช่พื้นที่ว่าง

## Performance — เทียบ V2 (Lighthouse, รันครั้งเดียวต่อหน้า, server ในเครื่องไม่บีบอัด)

| หน้า | Perf V2 → V3 | A11y | BP | SEO | LCP | TBT | **CLS** | SI |
|---|---|---|---|---|---|---|---|---|
| `/` Desktop | 58 → **61** | 94 → **100** | 100 | 100 | 6.9 → 8.0 s | 350 → 310 ms | 0.072 → **0.001** | 1.4 → 1.4 s |
| `/` Mobile | 48 → **51** | 94 → **100** | 96 | 100 | 49.0 → 49.1 s | 1,150 → 950 ms | 0 → 0 | 4.2 → **3.1 s** |
| `/policies` Mobile | 57 → 57 | 90 → **100** | 96 | 100 | 41.6 → 38.6 s | 590 → 570 ms | 0.037 → 0.037 | 3.7 → 3.6 s |

- **ระหว่างพัฒนา V3 พบ CLS 0.595 (desktop)** จากแบนเนอร์ไม่มีขนาด — แก้แล้ว ผลสุดท้ายดีกว่า V2
- LCP ยังสูงมาก — สาเหตุเดิมจาก V2 (ภาพอัปโหลด PNG 1.7–2.7 MB × 5, settings 1.3 MB × 2) **ไม่ได้อยู่ในขอบเขต V3** ค่าต่างระหว่างรอบอยู่ในช่วงแกว่งของการวัดครั้งเดียว
- Core Web Vitals ภาคสนาม (CrUX/RUM) วัดไม่ได้ใน localhost — ตัวเลขข้างบนเป็น lab data

## Before / After (`docs/v3-compare/`)

| จุด | 1440 | 390 |
|---|---|---|
| Hero cinematic | `v2-hero-cinematic-1440.png` → `v3-hero-cinematic-1440.png` | `v2-hero-cinematic-390.png` → `v3-hero-cinematic-390.png` |
| Hero imageOnly (ค่าจริง) | `v2-hero-imageOnly-1440.png` → `v3-hero-imageOnly-1440.png` | `v2-hero-imageOnly-390.png` → `v3-hero-imageOnly-390.png` |
| Lemon Guide | `v2-guide-1440.png` → `v3-guide-1440.png` | `v2-guide-390.png` → `v3-guide-390.png` |
| คลิป (มีข้อมูล — fixture) | `v2-video-data-1440.png` → `v3-video-data-1440.png` | `v2-video-data-390.png` → `v3-video-data-390.png` |
| คลิป (ไม่มีข้อมูล — จริง) | `v2-video-empty-1440.png` → `v3-video-empty-1440.png` | `v2-video-empty-390.png` → `v3-video-empty-390.png` |
| กิจกรรม | `v2-activities-1440.png` → `v3-activities-1440.png` | `v2-activities-390.png` → `v3-activities-390.png` |
| ทั้งหน้า | `v2-full-1440.png` → `v3-full-1440.png` | `v2-full-390.png` → `v3-full-390.png` |
| Admin แท็บคลิป | `v3-admin-videos-tab.png` | — |

รายงาน Lighthouse: `lh-v3-home-desktop.html`, `lh-v3-home-mobile.html`, `lh-v3-policies-mobile.html` (V2 อยู่ใน `docs/v2-acceptance/`) · ผลดิบ: `qa-*.json`

## ไม่ได้ทดสอบ / ข้อจำกัด

- อุปกรณ์จริง (iOS/Android), Safari, Firefox — ทดสอบ Chrome headless เท่านั้น
- Screen reader จริง (NVDA/VoiceOver) — ใช้ axe-core + Lighthouse
- YouTube จริง (ยังไม่มีคลิปที่อนุมัติ) — ใช้ ID ทดสอบซึ่งไม่มีรูปปกจริง
- Lighthouse รันครั้งเดียวต่อหน้า (ค่าแกว่งได้ ±5 คะแนน)

## ปัญหาที่ยังค้าง

| # | ระดับ | ปัญหา | แนวทาง |
|---|---|---|---|
| 1 | 🔴 High | ภาพอัปโหลดใหญ่ (12.5 MB/หน้ามือถือ) → LCP มือถือ ~49s (lab) | ทีม export ภาพใหม่ WebP ≤ 300 KB · ระบบย่อภาพตอนอัปโหลด + srcset |
| 2 | 🔴 High | settings 1.3 MB (รูป base64) โหลด 2 ครั้ง | ย้ายรูปเป็นไฟล์ `/uploads`, ไม่ส่ง payload แรกซ้ำ |
| 3 | 🔴 High | `/policies` JS 832 KB (ไอคอน 1,578) | icon registry + `DynamicIcon` (ข้อเสนอใน `V2_FINAL_ACCEPTANCE.md`) |
| 4 | 🟠 Medium | ไม่มีไฟล์มาสคอตต้นฉบับ / แผนที่ SVG / ข้อมูลสาขา / คลิปที่อนุมัติ | รอ asset จากทีม (รายการใน CHANGELOG) |
| 5 | 🟠 Medium | กิจกรรมไม่มีฟิลด์จังหวัด (อ่านจากข้อความสถานที่) — ข้อมูลจริงตอนนี้จับจังหวัดไม่ได้ | เพิ่มช่องจังหวัดในหน้า admin กิจกรรม |
| 6 | 🟡 Low | รายการใน admin อัปเดตช้าสูงสุด 8 วิ (polling เดิม) | ใช้ SSE/refresh หลังบันทึก |
| 7 | 🟡 Low | `unsized-images` ยังเหลือ (แบนเนอร์/popup ไม่มี width/height attr — ภาพจาก admin ไม่รู้ขนาด) | เก็บขนาดภาพตอนอัปโหลด |
| 8 | 🟡 Low | `docs/v2-acceptance` + `docs/v3-compare` รวม ~43 MB | ตัดสินใจก่อน commit ว่าจะเก็บใน repo หรือไม่ |
