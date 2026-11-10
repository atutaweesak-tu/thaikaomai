import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { PolicyGroup, splitPillarTitle } from '../../utils/policies';
import { SectionHeader } from './shared';

function PillarDetail({ group, index, headingLevel = 'h3' }: { group: PolicyGroup; index: number; headingLevel?: 'h3' | 'h4' }) {
  const { label, name } = splitPillarTitle(group.header.title);
  const H = headingLevel;
  const preview = group.items.slice(0, 5);
  return (
    <>
      {group.header.iconImage && (
        <div className="aspect-[16/7] rounded-2xl overflow-hidden mb-5 bg-uf-surface">
          <img src={group.header.iconImage} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      )}
      <p className="text-sm font-bold text-uf-cyan mb-1">{label || `ธนูดอกที่ ${index + 1}`}</p>
      <H className="uf-h3 text-uf-text mb-3">{name}</H>
      <p className="text-[15px] text-uf-muted leading-relaxed mb-5">{group.header.description}</p>
      {preview.length > 0 && (
        <ul className="space-y-2 mb-6">
          {preview.map(p => (
            <li key={p.id}>
              <Link to={`/policies#${p.id}`} className="flex items-start gap-2 text-sm text-uf-text/90 hover:text-uf-lemon transition-colors">
                <span aria-hidden className="mt-[0.6em] w-1.5 h-1.5 rounded-full bg-uf-lemon shrink-0" />
                {p.title}
              </Link>
            </li>
          ))}
          {group.items.length > preview.length && (
            <li className="text-sm text-uf-faint pl-3.5">และอีก {group.items.length - preview.length} นโยบาย</li>
          )}
        </ul>
      )}
      <Link to={`/policies#${group.header.id}`} className="uf-btn-ghost !py-3 !px-5 text-sm">
        อ่านนโยบายฉบับเต็ม <ArrowRight size={16} />
      </Link>
    </>
  );
}

/** เลขลำดับในวงกลม — ดอกที่เลือก = พื้นเหลือง */
function PillarNumber({ i, selected }: { i: number; selected: boolean }) {
  return (
    <span className={`w-9 h-9 lg:w-10 lg:h-10 shrink-0 rounded-full text-xs lg:text-sm font-extrabold flex items-center justify-center border transition-colors duration-300 ${selected ? 'bg-uf-lemon text-uf-bg border-uf-lemon' : 'bg-uf-cyan/10 text-uf-cyan border-uf-cyan/40'}`}>
      {String(i + 1).padStart(2, '0')}
    </span>
  );
}

const rowClass = (selected: boolean) =>
  `relative w-full rounded-2xl border px-4 flex items-center gap-3 text-left transition-[border-color,box-shadow,background-color] duration-300 ${
    selected
      ? 'bg-uf-lemon/[0.08] border-uf-lemon/80 shadow-[0_0_0_3px_rgba(221,243,75,0.12)]'
      : 'uf-glass hover:border-uf-cyan/60'
  }`;

/** SECTION 04 — นโยบายหลัก "ธนู 4 ดอก"
 *  เดสก์ท็อป (lg+): Horizontal Accordion — 4 แถบเรียงแนวนอน แถบที่เลือกขยายโชว์รูป + รายละเอียด
 *  มือถือ: accordion — กดดอกไหน รายละเอียดกางใต้ดอกนั้นทันที (เดิมแผงอยู่ใต้รายการทั้งหมด กดแล้วมองไม่เห็นว่าอะไรเปลี่ยน)
 *  เดิมมีเส้นพลังงาน/เส้นเชื่อม/วงกลม SYNERGY — เอาออกเพราะกินที่จนชื่อนโยบายตัวเล็กและตัดบรรทัดกลางคำบนมือถือ */
