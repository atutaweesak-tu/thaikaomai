import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { PageBlock } from '../types';
import { openSafeUrl } from '../utils/safeUrl';

// key?: ไม่ได้ใช้จริงในตัว component — ใส่ไว้เฉยๆ เพราะโปรเจกต์นี้ไม่มี @types/react
// TS เลยไม่รู้ว่า "key" เป็น prop พิเศษที่ JSX อนุญาตเสมอ (ต่างจาก component อื่นที่ไม่มี props เลยเลยไม่ชนปัญหานี้)
export default function PromoBannerBlock({ block }: { block: PageBlock; key?: string }) {
  const imgs = useMemo(() => {
    const list = (block.images ?? []).filter(u => typeof u === 'string' && u);
    return list.length ? list : (block.image ? [block.image] : []);
  }, [block.images, block.image]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReduced(!!m?.matches);
    const onChange = () => setReduced(!!m?.matches);
    m?.addEventListener?.('change', onChange);
    return () => m?.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => { setIdx(0); }, [imgs.length]);

  useEffect(() => {
    if (imgs.length <= 1 || paused || reduced) return;
    const t = setInterval(() => setIdx(i => (i + 1) % imgs.length), 5000);
    return () => clearInterval(t);
  }, [imgs.length, paused, reduced]);

  if (!imgs.length && !block.title) return null;

  const handleClick = () => openSafeUrl(block.link);
  const cur = imgs[Math.min(idx, imgs.length - 1)] || '';

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`overflow-hidden rounded-[40px] border border-white/10 bg-white/5 grid grid-cols-1 items-center ${imgs.length ? 'md:grid-cols-2' : ''}`}
        >
          {imgs.length > 0 && (
            <div
              className="relative aspect-[16/9] md:aspect-auto md:h-full md:min-h-[320px] bg-brand-navy"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={idx}
                  src={cur}
                  alt={block.title || ''}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </AnimatePresence>

              {imgs.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {imgs.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`ไปสไลด์ที่ ${i + 1}`}
                      onClick={() => setIdx(i)}
                      className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-brand-neon' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-10 md:p-16">
            {block.title && (
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-[1.15] mb-4">{block.title}</h2>
            )}
            {block.description && (
              <p className="text-white/60 text-lg mb-8">{block.description}</p>
            )}
            {block.link && block.buttonText && (
              <button onClick={handleClick} className="neon-button">
                {block.buttonText} <ArrowRight size={18} />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
