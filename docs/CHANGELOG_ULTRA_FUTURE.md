# Changelog — Ultra Future 2035 (branch `feature/ultra-future-homepage`)

**Production deployment status: NOT DEPLOYED** — ทุกอย่างอยู่ในเครื่อง local เท่านั้น

## ไฟล์ที่แก้

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/index.css` | token สี `uf-*`, คลาส layout/type/การ์ด/ปุ่ม/focus, keyframes ของ hero, ซ่อนปุ่ม × ของ search input |
| `src/pages/HomePage.tsx` | map block เดิม → section ใหม่, ดึงข้อมูลครั้งเดียวที่หน้า แล้วส่ง props, เลื่อนไป `#hash` |
| `src/components/Navbar.tsx` | ออกแบบใหม่: กระจกตอนเลื่อน, mega menu นโยบาย, ปุ่มค้นหา, เมนูมือถือเกือบเต็มจอ (Esc/focus/ล็อก scroll), เพิ่มเมนู "กิจกรรม" |
| `src/components/Footer.tsx` | ออกแบบใหม่: เมนู 3 คอลัมน์, ซ่อน social ที่ยังไม่มีลิงก์ (`#`), คงฟอร์มรับข่าวสาร/ติดต่อ/QR เดิม |
| `src/App.tsx` | mount `LemonGuide` (ทุกหน้า ยกเว้น `/admin`) |
| `src/pages/PoliciesPage.tsx` | ใส่ `id` ให้การ์ดทุกนโยบาย + เลื่อนตาม `#hash`, ใช้ `groupPolicies` ร่วม |
| `src/pages/AdminPage.tsx` | แท็บ **คลิปวิดีโอ** (เพิ่ม/แก้/ลบ/เรียง/ซ่อน, ตรวจลิงก์ YouTube, แสดงรูปปก) |
| `src/services/dataService.ts` | `subscribeToVideos`/`add`/`update`/`deleteVideo`, `fetchCollectionOnce`, `onError` (ไม่บังคับ) ใน subscribe |
| `src/types.ts` | `VideoItem` |
| `server/api.ts` | `COLLECTION_TAB.videos = 'news'` |
| `index.html` | `theme-color` → `#071326` |

### รอบแก้ไขที่ 2

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/pages/AdminPage.tsx` | คลิปใหม่ได้ `order` น้อยสุด − 1 (ขึ้นลำดับแรก) |
| `src/components/uf/VideoChannel.tsx` | คอมเมนต์อธิบายลำดับการเรียง |
| `src/components/SiteNoticeBar.tsx` | ตั้ง/ลบ `data-notice="open"` ที่ `<html>` ตามการแสดงแถบคุกกี้ |
| `src/index.css` + `uf/LemonGuide.tsx` | คลาส `.uf-guide-fab` ซ่อนปุ่มลอยขณะแถบคุกกี้เปิด |
| `src/components/uf/PolicyUniverse.tsx` | ปุ่มก่อนหน้า/ถัดไปบนมือถือจัดกลาง |
| `src/components/Navbar.tsx` | "นโยบาย" เป็นลิงก์ + ปุ่มลูกศรเปิดเมนูย่อยแยก |
| `src/pages/HomePage.tsx` | โพลอยู่ก่อน block `cta` แรก |

### รอบแก้ไขที่ 3 — Hero รองรับ layout ของ admin + แก้การโหลด settings ซ้ำ

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/components/uf/UfHero.tsx` | เคารพ `hero.layout`: **imageOnly** = แบนเนอร์เต็มความกว้างไม่ครอป ไม่มีอะไรวาดทับ + h1 ซ่อนสำหรับ screen reader/SEO; **full** = แบนเนอร์เป็นพื้นหลัง + ข้อความ/ปุ่มทับ; **split** = ดีไซน์เดิม. สไลด์ทุกโหมด (จุดเลือกภาพ, เลื่อนอัตโนมัติ 6 วิ นับใหม่เมื่อกดเอง, หยุดเมื่อพ้นจอ/ลด motion), crossfade รูปผู้นำ, preload ภาพถัดไป, รองรับลิงก์ต่อภาพ |
| `src/services/dataService.ts` | `subscribeToSiteSettings` ใช้ SSE 1 สาย + fetch 1 ครั้งร่วมกันทุก subscriber (เดิมเปิดคนละสาย) — ปิดเมื่อ subscriber ตัวสุดท้ายออก |

