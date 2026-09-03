import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { DEFAULT_SETTINGS } from '../types';

/** ป้ายเล็กเหนือหัวข้อ section — ลูกศร ↗ (โลโก้พรรค) + ชื่อหมวด
 *  ซ่อนได้จากหน้า admin (การแสดงผล → แสดงป้ายหมวด) */
export default function SectionEyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [show, setShow] = useState(DEFAULT_SETTINGS.theme.showEyebrows);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(s => setShow(s.theme.showEyebrows !== false));
    return () => unsub();
  }, []);

  if (!show) return null;

  return (
    <p className={`accent-text inline-flex items-center gap-1.5 text-xs md:text-sm font-bold tracking-wide mb-4 ${className}`}>
      <ArrowUpRight size={16} strokeWidth={2.75} className="shrink-0" />
      {children}
    </p>
  );
}
