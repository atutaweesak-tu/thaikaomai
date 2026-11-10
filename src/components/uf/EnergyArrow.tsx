import React from 'react';

/** ฉาก "ลูกศรพลังงาน" ของ Hero (ตกแต่งล้วน · aria-hidden) — **ไม่ใช่โลโก้พรรค**
 *  โลโก้เป็นลูกศรเส้นตรงทแยงในกรอบสี่เหลี่ยม → ฉากนี้ใช้ "เส้นทางโค้ง" (trajectory) มีมิติ 3D และไม่มีกรอบ
 *  เพื่อไม่ให้ดูเหมือนโลโก้ที่ถูกดัดแปลง
 *
 *  ลำดับเวลา (คลาสใน index.css — ทุกช่วงจบที่สถานะสุดท้ายด้วย fill forwards):
 *   0.4–0.9s  ชีพจรพลังงานวิ่งตามเส้นทางลูกศร (uf-pulse-intro)
 *   0.9–1.5s  วงโคจร + เส้นแสง lemon/cyan ปรากฏ (uf-reveal / uf-draw)
 *   1.5–2.0s  อนุภาคกระจก (uf-particle-in)
 *   > 2.0s    idle: ลูกศรลอย, วงโคจรหมุนช้า, ชีพจรวิ่งซ้ำทุก ~5s, อนุภาคลอย
 *  ลด motion / โหมดสำรวม → แสดงทุกชั้นแบบนิ่งทันที (ชีพจรซ่อน)
 *
 *  variant "ambient" = ฉากหลังจางสำหรับ layout split (ไม่มีอนุภาค/ชีพจร ลดภาระ) */

// เส้นทางโค้งจากซ้ายล่างขึ้นขวาบน — ปลายทางพุ่งขึ้นแนวทแยง หัวลูกศรวางตามทิศปลายเส้น
const PATH = 'M96 498 C 196 470, 250 400, 300 318 S 392 168, 474 128';
const HEAD = 'M440 104 L 506 112 L 478 170';

const PARTICLES = [
  { x: 120, y: 160, w: 34, h: 22, r: 7, d: '1.50s', f: '7s' },
  { x: 470, y: 330, w: 26, h: 26, r: 13, d: '1.62s', f: '8s' },
  { x: 214, y: 236, w: 18, h: 12, r: 4, d: '1.70s', f: '6.5s' },
  { x: 404, y: 432, w: 40, h: 24, r: 8, d: '1.78s', f: '9s' },
  { x: 528, y: 222, w: 14, h: 14, r: 7, d: '1.86s', f: '7.5s' },
  { x: 64, y: 330, w: 22, h: 14, r: 5, d: '1.94s', f: '8.5s' },
];

