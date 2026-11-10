# Motion Storyboard

ใช้ของที่มีอยู่แล้วเท่านั้น: **CSS keyframes** (ต่อเนื่อง/วนซ้ำ — ราคาถูก) + **`motion`** (เข้า/ออก, reveal) — ไม่เพิ่ม dependency, ไม่ใช้ WebGL

## Hero (Section 02)

| เวลา | สิ่งที่เกิด | ที่มา |
|---|---|---|
| 0.0–0.4s | badge → H1 → คำอธิบาย fade-up (อ่านได้ทันที) | `motion` delay 0 / 0.1 / 0.2 |
| 0.4–0.9s | เส้นแสงสีขาววิ่งตามลูกศร | `.uf-trace` (stroke-dashoffset, `pathLength=1`) |
| 0.9–1.5s | ลูกศรเต็ม gradient cyan→lemon + glow ปรากฏ, วงโคจรขึ้นที่ 1.1s, อนุภาค 1.3s | `.uf-reveal` |
| 1.5–2.0s | ปุ่ม CTA (1.5s) + ตัวบอกเลื่อนลง (1.7s) | `motion` |
| > 2.0s | ลูกศรลอยขึ้นลง 12px/6s, วงโคจรหมุน 40s/56s, แสงหายใจ 4s | `.uf-float` `.uf-orbit` `.uf-glow` |

ลูกศรเป็นวัตถุตกแต่ง SVG แยก (`aria-hidden`) — ไม่ได้วาดหรือแก้โลโก้พรรค

## Section อื่น

| จุด | การเคลื่อนไหว |
|---|---|
| ทุก section | `Reveal` fade-up 24px ครั้งเดียวตอนเลื่อนถึง, stagger 80ms (สูงสุด 6 ชิ้น) |
| Navbar | โปร่งใสบนสุดของหน้าแรก → กระจก navy เมื่อเลื่อน > 24px (300ms); เส้นใต้ lemon วิ่งจากซ้ายตอน hover; mega menu fade/slide 180ms |
| Policy Universe | ดอกที่เลือกขยาย 1.05 + glow; แผงรายละเอียดสลับ slide 24px 300ms; วงเส้นประหมุนช้า |
| การ์ดข่าว/คลิป | รูป scale 1.03–1.05 ใน 700ms ตอน hover; การ์ดยก 4px |
| ปุ่มเล่นคลิป | วงแสง cyan ขยายตอน hover |
| แผนที่ | ปุ่มจังหวัดที่เลือกเปลี่ยนเป็น lemon (ไม่มีแผนที่ SVG — ดู DATA_INTEGRATION_MAP) |
| น้องเลม่อน | GIF ต้นฉบับ + ลอยขึ้นลง (`.uf-float`); แผงผู้ช่วยขึ้นจากล่าง 250ms |

## Accessibility / Performance

- `prefers-reduced-motion`: กฎ CSS เดิมของเว็บตัด animation ทั้งหมด + `MotionConfig reducedMotion="user"` ในหน้าแรก + คอมโพเนนต์ที่ใช้ `useReducedMotion()` ข้าม `initial` และ delay
- **มือถือ (<768px)**: ไม่มี animation วนซ้ำ (ลอย/หมุน/หายใจ) เหลือแค่ trace + reveal ครั้งเดียว
- นอกจอ: `useOnScreen` ใส่ `.uf-paused` หยุด animation ของ hero/วงโคจรนโยบาย
- ไม่มีแสงกะพริบ, ไม่ hijack scroll, ไม่เล่นเสียง/วิดีโออัตโนมัติ (คลิปเล่นเมื่อผู้ใช้กดเท่านั้น)
