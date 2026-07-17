import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';

export default function PrivacyPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const { privacy } = settings;

  return (
    <main className="min-h-screen pt-28 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-neon/10 mb-6">
              <ShieldCheck size={32} className="text-brand-neon" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
              นโยบายความเป็นส่วนตัว
            </h1>
            {privacy.updatedAt && (
              <p className="text-white/40 text-sm">อัพเดตล่าสุด: {privacy.updatedAt}</p>
            )}
            <div className="w-16 h-1 bg-brand-neon mx-auto rounded-full mt-4" />
          </div>

          {/* Content */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10">
            <div className="text-white/75 leading-relaxed whitespace-pre-line text-base">
              {privacy.content}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-white/30 text-sm">
              หากมีข้อสงสัย ติดต่อเราได้ที่{' '}
              <a href="/contact" className="text-brand-neon hover:underline">
                หน้าติดต่อ
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
