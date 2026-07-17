import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const NOTICE_KEY = 'tkm_site_notice_ack';

export default function SiteNoticeBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(NOTICE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(NOTICE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(NOTICE_KEY, 'declined');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[150]"
        >
          <div className="bg-brand-navy border border-white/15 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Cookie size={18} className="text-brand-neon shrink-0" />
                <p className="font-bold text-sm text-white">การใช้คุกกี้</p>
              </div>
              <button onClick={decline} className="text-white/30 hover:text-white transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <p className="text-white/55 text-xs leading-relaxed mb-4">
              เว็บไซต์นี้ใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งาน
              ตาม <Link to="/privacy" onClick={accept} className="text-brand-neon hover:underline">นโยบายความเป็นส่วนตัว</Link>{' '}
              ของพรรคไทยก้าวใหม่ (PDPA)
            </p>
            <div className="flex gap-2">
              <button
                onClick={accept}
                className="flex-1 bg-brand-neon text-brand-navy text-xs font-black px-4 py-2.5 rounded-xl hover:bg-brand-accent transition-colors"
              >
                ยอมรับทั้งหมด
              </button>
              <button
                onClick={decline}
                className="flex-1 border border-white/15 text-white/60 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                ปฏิเสธ
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
