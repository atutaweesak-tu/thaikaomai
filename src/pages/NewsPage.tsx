import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Calendar, MapPin, Clock, Search, Newspaper } from 'lucide-react';
import { NEWS as FALLBACK_NEWS, EVENTS as FALLBACK_EVENTS } from '../constants';
import { subscribeToNews, subscribeToEvents, addNewsletterSubscriber, subscribeToSiteSettings, fetchCategories } from '../services/dataService';
import { NewsItem, EventItem, SiteSettings, DEFAULT_SETTINGS, NewsCategory } from '../types';
import { NewsCardSkeleton } from '../components/Skeleton';
import Honeypot from '../components/Honeypot';
import YouTubeEmbed from '../components/YouTubeEmbed';
import { upcomingEvents } from '../utils/events';

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS);
  const [events, setEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterWebsite, setNewsletterWebsite] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    const unsubNews = subscribeToNews((data) => {
      if (data.length > 0) setNews(data);
      setLoading(false);
    });
    const unsubEvents = subscribeToEvents((data) => {
      if (data.length > 0) setEvents(data);
    });
    const unsubSettings = subscribeToSiteSettings(setSettings);
    fetchCategories().then(setCategories);
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { unsubNews(); unsubEvents(); unsubSettings(); clearTimeout(timeout); };
  }, []);

  const visibleNews = news.filter(n => {
    if (n.published === false) return false;
    const now = new Date();
    if (n.publishAt && new Date(n.publishAt) > now) return false;
    if (n.unpublishAt && new Date(n.unpublishAt) < now) return false;
    return true;
  });

  const visibleEvents = upcomingEvents(events);

  // แสดง chip เฉพาะหมวดที่มีข่าวจริง เรียงตาม order ที่ตั้งไว้ในหน้า admin
  const usedCategoryNames = new Set(visibleNews.map(n => n.category));
  const categoryChips = categories
    .filter(c => usedCategoryNames.has(c.name))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => c.name);

  const byCategory = activeCategory
    ? visibleNews.filter(n => n.category === activeCategory)
    : visibleNews;

  const filtered = query.trim()
    ? byCategory.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.category.toLowerCase().includes(query.toLowerCase()) ||
        n.summary.toLowerCase().includes(query.toLowerCase())
      )
    : byCategory;

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus('sending');
    try {
      await addNewsletterSubscriber(newsletterEmail, newsletterWebsite);
      setNewsletterStatus('sent');
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
    }
  };

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-20"
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
            {settings.pages.newsHeading}
          </h1>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <p className="text-xl text-white/60 max-w-2xl leading-relaxed">
              {settings.pages.newsDescription}
            </p>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ค้นหาข่าวสาร..."
                className="w-full bg-white/5 border border-white/10 rounded-full pl-12 pr-6 py-3 focus:outline-none focus:border-brand-neon transition-colors placeholder:text-white/30"
              />
            </div>
          </div>
          {settings.pages.newsImage && (
            <div className="mt-10 rounded-[32px] overflow-hidden aspect-[21/7]">
              <img src={settings.pages.newsImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: settings.pages.newsImagePos || '50% 50%' }} referrerPolicy="no-referrer" />
            </div>
          )}
          {categoryChips.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-10">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                  activeCategory === null
                    ? 'bg-brand-neon text-brand-navy'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                ทั้งหมด
              </button>
              {categoryChips.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveCategory(name)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                    activeCategory === name
                      ? 'bg-brand-neon text-brand-navy'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-16">
            {loading ? (
              <>
                <NewsCardSkeleton />
                <NewsCardSkeleton />
              </>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Search size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-xl">
                  {query.trim()
                    ? `ไม่พบข่าวสารที่ตรงกับ "${query}"`
                    : `ไม่พบข่าวสารในหมวด "${activeCategory}"`}
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <Link to={`/news/${item.id}`}>
                    <div className="aspect-[21/9] rounded-[40px] overflow-hidden mb-8 border border-white/10 bg-white/5 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <Newspaper size={48} strokeWidth={1} className="text-white/15" />
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="bg-brand-neon text-brand-navy text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                      {item.category}
                    </span>
                    <span className="text-white/40 text-sm font-medium">{item.date}</span>
                  </div>
                  <Link to={`/news/${item.id}`}>
                    <h2 className="text-4xl font-black tracking-tighter mb-6 group-hover:text-brand-neon transition-colors leading-[1.1]">
                      {item.title}
                    </h2>
                  </Link>
                  <p className="text-white/60 text-lg leading-relaxed mb-8">{item.summary}</p>
                  <Link to={`/news/${item.id}`} className="outline-button">อ่านต่อ</Link>
                </motion.article>
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-12">
              <div>
                <h3 className="text-2xl font-black tracking-tighter mb-8">กิจกรรมที่กำลังจะมาถึง</h3>
                {visibleEvents.length === 0 ? (
                  <p className="text-white/40 text-sm leading-relaxed">
                    ยังไม่มีกิจกรรมที่กำหนดการในขณะนี้ — ติดตามประกาศจากพรรคเร็วๆ นี้
                  </p>
                ) : (
                  <div className="space-y-6">
                    {visibleEvents.map((event) => (
                      <div key={event.id} className="group bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 hover:border-brand-neon/30 transition-all">
                        <div className="flex items-center gap-3 text-brand-neon font-bold text-sm mb-4">
                          <Calendar size={16} />
                          <span>{event.date}</span>
                        </div>
                        <Link to={`/events/${event.id}`} className="block">
                          <h4 className="text-xl font-bold mb-4 tracking-tight group-hover:text-brand-neon transition-colors">{event.title}</h4>
                        </Link>
                        <div className="space-y-2 text-sm text-white/40">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span>{event.time}</span>
                          </div>
                        </div>
                        {event.videoUrl && (
                          <YouTubeEmbed url={event.videoUrl} title={event.title} className="mt-4" />
                        )}
                        <Link to={`/events/${event.id}`} className="inline-flex items-center gap-1.5 text-brand-neon text-sm font-bold mt-4 hover:gap-3 transition-all">
                          ดูรายละเอียด <span aria-hidden>→</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-brand-neon rounded-[40px] p-8 text-brand-navy">
                <h3 className="text-2xl font-black tracking-tighter mb-4">รับข่าวสาร</h3>
                <p className="text-brand-navy/70 text-sm font-medium mb-6">รับข่าวสารล่าสุดตรงถึงอีเมลของคุณ</p>
                {newsletterStatus === 'sent' ? (
                  <p className="font-black text-center py-4">สมัครสำเร็จ! ขอบคุณ</p>
                ) : (
                  <form onSubmit={handleNewsletter}>
                    <Honeypot value={newsletterWebsite} onChange={setNewsletterWebsite} />
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={e => setNewsletterEmail(e.target.value)}
                      placeholder="อีเมลของคุณ"
                      required
                      className="w-full bg-white/20 border border-brand-navy/10 rounded-full px-6 py-3 text-brand-navy placeholder:text-brand-navy/40 focus:outline-none mb-4"
                    />
                    {newsletterStatus === 'error' && (
                      <p className="text-brand-navy/70 text-xs mb-2">เกิดข้อผิดพลาด กรุณาลองใหม่</p>
                    )}
                    <button
                      type="submit"
                      disabled={newsletterStatus === 'sending'}
                      className="w-full bg-brand-navy text-brand-neon font-black py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {newsletterStatus === 'sending' ? 'กำลังสมัคร...' : 'สมัครรับข่าวสาร'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
