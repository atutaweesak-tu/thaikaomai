# Instagram Integration — Ultra Future V3

**Production Status: NOT DEPLOYED** · branch `feature/ultra-future-homepage` · ยังไม่ commit
บัญชีทางการ: [@thaikaomaiparty](https://www.instagram.com/thaikaomaiparty/)

## 1. สรุป

| ส่วน | สถานะ |
|---|---|
| Section Instagram หน้าแรก (โพสต์ 4:5 + Reels 9:16) | ✅ |
| PageBlock ของตัวเอง (`type: 'instagram'`) — admin จัดลำดับ/ซ่อนได้ในแท็บ "หน้าแรก" | ✅ |
| แท็บ admin "Instagram" — เพิ่ม/แก้/ลบ, ลำดับ, ปักหมุด, ซ่อน/เผยแพร่, ตั้งเวลา, รูปปก, ชนิดสื่อ | ✅ |
| ลิงก์โปรไฟล์ทางการ (`settings.contact.instagram`, ค่าสำรอง @thaikaomaiparty) | ✅ |
| Manual Mode (ใส่ลิงก์เอง) — ใช้ได้ทันที | ✅ |
| Instagram API (ทางการของ Meta) — โค้ดพร้อม, **ปิดอยู่**, ไม่มี token, ไม่มี sync ตามเวลา | 🟡 เตรียมไว้ |

ไม่มี scraping · ไม่เรียก endpoint ที่ไม่เป็นทางการ · ไม่มีโพสต์ปลอม (รายการทดสอบทั้งหมดถูกลบหลังทดสอบ)

## 2. หน้าแรก

- ไฟล์: `src/components/uf/InstagramFeed.tsx`, ใช้ `Carousel` จาก `src/components/uf/shared.tsx` (ใช้ร่วมกับ YouTube)
- **ตำแหน่ง:** บล็อก Instagram ที่อยู่ถัดจากบล็อก "ข่าวสาร" พอดี จะแสดง **ต่อจาก YouTube/Shorts ก่อนแผนที่กิจกรรม**; ถ้า admin ย้ายไปที่อื่น ก็แสดงตามลำดับนั้น
- **ข้อมูลลำดับหน้าแรกเดิม (รวม production) ยังไม่มีบล็อกนี้** → section จะยังไม่แสดงจนกว่า admin กด **"เพิ่มส่วน Instagram"** ในแท็บหน้าแรก (ปุ่มจะวางให้ต่อจากข่าวสาร)
  - เหตุผลที่ไม่แทรกให้เอง: API สาธารณะตัดบล็อกที่ซ่อนออก หน้าเว็บแยก "ไม่มีบล็อก" กับ "admin ซ่อนไว้" ไม่ได้ ถ้าแทรกให้เอง การซ่อนจะไม่มีผล
  - ไม่มีข้อมูลลำดับเลย → ใช้ `DEFAULT_HOME_BLOCKS` ซึ่งมี Instagram แล้ว
- **เลย์เอาต์:** เดสก์ท็อป (≥1024px) กริด 4 คอลัมน์ — โพสต์สูงสุด 8 (2 แถว), Reels สูงสุด 4 · มือถือ/แท็บเล็ตเลื่อนแนวนอน + ปุ่มก่อนหน้า/ถัดไป (44px, ซ่อนเองเมื่อไม่ล้น) · เกินจำนวน → ปุ่ม "ดูทั้งหมดบน Instagram"
- **การ์ด:** ป้าย ภาพ / วิดีโอ / อัลบั้ม / Reels, ปักหมุด, ไอคอนเล่นสำหรับวิดีโอ/Reels; รูปปกจาก admin — ไม่มี/เสีย → การ์ดแบรนด์ (ไม่โชว์รูปแตก)
- **Lazy loading:** ก่อนกดเปิด **ไม่มี iframe และไม่มี request ใดไป instagram.com** · กดการ์ด → หน้าต่าง (dialog) โหลด `https://www.instagram.com/{p|reel}/{code}/embed/captioned/` (embed ทางการ) · ปิด = ถอด iframe
- **โพสต์ส่วนตัว/ถูกลบ:** ตรวจข้าม iframe ไม่ได้ → แสดงข้อความ "โพสต์อาจถูกลบหรือเป็นบัญชีส่วนตัว" + ปุ่ม **"เปิดบน Instagram"** เสมอ (Instagram แสดงหน้า "post may have been removed" ใน iframe เอง)
- **A11y:** dialog `aria-modal`, โฟกัสเข้า/วนใน dialog, Esc ปิด, คืนโฟกัสการ์ด, ล็อก scroll; Reduced motion = ไม่มีแอนิเมชัน + ปุ่มเลื่อนกระโดดทันที
- **ว่าง:** แผงติดตามกะทัดรัด (ไม่มีการ์ดปลอม) ลิงก์ไปโปรไฟล์ — `settings.contact.instagram` ถ้าถูกต้อง ไม่งั้น @thaikaomaiparty
- **CSP:** `frame-src https://www.youtube-nocookie.com https://www.instagram.com` (`script-src 'self'` ไม่เปลี่ยน — ไม่ใช้ embed.js)

## 3. Admin

- แท็บ **Instagram** ใช้สิทธิ์ **แท็บข่าว** (`TAB_PERMISSION.instagram = 'news'`, server `COLLECTION_TAB.instagram = 'news'`) — **ไม่เพิ่ม key สิทธิ์ใหม่ ไม่เปลี่ยนสิทธิ์บัญชีเดิม**; ไม่อยู่ในรายการเลือกสิทธิ์ตอนสร้างบัญชี
- ลิงก์ที่รับ: `instagram.com/p/…`, `/reel/…`, `/reels/…`, `/tv/…` (มี/ไม่มี www, query string, username นำหน้า) — ปฏิเสธ stories, โปรไฟล์, explore, โดเมนอื่น
- ตรวจ 2 ชั้น: client (`parseInstagramUrl`) + server (`validateInstagramPayload`: URL, ชื่อบังคับ, `kind` คำนวณจาก URL เสมอ, `mediaType` เฉพาะ image/video/carousel)
- ลิงก์โปรไฟล์: แก้ได้เฉพาะผู้มีสิทธิ์ "ตั้งค่าเว็บ" — บันทึกเฉพาะช่องนี้บนค่าล่าสุดจาก server (ไม่พา draft อื่นในแท็บตั้งค่าไปด้วย), normalize เป็น `https://www.instagram.com/USER/`
- แผงสถานะ API: Manual/API Mode, token ตั้งแล้วหรือยัง (ไม่แสดงค่า), sync ล่าสุด, ปุ่มตรวจบัญชี/Sync (แสดงเมื่อมี token + สิทธิ์ตั้งค่าเว็บ)
- แท็บหน้าแรก: ปุ่ม "เพิ่มส่วน Instagram" เมื่อลำดับยังไม่มีบล็อกนี้

## 4. Instagram API (เตรียมไว้ — ปิดอยู่)

ไฟล์ `server/instagramSync.ts` + route `/api/instagram/*` ใน `server/api.ts` (ลงทะเบียนทั้ง `server/index.ts` และ `vite.config.ts`)

| Endpoint | สิทธิ์ | ทำอะไร |
|---|---|---|
| `GET /api/instagram/status` | แท็บข่าว | mode, tokenConfigured, syncEnabled, autoPublish, expectedUsername, lastSync — **ไม่มี token** |
| `POST /api/instagram/verify` | ตั้งค่าเว็บ | `GET graph.instagram.com/me?fields=user_id,username,account_type` |
| `POST /api/instagram/sync` | ตั้งค่าเว็บ | ตรวจบัญชีซ้ำก่อนทุกครั้ง → `GET /me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp` → รวมเข้า `data/instagram.json` |

เงื่อนไขก่อน sync ได้: มี `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_SYNC_ENABLED=true` + username = `INSTAGRAM_EXPECTED_USERNAME` (thaikaomaiparty) + ประเภทบัญชี `BUSINESS`/`MEDIA_CREATOR` — ไม่ผ่านข้อใด = 409 พร้อมเหตุผล

การรวมข้อมูล: กันซ้ำด้วย `externalId` (media id) และ shortcode ของรายการที่ admin ใส่เอง · รายการ API เดิมอัปเดตแค่รูปปก/เวลา (คงชื่อ ลำดับ ปักหมุด สถานะซ่อนที่ admin แก้) · ของใหม่ซ่อนไว้ก่อนถ้า `INSTAGRAM_SYNC_AUTO_PUBLISH=false` (ค่าเริ่มต้น) · ข้อความ error ตัด token ออกเสมอ

**ไม่มี scheduler** — เปิด Automatic Sync ได้หลังตรวจสิทธิ์/ข้อมูลครบแล้วเท่านั้น (ดูข้อ 6)

ตัวแปร (`.env` ฝั่ง server เท่านั้น — ตัวอย่างว่างใน `.env.example`):
```
INSTAGRAM_ACCESS_TOKEN=            # ห้ามเป็น VITE_* / ห้าม commit
INSTAGRAM_SYNC_ENABLED=false
INSTAGRAM_SYNC_AUTO_PUBLISH=false
INSTAGRAM_EXPECTED_USERNAME=thaikaomaiparty
INSTAGRAM_SYNC_LIMIT=24
```

## 5. ขั้นตอนขอสิทธิ์ (ทำโดยเจ้าของบัญชี — ยังไม่ได้ทำ)

1. ตรวจว่า @thaikaomaiparty เป็นบัญชี **Professional (Business หรือ Creator)** — บัญชีส่วนตัวใช้ API ไม่ได้
2. สร้าง Meta App (developers.facebook.com) เพิ่ม product **Instagram → API setup with Instagram login**, ขอ permission `instagram_business_basic`
3. เจ้าของบัญชีล็อกอินอนุญาต → ได้ long-lived token (อายุ ~60 วัน ต้องต่ออายุ) — ใส่ใน `.env` ของ **server production โดยตรง** ไม่ส่งผ่านแชท/ไม่ใส่ใน git
4. ห้ามใช้ token production บน localhost — ทดสอบในเครื่องใช้ mock (ดูข้อ 7)
5. ตั้ง `INSTAGRAM_SYNC_ENABLED=true` → admin กด "ตรวจสอบบัญชี/สิทธิ์" ให้ผ่านก่อน → กด "Sync ตอนนี้" แล้วตรวจรายการ (ซ่อนไว้ก่อน)

## 6. ยังไม่ได้ทำ / ข้อจำกัด

- Automatic Sync ตามเวลา + ต่ออายุ token อัตโนมัติ — ตั้งใจยังไม่เปิดตาม brief
- URL รูปจาก CDN ของ Instagram หมดอายุได้ → การ์ด fallback เป็นการ์ดแบรนด์จนกว่าจะ sync ใหม่
- Manual Mode ดึงรูปปก/คำบรรยายเองไม่ได้ (ไม่มี token, ไม่ scrape) → admin ใส่ชื่อ/รูปปกเอง
- Footer ยังใช้ `settings.contact.instagram` ตามเดิม (ค่าในข้อมูลปัจจุบันคือ `#`) — ตั้งค่าในแท็บ Instagram/ตั้งค่าเว็บได้

## 7. ผลทดสอบ (localhost — production build บนพอร์ต 3100, ข้อมูลทดสอบชั่วคราวลบ/คืนค่าทุกครั้ง)

| ชุด | ผล |
|---|---|
| `parseInstagramUrl` / profile normalize (unit) | ผ่าน |
| `server/instagramSync.ts` ด้วย mock fetch (ตรวจบัญชีถูก/ผิด/ส่วนตัว, error ไม่หลุด token, map media, merge กันซ้ำ/คงค่าที่ admin แก้) | ผ่าน |
| หน้าแรก 1440 / 390 / reduced motion / empty / CSP / lazy / dialog a11y / ลิงก์ผิด-ซ่อน-ตั้งเวลา / โพสต์ไม่มีจริง | 33/33 |
| Admin UI + สิทธิ์ (editor / สิทธิ์จำกัด 403 / ไม่ล็อกอิน 401 / super_admin, ลิงก์ผิด 3 แบบ, เพิ่ม-แก้-ลำดับ-ซ่อน-ลบ, server 400, kind จาก URL, API status/sync gating, เพิ่ม+ซ่อนบล็อกหน้าแรก) | 34/34 |
| YouTube regression (admin 12/12, หน้าแรกว่าง/มีข้อมูล, facade nocookie) | ผ่าน |
| axe-core WCAG A/AA (หน้าแรก desktop/mobile, นโยบาย) | 0 violations |
| ความกว้าง 320–1920 (16 กรณี) | ไม่มี overflow, ไม่มี error |
| `tsc --noEmit` / `npm run build` / `npm run test:verify` | ผ่าน / ผ่าน / 65 passed |

หมายเหตุ: console error `ErrorUtils caught an error` มาจากสคริปต์ของ Meta **ภายใน iframe** เมื่อเปิดโพสต์รหัสทดสอบที่ไม่มีจริง — ไม่ใช่โค้ดของเว็บ
