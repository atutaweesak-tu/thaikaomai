import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SiteSettings, HeroSlide } from '../../types';
import { openSafeUrl } from '../../utils/safeUrl';
import EnergyArrow from './EnergyArrow';
import { useOnScreen } from './shared';

const SLIDE_INTERVAL_MS = 6000;

type Hero = SiteSettings['hero'];
type TextKey = keyof NonNullable<Hero['textStyle']>;

/** สไลด์เลื่อนอัตโนมัติ — หยุดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว หรือ hero เลื่อนพ้นจอ
 *  นับเวลาใหม่ทุกครั้งที่เปลี่ยนภาพ (รวมตอนผู้ใช้กดเลือกเอง) ไม่ให้เด้งไปภาพถัดไปทันทีหลังกด */
function useSlideIndex(count: number, active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(i => (i >= count ? 0 : i)); }, [count]);
  useEffect(() => {
    if (count < 2 || !active) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % count), SLIDE_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [count, active, index]);
  return [index, setIndex] as const;
}

function SlideDots({ count, index, onSelect, className = '' }: { count: number; index: number; onSelect: (i: number) => void; className?: string }) {
  if (count < 2) return null;
  return (
    <div className={`flex gap-2 ${className}`} role="group" aria-label="เลือกภาพสไลด์">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i} type="button" onClick={() => onSelect(i)}
          aria-label={`ภาพที่ ${i + 1} จาก ${count}`} aria-current={i === index ? 'true' : undefined}
          className="h-6 flex items-center"
        >
          <span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-7 bg-uf-lemon' : 'w-2.5 bg-uf-text/35 hover:bg-uf-text/60'}`} />
        </button>
      ))}
    </div>
  );
}

/** SECTION 02 — Cinematic Hero
 *  เคารพ settings.hero.layout ที่ admin เลือก:
 *  - split (ค่าเริ่มต้น): ข้อความซ้าย + ฉากลูกศรพลังงาน + การ์ดรูปผู้นำ
 *  - imageOnly: แบนเนอร์เต็มความกว้าง แสดงครบทั้งภาพ (ไม่ครอป — แบนเนอร์มักมีตัวอักษรในภาพ)
 *  - full: แบนเนอร์เป็นพื้นหลัง + ข้อความทับ
 *  ข้อความจาก settings.hero — ใช้ visible/color ของ textStyle ส่วนขนาดใช้ type scale ของ design system */
