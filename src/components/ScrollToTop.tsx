import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router SPA navigation ไม่ scroll ไปบนสุดให้อัตโนมัติเหมือนการโหลดหน้าเว็บใหม่ปกติ — ถ้าไม่มี
// ตัวนี้ หน้าใหม่จะโผล่มาที่ตำแหน่ง scroll เดิมของหน้าก่อนหน้า (เช่น กดลิงก์จากด้านล่างสุดของหน้าแรก
// แล้วหน้าใหม่ก็เปิดมาที่ด้านล่างสุดเหมือนกัน)
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
