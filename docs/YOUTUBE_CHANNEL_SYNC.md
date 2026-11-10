# YouTube Channel Auto Sync — Ultra Future V3

**Production Status: NOT DEPLOYED** · branch `feature/ultra-future-homepage` · ยังไม่ commit · ยังไม่มี API key จริง (ทดสอบด้วย mock ในเครื่องเท่านั้น)

## 1. ตรวจระบบเดิมก่อนเริ่ม

| ส่วน | ของเดิม | สิ่งที่เปลี่ยน |
|---|---|---|
| Backend | Express (`server/index.ts`) + handler ใน `server/api.ts` ใช้ร่วมกับ Vite dev (`vite.config.ts`) | เพิ่ม `server/youtubeSync.ts` + route `/api/youtube/*` + ตัวจับเวลา sync |
| "ฐานข้อมูล" | ไฟล์ JSON `data/<collection>.json` (gitignored), เขียนผ่านคิวต่อ collection (`runExclusive`) | คลิปยังอยู่ใน `data/videos.json` (= cache) · สถานะ sync ใหม่ใน `data/youtube-sync.json` (เฉพาะ admin) |
| Video admin | แท็บ "คลิปวิดีโอ" ใช้สิทธิ์แท็บข่าว, เพิ่มคลิปด้วยลิงก์, ซ่อน/ลำดับ/คลิปเด่น | **คงไว้ทั้งหมด** + แผง Auto Sync, ประเภท live/upcoming, ปักหมุด, ล็อกประเภท |
| หน้าแรก | `VideoChannel.tsx`: คลิปเด่น + แถวคลิป 16:9 + แถว Shorts 9:16 + ปุ่มช่อง, facade (รูปปกก่อน iframe youtube-nocookie) | + ปักหมุด, ป้าย LIVE/กำลังจะไลฟ์, ปิด Shorts, จำนวนสูงสุด |

## 2. การตั้งค่าใน Admin (แท็บ "คลิปวิดีโอ")

| การตั้งค่า | เก็บที่ | สิทธิ์ |
|---|---|---|
| ลิงก์ช่อง / @handle → **Channel ID** (ตรวจผ่าน `channels.list`) | `data/youtube-sync.json` | ตั้งค่าเว็บ |
| Automatic Sync เปิด/ปิด · รอบ 30/60 นาที | `data/youtube-sync.json` | ตั้งค่าเว็บ |
| จำนวนคลิปสูงสุด (8/12/24/36/50) · แสดง Shorts | `settings.videoDisplay` (สาธารณะ — หน้าเว็บต้องใช้) | ตั้งค่าเว็บ |
| คลิปเด่น (Featured) | ฟิลด์ `featured` ของคลิป (ตัวเลือกเดียว) | แท็บข่าว |
| ปุ่ม **ซิงก์ทันที** · ซิงก์สำเร็จล่าสุด · รอบถัดไป · สถานะ error | — | แท็บข่าว |
| ซ่อน/แสดง · ปักหมุด · จัดลำดับ · แก้ประเภท · ลบ (ต่อคลิป) | `data/videos.json` | แท็บข่าว |

ไม่เพิ่ม key สิทธิ์ใหม่ ไม่เปลี่ยนสิทธิ์บัญชีเดิม · แผงรีเฟรชสถานะทุก 30 วิ ขณะเปิดแท็บ (อ่านไฟล์สถานะ ไม่ได้เรียก YouTube)

### แปลงลิงก์ช่องเป็น Channel ID
`parseYouTubeChannelInput` (`src/utils/youtube.ts`) แยกรูปแบบ → server เรียก `channels.list` เสมอ (ไม่เดา/ไม่สร้าง ID เอง):

| สิ่งที่ใส่ | เรียก |
|---|---|
| `youtube.com/@handle`, `@handle` | `channels.list?forHandle=@handle` |
| `youtube.com/channel/UC…`, `UC…` | `channels.list?id=UC…` (ยืนยันว่ามีจริง) |
| `youtube.com/user/name` | `channels.list?forUsername=name` |
| `youtube.com/c/name` | **ปฏิเสธ** — API ไม่มีวิธีทางการแปลง ให้ใช้ @handle หรือ /channel/ แทน |

ได้ `channelId`, ชื่อช่อง, handle, `uploads` playlist (จาก `contentDetails.relatedPlaylists`)

## 3. YouTube Data API v3

| ขั้น | Endpoint | โควตา |
|---|---|---|
| ตั้งช่อง (ครั้งเดียว) | `channels.list` part=snippet,contentDetails | 1 |
| รายการคลิป | `playlistItems.list` (uploads playlist, หน้าละ 50, ตามจำนวนสูงสุด) | 1/หน้า |
| รายละเอียด | `videos.list` part=snippet,contentDetails,liveStreamingDetails,player,status (ทีละ 50, `maxWidth=480`) | 1/50 คลิป |

