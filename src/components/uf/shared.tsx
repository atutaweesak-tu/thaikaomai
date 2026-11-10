import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** ref + flag ว่าอยู่ในจอไหม — ใช้ใส่คลาส uf-paused หยุด animation วนซ้ำตอนเลื่อนพ้นจอ */
export function useOnScreen<T extends Element>(margin = '120px') {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { margin: margin as any });
  return [ref, inView] as const;
}

/** fade-up ตอนเลื่อนถึง (ครั้งเดียว) — index ใช้ทำ stagger */
export function Reveal({ children, index = 0, className = '', as = 'div' }: {
  children: React.ReactNode; index?: number; className?: string; as?: 'div' | 'li' | 'article'; key?: string | number;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: Math.min(index, 6) * 0.08, ease: 'easeOut' }}
    >
      {children}
    </Comp>
  );
}

/** หัว section มาตรฐาน: eyebrow สี cyan + H2 + คำอธิบาย + action ด้านขวา (ถ้ามี) */
export function SectionHeader({ id, eyebrow, title, accent, description, action }: {
  id?: string; eyebrow: React.ReactNode; title: React.ReactNode; accent?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8 md:mb-10">
      <div className="max-w-2xl">
        <p className="uf-eyebrow mb-4">
          <span aria-hidden className="h-px w-8 bg-uf-cyan" />
          {eyebrow}
        </p>
        <h2 id={id} className="uf-h2 text-uf-text">
          {title}
          {accent && <> <span className="text-uf-lemon">{accent}</span></>}
        </h2>
        {description && <p className="uf-body text-uf-muted mt-4">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** แถวการ์ดเลื่อนแนวนอน + ปุ่มก่อนหน้า/ถัดไป (ใช้ร่วม: คลิป YouTube, Instagram)
 *  เดสก์ท็อป: ปุ่มที่หัวแถว · มือถือ: ปุ่มกลางใต้แถว (มุมขวาล่างของจอเป็นที่ของปุ่มลอยน้องเลม่อน)
 *  ปุ่มปิดเองเมื่อสุดแถว · children = <li>
 *  listClassName: คลาสเพิ่มให้ <ul> เช่น 'lg:grid lg:grid-cols-4' = เดสก์ท็อปเป็นกริด (ไม่ล้น → ปุ่มซ่อนเอง) */
export function Carousel({ title, label, children, className = '', listClassName = '' }: { title: React.ReactNode; label: string; children: React.ReactNode; className?: string; listClassName?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  const by = (dir: 1 | -1) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' }); };
  const btn = 'w-11 h-11 rounded-full uf-glass flex items-center justify-center text-uf-muted hover:text-uf-text disabled:opacity-35 disabled:cursor-default';
  const buttons = (
    <>
      <button type="button" onClick={() => by(-1)} disabled={edge.start} aria-controls={id} aria-label={`${label} ก่อนหน้า`} className={btn}><ChevronLeft size={20} /></button>
      <button type="button" onClick={() => by(1)} disabled={edge.end} aria-controls={id} aria-label={`${label} ถัดไป`} className={btn}><ChevronRight size={20} /></button>
    </>
  );
  const scrollable = !(edge.start && edge.end);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="uf-h3 text-uf-text flex items-center gap-2">{title}</h3>
        {scrollable && <div className="hidden md:flex gap-2">{buttons}</div>}
      </div>
      <ul ref={ref} id={id} aria-label={label} onScroll={update} className={`uf-scroll-x gap-3 lg:gap-4 -mx-5 px-5 lg:mx-0 lg:px-0 pb-2 ${listClassName}`}>{children}</ul>
      {scrollable && <div className="md:hidden flex justify-center gap-3 mt-3">{buttons}</div>}
    </div>
  );
}
