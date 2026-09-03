import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/** ป้ายเล็กเหนือหัวข้อ section — ลูกศร ↗ (โลโก้พรรค) + ชื่อหมวด ให้หัวข้อมีจุดยึดสายตา */
export default function SectionEyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-brand-neon text-xs md:text-sm font-bold tracking-wide mb-4 ${className}`}>
      <ArrowUpRight size={16} strokeWidth={2.75} className="shrink-0" />
      {children}
    </p>
  );
}
