import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Instagram, X, ExternalLink, Play, Pin, Loader2 } from 'lucide-react';
import { InstagramItem } from '../../types';
import { InstagramRef, OFFICIAL_INSTAGRAM_PROFILE, instagramEmbedUrl, instagramPermalink, normalizeInstagramProfile, parseInstagramUrl } from '../../utils/instagram';
import { Carousel, SectionHeader } from './shared';

type Entry = InstagramItem & { ref: InstagramRef };
const POST_LIMIT = 8;
const REEL_LIMIT = 4;

/** หน้าต่างดูโพสต์ — iframe /embed ทางการโหลด "ตอนเปิดหน้าต่างนี้เท่านั้น" (ไม่มี JS/คุกกี้ Instagram ก่อนผู้ใช้เลือก)
 *  ตรวจไม่ได้ว่าโพสต์ถูกลบ/เป็นบัญชีส่วนตัว (iframe ข้ามโดเมน) → ลิงก์ "เปิดบน Instagram" แสดงเสมอ */
function Viewer({ entry, onClose }: { entry: Entry; onClose: () => void; key?: string }) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const permalink = instagramPermalink(entry.ref);
  // onClose เปลี่ยน identity ทุกครั้งที่หน้าแรก re-render (settings SSE ฯลฯ) — เก็บใน ref ไม่ให้ effect ด้านล่างรันซ้ำแล้วดึงโฟกัสกลับ
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && panelRef.current) {
        const els = panelRef.current.querySelectorAll<HTMLElement>('a[href], button, iframe');
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, []);

  return createPortal(
    <motion.div
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}
      className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-6"
    >
      <div aria-hidden className="absolute inset-0 bg-uf-bg/85 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-label={`โพสต์ Instagram: ${entry.title}`}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 24 }} transition={{ duration: 0.25 }}
        className="relative w-full max-w-[520px] max-h-[calc(100svh-24px)] flex flex-col uf-glass !bg-uf-bg/95 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-uf-line">
          <Instagram size={18} aria-hidden className="text-uf-lemon shrink-0" />
          <p className="flex-1 min-w-0 text-sm font-bold text-uf-text truncate">{entry.title}</p>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าต่าง Instagram" className="w-10 h-10 rounded-full flex items-center justify-center text-uf-muted hover:text-uf-text hover:bg-uf-text/5"><X size={20} /></button>
        </div>
        <div className="relative flex-1 min-h-0 overflow-y-auto bg-white">
          {!loaded && (
            <p className="absolute inset-x-0 top-16 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden /> กำลังโหลดจาก Instagram…</p>
          )}
          <iframe
            src={instagramEmbedUrl(entry.ref)}
            title={`โพสต์ Instagram: ${entry.title}`}
            onLoad={() => setLoaded(true)}
            className="relative block w-full border-0"
            style={{ height: entry.ref.kind === 'reel' ? 760 : 680 }}
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture; clipboard-write"
          />
        </div>
        <div className="px-4 py-3 border-t border-uf-line flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-uf-faint">ไม่แสดง? โพสต์อาจถูกลบหรือเป็นบัญชีส่วนตัว</p>
          <a href={permalink} target="_blank" rel="noopener noreferrer" className="uf-btn-ghost !min-h-[40px] !py-2 !px-4 text-sm">
            เปิดบน Instagram <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** การ์ด 4:5 (สัดส่วนแนวตั้งของ Instagram) — ใช้รูปปกที่ admin อัปโหลด ถ้าไม่มีเป็นการ์ดแบรนด์
 *  (ดึงรูปปก/คำบรรยายจาก Instagram อัตโนมัติไม่ได้ถ้าไม่มี API token — ไม่ scrape) */
