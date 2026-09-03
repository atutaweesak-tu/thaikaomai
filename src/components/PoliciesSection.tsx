import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { POLICIES as FALLBACK_POLICIES } from '../constants';
import { subscribeToPolicies } from '../services/dataService';
import { Policy } from '../types';
import AccentUnderline from './AccentUnderline';

export default function PoliciesSection() {
  const [policies, setPolicies] = useState<Policy[]>(FALLBACK_POLICIES);

  useEffect(() => {
    const unsub = subscribeToPolicies((data) => {
      if (data.length > 0) setPolicies(data);
    });
    return () => unsub();
  }, []);

  const visiblePolicies = [...policies].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).filter(p => {
    if (p.published === false) return false;
    const now = new Date();
    if (p.publishAt && new Date(p.publishAt) > now) return false;
    if (p.unpublishAt && new Date(p.unpublishAt) < now) return false;
    return true;
  });

  const featured = visiblePolicies.filter(p => p.featuredHome === true).slice(0, 4);
  const homePolices = featured.length > 0 ? featured : visiblePolicies.slice(0, 4);

  return (
    <section className="py-24 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.15] mb-6">
              ธนู 4 ดอก <br />
              <AccentUnderline className="text-brand-neon">นโยบายพรรค</AccentUnderline>
            </h2>
            <p className="text-white/50 text-lg">
              4 นโยบายหลักที่ออกแบบมาเพื่อแก้ปัญหาสำคัญของประเทศ สร้างประเทศไทยให้แข็งแกร่งและทัดเทียมระดับโลก
            </p>
          </div>
          <Link to="/policies" className="outline-button">
            ดูนโยบายทั้งหมด {visiblePolicies.length > 4 ? `${visiblePolicies.length} นโยบาย` : ''} <ArrowRight size={18} />
          </Link>
        </div>

        {/* มือถือ: เลื่อนซ้าย-ขวาแบบ snap แทน stack เต็มความกว้างทีละใบ — จอ md ขึ้นไปกลับไปใช้ grid ปกติ */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
          {homePolices.map((policy, index) => {
            const IconComponent = (Icons as any)[policy.icon];
            return (
              <motion.div
                key={policy.id}
                initial={{ opacity: 0, y: 24, x: -6 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                transition={{ delay: index * 0.09, duration: 0.5, ease: 'easeOut' }}
                viewport={{ once: true }}
                className="bento-card group relative overflow-hidden shrink-0 w-[80%] snap-center md:w-auto md:shrink"
              >
                {/* เลขลำดับธนู (ธนูดอกที่ N) — จางๆ เป็นพื้นหลัง */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3 right-1 text-[5rem] leading-none font-black text-white/[0.045] group-hover:text-brand-neon/10 transition-colors duration-300 select-none"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="relative w-14 h-14 bg-brand-neon/10 rounded-2xl flex items-center justify-center text-brand-neon mb-6 group-hover:bg-brand-neon group-hover:text-brand-navy group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 overflow-hidden">
                  {policy.iconImage
                    ? <img src={policy.iconImage} alt={policy.title} className="w-full h-full object-cover" loading="lazy" />
                    : IconComponent ? <IconComponent size={28} /> : null}
                </div>
                <h3 className="relative text-xl font-bold mb-4 tracking-tight leading-snug">{policy.title}</h3>
                <p className="relative text-white/50 text-sm leading-relaxed">
                  {policy.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
