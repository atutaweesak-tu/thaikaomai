import React, { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Play, Youtube, ExternalLink } from 'lucide-react';
import { VideoItem } from '../../types';
import { extractYouTubeId, youtubeEmbedUrl } from '../../utils/youtube';
import { formatThaiDate } from '../../utils/bangkokTime';
import { isSafeHttpUrl } from '../../utils/safeUrl';
import { Carousel, SectionHeader } from './shared';

type Clip = VideoItem & { ytId: string };

/** ป้ายไลฟ์ — มาจาก liveBroadcastContent ของ YouTube (sync) หรือ admin เลือกเอง */
function LiveBadge({ clip, className = '' }: { clip: Clip; className?: string }) {
  if (clip.type === 'live') return <span className={`rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white ${className}`}>● LIVE</span>;
  if (clip.type === 'upcoming') return <span className={`rounded-full bg-uf-bg/80 px-2 py-0.5 text-[11px] font-bold text-uf-cyan ${className}`}>กำลังจะไลฟ์{clip.scheduledStart ? ` · ${formatThaiDate(clip.scheduledStart)}` : ''}</span>;
  return null;
}

const watchUrl = (c: Clip) => (c.type === 'short' ? `https://www.youtube.com/shorts/${c.ytId}` : `https://www.youtube.com/watch?v=${c.ytId}`);
const thumb = (id: string, size: 'mq' | 'hq' | 'maxres') => `https://i.ytimg.com/vi/${id}/${size}default.jpg`;

/** รูปปกตอบสนองขนาดจอ — mq 320w / hq 480w มีทุกคลิปเสมอ · คลิปเด่นลอง maxres (1280w) ก่อน ถ้าไม่มีจะถอยเป็น hq */
function Thumb({ id, featured = false, className = '' }: { id: string; featured?: boolean; className?: string }) {
  const [failed, setFailed] = useState<'none' | 'maxres' | 'all'>('none');
  if (failed === 'all') return <Youtube aria-hidden size={40} className="absolute inset-0 m-auto text-uf-faint/50" />;
  const useMax = featured && failed === 'none';
  return (
    <img
      src={useMax ? thumb(id, 'maxres') : thumb(id, 'hq')}
      srcSet={useMax ? undefined : `${thumb(id, 'mq')} 320w, ${thumb(id, 'hq')} 480w`}
      sizes={useMax ? undefined : '(max-width: 640px) 72vw, 320px'}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(f => (f === 'none' && useMax ? 'maxres' : 'all'))}
      // maxres ที่ไม่มีจริง YouTube ส่งภาพเทาขนาด 120×90 กลับมา (ไม่ error) — ตรวจขนาดแล้วถอยเป็น hq
      onLoad={e => { if (useMax && e.currentTarget.naturalWidth <= 120) setFailed('maxres'); }}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
    />
  );
}

