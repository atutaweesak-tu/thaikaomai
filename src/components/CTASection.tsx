import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus } from 'lucide-react';
import { subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';
import AccentUnderline from './AccentUnderline';

export default function CTASection() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const { cta } = settings;

  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="border-t border-white/10 pt-16 text-center"
        >
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-[1.15] mb-4">
            {cta.heading1}{cta.heading2 ? ' ' : ''}
            {cta.heading2 && <AccentUnderline className="text-brand-neon">{cta.heading2}</AccentUnderline>}
          </h2>
          {cta.description && (
            <p className="text-white/50 text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              {cta.description}
            </p>
          )}
          <Link to="/register" className="neon-button text-lg px-8 py-4 inline-flex">
            <UserPlus size={20} /> สมัครสมาชิกพรรค
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
