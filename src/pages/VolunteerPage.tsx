import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Check, Heart } from 'lucide-react';
import { addVolunteer } from '../services/dataService';

const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา',
  'ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก',
  'นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน',
  'บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา',
  'พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต',
  'มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี',
  'ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี',
  'สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี',
  'อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];

const EMPTY = { name: '', phone: '', email: '', province: '', skills: '', message: '' };

export default function VolunteerPage() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^[0-9\-+\s]{9,15}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(form.email)) { setError('รูปแบบอีเมลไม่ถูกต้อง'); return; }
    if (!PHONE_RE.test(form.phone)) { setError('รูปแบบเบอร์โทรไม่ถูกต้อง'); return; }
    setLoading(true);
    try {
      await addVolunteer(form);
      setSent(true);
      setForm(EMPTY);
    } catch {
      setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-neon/10 mb-6">
              <Heart size={32} className="text-brand-neon" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
              เป็นอาสาสมัคร
            </h1>
            <p className="text-white/60 text-lg leading-relaxed">
              ร่วมเป็นส่วนหนึ่งในการสร้างการเปลี่ยนแปลง<br />
              ด้วยการเป็นอาสาสมัครของพรรคไทยก้าวใหม่
            </p>
            <div className="w-16 h-1 bg-brand-neon mx-auto rounded-full mt-6" />
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-brand-neon/10 border border-brand-neon/30 rounded-3xl p-12 text-center"
            >
              <Check size={48} className="text-brand-neon mx-auto mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">ขอบคุณที่สมัครอาสาสมัคร!</h2>
              <p className="text-white/60">ทีมงานจะติดต่อกลับภายใน 3-5 วันทำการ</p>
              <button
                onClick={() => setSent(false)}
                className="mt-8 outline-button mx-auto"
              >
                สมัครอีกครั้ง
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-white/60 mb-2">ชื่อ-นามสกุล *</label>
                  <input
                    type="text" value={form.name} required maxLength={100}
                    onChange={e => set('name', e.target.value)}
                    placeholder="ชื่อ นามสกุล"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">เบอร์โทรศัพท์ *</label>
                  <input
                    type="tel" value={form.phone} required maxLength={15}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="08x-xxx-xxxx"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">อีเมล *</label>
                  <input
                    type="email" value={form.email} required maxLength={200}
                    onChange={e => set('email', e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-white/60 mb-2">จังหวัด *</label>
                  <select
                    value={form.province} required
                    onChange={e => set('province', e.target.value)}
                    className="w-full bg-brand-navy border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {PROVINCES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-white/60 mb-2">ทักษะ / ความสามารถพิเศษ</label>
                  <input
                    type="text" value={form.skills} maxLength={300}
                    onChange={e => set('skills', e.target.value)}
                    placeholder="เช่น ออกแบบกราฟิก, เขียนโปรแกรม, พูดในที่สาธารณะ"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-white/60 mb-2">ข้อความเพิ่มเติม</label>
                  <textarea
                    value={form.message} rows={4} maxLength={1000}
                    onChange={e => set('message', e.target.value)}
                    placeholder="บอกเราเพิ่มเติมเกี่ยวกับตัวคุณและแรงบันดาลใจในการเป็นอาสาสมัคร"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-neon transition-colors resize-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit" disabled={loading}
                className="neon-button w-full justify-center text-lg py-4 mt-2"
              >
                {loading ? 'กำลังส่ง...' : <><Send size={20} /> สมัครเป็นอาสาสมัคร</>}
              </button>

              <p className="text-center text-white/30 text-xs">
                การส่งแบบฟอร์มนี้ถือว่าท่านยินยอมให้พรรคไทยก้าวใหม่เก็บและใช้ข้อมูลส่วนบุคคลตาม
                {' '}<a href="/privacy" className="text-brand-neon hover:underline">นโยบายความเป็นส่วนตัว</a>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}
