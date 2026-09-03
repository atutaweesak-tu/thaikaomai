import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone, Send, Check, UserPlus } from 'lucide-react';
import { subscribeToSiteSettings, addNewsletterSubscriber } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';
import { isSafeHttpUrl } from '../utils/safeUrl';
import Honeypot from './Honeypot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const { contact, footer } = settings;

  const subscribe = async () => {
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
    <footer className="bg-white/[0.02] border-t border-white/10 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img src="/tkm-logo.png" alt="ไทยก้าวใหม่" className="h-12 w-auto" loading="lazy" />
            </Link>
            <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-md">
              {footer.description}
            </p>
            <div className="flex gap-4">
              <a href={isSafeHttpUrl(contact.facebook) ? contact.facebook : '#'} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-brand-neon hover:text-brand-navy transition-all">
                <Facebook size={18} />
              </a>
              <a href={isSafeHttpUrl(contact.twitter) ? contact.twitter : '#'} target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-brand-neon hover:text-brand-navy transition-all">
                <Twitter size={18} />
              </a>
              <a href={isSafeHttpUrl(contact.instagram) ? contact.instagram : '#'} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-brand-neon hover:text-brand-navy transition-all">
                <Instagram size={18} />
              </a>
              <a href={isSafeHttpUrl(contact.youtube) ? contact.youtube : '#'} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-brand-neon hover:text-brand-navy transition-all">
                <Youtube size={18} />
              </a>
            </div>
          </div>

          {/* Newsletter + สมัครสมาชิก */}
          <div>
            <h4 className="font-bold mb-6">ติดตามข่าวสาร</h4>
            {sent ? (
              <p className="text-brand-neon text-sm font-bold flex items-center gap-2">
                <Check size={16} /> สมัครรับข่าวสารแล้ว ขอบคุณ!
              </p>
            ) : (
              <form onSubmit={e => { e.preventDefault(); subscribe(); }} className="space-y-3">
                <Honeypot value={website} onChange={setWebsite} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="อีเมลของคุณ"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="neon-button w-full justify-center text-sm py-2.5 disabled:opacity-50"
                >
                  {loading ? 'กำลังส่ง...' : (<>รับข่าวสาร <Send size={15} /></>)}
                </button>
              </form>
            )}
            <Link
              to="/register"
              className="mt-5 inline-flex items-center gap-2 text-brand-neon text-sm font-bold hover:gap-3 transition-all"
            >
              <UserPlus size={15} /> สมัครสมาชิกพรรค
            </Link>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold mb-6">ติดต่อพรรค</h4>
            <ul className="space-y-4 text-sm text-white/50">
              {contact.address && (
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-brand-neon shrink-0" />
                  <span>{contact.address}</span>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-brand-neon shrink-0" />
                  <span>{contact.phone}</span>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-brand-neon shrink-0" />
                  <span>{contact.email}</span>
                </li>
              )}
            </ul>
            {contact.qrCode && (
              <div className="mt-6">
                <p className="text-xs text-white/30 mb-2">สแกน QR เพื่อติดตาม</p>
                <img src={contact.qrCode} alt="QR Code" className="w-24 h-24 object-contain rounded-xl border border-white/10 bg-white p-1.5" loading="lazy" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 pt-10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
          <p>{footer.copyright}</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">นโยบายความเป็นส่วนตัว</Link>
            <Link to="/register" className="hover:text-white transition-colors">สมัครสมาชิก</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
