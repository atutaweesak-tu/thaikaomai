import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Play } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';

const SLIDE_INTERVAL_MS = 5000;

export default function Hero() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const h = settings.hero;
  const isFull = h.layout === 'full';
  // รูปเดียว (leaderImage) คือของเดิมก่อนมี carousel — เก็บไว้ให้ล้มเหลวปลอดภัยถ้ายังไม่ได้ตั้งค่า leaderImages ใหม่
  const images = h.leaderImages && h.leaderImages.length > 0 ? h.leaderImages : (h.leaderImage ? [h.leaderImage] : []);

  useEffect(() => {
    setSlide(s => (s >= images.length ? 0 : s));
  }, [images.length]);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => setSlide(s => (s + 1) % images.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  const headingLines = [
    { key: 'heading1' as const, text: h.heading1, extraClass: '' },
    { key: 'heading2' as const, text: h.heading2, extraClass: 'text-brand-neon' },
    { key: 'heading3' as const, text: h.heading3, extraClass: '' },
  ].filter(l => h.textStyle?.[l.key]?.visible !== false);

  const content = (
    <motion.div
      initial={{ opacity: 0, x: isFull ? 0 : -30, y: isFull ? 20 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {h.textStyle?.badge?.visible !== false && (
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8">
          <span className="w-2 h-2 bg-brand-neon rounded-full animate-pulse" />
          <span
            className={`${h.textStyle?.badge?.fontSize || 'text-xs'} font-bold tracking-widest uppercase text-white/60`}
            style={h.textStyle?.badge?.color ? { color: h.textStyle.badge.color } : undefined}
          >
            {h.badge}
          </span>
        </div>
      )}

      {headingLines.length > 0 && (
        <h1 className="font-black tracking-tighter leading-[0.9] mb-8">
          {headingLines.map((line, i) => {
            const ts = h.textStyle?.[line.key];
            return (
              <React.Fragment key={line.key}>
                <span
                  className={`${ts?.fontSize || 'text-6xl md:text-8xl'} ${line.extraClass}`}
                  style={ts?.color ? { color: ts.color } : undefined}
                >
                  {line.text}
                </span>
                {i < headingLines.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </h1>
      )}

      {h.textStyle?.description?.visible !== false && (
        <p
          className={`${h.textStyle?.description?.fontSize || 'text-xl'} text-white/60 leading-relaxed mb-10 ${isFull ? 'max-w-2xl' : 'max-w-lg'}`}
          style={h.textStyle?.description?.color ? { color: h.textStyle.description.color } : undefined}
        >
          {h.description}
        </p>
      )}

      <div className="flex flex-wrap gap-4">
        <Link to={h.buttonPrimaryLink || '/policies'} className="neon-button text-lg px-8 py-4">
          {h.buttonPrimary} <ChevronRight />
        </Link>
        <Link to={h.buttonSecondaryLink || '/team'} className="outline-button text-lg px-8 py-4">
          <Play size={20} fill="currentColor" /> {h.buttonSecondary}
        </Link>
      </div>
    </motion.div>
  );

  const carousel = images.length > 0 && (
    <AnimatePresence mode="wait">
      <motion.img
        key={slide}
        src={images[slide]}
        alt={h.leaderName}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </AnimatePresence>
  );

  const dots = images.length > 1 && (
    <div className="absolute top-4 right-4 z-10 flex gap-1.5">
      {images.map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${i === slide ? 'bg-brand-neon' : 'bg-white/30'}`}
        />
      ))}
    </div>
  );

  if (isFull) {
    return (
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-brand-navy">
          {carousel}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/80 to-brand-navy/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/90 via-brand-navy/40 to-transparent" />
        </div>
        {dots}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-32 pb-20 w-full">
          <div className="max-w-2xl">
            {content}
            {(h.leaderName || h.leaderTitle) && (
              <div className="mt-10 pt-8 border-t border-white/10">
                <p className="text-brand-neon font-bold text-sm uppercase tracking-widest mb-1">{h.leaderTitle}</p>
                <h3 className="text-2xl font-black tracking-tighter">{h.leaderName}</h3>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-neon/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-blue-500/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {content}

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 rounded-[40px] overflow-hidden border border-white/10 aspect-[4/5] bg-brand-navy">
              {carousel}
              {dots}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-brand-navy to-transparent z-10">
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