export default function PolicyUniverse({ groups }: { groups: PolicyGroup[] }) {
  const [active, setActive] = useState(0); // มือถือ: -1 = พับทั้งหมด
  const reduce = useReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const accRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingReveal = useRef<number | null>(null); // มือถือ: ดอกที่รอเลื่อนหัวข้อให้เห็นหลังกาง
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const pillars = groups.slice(0, 4);
  if (pillars.length === 0) return null;
  const deskIndex = active >= 0 && active < pillars.length ? active : 0;
  const total = groups.reduce((n, g) => n + 1 + g.items.length, 0);

  const selectTab = (i: number, focus = false) => {
    clearTimeout(hoverTimer.current);
    const next = (i + pillars.length) % pillars.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const target =
      e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? pillars.length - 1
      : null;
    if (target === null) return;
    e.preventDefault();
    selectTab(target, true);
  };
  // ชี้ค้าง 180ms ก่อนขยาย — กันแถบสลับไปมาตอนแค่ลากเมาส์ผ่าน
  const hoverIntent = (i: number) => {
    clearTimeout(hoverTimer.current);
    if (i === deskIndex) return;
    hoverTimer.current = setTimeout(() => setActive(i), 180);
  };
  const cancelHover = () => clearTimeout(hoverTimer.current);

  // มือถือ: ดอกที่เปิดอยู่ด้านบนพับลง → หัวข้อที่เพิ่งกดเลื่อนขึ้นไปพ้นจอได้ — เลื่อนกลับมาให้เห็นหลัง animation กางจบ
  // (ผูกกับ onAnimationComplete ไม่ใช้ setTimeout เพราะ animation อาจช้ากว่าที่คาด เช่น เครื่องช้า/แท็บเพิ่งกลับมา)
  const revealHeader = (i: number) => {
    if (pendingReveal.current !== i) return;
    pendingReveal.current = null;
    const el = accRefs.current[i];
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 80) window.scrollBy({ top: top - 88, behavior: reduce ? 'auto' : 'smooth' });
  };
  const toggleAccordion = (i: number) => {
    const opening = active !== i;
    setActive(opening ? i : -1);
    pendingReveal.current = opening ? i : null;
    if (opening && reduce) requestAnimationFrame(() => revealHeader(i));
  };

  const hint = <>เลือกสำรวจรายละเอียดของแต่ละธนู <span className="text-uf-faint">· {total} นโยบาย</span></>;

  return (
    <section id="uf-policies" aria-labelledby="uf-universe-title" className="uf-section overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-1/3 h-[500px] bg-uf-surface/40 blur-[140px]" />
      <div className="uf-container relative">
        <SectionHeader
          id="uf-universe-title"
          eyebrow="4 Synchronized Arrows — One Future"
          title="ธนู 4 ดอก"
          accent="ขับเคลื่อนไปพร้อมกัน"
          description="ขับเคลื่อนนโยบายทั้ง 4 ด้านไปพร้อมกัน เพื่อสร้างการเปลี่ยนแปลงในทุกมิติของประเทศไทย"
        />

        <p className="lg:hidden text-sm text-uf-muted mb-3">{hint}</p>

        {/* ── มือถือ / แท็บเล็ต: accordion ── */}
        <div className="lg:hidden space-y-3">
          {pillars.map((g, i) => {
            const { name } = splitPillarTitle(g.header.title);
            const open = i === active;
            return (
              <div key={g.header.id}>
                <button
                  ref={el => { accRefs.current[i] = el; }}
                  type="button"
                  id={`uf-pillar-acc-${i}`}
                  aria-expanded={open}
                  aria-controls={`uf-pillar-acc-panel-${i}`}
                  onClick={() => toggleAccordion(i)}
                  className={`${rowClass(open)} min-h-[68px] py-3`}
                >
                  <PillarNumber i={i} selected={open} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold leading-snug text-uf-text">{name}</span>
                    <span className="block text-xs text-uf-faint mt-0.5">{1 + g.items.length} นโยบาย</span>
                  </span>
                  <ChevronDown size={20} aria-hidden className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-uf-lemon' : 'text-uf-cyan'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`uf-pillar-acc-panel-${i}`}
                      role="region"
                      aria-labelledby={`uf-pillar-acc-${i}`}
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? { height: 0, opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      onAnimationComplete={() => revealHeader(i)}
                      className="overflow-hidden"
                    >
                      <div className="uf-card p-5 mt-3 border-l-4 !border-l-uf-lemon">
                        <PillarDetail group={g} index={i} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── เดสก์ท็อป: Horizontal Accordion — แถบที่เลือกขยาย (flex-grow 4) แถบอื่นหุบ (1) ──
             ชี้ค้าง 180ms / คลิก / คีย์บอร์ด (ลูกศร, Home, End) · เอาเมาส์ออกแล้วแถบยังเปิดค้าง ไม่หุบกลับ
             ปุ่ม tab เป็น element เดียวกันทั้งตอนหุบ (คลุมทั้งแถบ) และตอนขยาย (ป้ายมุมรูป) — focus จึงไม่หลุดตอนสลับ */}
        <p className="hidden lg:block text-sm text-uf-muted mb-4">{hint}</p>
        <div role="tablist" aria-label="นโยบายหลัก 4 ด้าน" aria-orientation="horizontal" className="hidden lg:flex gap-3 h-[580px]">
          {pillars.map((g, i) => {
            const { label, name } = splitPillarTitle(g.header.title);
            const selected = i === deskIndex;
            const img = g.header.iconImage;
            const preview = g.items.slice(0, 3);
            return (
              <div
                key={g.header.id}
                onMouseEnter={() => hoverIntent(i)}
                onMouseLeave={cancelHover}
                style={{ flexGrow: selected ? 4 : 1 }}
                className={`relative basis-0 min-w-0 rounded-3xl overflow-hidden border transition-[flex-grow,border-color,box-shadow] duration-500 ease-out motion-reduce:transition-none ${
                  selected
                    ? 'border-uf-lemon/70 shadow-[0_0_0_3px_rgba(221,243,75,0.10),0_20px_60px_-25px_rgba(221,243,75,0.45)] bg-uf-surface/60'
                    : 'border-uf-line bg-uf-surface/40 hover:border-uf-cyan/60'
                }`}
              >
                {/* แถบที่หุบ: รูปจางเป็นพื้นหลัง */}
                {!selected && img && (
                  <img src={img} alt="" aria-hidden loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-30 saturate-50" />
                )}
                {!selected && <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-uf-bg via-uf-bg/70 to-uf-bg/30" />}

                <button
                  ref={el => { tabRefs.current[i] = el; }}
                  role="tab"
                  id={`uf-pillar-tab-${i}`}
                  aria-selected={selected}
                  aria-controls={`uf-pillar-panel-${i}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(i)}
                  onKeyDown={e => onTabKey(e, i)}
                  className={selected
                    ? 'absolute top-4 left-4 z-10 inline-flex items-center gap-2.5 rounded-full bg-uf-bg/80 backdrop-blur pl-1.5 pr-4 py-1.5 border border-uf-lemon/40'
                    : 'absolute inset-0 z-10 flex flex-col justify-between p-5 text-left'}
                >
                  <PillarNumber i={i} selected={selected} />
                  {selected ? (
                    <span className="text-sm font-bold text-uf-lemon">{label || `ธนูดอกที่ ${i + 1}`}</span>
                  ) : (
                    <span>
                      <span className="block text-base font-bold leading-snug text-uf-text">{name}</span>
                      <span className="block text-xs text-uf-faint mt-1.5">{1 + g.items.length} นโยบาย</span>
                    </span>
                  )}
                </button>

                {/* แถบที่ขยาย: รูปด้านบน + เนื้อหา — ค่อยปรากฏหลังแถบขยาย (ข้อความไม่ไหลกระโดดระหว่างกว้างขึ้น) */}
                {selected && (
                  <motion.div
                    id={`uf-pillar-panel-${i}`}
                    role="tabpanel"
                    aria-labelledby={`uf-pillar-tab-${i}`}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 min-w-[480px] flex flex-col"
                  >
                    <div className="h-[240px] shrink-0 bg-uf-surface">
                      {img && <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-h-0 p-6 flex flex-col">
                      <h3 className="uf-h3 text-uf-text mb-2">{name}</h3>
                      <p className="text-[15px] text-uf-muted leading-relaxed mb-4 line-clamp-3">{g.header.description}</p>
                      {preview.length > 0 && (
                        <ul className="space-y-1.5 mb-4">
                          {preview.map(p => (
                            <li key={p.id}>
                              <Link to={`/policies#${p.id}`} className="flex items-start gap-2 text-sm text-uf-text/90 hover:text-uf-lemon transition-colors">
                                <span aria-hidden className="mt-[0.6em] w-1.5 h-1.5 rounded-full bg-uf-lemon shrink-0" />
                                <span className="line-clamp-1">{p.title}</span>
                              </Link>
                            </li>
                          ))}
                          {g.items.length > preview.length && (
                            <li className="text-sm text-uf-faint pl-3.5">และอีก {g.items.length - preview.length} นโยบาย</li>
                          )}
                        </ul>
                      )}
                      <Link to={`/policies#${g.header.id}`} className="uf-btn-ghost !py-3 !px-5 text-sm self-start mt-auto">
                        อ่านนโยบายฉบับเต็ม <ArrowRight size={16} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
