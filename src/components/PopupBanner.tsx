import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';
import { openSafeUrl } from '../utils/safeUrl';

const DISMISS_KEY_PREFIX = 'tkm_popup_dismissed_';

// hash รูปเป็น key สั้นๆ แทนใช้ base64 เต็มๆ (รูปที่อัพโหลดจาก admin อาจยาวหลายร้อย KB) —
// ผูก key กับเนื้อหารูป ไม่ใช่ key ตายตัว เพื่อให้ popup ใหม่ (รูปเปลี่ยน) ยังเด้งได้แม้เคยปิดอันเก่าไปแล้ว
function hashImage(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return hash.toString(36);
}

export default function PopupBanner() {
  const location = useLocation();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const popupKey = settings.popup.image ? DISMISS_KEY_PREFIX + hashImage(settings.popup.image) : '';

  useEffect(() => {
    const { enabled, image, startDate, endDate } = settings.popup ?? {};
    if (!enabled || !image) { setVisible(false); return; }
    if (popupKey && localStorage.getItem(popupKey)) { setVisible(false); return; } // เคยกดปิดอันนี้ไปแล้ว ไม่เด้งซ้ำ

    const now = new Date();
    if (startDate && now < new Date(startDate)) { setVisible(false); return; }
    if (endDate && now > new Date(endDate)) { setVisible(false); return; }

    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [settings.popup, popupKey]);

  if (location.pathname === '/admin') return null;

  const close = () => {
    if (popupKey) localStorage.setItem(popupKey, '1');
    setVisible(false);
  };

  const handleImageClick = () => openSafeUrl(settings.popup.link);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
              className={`rounded-2xl overflow-hidden shadow-2xl ${settings.popup.link ? 'cursor-pointer' : ''}`}
              onClick={handleImageClick}
            >
              <img
                src={settings.popup.image}
                alt="ประกาศ"
                className="w-full h-auto block"
              />
            </div>

            {settings.popup.link && (
              <p className="text-center text-white/50 text-xs mt-3">
                คลิกที่รูปเพื่อดูรายละเอียด
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
