import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { POLICIES as FALLBACK_POLICIES } from '../constants';
import { subscribeToPolicies } from '../services/dataService';
import { Policy } from '../types';

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
    <section className="py-24 bg-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
              ธนู 4 ดอก <br />
              <span className="text-brand-neon">นโยบายพรรค</span>
            </h2>
            <p className="text-white/50 text-lg">
              4 นโยบายหลักที่ออกแบบมาเพื่อแก้ปัญหาสำคัญของประเทศ สร้างประเทศไทยให้แข็งแกร่งและทัดเทียมระดับโลก
            </p>
          </div>
          <Link to="/policies" className="outline-button">
            ดูนโยบายทั้งหมด {visiblePolicies.length > 4 ? `${visiblePolicies.length} นโยบาย` : ''} <ArrowRight size={18} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {homePolices.map((policy, index) => {
            const IconComponent = (Icons as any)[policy.icon];
            return (
              <motion.div
                key={policy.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bento-card group"
              >
                <div className="w-14 h-14 bg-brand-neon/10 rounded-2xl flex items-center justify-center text-brand-neon mb-6 group-hover:bg-brand-neon group-hover:text-brand-navy transition-all duration-300 overflow-hidden">
                  {policy.iconImage
                    ? <img src={policy.iconImage} alt={policy.title} className="w-full h-full object-cover" loading="lazy" />
                    : IconComponent ? <IconComponent size={28} /> : null}
                </div>
                <h3 className="text-xl font-bold mb-4 tracking-tight">{policy.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">
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
