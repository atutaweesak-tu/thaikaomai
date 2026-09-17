import React, { useState } from 'react';
import { createPortal } from 'react-dom';

// ซ่อนเคอร์เซอร์จริงแล้วเอา GIF ลอยตามตำแหน่งเมาส์แทน — เบราว์เซอร์เล่นแอนิเมชัน GIF
// ผ่าน cursor: url() ไม่ได้ (โชว์แค่เฟรมแรก) เลยต้องใช้ <img> ตามเมาส์ด้วย JS แทน
export default function MascotCursor({
  src, size = 64, className = '', children,
}: {
  src: string;
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className={`${className} ${pos ? 'cursor-none' : ''}`}
      onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        // Portal to body: ถ้า container นี้อยู่ในอีลิเมนต์ที่มี transform (เช่น framer-motion
        // สร้าง containing block ใหม่ให้ position: fixed) ตำแหน่งจะเพี้ยนถ้า render ตรงนี้เลย
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2"
          style={{ left: pos.x, top: pos.y, height: size, width: 'auto' }}
        />,
        document.body
      )}
    </div>
  );
}
