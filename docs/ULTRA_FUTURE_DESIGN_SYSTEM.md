# Ultra Future 2035 — Design System

ทั้งหมดอยู่ใน `src/index.css` (token ใน `@theme`, คลาส `uf-*` ท้ายไฟล์) ใช้กับหน้าแรก + Navbar + Footer

## สี

| Token (Tailwind) | ค่า | ใช้กับ | Contrast บน `uf-bg` |
|---|---|---|---|
| `uf-bg` | `#071326` | พื้นหลังหลัก | — |
| `uf-surface` | `#102D50` | การ์ด/แผง | — |
| `uf-lemon` | `#DDF34B` | ปุ่มหลัก, คำเน้น, สถานะ "กำลังจัดอยู่" | สูง |
| `uf-cyan` | `#36D9F5` | eyebrow, ลิงก์รอง, focus ring, ฟิลเตอร์ที่เลือก | สูง |
| `uf-text` | `#F7FAFF` | ข้อความหลัก | ~18:1 |
| `uf-muted` | `#AEBDD3` | ข้อความรอง | ~9.6:1 |
| `uf-faint` | `#8095B2` | วันที่/คำอธิบายเล็ก | ~6.0:1 (ผ่าน AA) |
| `uf-line` | `rgba(247,250,255,.12)` | เส้นขอบ | — |

นีออน (glow) ใช้เฉพาะ: ปุ่มหลักตอน hover, ดอกนโยบายที่เลือก, ปุ่มเล่นคลิป, ลูกศรใน hero

## Layout

- `.uf-container` — content 1248px, margin `20px@390 → 96px@1440` (fluid ด้วย `clamp`)
- `.uf-grid` — 4 คอลัมน์ gutter 12px → 12 คอลัมน์ gutter 24px ที่ ≥1024px
- `.uf-section` — padding บน/ล่าง fluid 64–120px; **ไม่ fix ความสูง** (ความสูงในบรีฟเป็นค่าประมาณ)
- Breakpoint หลัก: `lg` (1024px) = เปลี่ยนเป็นเลย์เอาต์เดสก์ท็อป

## Typography

ฟอนต์ **Noto Sans Thai** (ของเดิม — รองรับไทยครบ ไม่เปลี่ยนเพราะจะกระทบทุกหน้า)

| คลาส | มือถือ 390 | เดสก์ท็อป 1440 | line-height |
|---|---|---|---|
| `.uf-h1` | 42px | 76px | 1.22 |
| `.uf-h2` | 30px | 48px | 1.3 |
| `.uf-h3` | 20px | 24px | 1.4 |
| `.uf-body` | 15px | 16px | 1.75 |

line-height เผื่อสระบน/วรรณยุกต์ — **ห้ามใช้ `bg-clip-text` gradient กับหัวข้อไทย** (ตัดสระบน)

## คอมโพเนนต์พื้นฐาน

- `.uf-glass` / `.uf-card` — พื้นผิวกระจก gradient navy + ขอบบาง (`.uf-card-hover` = ยกขึ้น 4px + ขอบ cyan)
- `.uf-btn-primary` (lemon) / `.uf-btn-ghost` (ขอบ) — สูงขั้นต่ำ 48px (44px ใน navbar)
- `.uf-eyebrow` — ป้ายตัวพิมพ์ใหญ่สี cyan พร้อมเส้นนำ
- `.uf-scroll-x` — แถวเลื่อนแนวนอน scroll-snap ซ่อน scrollbar
- Focus: outline 2px cyan offset 3px ทุก element ใน `.uf-home/.uf-nav/.uf-footer/.uf-guide`
- `SectionHeader`, `Reveal`, `useOnScreen` ใน `src/components/uf/shared.tsx`

## ธีมจาก admin

ตัวปรับ "การแสดงผล" ใน admin (bgLevel/fontScale/accent) ยังมีผลกับหน้าอื่นเหมือนเดิม แต่หน้าแรก/Navbar/Footer ใช้ token `uf-*` ตายตัว — ถ้าต้องการให้ admin ปรับธีม Ultra Future ได้ ต้องเพิ่มในรอบถัดไป
