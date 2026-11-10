import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Search, Newspaper, CalendarDays, BookOpen, Youtube, ArrowRight } from 'lucide-react';
import { MascotImage, openGuide } from './LemonGuide';
import { Reveal } from './shared';

// คำถามแนะนำ — ชุดเดียวกับในแผงผู้ช่วย (ค้นจากเนื้อหาจริง)
const PROMPTS: { label: string; detail: { query?: string; mode?: 'news' | 'events' } }[] = [
  { label: 'นโยบายการศึกษา', detail: { query: 'การศึกษา' } },
  { label: 'นโยบายแก้หนี้', detail: { query: 'หนี้' } },
  { label: 'ข่าวล่าสุด', detail: { mode: 'news' } },
  { label: 'กิจกรรมที่จะถึง', detail: { mode: 'events' } },
];

export type GuideCounts = { policies: number; news: number; events: number; videos: number };

/** SECTION 08 — Lemon Digital Guide V3: "คอนโซลผู้ช่วย" ในหน้าแรก — ตัวผู้ช่วยจริงคือ LemonGuide (ลอยทุกหน้า)
 *  มาสคอต: ยังไม่มีไฟล์ต้นฉบับความละเอียดสูง → GIF เดิมไม่เกิน 2 เท่าในกรอบโฮโลแกรม (ไม่ขยายจนแตก ไม่วาดใหม่)
 *  ตัวเลขจำนวนมาจากข้อมูลที่หน้าโหลดอยู่จริง · ระบุชัดว่าเป็นการค้นหาเนื้อหา ไม่ใช่ AI */
export default function GuideSection({ counts }: { counts: GuideCounts }) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); openGuide({ query: q.trim() }); };
  const stats = [
    { icon: BookOpen, label: 'นโยบาย', n: counts.policies },
    { icon: Newspaper, label: 'ข่าว', n: counts.news },
    { icon: CalendarDays, label: 'กิจกรรม', n: counts.events },
    { icon: Youtube, label: 'คลิป', n: counts.videos },
  ];

  return (
    <section aria-labelledby="uf-guide-section-title" className="uf-section">
      <div className="uf-container">
        <Reveal className="uf-card relative overflow-hidden p-5 sm:p-8 lg:p-10">
          <div aria-hidden className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-uf-lemon/10 blur-[90px]" />
          <div aria-hidden className="absolute -left-20 -bottom-28 w-72 h-72 rounded-full bg-uf-cyan/10 blur-[90px]" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
            {/* ── ซ้าย: อวตารโฮโลแกรม + คำทักทาย ── */}
            {/* มือถือ: อวตาร + คำทักทายวางข้างกัน (ประหยัดความสูง) · เดสก์ท็อป: เรียงบน-ล่าง */}
            <div className="lg:col-span-4 flex flex-row lg:flex-col items-center gap-4 lg:gap-0 lg:text-center">
              <div className="relative shrink-0 w-[128px] h-[128px] lg:w-[184px] lg:h-[184px] flex items-center justify-center">
                <div aria-hidden className="absolute inset-0 rounded-full border border-uf-cyan/30" />
                <div aria-hidden className="absolute inset-[10%] rounded-full border border-dashed border-uf-lemon/30 uf-orbit" style={{ animationDuration: '40s' }} />
                <div aria-hidden className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgba(221,243,75,0.22),rgba(16,45,80,0.6)_60%,transparent_75%)]" />
                <span aria-hidden className="absolute right-[12%] top-[16%] w-2.5 h-2.5 rounded-full bg-uf-cyan uf-glow" />
                <MascotImage maxHeight={98} alt="น้องเลม่อน มาสคอตพรรคไทยก้าวใหม่" className="relative uf-float" />
              </div>
              <motion.p
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="relative lg:mt-3 rounded-2xl rounded-tl-sm bg-uf-surface border border-uf-line px-4 py-2.5 text-sm text-uf-text"
              >
                สวัสดีครับ<br />ให้<span className="whitespace-nowrap">น้องเลม่อน</span>ช่วย<span className="whitespace-nowrap">หาอะไรดี?</span>
              </motion.p>
            </div>

            {/* ── ขวา: คอนโซลค้นหา ── */}
            <div className="lg:col-span-8">
              <p className="uf-eyebrow mb-3"><span aria-hidden className="h-px w-8 bg-uf-cyan" />Lemon Digital Guide</p>
              <h2 id="uf-guide-section-title" className="uf-h2 text-uf-text mb-2">
                ค้นหากับ<span className="whitespace-nowrap">น้องเลม่อน</span> <span className="text-uf-lemon whitespace-nowrap">ครบในที่เดียว</span>
              </h2>
              <p className="uf-body text-uf-muted max-w-xl mb-5">
                ค้นหาจากเนื้อหาจริงบนเว็บไซต์ (ระบบค้นหา ไม่ใช่ AI) — เปิดผู้ช่วยได้ทุกหน้าจากปุ่ม<span className="whitespace-nowrap">น้องเลม่อน</span>มุมขวาล่าง
              </p>

              <form role="search" onSubmit={submit} className="relative mb-4">
                <label htmlFor="uf-guide-inline-q" className="sr-only">ค้นหานโยบาย ข่าว กิจกรรม คลิป</label>
                <Search size={20} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-uf-faint" />
                <input
                  id="uf-guide-inline-q"
                  type="search"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="พิมพ์สิ่งที่อยากรู้ เช่น เรียนฟรี, SME"
                  autoComplete="off"
                  className="w-full h-14 rounded-2xl bg-uf-bg/70 border border-uf-line pl-12 pr-32 text-uf-text placeholder:text-uf-faint focus:outline-none focus:border-uf-cyan"
                />
                <button type="submit" className="uf-btn-primary !min-h-[44px] !py-2 !px-4 absolute right-1.5 top-1/2 -translate-y-1/2 text-sm">
                  ค้นหา <ArrowRight size={16} aria-hidden />
                </button>
              </form>

              <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="คำถามแนะนำ">
                {PROMPTS.map(p => (
                  <button key={p.label} type="button" onClick={() => openGuide(p.detail)} className="rounded-full border border-uf-line px-4 min-h-[40px] text-sm font-bold text-uf-muted hover:text-uf-text hover:border-uf-cyan/60 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>

              <dl className="grid grid-cols-4 gap-2 sm:gap-3">
                {stats.map(s => (
                  <div key={s.label} className="rounded-2xl border border-uf-line bg-uf-bg/40 px-2 py-3 text-center">
                    <dt className="flex items-center justify-center gap-1.5 text-xs text-uf-faint"><s.icon size={14} aria-hidden /> {s.label}</dt>
                    <dd className="text-xl sm:text-2xl font-extrabold text-uf-text tabular-nums mt-0.5">{s.n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