function Card({ entry, onOpen }: { entry: Entry; onOpen: (e: Entry, el: HTMLElement) => void; key?: string }) {
  const reel = entry.ref.kind === 'reel';
  const video = reel || entry.mediaType === 'video';
  const badge = reel ? 'Reels' : entry.mediaType === 'video' ? 'วิดีโอ' : entry.mediaType === 'carousel' ? 'อัลบั้ม' : 'ภาพ';
  const [coverFailed, setCoverFailed] = useState(false); // รูปปกเสีย/ถูกลบ/URL จาก API หมดอายุ → กลับไปใช้การ์ดแบรนด์ ไม่โชว์ไอคอนรูปแตก
  return (
    <button
      type="button"
      onClick={e => onOpen(entry, e.currentTarget)}
      className={`uf-card uf-card-hover group relative w-full ${reel ? 'aspect-[9/16]' : 'aspect-[4/5]'} overflow-hidden text-left flex flex-col justify-end`}
    >
      {entry.cover && !coverFailed ? (
        <img src={entry.cover} alt="" loading="lazy" decoding="async" onError={() => setCoverFailed(true)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(221,243,75,0.22),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(54,217,245,0.22),transparent_60%),linear-gradient(160deg,#102D50,#071326)]">
          <Instagram size={56} strokeWidth={1.25} className="absolute inset-0 m-auto text-uf-text/25 transition-transform duration-500 group-hover:scale-110" />
        </span>
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-uf-bg/95 via-uf-bg/25 to-transparent" />
      <span className="absolute left-3 top-3 flex gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${video ? 'bg-uf-cyan text-uf-bg' : 'bg-uf-bg/75 text-uf-text'}`}>{badge}</span>
        {entry.pinned && <span className="rounded-full bg-uf-lemon text-uf-bg px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1"><Pin size={11} aria-hidden />ปักหมุด</span>}
      </span>
      {video && <span aria-hidden className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-uf-bg/60 text-uf-lemon flex items-center justify-center"><Play size={22} fill="currentColor" className="ml-0.5" /></span>}
      <span className="relative p-4 block">
        <span className="block text-[15px] font-bold leading-snug text-uf-text line-clamp-2 group-hover:text-uf-lemon transition-colors">
          <span className="sr-only">เปิดดู{reel ? ' Reels' : badge} Instagram: </span>{entry.title}
        </span>
        <span aria-hidden className="mt-1 block text-xs text-uf-faint">แตะเพื่อดูบนหน้านี้</span>
      </span>
    </button>
  );
}

/** SECTION — Instagram (โพสต์ + Reels) จาก collection "instagram" (admin ใส่ลิงก์เอง หรือจาก sync ฝั่ง server ในอนาคต)
 *  เป็น PageBlock ของตัวเอง (type "instagram") — admin จัดลำดับ/ซ่อนได้ในแท็บ "หน้าแรก"
 *  โปรไฟล์ = settings.contact.instagram (ช่องเดียวกับ Footer) หรือ @thaikaomaiparty · ไม่มีรายการ = แผงติดตามกะทัดรัด */
export default function InstagramFeed({ items, profileUrl }: { items: InstagramItem[]; profileUrl?: string }) {
  const entries = useMemo<Entry[]>(() => items
    .map(i => ({ ...i, ref: parseInstagramUrl(i.url) as InstagramRef }))
    .filter(i => i.ref && i.title)
    // ปักหมุดก่อน → ลำดับที่ admin จัด → วันที่โพสต์ (เมื่อมีจาก sync ในอนาคต)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.order ?? 999) - (b.order ?? 999) || (b.postedAt || '').localeCompare(a.postedAt || '')), [items]);

  const [open, setOpen] = useState<Entry | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // settings.contact.instagram ยังเป็น "#"/ว่าง → ใช้บัญชีทางการ @thaikaomaiparty
  const profile = normalizeInstagramProfile(profileUrl) || OFFICIAL_INSTAGRAM_PROFILE;

  const follow = (
    <a href={profile} target="_blank" rel="noopener noreferrer" className="uf-btn-primary">
      <Instagram size={18} aria-hidden /> ติดตามบน Instagram
    </a>
  );

  // ยังไม่มีโพสต์ (Manual Mode ยังไม่ได้ใส่ลิงก์ / ยังไม่เปิด sync) → แผงติดตามกะทัดรัด ไม่สร้างการ์ดปลอม
  if (entries.length === 0) {
    return (
      <section aria-label="Instagram ของพรรค" className="py-6">
        <div className="uf-container">
          <div className="uf-card relative overflow-hidden p-5 md:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div aria-hidden className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-uf-cyan/10 blur-[60px]" />
            <span aria-hidden className="relative w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-uf-lemon to-uf-cyan text-uf-bg flex items-center justify-center"><Instagram size={28} /></span>
            <div className="relative flex-1">
              <p className="uf-eyebrow mb-1">Instagram</p>
              <p className="uf-h3 text-uf-text">ติดตามภาพและ Reels ล่าสุดของพรรค</p>
            </div>
            <div className="relative">{follow}</div>
          </div>
        </div>
      </section>
    );
  }

  // โพสต์ (ภาพ/วิดีโอ/อัลบั้ม 4:5) กับ Reels (9:16) แยกแถว — สัดส่วนต่างกันมาก วางกริดเดียวกันจะเป็นฟันปลา
  // เดสก์ท็อป = กริด 4 คอลัมน์ (โพสต์สูงสุด 2 แถว, Reels 1 แถว) · มือถือ/แท็บเล็ต = เลื่อนแนวนอน + ปุ่มก่อนหน้า/ถัดไป
  const posts = entries.filter(e => e.ref.kind === 'post');
  const reels = entries.filter(e => e.ref.kind === 'reel');
  const shownPosts = posts.slice(0, POST_LIMIT);
  const shownReels = reels.slice(0, REEL_LIMIT);
  const more = posts.length > POST_LIMIT || reels.length > REEL_LIMIT;
  const openEntry = (e: Entry, el: HTMLElement) => { returnFocus.current = el; setOpen(e); };
  const close = () => { setOpen(null); setTimeout(() => returnFocus.current?.focus(), 0); };
  const count = (n: number) => <span className="text-sm font-bold text-uf-faint">({n})</span>;

  return (
    <section id="uf-instagram" aria-labelledby="uf-instagram-title" className="uf-section">
      <div className="uf-container">
        <SectionHeader id="uf-instagram-title" eyebrow="Instagram · @thaikaomaiparty" title="ภาพ วิดีโอ และ Reels" accent="จากไทยก้าวใหม่" action={follow} />

        {shownPosts.length > 0 && (
          <Carousel label="โพสต์ Instagram" title={<>โพสต์ล่าสุด {count(posts.length)}</>} listClassName="lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
            {shownPosts.map(e => (
              <li key={e.id} className="shrink-0 w-[72%] sm:w-[44%] md:w-[31%] lg:w-auto">
                <Card entry={e} onOpen={openEntry} />
              </li>
            ))}
          </Carousel>
        )}

        {shownReels.length > 0 && (
          <Carousel label="Reels Instagram" title={<>Reels {count(reels.length)}</>} className={shownPosts.length ? 'mt-10' : ''} listClassName="lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
            {shownReels.map(e => (
              <li key={e.id} className="shrink-0 w-[46%] sm:w-[31%] md:w-[23%] lg:w-auto">
                <Card entry={e} onOpen={openEntry} />
              </li>
            ))}
          </Carousel>
        )}

        {more && (
          <p className="mt-6">
            <a href={profile} target="_blank" rel="noopener noreferrer" className="uf-btn-ghost">ดูทั้งหมดบน Instagram <ExternalLink size={16} aria-hidden /></a>
          </p>
        )}

        <p className="mt-4 text-xs text-uf-faint">การเปิดดูโพสต์จะโหลดเนื้อหาจาก Instagram (อาจมีคุกกี้ของ Instagram) — ระบบไม่โหลดอะไรจาก Instagram จนกว่าจะกดเปิด</p>
      </div>

      <AnimatePresence>{open && <Viewer key={open.id} entry={open} onClose={close} />}</AnimatePresence>
    </section>
  );
}