export default function UfHero({ settings }: { settings: SiteSettings }) {
  const h = settings.hero;
  // ปิด animation (ผู้ใช้ตั้งลด motion หรือ admin เปิดโหมดสำรวม) → ข้อความ/ปุ่ม CTA/ภาพแสดงทันทีในสถานะสุดท้าย ไม่รอ delay
  const reduce = useReducedMotion() || settings.theme.solemn;
  const [sectionRef, onScreen] = useOnScreen<HTMLElement>();

  // ลำดับ fallback เดียวกับ Hero เดิม: split ใช้ slides → leaderImages → leaderImage; full/imageOnly ใช้ fullSlides (ไม่มี = ใช้ชุด split)
  const splitSlides: HeroSlide[] = h.slides?.length ? h.slides
    : h.leaderImages?.length ? h.leaderImages.map(image => ({ image }))
    : h.leaderImage ? [{ image: h.leaderImage }] : [];
  const fullSlides: HeroSlide[] = h.fullSlides?.length ? h.fullSlides : splitSlides;

  const layout = h.layout === 'imageOnly' || h.layout === 'full' || h.layout === 'cinematic' ? h.layout : 'split';
  const slides = layout === 'imageOnly' || layout === 'full' ? fullSlides : splitSlides;
  // ไม่เลื่อนสไลด์เอง: ผู้ใช้ตั้งลด motion หรือ admin เปิดโหมดสำรวม (ยังกดจุดเลือกภาพเองได้)
  const [index, setIndex] = useSlideIndex(slides.length, onScreen && !reduce && !settings.theme.solemn);

  // โหลดภาพสไลด์ถัดๆ ไปไว้ล่วงหน้า — สลับแล้วไม่เจอกรอบว่างระหว่างรอดาวน์โหลด
  const slideKey = slides.map(s => s.image.slice(0, 64)).join('|');
  useEffect(() => {
    slides.slice(1).forEach(s => { if (!s.image.startsWith('data:')) new Image().src = s.image; });
  }, [slideKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = slides[index] ?? slides[0];

  if (layout === 'imageOnly' && current) {
    return <BannerHero h={h} slides={slides} index={index} setIndex={setIndex} sectionRef={sectionRef} />;
  }

  if (layout === 'full' && current) {
    return (
      <section ref={sectionRef} aria-labelledby="uf-hero-title" className="relative overflow-hidden min-h-[710px] lg:min-h-[820px] flex items-end lg:items-center pt-[68px] lg:pt-20">
        <div aria-hidden className="absolute inset-0 bg-uf-bg">
          <AnimatePresence mode="sync">
            <motion.img
              key={index}
              src={current.image}
              alt=""
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-uf-bg via-uf-bg/75 to-uf-bg/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-uf-bg/90 via-uf-bg/40 to-transparent" />
        </div>
        <div className="uf-container relative z-10 w-full py-10 lg:py-16">
          <div className="max-w-2xl">
            <HeroText h={h} reduce={!!reduce} />
          </div>
          <SlideDots count={slides.length} index={index} onSelect={setIndex} className="mt-8" />
        </div>
      </section>
    );
  }

  // cinematic = ข้อความ + ฉากลูกศรพลังงาน (ไม่มีรูป) · split = ข้อความ + การ์ดรูปผู้นำ (ลูกศรเป็นแค่ฉากหลังจางๆ)
  const cinematic = layout === 'cinematic' || !current;
  const dots = <SlideDots count={slides.length} index={index} onSelect={setIndex} className="uf-glass rounded-full px-2.5" />;

  return (
    // มือถือไม่บังคับความสูงขั้นต่ำ — สูงเท่าเนื้อหา (กระชับ ไม่ตัดอะไร); เดสก์ท็อปคงฉาก cinematic ~820px
    <section ref={sectionRef} aria-labelledby="uf-hero-title" className="relative overflow-hidden lg:min-h-[820px] flex items-center pt-[68px] lg:pt-20">
      {/* พื้นหลัง: grid เส้นบางๆ + แสง */}
      <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#F7FAFF_1px,transparent_1px),linear-gradient(90deg,#F7FAFF_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_60%_40%,black,transparent_70%)]" />
      <div aria-hidden className="absolute -top-40 right-[-10%] w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] rounded-full bg-uf-surface/60 blur-[120px]" />

      <div className="uf-container relative z-10 w-full pt-6 pb-8 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-6 lg:gap-10 items-center">
          <div className="relative z-10">
            <HeroText h={h} reduce={!!reduce} />
          </div>

          {cinematic ? (
            // เดสก์ท็อป 45/55: ฉากจัตุรัสเต็มคอลัมน์ขวา · มือถือ: เรียงต่อจากข้อความเป็นแถบภาพเตี้ย (ฉากย่อให้พอดีความสูง)
            <div className="relative w-full h-[180px] sm:h-[280px] lg:h-auto lg:aspect-square lg:max-w-[640px] lg:mx-auto lg:mt-0">
              <EnergyArrow paused={!onScreen} />
            </div>
          ) : (
            <>
              {/* เดสก์ท็อป: การ์ดรูปใหญ่ + ฉากลูกศรจางๆ ด้านหลัง (ambient = ไม่มีอนุภาค/ชีพจร) */}
              <div className="hidden lg:block relative">
                <div aria-hidden className="absolute inset-[-6%] opacity-40"><EnergyArrow paused={!onScreen} variant="ambient" /></div>
                <LeaderCard h={h} slide={current} reduce={!!reduce} dots={dots} variant="large" />
              </div>
              {/* มือถือ/แท็บเล็ต: การ์ดแนวนอนกะทัดรัด — รูปยังอยู่ครบ */}
              <div className="lg:hidden">
                <LeaderCard h={h} slide={current} reduce={!!reduce} dots={dots} variant="compact" />
              </div>
            </>
          )}
        </div>
      </div>

      <motion.a
        {...fade(!!reduce, 1.7, true)}
        href="#uf-discovery"
        className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-1 text-xs font-bold text-uf-faint hover:text-uf-cyan transition-colors"
      >
        เลื่อนลง
        <ChevronDown size={18} className="motion-safe:animate-bounce" />
      </motion.a>
    </section>
  );
}

// V3: ข้อความและปุ่ม CTA "อ่านได้/กดได้ตั้งแต่เฟรมแรก" — เลื่อนเข้าเบาๆ อย่างเดียว ไม่เริ่มจาก opacity 0
// (เดิมปุ่มรอ 1.5s) · withOpacity = ของตกแต่งรอง (ตัวบอกเลื่อนลง) ค่อยจางเข้าได้ · ลด motion = แสดงทันที
function fade(reduce: boolean, delay: number, withOpacity = false) {
  return reduce ? {} : {
    initial: withOpacity ? { opacity: 0, y: 12 } : { y: 12 },
    animate: withOpacity ? { opacity: 1, y: 0 } : { y: 0 },
    transition: { duration: 0.4, delay, ease: 'easeOut' as const },
  };
}

function textHelpers(h: Hero) {
  const ts = h.textStyle;
  const show = (k: TextKey) => ts?.[k]?.visible !== false;
  const color = (k: TextKey) => (ts?.[k]?.color ? { color: ts[k]!.color } : undefined);
  const lines = [
    { key: 'heading1' as const, text: h.heading1, cls: 'text-uf-text' },
    { key: 'heading2' as const, text: h.heading2, cls: 'text-uf-lemon' },
    { key: 'heading3' as const, text: h.heading3, cls: 'text-uf-text' },
  ].filter(l => l.text && show(l.key));
  return { show, color, lines };
}

function HeroText({ h, reduce }: { h: Hero; reduce: boolean }) {
  const { show, color, lines } = textHelpers(h);
  return (
    <>
      {show('badge') && h.badge && (
        <motion.p {...fade(reduce, 0)} className="inline-flex items-center gap-2 uf-glass rounded-full px-4 py-2 mb-4 lg:mb-6 text-sm font-bold text-uf-muted" style={color('badge')}>
          <span className="w-2 h-2 rounded-full bg-uf-lemon shadow-[0_0_12px_#DDF34B]" />
          {h.badge}
        </motion.p>
      )}

      {lines.length > 0 && (
        <motion.h1 {...fade(reduce, 0.1)} id="uf-hero-title" className="uf-h1 mb-5 lg:mb-6">
          {lines.map((l, i) => (
            <React.Fragment key={l.key}>
              <span className={l.cls} style={color(l.key)}>{l.text}</span>
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </motion.h1>
      )}

      {show('description') && h.description && (
        <motion.p {...fade(reduce, 0.2)} className="uf-body text-uf-muted max-w-xl mb-8" style={color('description')}>
          {h.description}
        </motion.p>
      )}

      <HeroButtons h={h} reduce={reduce} />
    </>
  );
}

function HeroButtons({ h, reduce, className = '' }: { h: Hero; reduce: boolean; className?: string }) {
  const { show } = textHelpers(h);
  if (!show('buttonPrimary') && !show('buttonSecondary')) return null;
  return (
    <motion.div {...fade(reduce, 0.2)} className={`flex flex-wrap gap-2.5 sm:gap-3 ${className}`}>
      {show('buttonPrimary') && (
        <Link to={h.buttonPrimaryLink || '/policies'} className="uf-btn-primary max-sm:!px-4">
          {h.buttonPrimary || 'สำรวจนโยบาย'} <ArrowRight size={18} />
        </Link>
      )}
      {show('buttonSecondary') && (
        <Link to={h.buttonSecondaryLink || '/about'} className="uf-btn-ghost max-sm:!px-4">
          {h.buttonSecondary || 'รู้จักไทยก้าวใหม่'}
        </Link>
      )}
    </motion.div>
  );
}

/** รูปผู้นำ (layout split) — large: การ์ดใหญ่คอลัมน์ขวา (เดสก์ท็อป) · compact: การ์ดแนวนอนบนมือถือ
 *  สลับตามสไลด์ (crossfade) และกดได้ถ้า slide มีลิงก์ */
function LeaderCard({ h, slide, reduce, dots, variant }: { h: Hero; slide: HeroSlide; reduce: boolean; dots?: React.ReactNode; variant: 'large' | 'compact' }) {
  const { show } = textHelpers(h);
  // crossfade (ภาพใหม่ทับภาพเก่า) — ไม่มีช่วงการ์ดว่างระหว่างรอภาพเก่าหายแบบ mode="wait"
  const img = (
    <AnimatePresence initial={false}>
      <motion.img
        key={slide.image}
        src={slide.image}
        alt={h.leaderName || 'หัวหน้าพรรค'}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </AnimatePresence>
  );
  // กล่องสัดส่วนคงที่ — การ์ดไม่ยุบระหว่างภาพเก่าออก/ภาพใหม่เข้า
  const photo = (
    <div className={`relative aspect-[4/5] bg-uf-surface overflow-hidden ${variant === 'compact' ? 'w-28 shrink-0 rounded-2xl' : ''}`}>
      {slide.link ? (
        <button type="button" onClick={() => openSafeUrl(slide.link)} className="block w-full h-full" aria-label="เปิดลิงก์ของภาพนี้">{img}</button>
      ) : img}
    </div>
  );
  const caption = (h.leaderName || h.leaderTitle) && (show('leaderName') || show('leaderTitle')) && (
    <figcaption className={variant === 'large' ? 'px-5 py-4' : 'min-w-0'}>
      {h.leaderTitle && show('leaderTitle') && <span className="block text-xs font-bold text-uf-lemon">{h.leaderTitle}</span>}
      {h.leaderName && show('leaderName') && <span className={`block font-bold text-uf-text leading-snug ${variant === 'large' ? 'text-lg' : 'text-sm'}`}>{h.leaderName}</span>}
    </figcaption>
  );

  if (variant === 'compact') {
    return (
      <motion.figure {...fade(reduce, 0.3)} className="uf-glass rounded-3xl p-3 flex items-center gap-4">
        {photo}
        <div className="flex flex-col gap-3 min-w-0">
          {caption}
          {dots}
        </div>
      </motion.figure>
    );
  }
  return (
    <motion.figure {...fade(reduce, 0.3)} className="relative ml-auto w-full max-w-[420px] uf-glass rounded-[32px] overflow-hidden">
      {photo}
      {dots && <div className="absolute top-3 right-3">{dots}</div>}
      {caption}
    </motion.figure>
  );
}

/** layout imageOnly — แบนเนอร์ที่ admin อัปโหลด (แนะนำ 16:9) แสดงเต็มความกว้างแบบไม่ครอป
 *  สูงไม่เกินจอ (เหลือที่ให้ navbar) และมี h1 ซ่อนไว้ให้ screen reader/Google ตามหัวข้อ hero */
function BannerHero({ h, slides, index, setIndex, sectionRef }: {
  h: Hero; slides: HeroSlide[]; index: number; setIndex: (i: number) => void; sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const reduce = useReducedMotion();
  const slide = slides[index] ?? slides[0];
  const { lines } = textHelpers(h);
  const title = [h.heading1, h.heading2, h.heading3].filter(Boolean).join(' ') || 'พรรคไทยก้าวใหม่';
  // กล่องจองพื้นที่ 16:9 (สัดส่วนที่หน้า admin แนะนำ) ก่อนภาพโหลด — เดิมภาพไม่มีขนาด ทำให้เนื้อหาใต้แบนเนอร์กระโดดลง
  // ตอนภาพโหลดเสร็จ (Lighthouse CLS 0.5) · ภาพจริงอยู่ข้างในแบบ object-contain จึงไม่ครอปแม้สัดส่วนไม่ตรง 16:9
  // เดสก์ท็อป: เว้นท้ายจอ ~104px ให้ปุ่มลอยน้องเลม่อน (มุมขวาล่าง) ไม่ทับภาพตอนเปิดหน้า และเห็นการ์ดทางลัดโผล่ใต้แบนเนอร์
  const banner = (
    <div className="relative w-full aspect-video max-h-[calc(100svh-68px)] lg:max-h-[calc(100svh-184px)] mx-auto">
      <AnimatePresence initial={false}>
        <motion.img
          key={slide.image}
          src={slide.image}
          // HeroSlide ยังไม่มีฟิลด์คำอธิบายภาพ — ใช้คำกลางๆ แทนสโลแกน (แบนเนอร์อาจเป็นประกาศคนละเรื่องกับหัวข้อ hero)
          alt={`แบนเนอร์ประกาศ พรรคไทยก้าวใหม่${slides.length > 1 ? ` (ภาพที่ ${index + 1} จาก ${slides.length})` : ''}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
    </div>
  );

  // ไม่วาดอะไรทับ/ล้อมภาพแบนเนอร์ (ไม่มี glow, gradient, เส้นนีออน) — เนื้อหาแบนเนอร์เป็นของ admin และอาจเป็น
  // ประกาศที่ต้องการความสำรวม (เช่น แบนเนอร์ถวายอาลัยที่ใช้อยู่บน production ตอนนี้)
  return (
    <section ref={sectionRef} aria-labelledby="uf-hero-title" className="relative pt-[68px] lg:pt-20 bg-uf-bg">
      <h1 id="uf-hero-title" className="sr-only">{lines.length ? lines.map(l => l.text).join(' ') : title}</h1>
      <div className="relative">
        {slide.link ? (
          <button type="button" onClick={() => openSafeUrl(slide.link)} className="block w-full cursor-pointer" aria-label="แบนเนอร์ประกาศ — เปิดลิงก์">{banner}</button>
        ) : banner}
        {/* จุดสไลด์ไว้กลาง — มุมขวาล่างของจอเป็นที่ของปุ่มลอยน้องเลม่อน */}
        <SlideDots count={slides.length} index={index} onSelect={setIndex} className="absolute left-1/2 -translate-x-1/2 bottom-4 md:bottom-6 z-10 uf-glass rounded-full px-3" />
      </div>
    </section>
  );
}
