import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Search, BookOpen, Newspaper, CalendarDays, Youtube, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { fetchCollectionOnce } from '../../services/dataService';
import { EventItem, NewsItem, Policy, VideoItem } from '../../types';
import { matchesQuery } from '../../utils/policies';
import { eventStatus } from '../../utils/bangkokTime';
import { extractYouTubeId } from '../../utils/youtube';

/** มาสคอตทางการ "น้องเลม่อน" — ห้ามดัดแปลงรูปลักษณ์
 *  ตอนนี้มีแค่ GIF 27×49px (ไฟล์เคอร์เซอร์เดิม) → แสดงได้ไม่เกิน 2 เท่าแบบ pixel ตรง (ไม่ขยายจนแตก)
 *  เมื่อทีมส่งไฟล์ต้นฉบับ: วางใน public/mascot/ แล้วใส่ path ที่ MASCOT_HIRES_SRC (PNG/WebP พื้นโปร่งใส สูง ≥ 800px)
 *  รายการ asset ที่ต้องใช้ ดู docs/CHANGELOG_ULTRA_FUTURE.md → Asset ที่ยังขาด */
export const MASCOT_SRC = '/nong-lemon-cursor.gif';
const MASCOT_GIF_SIZE = { width: 27, height: 49 };
export const MASCOT_HIRES_SRC: string | null = null;

/** แสดงมาสคอตสูงไม่เกิน maxHeight — ไฟล์ความละเอียดสูง (ถ้ามี) หรือ GIF ที่ขนาดจริง/ย่อ/ขยายจำนวนเต็มเท่า (สูงสุด 2×) */
export function MascotImage({ maxHeight, alt = '', className = '' }: { maxHeight: number; alt?: string; className?: string }) {
  if (MASCOT_HIRES_SRC) {
    return <img src={MASCOT_HIRES_SRC} alt={alt} style={{ height: maxHeight, width: 'auto' }} className={className} />;
  }
  const { width, height } = MASCOT_GIF_SIZE;
  // เล็กกว่าขนาดจริง = ย่อ (คมอยู่แล้ว) · ใหญ่กว่า = ขยายเป็นจำนวนเต็มเท่า ≤ 2 แบบ pixelated (ขอบพิกเซลคม ไม่เบลอ)
  const scale = maxHeight < height ? maxHeight / height : Math.min(2, Math.floor(maxHeight / height));
  return (
    <img
      src={MASCOT_SRC}
      alt={alt}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      className={`${scale > 1 ? '[image-rendering:pixelated]' : ''} ${className}`}
    />
  );
}

const OPEN_EVENT = 'tkm:open-guide';
type Mode = 'search' | 'news' | 'events';

