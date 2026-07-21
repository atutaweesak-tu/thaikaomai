// ฟิลด์ดักบอทสำหรับฟอร์มสาธารณะ (contact/newsletter/volunteer) — คนจริงมองไม่เห็นเพราะซ่อนด้วยตำแหน่ง
// นอกจอ ไม่ใช้ display:none/aria-hidden เพราะบอทที่ฉลาดพอจะข้ามฟิลด์ที่ซ่อนแบบนั้นได้ ส่วนบอทพื้นฐานที่
// กรอกทุกช่อง input ที่เจอในหน้าโดยไม่สนใจ CSS/ARIA จะยังกรอกช่องนี้อยู่ดี — ถ้ามีค่าฝั่ง server จะทิ้ง
// ข้อมูลเงียบๆ (ดู PUBLIC_POST_COLLECTIONS ใน server/api.ts) label จริงไว้บอก screen reader ให้เว้นว่างไว้
export default function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
      <label htmlFor="website">กรุณาปล่อยช่องนี้ว่างไว้</label>
      <input
        type="text"
        id="website"
        name="website"
        value={value}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
