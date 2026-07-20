import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';
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
              <button className="text-brand-neon font-bold flex items-center gap-2 hover:gap-4 transition-all">
                All News <ArrowRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {visibleNews.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group cursor-pointer"
                >
                  <div className="aspect-[16/9] rounded-3xl overflow-hidden mb-6 border border-white/10">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
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
              ))}
            </div>
          </div>

          {/* Events Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 h-full">
              <h3 className="text-3xl font-black tracking-tighter mb-10">UPCOMING <br /> EVENTS.</h3>
              
              <div className="space-y-8">
                {events.map((event) => (
                  <div key={event.id} className="group cursor-pointer">
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
