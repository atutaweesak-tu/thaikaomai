import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { PageBlock } from '../types';
import { openSafeUrl } from '../utils/safeUrl';

// key?: ไม่ได้ใช้จริงในตัว component — ใส่ไว้เฉยๆ เพราะโปรเจกต์นี้ไม่มี @types/react
// TS เลยไม่รู้ว่า "key" เป็น prop พิเศษที่ JSX อนุญาตเสมอ (ต่างจาก component อื่นที่ไม่มี props เลยเลยไม่ชนปัญหานี้)
export default function PromoBannerBlock({ block }: { block: PageBlock; key?: string }) {
  if (!block.image && !block.title) return null;

  const handleClick = () => openSafeUrl(block.link);

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`overflow-hidden rounded-[40px] border border-white/10 bg-white/5 grid grid-cols-1 items-center ${block.image ? 'md:grid-cols-2' : ''}`}
        >
          {block.image && (
            <div className="aspect-[16/9] md:aspect-auto md:h-full">
              <img
                src={block.image}
                alt={block.title || ''}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>
          )}
          <div className="p-10 md:p-16">
            {block.title && (
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4">{block.title}</h2>
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
