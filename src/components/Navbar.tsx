import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X, Search, ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { POLICIES as FALLBACK_POLICIES } from '../constants';
import { fetchCollectionOnce } from '../services/dataService';
import { Policy } from '../types';
import { groupPolicies, splitPillarTitle, visiblePolicies } from '../utils/policies';
import { openGuide } from './uf/LemonGuide';

// URL เดิมทั้งหมด — "กิจกรรม" ชี้ไป section กิจกรรมในหน้าแรก (ยังไม่มีหน้ารวมกิจกรรมแยก)
const NAV_LINKS = [
  { name: 'เกี่ยวกับพรรค', path: '/about' },
  { name: 'นโยบาย', path: '/policies', mega: true },
  { name: 'ทีมพรรค', path: '/team' },
  { name: 'ข่าวสาร', path: '/news' },
  { name: 'กิจกรรม', path: '/#activities' },
  { name: 'ติดต่อ', path: '/contact' },
];

const linkCls = (active: boolean) => cn(
  'relative py-2 text-[15px] font-medium transition-colors hover:text-uf-text',
  'after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-uf-lemon after:origin-left after:transition-transform after:duration-300',
  active ? 'text-uf-text after:scale-x-100' : 'text-uf-muted after:scale-x-0 hover:after:scale-x-100',
);

