import { useEffect } from 'react';
import { subscribeToSiteSettings } from '../services/dataService';
import { applyTheme } from '../lib/theme';

/** เขียนค่าธีมจาก settings ลงเป็น CSS variables + data-* ที่ <html> — อัปเดต real-time เมื่อ admin บันทึก (ผ่าน SSE) */
export default function ThemeApplier() {
  useEffect(() => {
    const unsub = subscribeToSiteSettings(s => applyTheme(s.theme));
    return () => unsub();
  }, []);
  return null;
}
