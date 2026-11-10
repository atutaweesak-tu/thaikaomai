import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Newspaper } from 'lucide-react';
import { NewsItem } from '../../types';
import { Reveal, SectionHeader } from './shared';

function Cover({ item, className }: { item: NewsItem; className: string }) {
  return (
    <div className={`overflow-hidden bg-uf-surface flex items-center justify-center ${className}`}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <Newspaper size={40} strokeWidth={1} aria-hidden className="text-uf-faint/50" />
      )}
    </div>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
      {item.category && <span className="font-bold text-uf-cyan">{item.category}</span>}
      {item.date && <span className="text-uf-faint">{item.date}</span>}
    </p>
  );
}

/** SECTION 06 — Future Newsroom: ข่าวจริงจาก /api/data/news (กรอง publish window แล้วจาก HomePage) */
export default function Newsroom({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return null;
  const [featured, ...rest] = news;
  const secondary = rest.slice(0, 3);

  return (
    <section id="uf-news" aria-labelledby="uf-news-title" className="uf-section">
      <div className="uf-container">
        <SectionHeader
          id="uf-news-title"
          eyebrow="Newsroom"
          title="ข่าวสาร"
          accent="ความเคลื่อนไหว"
          action={<Link to="/news" className="uf-btn-ghost">ข่าวทั้งหมด <ArrowRight size={18} /></Link>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6">
          <Reveal className="lg:col-span-7">
            <Link to={`/news/${featured.id}`} className="uf-card uf-card-hover group flex flex-col overflow-hidden h-full">
              <Cover item={featured} className="aspect-[16/9]" />
              <div className="p-5 md:p-7">
                <Meta item={featured} />
                <h3 className="uf-h3 text-uf-text mb-2 line-clamp-3 lg:line-clamp-2 group-hover:text-uf-lemon transition-colors">{featured.title}</h3>
                {featured.summary && <p className="uf-body text-uf-muted line-clamp-2">{featured.summary}</p>}
              </div>
            </Link>
          </Reveal>

          {secondary.length > 0 && (
            // มือถือ: เลื่อนแนวนอน · เดสก์ท็อป: สูงเท่าการ์ดข่าวเด่นพอดี (h-0 + min-h-full = ใช้ความสูงแถวจากการ์ดเด่น
            // ไม่ให้รูปขยายแถว) แล้วแบ่งเป็นแถวเท่ากัน minmax(0,1fr) — รูปไม่ดันความสูงการ์ด
            <ul className="lg:col-span-5 uf-scroll-x gap-3 -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:auto-rows-[minmax(0,1fr)] lg:h-0 lg:min-h-full lg:overflow-visible lg:gap-6">
              {secondary.map((item, i) => (
                <Reveal as="li" index={i + 1} key={item.id} className="shrink-0 w-[78%] sm:w-[48%] lg:w-auto lg:min-h-0">
                  <Link to={`/news/${item.id}`} className="uf-card uf-card-hover group flex flex-col lg:flex-row overflow-hidden h-full">
                    <Cover item={item} className="aspect-[16/9] lg:aspect-auto lg:w-[40%] lg:h-full shrink-0" />
                    <div className="p-4 lg:p-5 min-w-0 flex flex-col justify-center">
                      <Meta item={item} />
                      <h3 className="text-base lg:text-[17px] font-bold leading-snug text-uf-text line-clamp-3 lg:line-clamp-2 group-hover:text-uf-lemon transition-colors">{item.title}</h3>
                      {/* line-clamp ต้องการ display:-webkit-box — ห้ามใช้ xl:block (จะทำให้ clamp ไม่ทำงาน การ์ดสูงไม่เท่ากัน) */}
                      {item.summary && <p className="max-xl:hidden text-sm text-uf-muted mt-1.5 line-clamp-2">{item.summary}</p>}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