export default function EnergyArrow({ paused = false, variant = 'full' }: { paused?: boolean; variant?: 'full' | 'ambient' }) {
  const full = variant === 'full';
  return (
    <div className={`relative w-full h-full ${paused ? 'uf-paused' : ''}`} aria-hidden>
      {/* พื้นหลังลึก: แสง navy-cyan ไล่ระดับ — ไม่มีกรอบ */}
      {/* วงกลมจัตุรัสเสมอ (ยึดความสูง) — กล่องมือถือเป็นแนวนอน ถ้ายึด inset จะกลายเป็นแคปซูล */}
      <div className="absolute inset-y-[4%] left-1/2 -translate-x-1/2 aspect-square rounded-full bg-[radial-gradient(circle_at_60%_40%,rgba(54,217,245,0.16),rgba(16,45,80,0.55)_45%,transparent_72%)] uf-glow" />

      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" className="relative w-full h-full overflow-visible">
        <defs>
          <linearGradient id="uf-arrow-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--color-uf-cyan)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-uf-lemon)' }} />
          </linearGradient>
          <linearGradient id="uf-trail-lemon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--color-uf-lemon)', stopOpacity: 0 }} />
            <stop offset="70%" style={{ stopColor: 'var(--color-uf-lemon)', stopOpacity: 0.85 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-uf-lemon)', stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id="uf-trail-cyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--color-uf-cyan)', stopOpacity: 0 }} />
            <stop offset="60%" style={{ stopColor: 'var(--color-uf-cyan)', stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-uf-cyan)', stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id="uf-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F7FAFF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#36D9F5" stopOpacity="0.05" />
          </linearGradient>
          <filter id="uf-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── 0.9–1.5s วงโคจรเอียง 3 วง ── */}
        <g className="uf-reveal" style={{ animationDelay: '0.9s' }}>
          <g className="uf-orbit">
            <ellipse cx="300" cy="300" rx="262" ry="96" fill="none" className="stroke-uf-cyan" strokeOpacity="0.32" strokeWidth="1.5" transform="rotate(-24 300 300)" />
            <circle cx="534" cy="196" r="6" className="fill-uf-cyan" />
          </g>
          <g className="uf-orbit" style={{ animationDuration: '64s', animationDirection: 'reverse' }}>
            <ellipse cx="300" cy="300" rx="214" ry="74" fill="none" className="stroke-uf-lemon" strokeOpacity="0.26" strokeWidth="1" strokeDasharray="4 10" transform="rotate(16 300 300)" />
            <circle cx="96" cy="242" r="4.5" className="fill-uf-lemon" />
          </g>
          {full && (
            <g className="uf-orbit" style={{ animationDuration: '90s' }}>
              <ellipse cx="300" cy="300" rx="176" ry="176" fill="none" className="stroke-uf-cyan" strokeOpacity="0.12" strokeWidth="1" />
            </g>
          )}
        </g>

        {/* ── 0.9–1.5s เส้นแสง lemon/cyan วาดตัวเอง (light trails) ── */}
        <g fill="none" strokeLinecap="round">
          <path className="uf-draw" pathLength={1} style={{ animationDelay: '0.95s' }} d="M40 430 C 180 400, 260 300, 330 250 S 470 150, 570 150" stroke="url(#uf-trail-cyan)" strokeWidth="2" />
          <path className="uf-draw" pathLength={1} style={{ animationDelay: '1.1s' }} d="M70 540 C 200 520, 300 440, 380 360 S 500 250, 590 230" stroke="url(#uf-trail-lemon)" strokeWidth="1.5" />
          {full && <path className="uf-draw" pathLength={1} style={{ animationDelay: '1.25s' }} d="M20 360 C 140 350, 230 280, 280 210" stroke="url(#uf-trail-cyan)" strokeWidth="1" />}
        </g>

        <g className="uf-float">
          {/* ── ลูกศรมิติ 3D: ชั้นเงา (extrusion) → ท่อไล่สี + เรืองแสง → เส้นไฮไลต์ ── */}
          <g className="uf-reveal" style={{ animationDelay: '0.4s' }}>
            <g transform="translate(10 12)" opacity="0.55">
              <path d={PATH} stroke="#0B2240" strokeWidth="30" strokeLinecap="round" fill="none" />
              <path d={HEAD} stroke="#0B2240" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            <g filter="url(#uf-soft-glow)">
              <path d={PATH} stroke="url(#uf-arrow-grad)" strokeWidth="28" strokeLinecap="round" fill="none" />
              <path d={HEAD} stroke="url(#uf-arrow-grad)" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            <path d={PATH} stroke="#F7FAFF" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" transform="translate(-4 -5)" />
          </g>

          {/* ── 0.4–0.9s ชีพจรพลังงานวิ่งตามเส้นทาง แล้ววิ่งซ้ำช้าๆ หลัง 2s ── */}
          {full && (
            <g className="uf-pulse-group">
              <path className="uf-pulse" pathLength={1} d={`${PATH} M474 128 L 506 112`} stroke="#F7FAFF" strokeWidth="6" strokeLinecap="round" fill="none" filter="url(#uf-soft-glow)" />
            </g>
          )}
        </g>

        {/* ── 1.5–2.0s อนุภาคกระจก ── */}
        {full && PARTICLES.map((p, i) => (
          <g key={i} className="uf-particle-in" style={{ animationDelay: p.d }}>
            <rect
              style={{ animationDuration: p.f }}
              x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r}
              fill="url(#uf-glass)" className="uf-particle-float stroke-uf-cyan" strokeOpacity="0.4" strokeWidth="1"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
