# Data Integration Map

ทุก section ใช้ API เดิม `/api/data/<collection>` และ `/api/settings` ผ่าน `src/services/dataService.ts` — **ไม่มีการแก้ schema ของ collection เดิม** ทดสอบกับไฟล์ใน `data/` ของเครื่อง local เท่านั้น

## แหล่งข้อมูลต่อ section

| Section | Collection / ฟิลด์ | หมายเหตุ |
|---|---|---|
| Hero | `settings.hero` (badge, heading1–3, description, buttonPrimary/Secondary + Link, leaderName/Title, slides/leaderImages/leaderImage) | ใช้ข้อความที่ admin ตั้งไว้ (ไม่ใช้ข้อความ CTA ในบรีฟแทน — ดู CHANGELOG) |
| Policy Universe / Hub | `policies` (title, description, iconImage, order, featuredHome, publish window) | 36 รายการ, จัดกลุ่มตามลำดับ — หัวกลุ่ม = `featuredHome` |
| Newsroom | `news` (title, summary, date, category, image) | กรอง publish window; ลำดับตาม array (ใหม่สุดก่อน) |
| คลิป | **`videos` (ใหม่)** | ดูด้านล่าง |
| กิจกรรม | `events` (title, date, startAt, location, time) | สถานะคำนวณจาก `startAt` ตามเวลา Asia/Bangkok; จังหวัดจับจาก `location` |
| Join / Footer | `settings.cta`, `settings.contact`, `settings.footer` | social ที่เป็น `#` ไม่แสดง |
| ผู้ช่วยน้องเลม่อน | policies, news, events, videos (ดึงครั้งเดียว) | ค้นหาแบบ substring ภาษาไทย — ไม่ใช่ AI |

## Collection ใหม่: `videos`

```ts
interface VideoItem {
  id: string; url: string; title: string;
  type: 'video' | 'short';
  category?: string; policyId?: string; date?: string;
  featured?: boolean; order?: number;
  published?: boolean; publishAt?: string; unpublishAt?: string;
}
```

- ไฟล์: `data/videos.json` (สร้างอัตโนมัติเมื่อ admin เพิ่มคลิปแรก)
- สิทธิ์: ผูกกับแท็บ **ข่าว** (`COLLECTION_TAB.videos = 'news'` ใน `server/api.ts`) — ไม่เพิ่ม key สิทธิ์ใหม่ บัญชีเดิมไม่เปลี่ยน
- อ่านแบบสาธารณะได้เฉพาะที่เผยแพร่อยู่ (กรองด้วย `isPublicNow` เหมือน collection อื่น)
- ความปลอดภัย: ลิงก์ผ่าน `extractYouTubeId` ทุกจุด (หน้าเว็บ/ผู้ช่วย/admin) — ไม่ใช่ YouTube = ไม่แสดง; ฝังผ่าน `youtube-nocookie.com` ซึ่ง CSP อนุญาตอยู่แล้ว; admin บันทึกลิงก์ไม่ถูกต้องไม่ได้
- รูปปกจาก `i.ytimg.com` (CSP `img-src https:` อนุญาตอยู่แล้ว)
- **ยังไม่มีคลิปจริง** — ต้องให้ทีมใส่ลิงก์ที่อนุมัติผ่านแท็บ "คลิปวิดีโอ" ระหว่างนี้แสดงแค่แถบลิงก์ไปช่อง YouTube

## ช่องว่างของข้อมูล (ไม่ได้แต่งเติม)

| ต้องการ | สถานะ | ต้องทำอะไรต่อ |
|---|---|---|
| แผนที่ SVG รายจังหวัด | ไม่มีไฟล์ | หาไฟล์ open-data ที่สัญญาอนุญาตใช้ได้ + อนุมัติ แล้วแทนกล่อง "จังหวัดที่มีกิจกรรม" |
| ข้อมูลสาขาพรรค | ไม่มี collection | ต้องออกแบบ collection `branches` (จังหวัด, ที่อยู่, ติดต่อ) + แท็บ admin |
| จังหวัดของกิจกรรม | ไม่มีฟิลด์ | ตอนนี้จับจากข้อความ `location`; ถ้าเพิ่มฟิลด์ `province` (dropdown) ใน admin จะแม่นกว่า |
| เวลาสิ้นสุดกิจกรรม | ไม่มีฟิลด์ | "กำลังจัดอยู่" = วันเดียวกับวันนี้ (ตามเวลาไทย); ถ้าเพิ่ม `endAt` จะรองรับกิจกรรมหลายวัน |
| `startAt` ของกิจกรรมเดิม | ว่าง | กิจกรรมทั้ง 2 รายการแสดงเป็น "รอกำหนดการ" จนกว่า admin จะใส่ |
| รูปประกอบนโยบายย่อย | ไม่มี | การ์ดนโยบายย่อยเป็นข้อความล้วน |
| ข่าว/กิจกรรม/settings ล่าสุด | local เก่ากว่า production | ถ้าต้องการพรีวิวเหมือนจริง ให้ export **เฉพาะเนื้อหาสาธารณะ** มาแทน (ห้ามมี contact/newsletter/volunteer/users) |