ซิงก์ 1 รอบ (≤50 คลิป) ≈ 2 หน่วย → ทุก 30 นาที ≈ 96 หน่วย/วัน จากโควตาเริ่มต้น 10,000

- **API key ฝั่ง server เท่านั้น** (`YOUTUBE_API_KEY` ใน `.env`) — ไม่มี `VITE_*`, `/api/youtube/status` ส่งแค่ `apiKeyConfigured: true/false`, ข้อความ error ตัด key ออก (`key=[key]`)
- **ไม่เรียก API ตอนผู้ใช้เปิดเว็บ** — หน้าเว็บอ่าน `/api/data/videos` (= `data/videos.json`) เท่านั้น
- **Scheduled sync:** ตัวจับเวลาฝั่ง server เช็คทุก 60 วิ (`YOUTUBE_SYNC_TICK_SECONDS`) ว่า auto เปิด + มี key + ตั้งช่องแล้ว + ผ่านไปครบรอบนับจากความพยายามครั้งล่าสุด → ซิงก์ · กันซ้อนด้วย flag `running`
- ไม่ดึงคลิป private/unlisted (`status.privacyStatus`)

## 4. การจัดประเภท (`classifyVideo`)

| ประเภท | เงื่อนไข (ข้อมูลที่ API ยืนยันได้) |
|---|---|
| `live` | `snippet.liveBroadcastContent = live` |
| `upcoming` | `snippet.liveBroadcastContent = upcoming` (+ `scheduledStartTime`) |
| `short` | ยาว ≤ 180 วิ **และ** อย่างน้อยหนึ่งใน: player แนวตั้ง (`embedHeight > embedWidth`), `#shorts` ในชื่อ/คำอธิบาย/แท็ก |
| `video` | ที่เหลือ — **คลิปสั้นที่ไม่มีหลักฐานอื่นไม่ถูกนับเป็น Shorts** (ไม่ใช้ความยาวอย่างเดียว) |

เหตุผลเก็บใน `classifyEvidence` · ไลฟ์จบแล้ว sync รอบถัดไปเปลี่ยนเป็น `video` เอง · admin แก้ประเภทคลิปจาก sync → `typeLocked: true` (server ตั้งให้) sync จะไม่เปลี่ยนกลับ

## 5. การรวมข้อมูล (`mergeSyncedVideos`) — กันซ้ำ/ไม่ลบ/เคารพการแก้ของ admin

- คีย์ = **YouTube video ID** (`youtubeId` ของรายการ sync, หรือ id จาก url ของรายการที่เพิ่มเอง) → ไม่มีรายการซ้ำ ซิงก์ซ้ำได้ผลเท่าเดิม (idempotent)
- รายการที่ **admin เพิ่มเอง** ไม่ถูกแตะเลย แม้เป็นคลิปเดียวกัน
- รายการจาก sync เดิม: อัปเดตเฉพาะ ประเภท/url (ถ้าไม่ล็อก), ความยาว, เวลาไลฟ์ — **ไม่แตะ ชื่อ, ซ่อน/แสดง, ปักหมุด, ลำดับ, คลิปเด่น, หมวด**
- **คลิปที่ซ่อนไว้ยังซ่อน** หลังซิงก์ · **คลิปจาก sync ที่ admin ลบ** ถูกจำใน `ignoredVideoIds` ไม่ถูกเพิ่มกลับ
- คลิปใหม่: `published: true`, `order` = ต่ำสุด−1 เรียงจากเก่าไปใหม่ → คลิปใหม่สุดขึ้นก่อน (เหมือนเพิ่มเอง) · จัดลำดับ/ปักหมุดต่อได้
- server ไม่ยอมให้ client ตั้ง `source`/`youtubeId` เอง และตรวจ `type` ∈ video/short/live/upcoming

## 6. Reliability

| เหตุการณ์ | ผล |
|---|---|
| API ล่ม / 5xx / เครือข่าย | ไม่เขียน `videos.json` · `lastError`, `lastErrorAt`, `consecutiveFailures` + แจ้งใน admin (กล่องแดง "หน้าเว็บยังแสดงคลิปชุดเดิม") |
| โควตาหมด (`quotaExceeded`/`dailyLimitExceeded`/`rateLimitExceeded`) | เหมือนข้างบน + ข้อความ "โควตา YouTube API หมด (ใช้ข้อมูล cache เดิมไปก่อน)" · รอบถัดไปลองใหม่ตามรอบปกติ |
| key ไม่ได้ตั้ง / ช่องไม่ได้ตั้ง | ปุ่มซิงก์ปิด · API ตอบ 409 · หน้าเว็บทำงานแบบเพิ่มคลิปเองตามเดิม |
| หน้าแรก | อ่าน cache เสมอ — sync ล้มเหลวไม่ทำให้หน้าแรกล่ม (VideoChannel อยู่ใน ErrorBoundary อยู่แล้ว) |
| สถานะเขียนระหว่าง sync | อ่าน `youtube-sync.json` ใหม่ก่อนเขียน — ไม่ทับ config/ignored ที่เปลี่ยนระหว่างซิงก์ |

