import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Calendar, MapPin, Clock, ArrowRight, Newspaper } from 'lucide-react';
import { NEWS as FALLBACK_NEWS, EVENTS as FALLBACK_EVENTS } from '../constants';
import { subscribeToNews, subscribeToEvents } from '../services/dataService';
import { NewsItem, EventItem } from '../types';

export default function NewsSection() {
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS);
  const [events, setEvents] = useState<EventItem[]>(FALLBACK_EVENTS);

  useEffect(() => {
    const unsubNews = subscribeToNews((data) => {
      if (data.length > 0) setNews(data);
    });
    const unsubEvents = subscribeToEvents((data) => {
      if (data.length > 0) setEvents(data);
    });

    return () => {
      unsubNews();
      unsubEvents();
    };
  }, []);

  const visibleNews = news.filter(n => {
    if (n.published === false) return false;
    const now = new Date();
    if (n.publishAt && new Date(n.publishAt) > now) return false;
    if (n.unpublishAt && new Date(n.unpublishAt) < now) return false;
    return true;
  });

  const visibleEvents = events.filter(ev => {
    if (ev.published === false) return false;
    const now = new Date();
    if (ev.publishAt && new Date(ev.publishAt) > now) return false;
    if (ev.unpublishAt && new Date(ev.unpublishAt) < now) return false;
    return true;
  });

  return (
    <section className="py-24 bg-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* News Feed */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-12">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter">
                NEWS & <br />
                <span className="text-brand-neon">UPDATES.</span>
              </h2>
              <Link to="/news" className="text-brand-neon font-bold flex items-center gap-2 hover:gap-4 transition-all">
                All News <ArrowRight size={20} />
              </Link>
            </div>

            {/* มือถือ: เลื่อนซ้าย-ขวาแบบ snap แทน stack เต็มความกว้างทีละใบ (การ์ดสูงเพราะมีรูป ทำให้
                หน้ายาวมากถ้า stack) — จอ md ขึ้นไปกลับไปใช้ grid ปกติเหมือนเดิม ไม่กระทบ desktop */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible">
              {visibleNews.map((item, index) => (
                <Link key={item.id} to={`/news/${item.id}`} className="shrink-0 w-[85%] snap-center md:w-auto md:shrink">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group cursor-pointer"
                  >
                    <div className="aspect-[16/9] rounded-3xl overflow-hidden mb-6 border border-white/10 bg-white/5 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <Newspaper size={40} strokeWidth={1} className="text-white/15" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="bg-brand-neon/10 text-brand-neon text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                        {item.category}
                      </span>
                      <span className="text-white/40 text-xs font-medium">
                        {item.date}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black tracking-tighter mb-4 group-hover:text-brand-neon transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                      {item.summary}
                    </p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Events Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 h-full">
              <h3 className="text-3xl font-black tracking-tighter mb-10">UPCOMING <br /> EVENTS.</h3>
              
              {/* มือถือ: เลื่อนซ้าย-ขวาแบบ snap เหมือนการ์ดข่าวด้านบน — ห่อการ์ดแต่ละ event ด้วย
                  กรอบบางๆ ให้เห็นขอบเขตตอนเลื่อน ส่วนจอ md ขึ้นไปกลับไปเป็น list แนวตั้งแบบเดิม */}
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:space-y-8 md:overflow-visible md:pb-0">
                {visibleEvents.map((event) => (
                  <div key={event.id} className="group cursor-pointer shrink-0 w-[80%] snap-center bg-white/5 border border-white/10 rounded-3xl p-5 md:w-auto md:shrink md:bg-transparent md:border-0 md:rounded-none md:p-0">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-brand-neon rounded-2xl flex flex-col items-center justify-center text-brand-navy shrink-0">
                        <span className="text-xs font-black leading-none">{event.date.split(' ')[0]}</span>
                        <span className="text-lg font-black leading-none">{event.date.split(' ')[1]?.replace(',', '') || ''}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-3 group-hover:text-brand-neon transition-colors">
                          {event.title}
                        </h4>
                        <div className="space-y-2 text-sm text-white/40">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-brand-neon" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-brand-neon" />
                            <span>{event.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="neon-button w-full justify-center mt-12">
                Join Event
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
