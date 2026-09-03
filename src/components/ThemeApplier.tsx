import { useEffect } from 'react';
import { subscribeToSiteSettings } from '../services/dataService';
import { themeCssVars, normalizeTheme } from '../lib/theme';

/** เขียนค่าธีมจาก settings ลงเป็น CSS variables ที่ <html> — อัปเดต real-time เมื่อ admin บันทึก (ผ่าน SSE) */
export default function ThemeApplier() {
  useEffect(() => {
    const el = document.documentElement;
    const unsub = subscribeToSiteSettings(s => {
      const vars = themeCssVars(s.theme);
      for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
      el.dataset.accent = normalizeTheme(s.theme).accentLevel;
    });
    return () => unsub();
  }, []);
  return null;
}