## 7. หน้าแรก (`src/components/uf/VideoChannel.tsx`)

คลิปเด่น (admin เลือก → ไลฟ์ที่ออกอากาศ → คลิปที่ดูได้แล้ว; ไลฟ์ที่ยังไม่เริ่มไม่ขึ้นเป็นคลิปเด่นเอง) · คลิปล่าสุด 16:9 · Shorts 9:16 · ปุ่มไปช่อง YouTube (`settings.contact.youtube`) · มือถือเลื่อนแนวนอน + ปุ่มก่อนหน้า/ถัดไป · รูปปกก่อน แล้วโหลด iframe youtube-nocookie เมื่อผู้ใช้กดเล่นเท่านั้น (ไม่ autoplay พร้อมเสียงเอง) · ปักหมุดขึ้นก่อน · จำนวนสูงสุดใช้กับคลิปปกติและ Shorts แยกกัน

## 8. ตัวแปร (`.env` ฝั่ง server — ตัวอย่างว่างใน `.env.example`)

```
YOUTUBE_API_KEY=                 # Google Cloud → YouTube Data API v3 → API key (จำกัด API = YouTube Data API v3, จำกัด IP ของ server)
# YOUTUBE_SYNC_TICK_SECONDS=60
# YOUTUBE_API_BASE=              # ทดสอบ mock ในเครื่องเท่านั้น
```

ขั้นตอน production (ยังไม่ทำ): สร้าง key ในโปรเจกต์ Google Cloud ของพรรค → ใส่ใน `.env` บน server โดยตรง (ไม่ผ่านแชท/git) → restart → admin ใส่ลิงก์ช่องทางการกด "ตรวจสอบ & บันทึก" → กด "ซิงก์ทันที" ตรวจผล → ค่อยเปิด Automatic Sync

## 9. ผลทดสอบ (localhost, production build พอร์ต 3100, mock YouTube API 127.0.0.1:3199 — รหัสทดสอบ `[MOCK]` ทั้งหมด ไม่ใช่ช่อง/คลิปจริง; ข้อมูล/บัญชีทดสอบ/env ชั่วคราวลบคืนครบ)

| ชุด | ผล |
|---|---|
| Unit (`parseYouTubeChannelInput`, duration, classify 6 กรณี, resolve, paging, private, quota/error ไม่หลุด key, merge 10 กรณี, idempotent, status) | ผ่าน |
| End-to-end sync (สิทธิ์ 401/403, แปลง @handle, /c/ & ช่องไม่มีจริง 422, จัดประเภท, กันซ้ำกับคลิปเพิ่มเอง, ซ่อน/ล็อก/ปักหมุด/ลบ แล้วซิงก์ซ้ำ, โควตาหมด & API ล่มไม่แตะ cache, หน้าเว็บไม่เรียก API, LIVE/upcoming/Shorts 9:16, 390px, ปิด Shorts/maxVideos, scheduled sync ตามรอบ, admin UI error/สำเร็จ) | 37/37 |
| Regression: admin เพิ่มคลิปเอง (12), Instagram หน้าแรก (33) + admin (34), ฟังก์ชันหน้าแรก (YouTube ว่าง/มีข้อมูล, facade) | ผ่านทั้งหมด |
| axe-core (หน้าแรก desktop/mobile, นโยบาย) · ความกว้าง 320–1920 | 0 violations · ไม่มี overflow |
| `tsc --noEmit` · `npm run build` · `npm run test:verify` | ผ่าน · ผ่าน · 65 passed |

หมายเหตุ: รูปปก i.ytimg.com ของรหัส MOCK ตอบ 404 (YouTube ไม่มีคลิปนั้น) — component แสดงรูปสำรองตามปกติ

## 10. ยังไม่ได้ทำ / ข้อจำกัด

- ยังไม่มี API key จริง → ยังไม่ได้ยืนยันกับช่องจริง (ต้องทดสอบหลังได้ key — บน staging/production ไม่ใช่ localhost)
- การจัด Shorts อาศัยสัญญาณที่ API ให้ — คลิปสั้นแนวนอนที่ไม่มี #shorts จะเป็น "คลิปปกติ" (แก้ทีละคลิปได้ และล็อกไว้)
- ไม่มีการถอนคลิปที่ถูกลบ/ตั้ง private บน YouTube ภายหลังออกจากเว็บอัตโนมัติ (ตั้งใจ "ไม่ลบ" ตาม brief) — admin ซ่อน/ลบเอง
- รัน server หลาย instance พร้อมกันจะมีตัวจับเวลาหลายตัว (ตอนนี้ deploy เป็น instance เดียว)