**ทำไมต้องแก้ dataService:** หน้าแรกมีคอมโพเนนต์ subscribe settings ~5 ตัว แต่ละตัวเปิด SSE + fetch ของตัวเอง → settings production (1.36 MB เพราะมีรูป base64) ถูกโหลด ~10 รอบต่อการเปิดหน้า (~13 MB) และบน HTTP/1.1 (dev) SSE ค้าง 5 สายกินโควตา 6 connection ต่อโดเมน จนรูป/fetch อื่นค้าง (แท็บค้างระหว่างทดสอบ) — หลังแก้ เหลือ 1 ครั้ง (dev เห็น 2 เพราะ React StrictMode mount ซ้ำ)

### รอบแก้ไขที่ 4 — โหมดสำรวม (ช่วงไว้ทุกข์ / ประกาศสำคัญ)

เปิด/ปิดได้เองที่ **admin → ตั้งค่าเว็บ → ⑦ การแสดงผล / ธีม → โหมดสำรวม** (กด "บันทึกทั้งหมด" แล้วมีผลทันที ไม่ต้อง deploy)

| เมื่อเปิด | รายละเอียด |
|---|---|
| สีเน้นเป็นโทนเทา-ขาว | lemon/cyan ของ Ultra Future + นีออนของหน้าอื่น (`--color-brand-neon`) + คำเน้นในหัวข้อ |
| ปิดแสงเรือง | เงานีออนของปุ่ม/การ์ด/ดอกนโยบาย, text-shadow; จุดแสงพื้นหลังจางลง |
| ปิดภาพเคลื่อนไหว | CSS animation ทั้งเว็บจบที่สถานะสุดท้ายทันที, `motion` ในหน้าแรกเป็น reduced motion, สไลด์ Hero ไม่เลื่อนเอง (ยังกดเลือกได้) |
| (ตัวเลือกย่อย) ขาวดำทั้งเว็บ | `filter: grayscale(1)` ที่ `<html>` — **รวมโลโก้และรูปทั้งหมด** ปิดอยู่เป็นค่าเริ่มต้น; ปิดโหมดสำรวมแล้วขาวดำปิดตามเสมอ |

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/types.ts` | `ThemeSettings.solemn`, `ThemeSettings.grayscale` (+ ค่าเริ่มต้น `false`) |
| `src/lib/theme.ts` | normalize ค่าใหม่, CSS variables ของสีเน้นตามโหมด, `applyTheme()` ใช้ร่วมกัน (ใส่ `data-solemn`/`data-grayscale` ที่ `<html>`) |
| `src/components/ThemeApplier.tsx`, `src/pages/AdminPage.tsx` | ใช้ `applyTheme()`; admin มีสวิตช์ 2 ตัว + พรีวิวสด |
| `src/index.css` | กฎ `:root[data-solemn="1"]` / `:root[data-grayscale="1"]` |
| `uf/EnergyArrow.tsx` | สีลูกศร/วงโคจรอ่านจาก CSS variable แทนค่าตายตัว |
| `uf/UfHero.tsx`, `pages/HomePage.tsx` | หยุดสไลด์อัตโนมัติ / `MotionConfig reducedMotion="always"` เมื่อโหมดสำรวม |

ข้อมูลเดิมไม่ต้อง migrate — settings ที่ไม่มีฟิลด์ใหม่ถือว่า "ปิด"

### V2 — Visual Refinement & UX Correction (ยังไม่ commit ตามบรีฟ)

| Section | ปรับอะไร | ไฟล์ |
|---|---|---|
| Hero | เพิ่ม layout **cinematic** ใน admin (ข้อความ + CTA + ลูกศรพลังงาน SVG แยกจากโลโก้); **split** กลับเป็น "ข้อความ + รูป" (การ์ดรูปใหญ่, ลูกศรเป็นฉากหลังจาง); มือถือไม่บังคับ min-height — cinematic ลูกศรอยู่หลังข้อความ, split รูปเป็นการ์ดแนวนอน (ไม่ตัดเนื้อหา); ปิด animation (OS/โหมดสำรวม) → ข้อความ/CTA/ลูกศรแสดงทันทีแบบนิ่ง; imageOnly/full ไม่เปลี่ยน | `uf/UfHero.tsx`, `types.ts`, `AdminPage.tsx` |
| Spacing | `.uf-section` padding ลด ~30% (clamp 44–84px), หัว section, ทางลัด, Join, promo, ทีม, โพล; Hub ต่อจาก Universe ลดระยะบน; Hub มือถือแสดง 3 ใบแรก | `index.css`, `uf/shared.tsx`, `uf/QuickDiscovery.tsx`, `uf/JoinFuture.tsx`, `uf/PolicyHub.tsx`, `uf/VideoChannel.tsx`, `PromoBannerBlock.tsx`, `TeamSection.tsx`, `PollWidget.tsx` |
| Continuity | ฉากหลังต่อเนื่องทั้งหน้า: gradient โซนสลับซ้าย-ขวา, grid จางที่ขอบ, เส้นแสงแนวตั้ง + comet (เดสก์ท็อป ≥1280), เส้นแสงทแยง 3 จุด — CSS ล้วน หลังเนื้อหา (-z-10) ไม่มีแสงทับข้อความยาว; promo block ใช้ container/การ์ดของ design system | `uf/JourneyBackdrop.tsx` (ใหม่), `HomePage.tsx`, `index.css`, `PromoBannerBlock.tsx` |
| Policy Universe | วงโคจรจัตุรัสจริง สูง ≤ `min(600px, 100svh−220px)` เห็นครบ 4 ดอก; ดอกอยู่แนวทแยง; ดอกที่เลือก = lemon + วงแหวน + ลำแสงไปแกนกลาง; เส้นเชื่อมแกนกลาง → จุดบนแผงรายละเอียด (ไม่ตัดผ่านดอกอื่น); แผงมีแถบ lemon; crossfade เนื้อหา+รูป — เนื้อหานโยบาย 36 รายการไม่เปลี่ยน | `uf/PolicyUniverse.tsx` |
| Newsroom | การ์ดขวาสูงเท่ากันและรวมเท่าการ์ดเด่น; หัวข้อ ≤2 บรรทัด (มือถือ ≤3), สรุป ≤2 บรรทัด; **แก้บัก** `xl:block` ทับ `line-clamp` จน clamp ไม่ทำงาน | `uf/Newsroom.tsx` |
| Activities | **แก้บัก** กิจกรรมไม่มี `startAt` แต่ข้อความวันที่ผ่านไปแล้ว ("22 ส.ค. 69", "25 ก.ค. 2569") แสดงเป็น "รอกำหนดการ"/"ที่จะถึง" — อ่านวันจากข้อความเมื่อมีปีชัดเจน (startAt ของ admin มาก่อนเสมอ, ไม่มีปี = ไม่เดา) ใช้ร่วมกับหน้า /news ด้วย | `utils/bangkokTime.ts`, `utils/events.ts`, `uf/ActivitiesMap.tsx` |
| Lemon Guide | `MascotImage`: รองรับไฟล์ความละเอียดสูงผ่าน `MASCOT_HIRES_SRC` (ค่าเดียว); ระหว่างนี้ GIF 27×49 ไม่ขยายเกิน 2 เท่าแบบจำนวนเต็ม (54×98) — เดิมขยาย ~3.3 เท่า; ฟังก์ชันค้นหาเดิมไม่เปลี่ยน | `uf/LemonGuide.tsx`, `uf/GuideSection.tsx` |
| Footer | แท็บเล็ต 2 คอลัมน์ก่อน 12 คอลัมน์ + อีเมลตัดบรรทัดได้ — **แก้ scroll แนวนอนที่ 768px** (อีเมลจริงยาวล้นคอลัมน์) | `Footer.tsx` |
| CSS | `.uf-scroll-x` ย้ายเข้า `@layer components` — CSS นอก layer ชนะ utility ของ Tailwind v4 ทำให้ `lg:grid` ไม่มีผล | `index.css` |

Dependencies เพิ่ม: **ไม่มี**

## ไฟล์ใหม่

`src/components/uf/` — `shared.tsx`, `EnergyArrow.tsx`, `UfHero.tsx`, `QuickDiscovery.tsx`, `PolicyUniverse.tsx`, `PolicyHub.tsx`, `Newsroom.tsx`, `VideoChannel.tsx`, `ActivitiesMap.tsx`, `LemonGuide.tsx`, `GuideSection.tsx`, `JoinFuture.tsx`
`src/utils/` — `policies.ts`, `bangkokTime.ts`, `provinces.ts`
`docs/` — เอกสาร 7 ไฟล์นี้

## Dependencies ที่เพิ่ม

**ไม่มี** (ไม่เพิ่ม three.js / GSAP / Lottie — ใช้ CSS + `motion` ที่มีอยู่)

## การตั้งค่าในเครื่อง (ไม่อยู่ใน git)

- `.env.local` — `SMTP_USER=` / `SMTP_PASS=` ว่าง เพื่อไม่ให้ฟอร์มทดสอบส่งอีเมลจริง (ลบไฟล์เพื่อเปิดกลับ; deploy ด้วย `git archive` จึงไม่ติดไป)
- Backup ก่อนเริ่ม: `data/`, `public/uploads/`, `.env` ใน scratchpad ของเซสชัน (`backup-pre-ultra/`)
- **2026-11-02: snapshot เนื้อหาสาธารณะจาก production** (ผู้ใช้อนุมัติ) — `GET` แบบไม่ login ครั้งเดียวจาก `www.thaikaomai.or.th/api/data/{news,events,policies,team,categories,homeblocks,polls,videos}` + `/api/settings` และรูปที่ข้อมูลอ้างถึง 33 ไฟล์ (33 MB) ลง `public/uploads/`
  - ไม่ได้ดึง contact/newsletter/volunteer/users/pushTokens; ตัด `createdBy`/`updatedBy` (อีเมล admin) ออกก่อนบันทึก
  - ได้: ข่าว 14, กิจกรรม 2, นโยบาย 36, ทีม 6, หมวด 5, block หน้าแรก 5, โพล 0, คลิป 0
  - backup ข้อมูล local ชุดก่อนหน้า: scratchpad `backup-pre-prod-snapshot/`
  - `data/settings.json` ต้องเป็น JSON บรรทัดเดียว (server ส่งดิบผ่าน SSE)
- **พบจาก snapshot:** Hero บน production ตั้ง `layout: imageOnly` (แบนเนอร์ `/uploads/1787555602747-5d627304.jpg`) และซ่อนคำอธิบาย/ชื่อผู้นำ — ดีไซน์ใหม่ไม่แสดงแบนเนอร์นี้ (ดูข้อ 6 ด้านล่าง)

## เรื่องที่ตัดสินใจเองและควรยืนยัน

1. **ข้อความ CTA ใน Hero** ใช้ค่าจาก admin ("ดูนโยบาย ธนู 4 ดอก" / "วิสัยทัศน์พรรค") ไม่ใช่ "สำรวจนโยบาย" / "รู้จักไทยก้าวใหม่" ตามบรีฟ — แก้ได้ทันทีในหน้า admin
2. **Section 09** หัวข้อ "อนาคตไม่ได้รอใคร" ตามบรีฟ (ฝังในโค้ด), หัวข้อรองมาจาก `settings.cta` ("ร่วมก้าวใหม่ ไปกับเรา" — บรีฟเขียน "ร่วมก้าวใหม่ไปด้วยกัน")
3. **ฟอนต์** คง Noto Sans Thai (บรีฟแนะนำ IBM Plex Sans Thai/Prompt — เปลี่ยนแล้วกระทบทุกหน้า)
4. **3D** ใช้ SVG/CSS pseudo-3D แทน WebGL — เบากว่า, เนื้อหาเป็น HTML ทั้งหมด
5. ลูกศรพลังงานใน Hero เป็นทรง ↗ คล้ายสัญลักษณ์ในโลโก้ (ตามบรีฟ) แต่เป็นวัตถุแยก ไม่ได้ใช้/แก้ไฟล์โลโก้ — ฝ่ายแบรนด์ควรดูว่าคล้ายเกินไปหรือไม่
6. ~~Hero ไม่รองรับ layout `full`/`imageOnly`~~ — **แก้แล้วในรอบที่ 3** (production ใช้ `imageOnly` กับแบนเนอร์ถวายอาลัย — แสดงครบ ไม่ครอป ไม่มีเอฟเฟกต์ทับ). ข้อสังเกต: โหมด `imageOnly` ไม่มีปุ่ม CTA ใน hero (ตามที่ admin เลือก — การ์ดทางลัดอยู่ถัดลงมา) และ `HeroSlide` ยังไม่มีฟิลด์คำอธิบายภาพ (alt) — ใช้ข้อความกลางๆ ไปก่อน
9. ~~ช่วงไว้ทุกข์: ต้องมีโหมดสำรวม~~ — **ทำแล้วในรอบที่ 4** (ยังปิดอยู่ทั้งในเครื่องและ production — ทีมพรรคเป็นคนตัดสินใจเปิด)
7. หน้าอื่นยังใช้สีพื้นเดิม (`#1b1d33`) กับ Navbar/Footer ใหม่ — ยังไม่ได้รีดีไซน์หน้าอื่น
8. ส่วนทีมพรรคและโพลยังเป็นดีไซน์เดิม (ไม่อยู่ในบรีฟ 9 section)

