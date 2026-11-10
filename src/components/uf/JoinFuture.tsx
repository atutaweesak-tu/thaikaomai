import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, MessageCircle } from 'lucide-react';
import { SiteSettings } from '../../types';
import { Reveal } from './shared';

/** SECTION 09 — Join the Future (ต่อด้วย Footer ส่วนกลาง)
 *  หัวข้อหลักตามบรีฟ; หัวข้อรอง + คำอธิบายมาจาก settings.cta (แก้ได้จาก admin) */
export default function JoinFuture({ settings }: { settings: SiteSettings }) {
  const { cta } = settings;
  const sub = [cta.heading1, cta.heading2].filter(Boolean).join(' ');
  return (
    <section aria-labelledby="uf-join-title" className="relative overflow-hidden py-16 md:py-24">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(54,217,245,0.18),transparent_60%)]" />
      <div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[120%] h-px bg-gradient-to-r from-transparent via-uf-cyan/60 to-transparent" />
      <div className="uf-container relative text-center">
        <Reveal>
          <img src="/tkm-logo.png" alt="พรรคไทยก้าวใหม่" width={80} height={80} className="h-16 md:h-20 w-auto mx-auto mb-8" loading="lazy" />
          <h2 id="uf-join-title" className="uf-h1 text-uf-text">อนาคตไม่ได้รอใคร</h2>
          {sub && <p className="uf-h2 text-uf-lemon mt-2">{sub}</p>}
          {cta.description && <p className="uf-body text-uf-muted max-w-xl mx-auto mt-5">{cta.description}</p>}
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            <Link to="/register" className="uf-btn-primary text-lg">
              <UserPlus size={20} aria-hidden /> สมัครสมาชิกพรรค
            </Link>
            <Link to="/contact" className="uf-btn-ghost text-lg">
              <MessageCircle size={20} aria-hidden /> ติดต่อพรรค
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
