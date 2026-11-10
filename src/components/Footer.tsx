import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone, Send, Check, UserPlus, ArrowRight } from 'lucide-react';
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
  const showCta = isSafeHttpUrl(footer.ctaUrl);

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

  // แสดงเฉพาะช่องทางที่ตั้งลิงก์จริงไว้ (ค่า "#" = ยังไม่มีช่องทางนั้น)
  const socials = [
    { url: contact.facebook, label: 'Facebook', icon: Facebook },
    { url: contact.twitter, label: 'X (Twitter)', icon: Twitter },
    { url: contact.instagram, label: 'Instagram', icon: Instagram },
    { url: contact.youtube, label: 'YouTube', icon: Youtube },
  ].filter(s => isSafeHttpUrl(s.url));

  return (
    <footer className="uf-footer bg-uf-bg border-t border-uf-line pt-16 md:pt-20 pb-10">
      <div className="uf-container">
        {/* มือถือ 1 คอลัมน์ · แท็บเล็ต 2 คอลัมน์ · เดสก์ท็อป 12 คอลัมน์ — เดิม 12 คอลัมน์ตั้งแต่ 768px ทำให้คอลัมน์ติดต่อแคบจนอีเมลล้นจอ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-6">
            <Link to="/" className="inline-flex mb-5" aria-label="พรรคไทยก้าวใหม่ — หน้าแรก">
              <img src="/tkm-logo.png" alt="ไทยก้าวใหม่" width={56} height={56} className="h-14 w-auto" loading="lazy" />
            </Link>
            <p className="text-uf-muted text-sm leading-relaxed mb-6 max-w-sm">{footer.description}</p>
            {socials.length > 0 && (
              <ul className="flex gap-3" aria-label="ช่องทางโซเชียลของพรรค">
                {socials.map(s => (
                  <li key={s.label}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="w-11 h-11 rounded-full border border-uf-line flex items-center justify-center text-uf-muted hover:bg-uf-lemon hover:text-uf-bg hover:border-uf-lemon transition-colors">
                      <s.icon size={18} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ปุ่มลิงก์ (admin ตั้งได้) หรือ Newsletter + ติดต่อ */}
          <div className="lg:col-start-9 lg:col-span-4">
            <h3 className="text-sm font-bold text-uf-text mb-4">{showCta ? (footer.ctaHeading || 'เปิดรับสมัคร') : 'ติดตามข่าวสาร'}</h3>
            {showCta ? (
              <a href={footer.ctaUrl} target="_blank" rel="noopener noreferrer" className="uf-btn-primary w-full text-sm text-center">
                {/* ตัดบรรทัดเฉพาะตรงช่องว่างที่ admin ใส่ — ภาษาไทยไม่มีเว้นวรรค เบราว์เซอร์จึงอาจตัดกลางคำ (เช่น "ไทยก้าว/ใหม่") */}
                <span>
                  {(footer.ctaLabel || 'สมัครเลย').split(/\s+/).map((w, i) => (
                    <React.Fragment key={i}>{i > 0 && ' '}<span className="whitespace-nowrap">{w}</span></React.Fragment>
                  ))}
                </span>
                <ArrowRight size={15} className="shrink-0" aria-hidden />
              </a>
            ) : sent ? (
              <p className="text-uf-lemon text-sm font-bold flex items-center gap-2">
                <Check size={16} /> สมัครรับข่าวสารแล้ว ขอบคุณ!
              </p>
            ) : (
              <form onSubmit={e => { e.preventDefault(); subscribe(); }} className="space-y-3">
                <Honeypot value={website} onChange={setWebsite} />
                <label htmlFor="uf-footer-email" className="sr-only">อีเมล</label>
                <input
                  id="uf-footer-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="อีเมลของคุณ"
                  className="w-full h-12 bg-uf-surface/50 border border-uf-line rounded-xl px-4 text-uf-text text-sm placeholder:text-uf-faint focus:outline-none focus:border-uf-cyan transition-colors"
                />
                <button type="submit" disabled={loading} className="uf-btn-primary w-full text-sm disabled:opacity-50">
                  {loading ? 'กำลังส่ง...' : (<>รับข่าวสาร <Send size={15} /></>)}
                </button>
              </form>
            )}
            <ul className="space-y-3 text-sm text-uf-muted mt-6">
              {contact.address && <li className="flex items-start gap-2.5"><MapPin size={16} className="text-uf-cyan shrink-0 mt-0.5" /><span>{contact.address}</span></li>}
              {contact.phone && <li className="flex items-center gap-2.5"><Phone size={16} className="text-uf-cyan shrink-0" /><span>{contact.phone}</span></li>}
              {contact.email && <li className="flex items-center gap-2.5 min-w-0"><Mail size={16} className="text-uf-cyan shrink-0" /><a href={`mailto:${contact.email}`} className="hover:text-uf-text break-all">{contact.email}</a></li>}
            </ul>
            {contact.qrCode && (
              <div className="mt-5">
                <p className="text-xs text-uf-faint mb-2">สแกน QR เพื่อติดตาม</p>
                <img src={contact.qrCode} alt="QR Code" className="w-24 h-24 object-contain rounded-xl border border-uf-line bg-white p-1.5" loading="lazy" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-uf-line pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-uf-faint">
          <p>{footer.copyright}</p>
          {/* เมนูหลักอยู่ที่ Navbar แล้ว — ที่นี่เหลือเฉพาะหน้าที่ไม่มีทางเข้าจากที่อื่น (โพล/อาสาสมัคร) + ลิงก์มาตรฐาน */}
          <nav aria-label="ลิงก์ท้ายเว็บ" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/polls" className="hover:text-uf-text transition-colors">โพลความคิดเห็น</Link>
            <Link to="/volunteer" className="hover:text-uf-text transition-colors">อาสาสมัคร</Link>
            <Link to="/privacy" className="hover:text-uf-text transition-colors">นโยบายความเป็นส่วนตัว</Link>
            <Link to="/register" className="hover:text-uf-text transition-colors inline-flex items-center gap-1.5"><UserPlus size={13} aria-hidden /> สมัครสมาชิก</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
