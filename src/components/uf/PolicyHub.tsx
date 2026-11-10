import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, ArrowRight, AlertTriangle, SearchX } from 'lucide-react';
import { Policy } from '../../types';
import { PolicyGroup, matchesQuery, splitPillarTitle } from '../../utils/policies';
import { Reveal, SectionHeader } from './shared';

const PAGE = 6;
const MOBILE_PAGE = 3;
const DEBOUNCE_MS = 250;

/** SECTION 05 — Policy Discovery Hub: ค้นหา (ภาษาไทย, debounce) + กรองตามธนู 4 ดอก ทั้ง 36 รายการจาก /api/data/policies */
export default function PolicyHub({ groups, loadError }: { groups: PolicyGroup[]; loadError: boolean }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [pillar, setPillar] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);
  const searching = input !== query;

  useEffect(() => {
    const t = setTimeout(() => setQuery(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);
  useEffect(() => setExpanded(false), [query, pillar]);

  // แต่ละนโยบายพร้อมชื่อดอกที่สังกัด — ใช้ทำป้ายบนการ์ด + กรอง
  const all = useMemo(() => groups.flatMap(g => {
    const { name } = splitPillarTitle(g.header.title);
    return [g.header, ...g.items].map(p => ({ policy: p, pillarId: g.header.id, pillarName: name, isHeader: p === g.header }));
  }), [groups]);
  const total = all.length;

  const results = useMemo(() => all.filter(r =>
    (pillar === 'all' || r.pillarId === pillar) &&
    matchesQuery(`${r.policy.title} ${r.policy.description}`, query),
  ), [all, pillar, query]);

  const shown = expanded ? results : results.slice(0, PAGE);

  return (
    // ต่อจาก Policy Universe เสมอ (block "policies" เดียวกัน) — ลดระยะบนให้สองส่วนอ่านเป็นเรื่องเดียวกัน
    <section aria-labelledby="uf-hub-title" className="uf-section !pt-6 md:!pt-10">
      <div className="uf-container">
        <SectionHeader
          id="uf-hub-title"
          eyebrow="Policy Discovery"
          title="ค้นหานโยบาย"
          accent="ที่ตรงกับคุณ"
          description={`นโยบายทั้งหมด ${total} รายการ ค้นหาด้วยคำสำคัญ หรือเลือกดูตามธนูแต่ละดอก`}
          action={
            <Link to="/policies" className="uf-btn-ghost">ดูนโยบายทั้งหมด <ArrowRight size={18} /></Link>
          }
        />

        <div className="uf-card p-4 md:p-6 mb-8">
          <form role="search" onSubmit={e => { e.preventDefault(); setQuery(input); }} className="relative">
            <label htmlFor="uf-policy-search" className="sr-only">ค้นหานโยบาย</label>
            <Search size={20} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-uf-faint" />
            <input
              id="uf-policy-search"
              type="search"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setInput(''); setQuery(''); } }}
              placeholder="เช่น เรียนฟรี, หนี้, SME, ผู้สูงอายุ"
              autoComplete="off"
              className="w-full h-14 rounded-2xl bg-uf-bg/70 border border-uf-line pl-12 pr-12 text-uf-text placeholder:text-uf-faint focus:outline-none focus:border-uf-cyan"
            />
            {input && (
              <button type="button" onClick={() => { setInput(''); setQuery(''); }} aria-label="ล้างคำค้นหา" className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-uf-faint hover:text-uf-text">
                <X size={18} />
              </button>
            )}
          </form>

          <div role="group" aria-label="กรองตามธนู" className="uf-scroll-x gap-2 mt-4 -mx-1 px-1">
            {[{ id: 'all', name: 'ทั้งหมด' }, ...groups.map(g => ({ id: g.header.id, name: splitPillarTitle(g.header.title).name }))].map(f => (
              <button
                key={f.id}
                type="button"
                aria-pressed={pillar === f.id}
                onClick={() => setPillar(f.id)}
                className={`shrink-0 rounded-full px-4 min-h-[40px] text-sm font-bold border transition-colors ${
                  pillar === f.id ? 'bg-uf-cyan text-uf-bg border-uf-cyan' : 'border-uf-line text-uf-muted hover:text-uf-text hover:border-uf-cyan/50'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="text-sm text-uf-faint mb-4 min-h-[1.5em]">
          {searching ? 'กำลังค้นหา…' : `พบ ${results.length} นโยบาย`}
        </p>

        {loadError && (
          <p role="status" className="flex items-center gap-2 text-sm text-uf-lemon/90 mb-4">
            <AlertTriangle size={16} aria-hidden /> โหลดข้อมูลล่าสุดไม่สำเร็จ — กำลังแสดงข้อมูลนโยบายชุดสำรองในเว็บ
          </p>
        )}

        {searching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="uf-card h-[210px] animate-pulse" />)}
          </div>
        ) : results.length === 0 ? (
          <div className="uf-card p-10 text-center">
            <SearchX size={36} aria-hidden className="mx-auto text-uf-faint mb-3" />
            <p className="font-bold text-uf-text">ไม่พบนโยบายที่ตรงกับ “{query}”</p>
            <p className="text-sm text-uf-muted mt-1">ลองใช้คำที่สั้นลง หรือเลือก “ทั้งหมด”</p>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
              {shown.map((r, i) => (
                // มือถือแสดง 3 ใบแรกก่อน (การ์ดเรียงคอลัมน์เดียว 6 ใบ = ยาวเกินไป) — ใบที่ 4–6 เห็นเมื่อกดแสดงทั้งหมด
                <PolicyCard key={r.policy.id} policy={r.policy} pillarName={r.pillarName} isHeader={r.isHeader} index={i}
                  className={!expanded && i >= MOBILE_PAGE ? 'max-md:hidden' : ''} />
              ))}
            </ul>
            {results.length > MOBILE_PAGE && (
              // > 6 รายการ: ปุ่มแสดงทุกขนาดจอ · 4–6 รายการ: ปุ่มแสดงเฉพาะมือถือ (เดสก์ท็อปเห็นครบแล้ว)
              <div className={`text-center mt-8 ${results.length > PAGE || expanded ? '' : 'md:hidden'}`}>
                <button type="button" onClick={() => setExpanded(v => !v)} className="uf-btn-ghost">
                  {expanded ? 'แสดงน้อยลง' : `แสดงทั้งหมด ${results.length} รายการ`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PolicyCard({ policy, pillarName, isHeader, index, className = '' }: { policy: Policy; pillarName: string; isHeader: boolean; index: number; className?: string; key?: string }) {
  return (
    <Reveal as="li" index={index % PAGE} className={className}>
      <Link to={`/policies#${policy.id}`} className="uf-card uf-card-hover group flex flex-col h-full p-6">
        <span className={`self-start text-xs font-bold rounded-full px-3 py-1 mb-4 ${isHeader ? 'bg-uf-lemon text-uf-bg' : 'bg-uf-cyan/12 text-uf-cyan'}`}>
          {isHeader ? 'นโยบายหลัก' : pillarName}
        </span>
        <h3 className="text-lg font-bold leading-snug text-uf-text mb-2 group-hover:text-uf-lemon transition-colors">{policy.title}</h3>
        <p className="text-sm text-uf-muted leading-relaxed line-clamp-3 mb-4">{policy.description}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-uf-cyan">
          อ่านต่อ <ArrowRight size={15} aria-hidden className="group-hover:translate-x-1 transition-transform" />
        </span>
      </Link>
    </Reveal>
  );
}