/** ผู้เล่นแบบ facade: แสดงรูปปก + ปุ่มเล่น — iframe (youtube-nocookie) โหลดเมื่อกดเท่านั้น, เล่นเมื่อผู้ใช้กดเองจึงไม่ใช่ autoplay ที่มีเสียงโดยไม่ตั้งใจ */
function Player({ clip, playing, onPlay, vertical = false, featured = false }: { clip: Clip; playing: boolean; onPlay: () => void; vertical?: boolean; featured?: boolean; key?: string }) {
  const ratio = vertical ? 'aspect-[9/16]' : 'aspect-video';
  if (playing) {
    return (
      <div className={`${ratio} w-full bg-black`}>
        <iframe
          src={`${youtubeEmbedUrl(clip.ytId)}?autoplay=1&rel=0&playsinline=1`}
          title={clip.title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    <button type="button" onClick={onPlay} aria-label={`เล่นคลิป: ${clip.title}`} className={`group relative ${ratio} w-full overflow-hidden bg-uf-surface block`}>
      <Thumb id={clip.ytId} featured={featured} className="transition-transform duration-700 group-hover:scale-[1.03]" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-uf-bg/85 via-uf-bg/10 to-transparent" />
      <span aria-hidden className={`absolute inset-0 m-auto ${featured ? 'w-20 h-20' : vertical ? 'w-12 h-12' : 'w-14 h-14'} rounded-full bg-uf-lemon text-uf-bg flex items-center justify-center shadow-[0_0_0_8px_rgba(221,243,75,0.18)] transition-shadow group-hover:shadow-[0_0_0_12px_rgba(54,217,245,0.3),0_0_40px_rgba(54,217,245,0.6)]`}>
        <Play size={featured ? 30 : vertical ? 20 : 24} fill="currentColor" className="ml-0.5" />
      </span>
      {vertical && <span aria-hidden className="absolute left-2 top-2 rounded-full bg-uf-bg/70 px-2 py-0.5 text-[11px] font-bold text-uf-text">Shorts</span>}
    </button>
  );
}

/** SECTION 06B — Thai Kao Mai Channel V3: คลิปเด่น (ผู้เล่น + ข้อมูล) · แถวคลิปทั้งหมด · แถว Shorts 9:16
 *  ข้อมูลจาก collection "videos" (cache ฝั่ง server) — admin ใส่ลิงก์เอง + คลิปที่ sync จากช่องทางการ (server/youtubeSync.ts)
 *  หน้าเว็บไม่เรียก YouTube API เอง · ไม่สร้างคลิปขึ้นเอง */
export default function VideoChannel({ videos, channelUrl, display }: { videos: VideoItem[]; channelUrl?: string; display?: { showShorts: boolean; maxVideos: number } }) {
  const max = Math.max(1, display?.maxVideos || 24);
  const clips = useMemo<Clip[]>(() => videos
    .map(v => ({ ...v, ytId: extractYouTubeId(v.url) || '' }))
    .filter(v => v.ytId && v.title)
    // ปักหมุดก่อน → ลำดับที่ admin จัด (คลิปใหม่/คลิปจาก sync ได้ order น้อยสุด = ขึ้นก่อน) → วันที่ใหม่ก่อน
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.order ?? 999) - (b.order ?? 999) || (b.date || '').localeCompare(a.date || '')), [videos]);

  // จำนวนสูงสุด (admin ตั้ง) ใช้กับคลิปปกติและ Shorts แยกกัน · ปิด Shorts = ไม่แสดงแถว Shorts
  const longClips = clips.filter(c => c.type !== 'short').slice(0, max);
  const shorts = display?.showShorts === false ? [] : clips.filter(c => c.type === 'short').slice(0, max);
  const categories = Array.from(new Set(longClips.map(c => c.category).filter(Boolean))) as string[];

  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const channel = channelUrl && isSafeHttpUrl(channelUrl) ? channelUrl : '';
  const channelLink = channel && (
    <a href={channel} target="_blank" rel="noopener noreferrer" className="uf-btn-ghost">
      <Youtube size={18} aria-hidden /> ไปที่ช่อง YouTube <ExternalLink size={14} aria-hidden />
    </a>
  );

  // ── ยังไม่มีคลิป: แผงช่องทางการแบบกะทัดรัด (ไม่มีช่องว่างรอคลิป ไม่แต่งคลิปขึ้นเอง) ──
  if (longClips.length === 0 && shorts.length === 0) {
    if (!channel) return null;
    return (
      <section aria-label="ช่อง YouTube" className="py-6">
        <div className="uf-container">
          <div className="uf-card relative overflow-hidden p-5 md:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div aria-hidden className="absolute -left-10 -top-16 w-48 h-48 rounded-full bg-uf-lemon/10 blur-[60px]" />
            <span aria-hidden className="relative w-14 h-14 shrink-0 rounded-2xl bg-uf-lemon text-uf-bg flex items-center justify-center shadow-[0_0_0_6px_rgba(221,243,75,0.15)]">
              <Youtube size={28} />
            </span>
            <div className="relative flex-1">
              <p className="uf-eyebrow mb-1">Thai Kao Mai Channel</p>
              <p className="uf-h3 text-uf-text">ติดตามคลิปล่าสุดของพรรคบน YouTube</p>
            </div>
            <div className="relative">{channelLink}</div>
          </div>
        </div>
      </section>
    );
  }

  const filtered = category === 'all' ? longClips : longClips.filter(c => c.category === category);
  // คลิปเด่นอัตโนมัติ (admin ไม่ได้เลือก): ไลฟ์ที่กำลังออกอากาศ → คลิปที่ดูได้แล้ว → ที่เหลือ (ไม่ให้ไลฟ์ที่ยังไม่เริ่มขึ้นเป็นคลิปเด่นเอง)
  const featured = filtered.find(c => c.id === selectedId) || filtered.find(c => c.featured) || filtered.find(c => c.type === 'live') || filtered.find(c => c.type !== 'upcoming') || filtered[0];
  const rest = filtered.filter(c => c !== featured);

  const pick = (c: Clip) => {
    setSelectedId(c.id);
    setPlayingId(c.id);
    featuredRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <section id="uf-videos" aria-labelledby="uf-videos-title" className="uf-section">
      <div className="uf-container">
        <SectionHeader id="uf-videos-title" eyebrow="Thai Kao Mai Channel" title="คลิปล่าสุด" accent="จากไทยก้าวใหม่" action={channelLink || undefined} />

        {categories.length > 0 && (
          <div role="group" aria-label="หมวดคลิป" className="uf-scroll-x gap-2 mb-6 -mx-1 px-1">
            {['all', ...categories].map(c => (
              <button
                key={c} type="button" aria-pressed={category === c}
                onClick={() => { setCategory(c); setSelectedId(null); setPlayingId(null); }}
                className={`shrink-0 rounded-full px-4 min-h-[40px] text-sm font-bold border transition-colors ${category === c ? 'bg-uf-cyan text-uf-bg border-uf-cyan' : 'border-uf-line text-uf-muted hover:text-uf-text'}`}
              >
                {c === 'all' ? 'ทั้งหมด' : c}
              </button>
            ))}
          </div>
        )}

        {/* ── คลิปเด่น: ผู้เล่น 8 คอลัมน์ + แผงข้อมูล 4 คอลัมน์ (มือถือเรียงบน-ล่าง) ── */}
        {featured && (
          <div ref={featuredRef} className="uf-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 mb-10 scroll-mt-24">
            <div className="lg:col-span-8">
              <Player key={featured.id} clip={featured} featured playing={playingId === featured.id} onPlay={() => setPlayingId(featured.id)} />
            </div>
            <motion.div
              key={featured.id}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-4 p-5 md:p-7 flex flex-col justify-center gap-3 border-t lg:border-t-0 lg:border-l border-uf-line"
            >
              <p className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-bold text-uf-lemon">คลิปเด่น</span>
                <LiveBadge clip={featured} />
                {featured.category && <span className="font-bold text-uf-cyan">{featured.category}</span>}
                {featured.date && <span className="text-uf-faint">{formatThaiDate(featured.date)}</span>}
              </p>
              <h3 className="uf-h3 text-uf-text line-clamp-3">{featured.title}</h3>
              <div className="flex flex-wrap gap-2.5 mt-2">
                {playingId !== featured.id && (
                  <button type="button" onClick={() => setPlayingId(featured.id)} className="uf-btn-primary !min-h-[44px] !py-2.5 !px-5 text-sm">
                    <Play size={16} fill="currentColor" aria-hidden /> เล่นคลิป
                  </button>
                )}
                <a href={watchUrl(featured)} target="_blank" rel="noopener noreferrer" className="uf-btn-ghost !min-h-[44px] !py-2.5 !px-5 text-sm">
                  ดูบน YouTube <ExternalLink size={14} aria-hidden />
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── คลิปทั้งหมด (16:9) ── */}
        {rest.length > 0 && (
          <div className="mb-10">
            <Carousel label="คลิป" title={<>คลิปทั้งหมด <span className="text-sm font-bold text-uf-faint">({rest.length})</span></>}>
              {rest.map(c => (
                <li key={c.id} className="shrink-0 w-[72%] sm:w-[44%] md:w-[31%] lg:w-[calc((100%-3*16px)/4)]">
                  <button type="button" onClick={() => pick(c)} className="uf-card uf-card-hover group w-full h-full text-left overflow-hidden flex flex-col">
                    <span className="relative block aspect-video bg-uf-surface overflow-hidden">
                      <Thumb id={c.ytId} className="transition-transform duration-700 group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-uf-bg/70 text-uf-lemon flex items-center justify-center"><Play size={18} fill="currentColor" className="ml-0.5" /></span>
                      <LiveBadge clip={c} className="absolute left-2 top-2" />
                    </span>
                    <span className="p-4 block">
                      {(c.category || c.date) && (
                        <span className="flex gap-2 text-xs mb-1">
                          {c.category && <span className="font-bold text-uf-cyan">{c.category}</span>}
                          {c.date && <span className="text-uf-faint">{formatThaiDate(c.date)}</span>}
                        </span>
                      )}
                      <span className="block text-[15px] font-bold leading-snug text-uf-text line-clamp-2 group-hover:text-uf-lemon transition-colors">
                        <span className="sr-only">เล่นคลิป: </span>{c.title}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </Carousel>
          </div>
        )}

        {/* ── Shorts (9:16) — เล่นในการ์ดของตัวเอง ── */}
        {shorts.length > 0 && (
          <Carousel label="Shorts" title={<><span aria-hidden className="inline-block w-2 h-6 rounded-full bg-uf-lemon" /> Shorts <span className="text-sm font-bold text-uf-faint">({shorts.length})</span></>}>
            {shorts.map(c => (
              <li key={c.id} className="shrink-0 w-[46%] sm:w-[30%] md:w-[23%] lg:w-[calc((100%-5*16px)/6)]">
                <div className="uf-card overflow-hidden">
                  <Player clip={c} vertical playing={playingId === c.id} onPlay={() => setPlayingId(c.id)} />
                </div>
                <p className="mt-2 text-sm font-bold leading-snug text-uf-text line-clamp-2">{c.title}</p>
              </li>
            ))}
          </Carousel>
        )}
      </div>
    </section>
  );
}
