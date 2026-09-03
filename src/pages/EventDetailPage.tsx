import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Clock, MapPin, ExternalLink } from 'lucide-react';
import { subscribeToEvents } from '../services/dataService';
import { EventItem } from '../types';
import { EVENTS as FALLBACK } from '../constants';
import { SkeletonBox } from '../components/Skeleton';
import YouTubeEmbed from '../components/YouTubeEmbed';
import ShareButtons from '../components/ShareButtons';
import { isPublished } from '../utils/events';
import { openSafeUrl } from '../utils/safeUrl';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToEvents((data) => {
      if (data.length > 0) setEvents(data);
      setLoading(false);
    });
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const event = events.find(e => e.id === id);
  const gone = !loading && (!event || !isPublished(event));

  useEffect(() => {
    if (gone) navigate('/news', { replace: true });
  }, [gone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!event) return;
    const siteName = 'พรรคไทยก้าวใหม่';
    const prev = document.title;
    document.title = `${event.title} — ${siteName}`;
    return () => { document.title = prev; };
  }, [event]);

  if (loading) {
    return (
      <main className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SkeletonBox className="h-6 w-32 mb-10" />
        <SkeletonBox className="h-12 w-3/4 mb-6" />
        <SkeletonBox className="h-5 w-1/2 mb-3" />
        <SkeletonBox className="h-5 w-2/3" />
      </main>
    );
  }

  if (!event) return null;

  const past = event.startAt ? new Date(event.startAt).getTime() < Date.now() : false;

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <Link to="/news" className="inline-flex items-center gap-2 text-white/50 hover:text-brand-neon transition-colors mb-10 font-bold">
            <ArrowLeft size={18} /> กลับหน้าข่าวสาร & กิจกรรม
          </Link>

          {event.image && (
            <div className="aspect-[21/9] rounded-[40px] overflow-hidden border border-white/10 mb-10">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <span className={`text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${past ? 'bg-white/10 text-white/50' : 'bg-brand-neon text-brand-navy'}`}>
              {past ? 'กิจกรรมที่ผ่านมา' : 'กิจกรรมที่จะถึง'}
            </span>
            <ShareButtons title={event.title} label="" />
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-8">
            {event.title}
          </h1>

          {/* วัน/เวลา/สถานที่ */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-10 space-y-3">
            <div className="flex items-center gap-3 text-white/80">
              <Calendar size={18} className="text-brand-neon shrink-0" /> <span className="font-bold">{event.date}</span>
            </div>
            <div className="flex items-center gap-3 text-white/60">
              <Clock size={18} className="text-brand-neon shrink-0" /> <span>{event.time}</span>
            </div>
            <div className="flex items-start gap-3 text-white/60">
              <MapPin size={18} className="text-brand-neon shrink-0 mt-0.5" />
              <span>
                {event.location}
                {event.mapUrl && (
                  <button onClick={() => openSafeUrl(event.mapUrl)} className="ml-2 text-brand-neon font-bold text-sm inline-flex items-center gap-1 hover:underline">
                    ดูแผนที่ <ExternalLink size={13} />
                  </button>
                )}
              </span>
            </div>
          </div>

          {event.videoUrl && (
            <div className="mb-10">
              <YouTubeEmbed url={event.videoUrl} title={event.title} />
            </div>
          )}

          {event.content && (
            <div className="text-white/70 text-lg leading-relaxed whitespace-pre-wrap mb-10">
              {event.content}
            </div>
          )}

          {/* ลงทะเบียน */}
          {!past && event.registerUrl && (
            <button onClick={() => openSafeUrl(event.registerUrl)} className="neon-button text-lg px-8 py-4">
              ลงทะเบียนเข้าร่วมกิจกรรม <ExternalLink size={18} />
            </button>
          )}

          <div className="mt-14 pt-8 border-t border-white/10">
            <ShareButtons title={event.title} label="แชร์กิจกรรมนี้:" />
          </div>

          <div className="mt-10">
            <Link to="/news" className="outline-button">
              <ArrowLeft size={18} /> ดูข่าวสาร & กิจกรรมทั้งหมด
            </Link>
          </div>

        </motion.div>
      </div>
    </main>
  );
}
