# Homepage Component Map

`src/pages/HomePage.tsx` ยังเรียงตาม **PageBlock** ที่ admin จัดในแท็บ "หน้าแรก" (ซ่อน/ตั้งเวลาได้เหมือนเดิม) — block type เดิมแต่ละตัว render section ชุดใหม่ดังนี้

| Block (admin) | Section | คอมโพเนนต์ | ข้อมูล |
|---|---|---|---|
| — (ทุกหน้า) | 01 Future Navigation | `components/Navbar.tsx` | ลิงก์คงที่ + นโยบาย (โหลดเมื่อเปิด mega menu) |
| `hero` | 02 Cinematic Hero | `uf/UfHero.tsx` + `uf/EnergyArrow.tsx` | `settings.hero` |
| `hero` | 03 Quick Discovery | `uf/QuickDiscovery.tsx` | ลิงก์คงที่ |
| `policies` | 04 Policy Universe | `uf/PolicyUniverse.tsx` | `policies` (จัดกลุ่มด้วย `utils/policies.ts`) |
| `policies` | 05 Policy Discovery Hub | `uf/PolicyHub.tsx` | `policies` ทั้ง 36 |
| `team` | (เดิม) ทีมพรรค | `components/TeamSection.tsx` | `team` |
| `news` | 06 Future Newsroom | `uf/Newsroom.tsx` | `news` |
| `news` | 06B Thai Kao Mai Channel | `uf/VideoChannel.tsx` | `videos` (ใหม่) + `settings.contact.youtube` |
| `news` | 07 กิจกรรมทั่วประเทศ (แผนที่) | `uf/ActivitiesMap.tsx` | `events` + `utils/provinces.ts` + `utils/bangkokTime.ts` |
| `cta` | 08 Lemon Digital Guide | `uf/GuideSection.tsx` | — (เปิด `LemonGuide`) |
| `cta` | 09 Join the Future | `uf/JoinFuture.tsx` | `settings.cta` |
| — (ทุกหน้า) | 09 Footer | `components/Footer.tsx` | `settings.contact/footer` |
| — (ทุกหน้า ยกเว้น /admin) | 08 ผู้ช่วยลอย | `uf/LemonGuide.tsx` (mount ใน `App.tsx`) | ดึง policies/news/events/videos ครั้งเดียวตอนเปิด |
| `promo` | (เดิม) แบนเนอร์โปรโมท | `components/PromoBannerBlock.tsx` | block |
| — | (เดิม) โพล | `components/PollWidget.tsx` | `polls` |

## Route / anchor ที่ใช้

- `/#activities` — section 07 (ใช้ในเมนู "กิจกรรม", การ์ด "ร่วมกิจกรรม", footer)
- `/policies#<policyId>` — ทุกการ์ด/ลิงก์นโยบาย (เพิ่ม `id` + scroll ใน `PoliciesPage.tsx`)
- ไม่มี route ใหม่ → ไม่ต้องแก้ `SPA_STATIC_PATHS`

## คอมโพเนนต์เดิมที่ไม่ได้ใช้ในหน้าแรกแล้ว

`Hero.tsx`, `PoliciesSection.tsx`, `NewsSection.tsx`, `CTASection.tsx` — ยังเก็บไว้ (ย้อนกลับได้ง่าย) ลบได้หลังอนุมัติดีไซน์ใหม่
หมายเหตุ: ค่า `hero.layout` (split/full/imageOnly) และ `textStyle.fontSize` ไม่มีผลกับ hero ใหม่ — ใช้แค่ข้อความ/สี/การซ่อน และรูปผู้นำ (slide แรก)
