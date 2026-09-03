import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS, PopupItem } from '../types';
import { openSafeUrl } from '../utils/safeUrl';

const DISMISS_KEY_PREFIX = 'tkm_popup_dismissed_';

// hash รูปเป็น key สั้นๆ แทนใช้ base64 เต็มๆ (รูปที่อัพโหลดจาก admin อาจยาวหลายร้อย KB) —
// ผูก key กับเนื้อหารูป ไม่ใช่ key ตายตัว เพื่อให้ popup ใหม่ (รูปเปลี่ยน) ยังเด้งได้แม้เคยปิดอันเก่าไปแล้ว
function hashImage(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return hash.toString(36);
}

function isWithinWindow(item: PopupItem, now: Date): boolean {
  if (item.startDate && now < new Date(item.startDate)) return false;
  if (item.endDate && now > new Date(item.endDate)) return false;
  return true;
}

export default function PopupBanner() {
  const location = useLocation();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const popup = settings.popup ?? DEFAULT_SETTINGS.popup;

  // ลายเซ็นของ config popup — คิวจะ re-build เฉพาะตอน config เปลี่ยนจริง (ไม่ใช่ทุก broadcast)
  const sig = JSON.stringify({
    on: popup.enabled,
    items: (popup.items ?? []).map(i => [i.id, i.image, i.link, i.startDate, i.endDate, i.enabled]),
  });

  // คิว popup ที่จะแสดง (เรียงตามลำดับใน items) — กรอง: เปิดอยู่, มีรูป, อยู่ในช่วงเวลา, ยังไม่เคยกดปิด
  const queue = useMemo<PopupItem[]>(() => {
    if (!popup.enabled) return [];
    const now = new Date();
    return (popup.items ?? []).filter(item => {
      if (item.enabled === false || !item.image) return false;
      if (!isWithinWindow(item, now)) return false;
      try {
        if (localStorage.getItem(DISMISS_KEY_PREFIX + hashImage(item.image))) return false;
      } catch { /* localStorage ปิด — ถือว่ายังไม่ปิด */ }
      return true;
    });
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pos, setPos] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setPos(0);
    if (!queue.length) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [queue]);

  if (location.pathname === '/admin') return null;

  const current = queue[pos];
  if (!current) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY_PREFIX + hashImage(current.image), '1'); } catch { /* noop */ }
    if (pos + 1 < queue.length) {
      // ปิดอันนี้ก่อน แล้วค่อยเด้งอันถัดไป (ให้ exit animation จบก่อน)
      setVisible(false);
      setTimeout(() => { setPos(pos + 1); setVisible(true); }, 280);
    } else {
      setVisible(false);
    }
  };

  const handleImageClick = () => openSafeUrl(current.link);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={close}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute -top-4 -right-4 z-20 w-9 h-9 bg-white text-brand-navy rounded-full flex items-center justify-center shadow-lg hover:bg-brand-neon transition-colors"
              aria-label="ปิด"
            >
              <X size={18} />
            </button>

            {/* Image */}
            <div
              className={`rounded-2xl overflow-hidden shadow-2xl ${current.link ? 'cursor-pointer' : ''}`}
              onClick={handleImageClick}
            >
              <img
                src={current.image}
                alt="ประกาศ"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>

            <div className="flex items-center justify-center gap-3 mt-3">
              {current.link && (
                <p className="text-center text-white/50 text-xs">คลิกที่รูปเพื่อดูรายละเอียด</p>
              )}
              {queue.length > 1 && (
                <p className="text-center text-white/40 text-xs font-medium tabular-nums">
                  {pos + 1} / {queue.length}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
