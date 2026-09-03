import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Send, Check, UserPlus } from 'lucide-react';
import { addNewsletterSubscriber, subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';
import Honeypot from './Honeypot';
import AccentUnderline from './AccentUnderline';

export default function CTASection() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleSubscribe = async () => {
    if (!email || !EMAIL_RE.test(email)) return;
    setLoading(true);
    try {
      await addNewsletterSubscriber(email, website);
      setSent(true);
      setEmail('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-brand-neon/5 blur-[120px] rounded-full translate-y-1/2" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-brand-neon rounded-[60px] p-12 md:p-24 text-brand-navy"
        >
          <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[1.05] mb-8">
            {settings.cta.heading1}<br />
            <AccentUnderline barClassName="bg-brand-navy/30">{settings.cta.heading2}</AccentUnderline>
          </h2>
          <p className="text-brand-navy/70 text-xl md:text-2xl font-medium mb-12 max-w-2xl mx-auto">
            {settings.cta.description}
          </p>

          {sent ? (
            <div className="flex items-center justify-center gap-3 text-brand-navy font-black text-xl">
              <Check size={28} /> ขอบคุณที่สมัคร! เราจะส่งข่าวสารให้คุณเร็วๆ นี้
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-4 justify-center max-w-lg mx-auto">
              <Honeypot value={website} onChange={setWebsite} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ"
                className="bg-white/20 border border-brand-navy/10 rounded-full px-8 py-4 text-brand-navy placeholder:text-brand-navy/40 focus:outline-none focus:bg-white/30 transition-all flex-1"
              />
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="bg-brand-navy text-brand-neon font-black px-10 py-4 rounded-full hover:bg-brand-navy/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? 'กำลังส่ง...' : (<>ร่วมพรรค <Send size={20} /></>)}
              </button>
            </div>
          )}

          <p className="mt-8 text-sm font-bold uppercase tracking-widest opacity-40">
            ไม่มีสแปม มีแต่ความก้าวหน้า
          </p>

          <div className="mt-10 pt-10 border-t border-brand-navy/20">
            <p className="text-brand-navy/70 font-medium mb-5">
              พร้อมเป็นส่วนหนึ่งของพรรคไทยก้าวใหม่?
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 border-2 border-brand-navy text-brand-navy font-black px-8 py-4 rounded-full hover:bg-brand-navy hover:text-brand-neon transition-all duration-200"
            >
              <UserPlus size={20} />
              สมัครสมาชิกพรรค
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
