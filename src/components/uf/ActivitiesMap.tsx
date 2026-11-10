import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, CalendarX, Newspaper } from 'lucide-react';
import { EventItem, NewsItem } from '../../types';
import { EVENT_STATUS_LABEL, EventStatus, eventStatus, eventSortKey, formatThaiDate } from '../../utils/bangkokTime';
import { THAI_REGIONS, RegionId, provinceFromLocation, provincesInText, regionOf } from '../../utils/provinces';
import { Reveal, SectionHeader } from './shared';

const STATUS_STYLE: Record<EventStatus, string> = {
  ongoing: 'bg-uf-lemon text-uf-bg',
  upcoming: 'bg-uf-cyan/15 text-uf-cyan',
  tba: 'bg-uf-text/10 text-uf-muted',
  past: 'bg-uf-text/5 text-uf-faint',
};
const PAST_LIMIT = 3;

// แผนผังภูมิภาค (schematic) — วางตำแหน่งโดยประมาณตามทิศ ไม่ใช่ขอบเขตจริง: [คอลัมน์, แถว] ใน grid 3×6
const TILE_POS: Record<RegionId, string> = {
  north: 'col-start-2 row-start-1 row-span-2',
  northeast: 'col-start-3 row-start-2 row-span-2',
  west: 'col-start-1 row-start-2 row-span-3',
  central: 'col-start-2 row-start-3 row-span-2',
  east: 'col-start-3 row-start-4',
  south: 'col-start-2 row-start-5 row-span-2',
};
const SHORT: Record<RegionId, string> = { north: 'เหนือ', northeast: 'อีสาน', west: 'ตะวันตก', central: 'กลาง', east: 'ตะวันออก', south: 'ใต้' };

type Row = { ev: EventItem; status: EventStatus; province: string | null; region: RegionId | null };

function EventCard({ row, index }: { row: Row; index: number; key?: string }) {
  const { ev, status } = row;
  return (
    <Reveal as="li" index={index}>
      <Link to={`/events/${ev.id}`} className={`uf-card uf-card-hover group block p-5 ${status === 'past' ? 'opacity-80' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${STATUS_STYLE[status]}`}>{EVENT_STATUS_LABEL[status]}</span>
          <span className="text-xs text-uf-faint">{ev.startAt ? formatThaiDate(ev.startAt) : ev.date}</span>
          {row.province && <span className="text-xs font-bold text-uf-cyan">{row.province}</span>}
        </div>
        <h4 className="text-base md:text-lg font-bold leading-snug text-uf-text group-hover:text-uf-lemon transition-colors mb-2">{ev.title}</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-uf-muted">
          {ev.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden className="text-uf-cyan" />{ev.location}</span>}
          {ev.time && <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden className="text-uf-cyan" />{ev.time}</span>}
        </div>
      </Link>
    </Reveal>
  );
}

function Group({ title, rows, note }: { title: string; rows: Row[]; note?: React.ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-bold text-uf-muted mb-3">
        {title} <span className="rounded-full bg-uf-text/10 px-2 py-0.5 text-xs text-uf-text tabular-nums">{rows.length}</span>
      </h3>
      <ul className="space-y-3">{rows.map((r, i) => <EventCard key={r.ev.id} row={r} index={i} />)}</ul>
      {note}
    </div>
  );
}

/** SECTION 07 — กิจกรรมทั่วประเทศ V3
 *  - ยังไม่มีไฟล์แผนที่ขอบเขตจังหวัดที่ได้รับอนุมัติ → ใช้ "แผนผังภูมิภาค" 6 ภาค (ระบุชัดว่าไม่ใช่แผนที่ตามมาตราส่วน)
 *  - จุดนีออนแสดงเฉพาะภาคที่มีกิจกรรมจริง (จังหวัดอ่านจากข้อความสถานที่ — ข้อมูลกิจกรรมไม่มีฟิลด์จังหวัด)
 *  - สถานะตามเวลาไทย (startAt ก่อน แล้ววันจากข้อความที่มีปี — ไม่เดาปี) · ไม่สร้างสาขา/สถานที่ขึ้นเอง */