## ข้อจำกัดที่รู้อยู่

- ความสูง hero มือถือ ~900px (บรีฟ ~710px) — เนื้อหาไม่ถูกตัด แต่ยาวกว่าเป้า
- Section 07 ไม่มีแผนที่ SVG (ใช้แผงเลือกจังหวัดแทน) — รอไฟล์
- `/policies` ยังโหลดไอคอนทั้งชุด (832 KB) — โค้ดเดิม ควรแก้
- ไม่ได้รัน Lighthouse

## Asset ที่ยังขาด

| Asset | ใช้ที่ | สถานะตอนนี้ |
|---|---|---|
| น้องเลม่อนต้นฉบับความละเอียดสูง — (1) ภาพเต็มตัวท่ายืน PNG/WebP พื้นโปร่งใส สูง ≥ 800px (2) ไอคอนหน้า/ครึ่งตัว 256×256 สำหรับปุ่มลอย (3) ไม่บังคับ: ท่าโบกมือ/ชี้/คิด, Lottie JSON สำหรับ idle | Section 08, ปุ่มผู้ช่วย, แผงผู้ช่วย | GIF เดิม 27×49px แสดง ≤ 2 เท่า; ใส่ไฟล์ที่ `public/mascot/` แล้วตั้ง `MASCOT_HIRES_SRC` ใน `uf/LemonGuide.tsx` (ภาพประกอบนโยบายบน production มีน้องเลม่อนความละเอียดสูงอยู่แล้ว — ทีมน่าจะมีไฟล์ต้นฉบับ) |
| แผนที่ประเทศไทยรายจังหวัด (SVG, สัญญาอนุญาตใช้ได้) | Section 07 | ใช้แผงเลือกจังหวัด |
| ข้อมูลสาขาพรรค | Section 07 | ไม่มี collection |
| รายการคลิปที่อนุมัติ | Section 06B | ยังไม่มี — ใส่ผ่านแท็บ "คลิปวิดีโอ" |
| โลโก้ขนาดเล็กสำหรับเว็บ | Navbar/Footer | ใช้ PNG 3419×3419 (145 KB) แสดงที่ 48px |

## ความเสี่ยงก่อนขึ้น production (ยังไม่ทำ — ต้องได้รับอนุมัติ)

- ต้อง review ดีไซน์/ข้อความกับทีมพรรคก่อน
- ตรวจ `settings.hero.layout` บน production ว่าใช้แบบไหน (ข้อ 6)
- ทดสอบแท็บคลิปวิดีโอใน admin ด้วยบัญชีจริงบน staging
- Purge Cloudflare cache หลัง deploy
