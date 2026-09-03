import React from 'react';
import { motion } from 'motion/react';

interface Props {
  children: React.ReactNode;
  /** class ของตัวข้อความ (เช่น "text-brand-neon") */
  className?: string;
  /** class ของเส้นใต้ — default นีออนจางๆ; บนพื้นสว่างให้ส่ง "bg-brand-navy/30" */
  barClassName?: string;
  /** หน่วงก่อนเส้นวิ่ง (วินาที) */
  delay?: number;
  /** เรืองแสงนีออน (text-shadow) — ใช้เฉพาะตอนตัวอักษรเป็นสีนีออน */
  glow?: boolean;
}

/** คำในหัวข้อ + เส้นใต้ที่ "วิ่ง" เข้ามาตอน scroll ถึง (respect prefers-reduced-motion ผ่าน CSS guard) */
export default function AccentUnderline({ children, className = '', barClassName = 'bg-[var(--accent-bar)]', delay = 0.25, glow = false }: Props) {
  return (
    <span
      className={`accent-word relative inline-block ${className} ${glow ? '[text-shadow:0_0_26px_rgba(230,255,0,0.38)]' : ''}`}
    >
      {children}
      <motion.span
        aria-hidden
        className={`absolute left-0 -bottom-1 h-1 w-full rounded-full origin-left ${barClassName}`}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      />
    </span>
  );
}
