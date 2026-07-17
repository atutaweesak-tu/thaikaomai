import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Landmark, Eye, Heart } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';

export default function AboutPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const { about } = settings;

  const sections = [
    {
      icon: Landmark,
      label: 'ประวัติความเป็นมา',
      content: about.history,
    },
    {
      icon: Heart,
      label: 'อุดมการณ์พรรค',
      content: about.ideology,
    },
    {
      icon: Eye,
      label: 'วิสัยทัศน์',
      content: about.vision,
    },
  ];

  return (
    <main className="min-h-screen pt-28 pb-24">
      {/* Hero Banner */}
      {about.image && (
        <div className="relative h-64 md:h-96 mb-16 overflow-hidden">
          <img
            src={about.image}
            alt="เกี่ยวกับพรรค"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/60 via-brand-navy/30 to-brand-navy" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <p className="text-brand-neon text-sm font-black uppercase tracking-widest mb-4">
            พรรคไทยก้าวใหม่
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4">
            เกี่ยวกับพรรค
          </h1>
          <div className="w-16 h-1 bg-brand-neon mx-auto rounded-full" />
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-8">
          {sections.map(({ icon: Icon, label, content }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-brand-neon/10 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-brand-neon" />
                </div>
                <h2 className="text-xl font-black text-white">{label}</h2>
              </div>
              <p className="text-white/70 leading-relaxed whitespace-pre-line text-base md:text-lg">
                {content}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
