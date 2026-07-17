import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, Facebook, Twitter, Instagram, Youtube } from 'lucide-react';
import { addContactMessage, subscribeToSiteSettings } from '../services/dataService';
import { SiteSettings, DEFAULT_SETTINGS } from '../types';

export default function ContactPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribeToSiteSettings(setSettings);
    return () => unsub();
  }, []);

  const { contact } = settings;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    if (!EMAIL_RE.test(form.email)) return;
    setStatus('sending');
    try {
      await addContactMessage({ name: form.name, email: form.email, message: `${form.subject ? `[${form.subject}] ` : ''}${form.message}` });
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setStatus('error');
    }
  };

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-20">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
            {settings.pages.contactHeading}
          </h1>
          <p className="text-xl text-white/60 max-w-2xl leading-relaxed">
            {settings.pages.contactDescription}
          </p>
          {settings.pages.contactImage && (
            <div className="mt-10 rounded-[32px] overflow-hidden aspect-[21/7]">
              <img src={settings.pages.contactImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: settings.pages.contactImagePos || '50% 50%' }} referrerPolicy="no-referrer" />
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
              <h2 className="text-3xl font-black tracking-tighter mb-8">ส่งข้อความ</h2>
              {status === 'sent' ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-brand-neon rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send size={32} className="text-brand-navy" />
                  </div>
                  <h3 className="text-2xl font-black mb-4">ส่งข้อความเรียบร้อย!</h3>
                  <p className="text-white/60 mb-8">ทีมงานจะติดต่อกลับหาคุณโดยเร็วที่สุด</p>
                  <button onClick={() => setStatus('idle')} className="neon-button">
                    ส่งข้อความอีกครั้ง
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <fieldset disabled={status === 'sending'} className="space-y-6 disabled:opacity-60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">ชื่อ-นามสกุล *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="ชื่อของคุณ"
                        required maxLength={100}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-neon transition-colors placeholder:text-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-white/60 mb-2">อีเมล *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@example.com"
                        required maxLength={200}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-neon transition-colors placeholder:text-white/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2">หัวข้อ</label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder="หัวข้อข้อความ"
                      maxLength={200}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-neon transition-colors placeholder:text-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2">ข้อความ *</label>
                    <textarea
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="เขียนข้อความของคุณที่นี่..."
                      required maxLength={2000}
                      rows={6}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-brand-neon transition-colors placeholder:text-white/20 resize-none"
                    />
                  </div>
                  </fieldset>
                  {status === 'error' && (
                    <p className="text-red-400 text-sm">{errorMsg || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'}</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="neon-button disabled:opacity-50"
                  >
                    <Send size={18} />
                    {status === 'sending' ? 'กำลังส่ง...' : 'ส่งข้อความ'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-8">
              <h2 className="text-2xl font-black tracking-tighter">ข้อมูลติดต่อ</h2>

              {contact.address && (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-brand-neon/10 rounded-2xl flex items-center justify-center shrink-0">
                    <MapPin size={20} className="text-brand-neon" />
                  </div>
                  <div>
                    <p className="font-bold mb-1">ที่อยู่</p>
                    <p className="text-white/50 text-sm leading-relaxed">{contact.address}</p>
                  </div>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-neon/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Phone size={20} className="text-brand-neon" />
                  </div>
                  <div>
                    <p className="font-bold mb-1">โทรศัพท์</p>
                    <p className="text-white/50 text-sm">{contact.phone}</p>
                  </div>
                </div>
              )}

              {contact.email && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-neon/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Mail size={20} className="text-brand-neon" />
                  </div>
                  <div>
                    <p className="font-bold mb-1">อีเมล</p>
                    <p className="text-white/50 text-sm">{contact.email}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-brand-neon/10 border border-brand-neon/20 rounded-[40px] p-8">
              <h2 className="text-2xl font-black tracking-tighter mb-6">โซเชียลมีเดีย</h2>
              <div className="grid grid-cols-2 gap-4">
                {contact.facebook && (
                  <a href={contact.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white/5 hover:bg-brand-neon hover:text-brand-navy rounded-2xl px-4 py-3 transition-all font-bold text-sm">
                    <Facebook size={18} /> Facebook
                  </a>
                )}
                {contact.twitter && (
                  <a href={contact.twitter} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white/5 hover:bg-brand-neon hover:text-brand-navy rounded-2xl px-4 py-3 transition-all font-bold text-sm">
                    <Twitter size={18} /> Twitter
                  </a>
                )}
                {contact.instagram && (
                  <a href={contact.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white/5 hover:bg-brand-neon hover:text-brand-navy rounded-2xl px-4 py-3 transition-all font-bold text-sm">
                    <Instagram size={18} /> Instagram
                  </a>
                )}
                {contact.youtube && (
                  <a href={contact.youtube} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white/5 hover:bg-brand-neon hover:text-brand-navy rounded-2xl px-4 py-3 transition-all font-bold text-sm">
                    <Youtube size={18} /> YouTube
                  </a>
                )}
              </div>
              {contact.qrCode && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="text-sm font-bold text-white/50">สแกน QR เพื่อติดตาม</p>
                  <img src={contact.qrCode} alt="QR Code" className="w-36 h-36 object-contain rounded-2xl border border-white/10 bg-white p-2" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