/** เปิดผู้ช่วยจากที่ไหนก็ได้ (Navbar ปุ่มค้นหา, section 08) */
export function openGuide(detail: { query?: string; mode?: Mode } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

const GUIDED: { label: string; query?: string; mode?: Mode; to?: string }[] = [
  { label: 'นโยบายการศึกษามีอะไรบ้าง?', query: 'การศึกษา' },
  { label: 'นโยบายแก้หนี้', query: 'หนี้' },
  { label: 'ข่าวล่าสุดของพรรค', mode: 'news' },
  { label: 'กิจกรรมที่กำลังจะมาถึง', mode: 'events' },
  { label: 'สมัครสมาชิกพรรคได้อย่างไร?', to: '/register' },
];

type Data = { policies: Policy[]; news: NewsItem[]; events: EventItem[]; videos: VideoItem[] };

const isLive = (i: { published?: boolean; publishAt?: string; unpublishAt?: string }, now: number) =>
  i.published !== false && !(i.publishAt && new Date(i.publishAt).getTime() > now) && !(i.unpublishAt && new Date(i.unpublishAt).getTime() < now);

/** SECTION 08 (ส่วนลอย) — ผู้ช่วยค้นหาจากเนื้อหาที่มีอยู่จริงในเว็บ (ไม่ใช่ AI — ยังไม่มีแหล่งความรู้ที่อนุมัติ) */
export default function LemonGuide() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('search');
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      returnFocus.current = document.activeElement as HTMLElement;
      setQuery(d.query ?? '');
      setMode(d.mode ?? 'search');
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  // โหลดข้อมูลครั้งแรกที่เปิดแผง (ไม่ poll)
  const load = () => {
    setStatus('loading');
    Promise.all([
      fetchCollectionOnce<Policy>('policies'), fetchCollectionOnce<NewsItem>('news'),
      fetchCollectionOnce<EventItem>('events'), fetchCollectionOnce<VideoItem>('videos'),
    ])
      .then(([policies, news, events, videos]) => { setData({ policies, news, events, videos }); setStatus('ready'); })
      .catch(() => setStatus('error'));
  };
  useEffect(() => { if (open && status === 'idle') load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const prevOverflow = document.body.style.overflow;
    if (window.matchMedia('(max-width: 767px)').matches) document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      // focus trap แบบง่าย — วน Tab อยู่ในแผง
      if (e.key === 'Tab' && panelRef.current) {
        const els = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setOpen(false);
    (returnFocus.current || triggerRef.current)?.focus?.();
  };

  const results = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const q = query.trim();
    const policies = data.policies.filter(p => isLive(p, now)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const news = data.news.filter(n => isLive(n, now));
    const events = data.events.filter(e => isLive(e, now));
    const videos = data.videos.filter(v => isLive(v, now) && extractYouTubeId(v.url));
    if (!q && mode === 'news') return { policies: [], news: news.slice(0, 6), events: [], videos: [] };
    if (!q && mode === 'events') return { policies: [], news: [], videos: [], events: events.filter(e => ['upcoming', 'ongoing', 'tba'].includes(eventStatus(e))).slice(0, 6) };
    if (!q) return null;
    return {
      policies: policies.filter(p => matchesQuery(`${p.title} ${p.description}`, q)).slice(0, 5),
      news: news.filter(n => matchesQuery(`${n.title} ${n.summary} ${n.category}`, q)).slice(0, 5),
      events: events.filter(e => matchesQuery(`${e.title} ${e.location} ${e.content || ''}`, q)).slice(0, 5),
      videos: videos.filter(v => matchesQuery(`${v.title} ${v.category || ''}`, q)).slice(0, 5),
    };
  }, [data, query, mode]);

  const count = results ? results.policies.length + results.news.length + results.events.length + results.videos.length : 0;

  if (location.pathname === '/admin') return null;

  return (
    <div className="uf-guide">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openGuide())}
        aria-label="เปิดผู้ช่วยค้นหา น้องเลม่อน"
        aria-expanded={open}
        className="uf-guide-fab fixed z-40 right-4 bottom-4 md:right-6 md:bottom-6 w-[52px] h-[52px] md:w-16 md:h-16 rounded-full bg-uf-surface border border-uf-lemon/50 shadow-[0_10px_30px_-8px_rgba(221,243,75,0.55)] flex items-center justify-center hover:scale-105"
      >
        {/* GIF ขนาดจริง 49px บนเดสก์ท็อป, ย่อเป็น 40px บนมือถือ (ปุ่ม 52px) — ไม่ขยาย */}
        <MascotImage maxHeight={49} className="h-10 w-auto md:h-[49px]" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-uf-bg/60 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
              onClick={close}
              aria-hidden
            />
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="uf-guide-title"
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              // มือถือ: bottom sheet · เดสก์ท็อป: การ์ดลอยมุมขวาล่าง เหนือปุ่ม
              className="fixed z-[61] inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl md:inset-x-auto md:right-6 md:bottom-28 md:w-[420px] md:max-h-[min(640px,calc(100vh-160px))] md:rounded-3xl uf-glass !bg-uf-bg/95 flex flex-col shadow-2xl"
            >
              <div className="md:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-uf-line" aria-hidden />
              <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                <MascotImage maxHeight={40} />
                <div className="flex-1">
                  <p id="uf-guide-title" className="font-bold text-uf-text leading-tight">น้องเลม่อน</p>
                  <p className="text-xs text-uf-faint">ค้นหานโยบาย ข่าว กิจกรรม และคลิปจากเนื้อหาในเว็บ</p>
                </div>
                <button type="button" onClick={close} aria-label="ปิดผู้ช่วย" className="w-10 h-10 rounded-full flex items-center justify-center text-uf-muted hover:text-uf-text hover:bg-uf-text/5">
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 pb-3">
                <label htmlFor="uf-guide-q" className="sr-only">ค้นหา</label>
                <div className="relative">
                  <Search size={18} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-uf-faint" />
                  <input
                    ref={inputRef}
                    id="uf-guide-q"
                    type="search"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setMode('search'); }}
                    placeholder="พิมพ์สิ่งที่อยากรู้ เช่น เรียนฟรี"
                    autoComplete="off"
                    className="w-full h-12 rounded-2xl bg-uf-surface/60 border border-uf-line pl-10 pr-4 text-uf-text placeholder:text-uf-faint focus:outline-none focus:border-uf-cyan"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5" aria-live="polite">
                {status === 'loading' && (
                  <p className="flex items-center gap-2 text-sm text-uf-muted py-6"><Loader2 size={16} className="animate-spin" aria-hidden /> กำลังโหลดข้อมูล…</p>
                )}
                {status === 'error' && (
                  <div className="py-6 text-sm">
                    <p className="flex items-center gap-2 text-uf-lemon mb-3"><AlertTriangle size={16} aria-hidden /> โหลดข้อมูลไม่สำเร็จ</p>
                    <button type="button" onClick={load} className="uf-btn-ghost !min-h-0 !py-2 !px-4 text-sm">ลองอีกครั้ง</button>
                  </div>
                )}

                {status === 'ready' && !results && (
                  <div>
                    <p className="text-sm text-uf-muted mb-3">สวัสดีครับ อยากรู้เรื่องอะไร ลองเลือกคำถามด้านล่างได้เลย</p>
                    <ul className="flex flex-col gap-2">
                      {GUIDED.map(g => (
                        <li key={g.label}>
                          {g.to ? (
                            <Link to={g.to} className="flex items-center gap-2 rounded-2xl border border-uf-line px-4 py-3 text-sm text-uf-text hover:border-uf-cyan">
                              <UserPlus size={16} aria-hidden className="text-uf-lemon" /> {g.label}
                            </Link>
                          ) : (
                            <button type="button" onClick={() => { setQuery(g.query ?? ''); setMode(g.mode ?? 'search'); }} className="w-full text-left rounded-2xl border border-uf-line px-4 py-3 text-sm text-uf-text hover:border-uf-cyan">
                              {g.label}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {status === 'ready' && results && (
                  count === 0 ? (
                    <p className="text-sm text-uf-muted py-6">ไม่พบเนื้อหาที่ตรงกับ “{query}” — ลองคำที่สั้นลง</p>
                  ) : (
                    <div className="space-y-5">
                      <ResultGroup icon={BookOpen} title="นโยบาย" items={results.policies.map(p => ({ key: p.id, to: `/policies#${p.id}`, title: p.title }))} />
                      <ResultGroup icon={Newspaper} title="ข่าว" items={results.news.map(n => ({ key: n.id, to: `/news/${n.id}`, title: n.title, meta: n.date }))} />
                      <ResultGroup icon={CalendarDays} title="กิจกรรม" items={results.events.map(e => ({ key: e.id, to: `/events/${e.id}`, title: e.title, meta: e.location }))} />
                      <ResultGroup icon={Youtube} title="คลิป" items={results.videos.map(v => ({ key: v.id, href: `https://www.youtube.com/watch?v=${extractYouTubeId(v.url)}`, title: v.title }))} />
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultGroup({ icon: Icon, title, items }: {
  icon: React.ComponentType<{ size?: number; className?: string }>; title: string;
  items: { key: string; to?: string; href?: string; title: string; meta?: string }[];
}) {
  if (items.length === 0) return null;
  const cls = 'block rounded-xl px-3 py-2.5 hover:bg-uf-text/5';
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-uf-cyan mb-1.5"><Icon size={14} /> {title}</h3>
      <ul>
        {items.map(i => (
          <li key={i.key}>
            {i.to ? (
              <Link to={i.to} className={cls}>
                <span className="block text-sm text-uf-text leading-snug">{i.title}</span>
                {i.meta && <span className="block text-xs text-uf-faint mt-0.5">{i.meta}</span>}
              </Link>
            ) : (
              <a href={i.href} target="_blank" rel="noopener noreferrer" className={cls}>
                <span className="block text-sm text-uf-text leading-snug">{i.title}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