/** SECTION 01 — Future Navigation (ใช้ทุกหน้า) */
export default function Navbar() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>(FALLBACK_POLICIES);
  const loadedPolicies = useRef(false);
  const megaBtn = useRef<HTMLButtonElement>(null);
  const megaWrap = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setIsOpen(false); setMegaOpen(false); }, [location.pathname, location.hash]);

  // โหลดนโยบายครั้งแรกที่เปิด mega menu เท่านั้น (ไม่ poll ทุกหน้า)
  useEffect(() => {
    if (!megaOpen || loadedPolicies.current) return;
    loadedPolicies.current = true;
    fetchCollectionOnce<Policy>('policies').then(d => { if (d.length) setPolicies(d); }).catch(() => { /* ใช้ชุดสำรอง */ });
  }, [megaOpen]);

  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMegaOpen(false); megaBtn.current?.focus(); } };
    const onClick = (e: MouseEvent) => { if (!megaWrap.current?.contains(e.target as Node)) setMegaOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [megaOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setIsOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [isOpen]);

  const pillars = groupPolicies(visiblePolicies(policies)).slice(0, 4);
  const solid = !isHome || scrolled || isOpen;

  const hoverOpen = () => { window.clearTimeout(closeTimer.current); setMegaOpen(true); };
  const hoverClose = () => { closeTimer.current = window.setTimeout(() => setMegaOpen(false), 160); };

  const isActive = (path: string) => (path.startsWith('/#') ? isHome && location.hash === path.slice(1) : location.pathname === path);

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        'uf-nav fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 border-b',
        solid ? 'bg-uf-bg/80 backdrop-blur-xl border-uf-line' : 'bg-transparent border-transparent',
      )}
    >
      <div className="uf-container">
        <div className="flex items-center justify-between h-[68px] lg:h-20 gap-6">
          <Link to="/" className="flex items-center shrink-0" aria-label="พรรคไทยก้าวใหม่ — หน้าแรก">
            <img src="/tkm-logo.png" alt="ไทยก้าวใหม่" width={48} height={48} className="h-10 lg:h-12 w-auto" />
          </Link>

          {/* Desktop */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map(link => link.mega ? (
              // "นโยบาย" เป็นลิงก์ไป /policies เหมือนเดิม — เมนูย่อยเปิดด้วย hover หรือปุ่มลูกศรข้างๆ (คีย์บอร์ด/จอสัมผัส)
              <div key={link.path} ref={megaWrap} className="relative flex items-center gap-0.5" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
                <Link
                  to={link.path}
                  aria-current={location.pathname === link.path ? 'page' : undefined}
                  className={linkCls(location.pathname === link.path || megaOpen)}
                >
                  {link.name}
                </Link>
                <button
                  ref={megaBtn}
                  type="button"
                  aria-expanded={megaOpen}
                  aria-controls="uf-mega"
                  aria-label="เปิดเมนูนโยบาย ธนู 4 ดอก"
                  // คลิกด้วยเมาส์/แตะ (detail > 0) เกิดหลัง hover เปิดเมนูไปแล้วเสมอ — ให้เปิดค้างไว้ ไม่ใช่ toggle ปิด;
                  // คีย์บอร์ด (Enter/Space, detail = 0) toggle ตามปกติ ปิดด้วยเมาส์ได้โดยคลิกข้างนอก/เลื่อนออก
                  onClick={e => setMegaOpen(v => (e.detail > 0 ? true : !v))}
                  className="w-7 h-9 -mr-1 rounded-lg flex items-center justify-center text-uf-muted hover:text-uf-text"
                >
                  <ChevronDown size={15} aria-hidden className={cn('transition-transform', megaOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {megaOpen && (
                    <motion.div
                      id="uf-mega"
                      initial={reduce ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full pt-4 w-[min(760px,calc(100vw-48px))]"
                    >
                      <div className="uf-glass !bg-uf-bg/95 rounded-3xl p-5 shadow-2xl">
                        <p className="text-xs font-bold tracking-[0.14em] text-uf-cyan mb-3 px-2">ธนู 4 ดอก</p>
                        <ul className="grid grid-cols-2 gap-2">
                          {pillars.map((g, i) => {
                            const { label, name } = splitPillarTitle(g.header.title);
                            return (
                              <li key={g.header.id}>
                                <Link to={`/policies#${g.header.id}`} className="group flex items-start gap-3 rounded-2xl p-3 hover:bg-uf-surface/70 transition-colors">
                                  <span className="w-9 h-9 rounded-xl bg-uf-lemon/15 text-uf-lemon font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                                  <span>
                                    <span className="block text-xs text-uf-faint">{label}</span>
                                    <span className="block text-[15px] font-bold text-uf-text leading-snug group-hover:text-uf-lemon">{name}</span>
                                    <span className="block text-xs text-uf-muted mt-0.5">{g.items.length} นโยบายย่อย</span>
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                        <Link to="/policies" className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3 bg-uf-surface/60 text-sm font-bold text-uf-text hover:text-uf-lemon">
                          ดูนโยบายทั้งหมด <ArrowRight size={16} aria-hidden />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link key={link.path} to={link.path} className={linkCls(isActive(link.path))} aria-current={isActive(link.path) ? 'page' : undefined}>
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openGuide()}
              aria-label="ค้นหา"
              className="w-11 h-11 rounded-full flex items-center justify-center text-uf-muted hover:text-uf-text hover:bg-uf-text/5 transition-colors"
            >
              <Search size={20} />
            </button>
            <Link to="/register" className="uf-btn-primary !min-h-[44px] !py-2.5 !px-4 sm:!px-5 text-sm whitespace-nowrap">
              สมัครสมาชิก
            </Link>
            <button
              ref={menuBtn}
              type="button"
              onClick={() => setIsOpen(v => !v)}
              aria-expanded={isOpen}
              aria-controls="uf-mobile-menu"
              aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              className="lg:hidden w-11 h-11 rounded-full flex items-center justify-center text-uf-text hover:bg-uf-text/5"
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile — แผงเกือบเต็มจอ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="uf-mobile-menu"
            ref={panelRef}
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="lg:hidden fixed inset-x-0 top-[68px] bottom-0 bg-uf-bg/98 backdrop-blur-xl border-t border-uf-line overflow-y-auto"
          >
            <div className="uf-container py-6 flex flex-col">
              {[{ name: 'หน้าหลัก', path: '/' }, ...NAV_LINKS].map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={cn('py-4 text-xl font-bold border-b border-uf-line', isActive(link.path) ? 'text-uf-lemon' : 'text-uf-text')}
                >
                  {link.name}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => { setIsOpen(false); openGuide(); }}
                className="mt-6 uf-btn-ghost w-full"
              >
                <Search size={18} aria-hidden /> ค้นหานโยบาย ข่าว กิจกรรม
              </button>
              <Link to="/register" onClick={() => setIsOpen(false)} className="mt-3 uf-btn-primary w-full text-lg">
                สมัครสมาชิก
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
