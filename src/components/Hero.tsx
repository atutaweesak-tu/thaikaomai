import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Play } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';

export default function Hero() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const h = settings.hero;

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-neon/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8">
              <span className="w-2 h-2 bg-brand-neon rounded-full animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase text-white/60">
                {h.badge}
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
              {h.heading1}<br />
              <span className="text-brand-neon">{h.heading2}</span><br />
              {h.heading3}
            </h1>

            <p className="text-xl text-white/60 leading-relaxed mb-10 max-w-lg">
              {h.description}
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/policies" className="neon-button text-lg px-8 py-4">
                {h.buttonPrimary} <ChevronRight />
              </Link>
              <Link to="/team" className="outline-button text-lg px-8 py-4">
                <Play size={20} fill="currentColor" /> {h.buttonSecondary}
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 rounded-[40px] overflow-hidden border border-white/10 aspect-[4/5] bg-brand-navy">
              {h.leaderImage && (
                <img
                  src={h.leaderImage}
                  alt={h.leaderName}
                  className="w-full h-full object-cover transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-brand-navy to-transparent">
                <p className="text-brand-neon font-bold text-sm uppercase tracking-widest mb-2">{h.leaderTitle}</p>
                <h3 className="text-3xl font-black tracking-tighter">{h.leaderName}</h3>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 border-t-4 border-r-4 border-brand-neon rounded-tr-[40px]" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 border-b-4 border-l-4 border-brand-neon rounded-bl-[40px]" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
