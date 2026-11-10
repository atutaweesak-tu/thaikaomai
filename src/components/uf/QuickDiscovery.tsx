import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Newspaper, CalendarDays, UserPlus, ArrowUpRight } from 'lucide-react';
import { Reveal } from './shared';

// ทุกการ์ดลิงก์ไป route ที่มีอยู่จริงใน App.tsx — "ร่วมกิจกรรม" ไปที่ section กิจกรรมในหน้าแรก (ยังไม่มีหน้ารวมกิจกรรมแยก)
const CARDS = [
  { title: 'สำรวจนโยบาย', desc: 'ธนู 4 ดอก และนโยบายย่อยทั้งหมด', to: '/policies', icon: Compass, tone: 'lemon' },
  { title: 'ติดตามข่าวสาร', desc: 'ความเคลื่อนไหวล่าสุดของพรรค', to: '/news', icon: Newspaper, tone: 'cyan' },
  { title: 'ร่วมกิจกรรม', desc: 'กิจกรรมที่กำลังจะมาถึงทั่วประเทศ', to: '/#activities', icon: CalendarDays, tone: 'cyan' },
  { title: 'ร่วมเป็นสมาชิก', desc: 'ร่วมก้าวใหม่ไปด้วยกัน', to: '/register', icon: UserPlus, tone: 'lemon' },
] as const;

/** SECTION 03 — Quick Discovery */
export default function QuickDiscovery() {
  return (
    <section id="uf-discovery" aria-label="ทางลัด" className="relative py-10 md:py-14 scroll-mt-20">
      <div className="uf-container">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          {CARDS.map((c, i) => (
            <Reveal as="li" index={i} key={c.title}>
              <Link
                to={c.to}
                className="uf-card uf-card-hover group flex flex-col h-full min-h-[156px] lg:min-h-[220px] p-4 sm:p-5 lg:p-7"
              >
                <span className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center mb-auto transition-colors ${c.tone === 'lemon' ? 'bg-uf-lemon/15 text-uf-lemon group-hover:bg-uf-lemon group-hover:text-uf-bg' : 'bg-uf-cyan/15 text-uf-cyan group-hover:bg-uf-cyan group-hover:text-uf-bg'}`}>
                  <c.icon size={24} aria-hidden />
                </span>
                <span className="mt-4 lg:mt-6 flex items-start justify-between gap-2">
                  <span className="uf-h3 text-uf-text">{c.title}</span>
                  <ArrowUpRight size={20} aria-hidden className="shrink-0 mt-1 text-uf-faint group-hover:text-uf-cyan transition-colors" />
                </span>
                <span className="mt-1.5 text-sm text-uf-muted leading-relaxed">{c.desc}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