export default function ActivitiesMap({ events, news = [] }: { events: EventItem[]; news?: NewsItem[] }) {
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [province, setProvince] = useState('all');

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    return events.map(ev => {
      const province = provinceFromLocation(ev.location);
      return { ev, status: eventStatus(ev, now), province, region: regionOf(province) };
    });
  }, [events]);

  const regionCounts = useMemo(() => {
    const m = new Map<RegionId, number>();
    rows.forEach(r => { if (r.region && r.status !== 'past') m.set(r.region, (m.get(r.region) || 0) + 1); });
    return m;
  }, [rows]);

  const filtered = province !== 'all' ? rows.filter(r => r.province === province)
    : region !== 'all' ? rows.filter(r => r.region === region)
    : rows;
  const national = rows.filter(r => !r.province);
  const scoped = province !== 'all' || region !== 'all';

  const byDate = (dir: 1 | -1) => (a: Row, b: Row) => dir * eventSortKey(a.ev).localeCompare(eventSortKey(b.ev));
  const active = filtered.filter(r => r.status === 'ongoing' || r.status === 'upcoming').sort((a, b) => (a.status === 'ongoing' ? -1 : 0) - (b.status === 'ongoing' ? -1 : 0) || byDate(1)(a, b));
  const tba = filtered.filter(r => r.status === 'tba');
  const past = filtered.filter(r => r.status === 'past').sort(byDate(-1));

  // ข่าวที่พูดถึงจังหวัดในพื้นที่ที่เลือก (จับชื่อจังหวัดจากหัวข้อ/สรุปข่าว)
  const related = useMemo(() => {
    if (!scoped) return [];
    const inScope = (p: string) => (province !== 'all' ? p === province : regionOf(p) === region);
    return news.filter(n => provincesInText(`${n.title} ${n.summary}`).some(inScope)).slice(0, 3);
  }, [news, province, region, scoped]);

  const pickRegion = (id: RegionId | 'all') => { setRegion(id); setProvince('all'); };
  const pickProvince = (p: string) => { setProvince(p); setRegion(p === 'all' ? 'all' : (regionOf(p) ?? 'all')); };
  const scopeName = province !== 'all' ? province : region !== 'all' ? THAI_REGIONS.find(r => r.id === region)!.name : '';

  return (
    <section id="activities" aria-labelledby="uf-activities-title" className="uf-section scroll-mt-20">
      <div className="uf-container">
        <SectionHeader
          id="uf-activities-title"
          eyebrow="Nationwide"
          title="กิจกรรม"
          accent="ทั่วประเทศ"
          description="เลือกภาคหรือจังหวัดเพื่อดูกิจกรรมของพรรคในพื้นที่ สถานะกิจกรรมคำนวณตามเวลาประเทศไทย"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── ซ้าย: ตัวเลือกจังหวัด (หลัก) + แผนผังภูมิภาค (รอง) ── */}
          <div className="lg:col-span-5">
            <div className="uf-card p-5 md:p-6 lg:sticky lg:top-28">
              <label htmlFor="uf-province" className="block text-sm font-bold text-uf-text mb-2">จังหวัด</label>
              <select
                id="uf-province"
                value={province}
                onChange={e => pickProvince(e.target.value)}
                className="w-full h-12 rounded-xl bg-uf-bg border border-uf-line px-4 text-uf-text focus:outline-none focus:border-uf-cyan"
              >
                <option value="all">ทุกจังหวัด</option>
                {THAI_REGIONS.map(r => (
                  <optgroup key={r.id} label={r.name}>
                    {r.provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                ))}
              </select>

              <div className="mt-5" role="group" aria-label="เลือกภูมิภาค">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-uf-muted">ภูมิภาค</p>
                  {scoped && <button type="button" onClick={() => pickRegion('all')} className="text-xs font-bold text-uf-cyan hover:text-uf-text">ดูทุกภาค</button>}
                </div>

                {/* มือถือ: ปุ่มภาคแบบแถว (รองจาก dropdown) */}
                <div className="lg:hidden uf-scroll-x gap-2 -mx-1 px-1 pb-1">
                  {THAI_REGIONS.map(r => {
                    const n = regionCounts.get(r.id) || 0;
                    const on = region === r.id;
                    return (
                      <button key={r.id} type="button" aria-pressed={on} onClick={() => pickRegion(on ? 'all' : r.id)}
                        className={`shrink-0 rounded-full px-3.5 min-h-[40px] text-sm font-bold border transition-colors ${on ? 'bg-uf-lemon text-uf-bg border-uf-lemon' : 'border-uf-line text-uf-muted'}`}>
                        {SHORT[r.id]}{n > 0 && <span className={on ? '' : 'text-uf-cyan'}> · {n}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* เดสก์ท็อป: แผนผังภูมิภาค — ตำแหน่งโดยประมาณตามทิศ ไม่ใช่ขอบเขตจริง */}
                <div className="hidden lg:block relative rounded-2xl border border-uf-line bg-uf-bg/50 p-3 overflow-hidden">
                  <div aria-hidden className="absolute inset-0 opacity-25 [background-image:radial-gradient(#36D9F5_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="relative grid grid-cols-3 grid-rows-[repeat(6,38px)] gap-1.5">
                    {THAI_REGIONS.map(r => {
                      const n = regionCounts.get(r.id) || 0;
                      const on = region === r.id;
                      return (
                        <button
                          key={r.id} type="button" aria-pressed={on} onClick={() => pickRegion(on ? 'all' : r.id)}
                          // ไม่ใช้ aria-label (ชื่อที่อ่านต้องมีข้อความที่เห็นบนจอ — WCAG 2.5.3) → ข้อมูลเพิ่มเป็น sr-only แทน
                          className={`${TILE_POS[r.id]} relative rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,box-shadow] duration-300 ${
                            on ? 'bg-uf-lemon/15 border-uf-lemon shadow-[0_0_0_3px_rgba(221,243,75,0.15)]' : 'bg-uf-surface/50 border-uf-line hover:border-uf-cyan/50'
                          }`}
                        >
                          <span className={`block text-[13px] font-bold leading-tight ${on ? 'text-uf-lemon' : 'text-uf-text'}`}><span className="sr-only">ภาค</span>{SHORT[r.id]}</span>
                          <span className="block text-[11px] text-uf-faint">{r.provinces.length} จังหวัด{n > 0 && <span className="sr-only"> — มีกิจกรรม {n} รายการ</span>}</span>
                          {/* จุดนีออน = มีกิจกรรมจริงในภาคนี้ */}
                          {n > 0 && <span aria-hidden className="absolute right-2 top-2 w-2.5 h-2.5 rounded-full bg-uf-cyan shadow-[0_0_10px_#36D9F5] uf-glow" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="relative mt-3 text-[11px] text-uf-faint">แผนผังภูมิภาค (ไม่ใช่แผนที่ตามมาตราส่วน) · จุดฟ้า = มีกิจกรรมที่ระบุจังหวัด</p>
                </div>
                {regionCounts.size === 0 && (
                  <p className="mt-3 text-xs text-uf-faint">กิจกรรมที่เผยแพร่ตอนนี้ยังไม่ระบุจังหวัดในช่องสถานที่</p>
                )}
              </div>
            </div>
          </div>

          {/* ── ขวา: กิจกรรมตามสถานะ + ข่าวในพื้นที่ ── */}
          <div className="lg:col-span-7 space-y-8" aria-live="polite">
            {scoped && <p className="text-sm text-uf-muted">แสดงเฉพาะ <b className="text-uf-text">{scopeName}</b></p>}

            {active.length + tba.length + past.length === 0 ? (
              <div className="uf-card p-10 text-center">
                <CalendarX size={36} aria-hidden className="mx-auto text-uf-faint mb-3" />
                <p className="font-bold text-uf-text">ยังไม่มีข้อมูลกิจกรรมที่เผยแพร่{scopeName ? `ใน${scopeName}` : ''}</p>
                <p className="text-sm text-uf-muted mt-1">ติดตามประกาศจากพรรคได้ที่หน้าข่าวสาร</p>
              </div>
            ) : (
              <>
                <Group title="กำลังจัด / กำลังจะมาถึง" rows={active} />
                <Group title="ยังไม่ระบุวัน" rows={tba} />
                <Group
                  title="ผ่านไปแล้ว"
                  rows={past.slice(0, PAST_LIMIT)}
                  note={past.length > PAST_LIMIT && <p className="mt-3 text-sm text-uf-faint">และอีก {past.length - PAST_LIMIT} กิจกรรมที่ผ่านมา</p>}
                />
              </>
            )}

            {scoped && national.filter(r => r.status !== 'past').length > 0 && (
              <Group title="ระดับประเทศ / ไม่ระบุจังหวัด" rows={national.filter(r => r.status !== 'past')} />
            )}

            {related.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-uf-muted mb-3"><Newspaper size={15} aria-hidden /> ข่าวที่เกี่ยวข้องในพื้นที่</h3>
                <ul className="space-y-2">
                  {related.map(n => (
                    <li key={n.id}>
                      <Link to={`/news/${n.id}`} className="block rounded-xl border border-uf-line px-4 py-3 hover:border-uf-cyan/50 transition-colors">
                        <span className="block text-xs text-uf-faint">{n.date}</span>
                        <span className="block text-sm font-bold text-uf-text line-clamp-2">{n.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
