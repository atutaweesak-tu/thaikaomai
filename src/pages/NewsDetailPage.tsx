import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { subscribeToNews } from '../services/dataService';
import { NewsItem } from '../types';
import { NEWS as FALLBACK } from '../constants';
import { SkeletonBox } from '../components/Skeleton';

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToNews((data) => {
      if (data.length > 0) setNews(data);
      setLoading(false);
    });
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const article = news.find(n => n.id === id);

  useEffect(() => {
    if (!loading && !article) navigate('/news', { replace: true });
  }, [loading, article]);

  // Dynamic SEO meta tags
  useEffect(() => {
    if (!article) return;
    const siteName = 'พรรคไทยก้าวใหม่';
    const prevTitle = document.title;
    document.title = `${article.title} — ${siteName}`;

    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr.split('=')[0], attr.split('=')[1] || ''); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };

    setMeta('meta[name="description"]', 'name=description', article.summary);
    setMeta('meta[property="og:title"]', 'property=og:title', `${article.title} — ${siteName}`);
    setMeta('meta[property="og:description"]', 'property=og:description', article.summary);
    setMeta('meta[property="og:type"]', 'property=og:type', 'article');
    if (article.image) setMeta('meta[property="og:image"]', 'property=og:image', article.image);
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', `${article.title} — ${siteName}`);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', article.summary);
    if (article.image) setMeta('meta[name="twitter:image"]', 'name=twitter:image', article.image);

    return () => {
      document.title = prevTitle;
    };
  }, [article]);

  if (loading) {
    return (
      <main className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SkeletonBox className="h-6 w-32 mb-10" />
        <SkeletonBox className="aspect-[21/9] rounded-[40px] mb-10" />
        <SkeletonBox className="h-12 w-3/4 mb-4" />
        <SkeletonBox className="h-5 w-full mb-3" />
        <SkeletonBox className="h-5 w-4/5 mb-3" />
        <SkeletonBox className="h-5 w-full" />
      </main>
    );
  }

  if (!article) return null;

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <Link to="/news" className="inline-flex items-center gap-2 text-white/50 hover:text-brand-neon transition-colors mb-10 font-bold">
            <ArrowLeft size={18} /> กลับหน้าข่าวสาร
          </Link>

          {/* Cover Image */}
          {article.image && (
            <div className="aspect-[21/9] rounded-[40px] overflow-hidden border border-white/10 mb-10">
              <img src={article.image} alt={article.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <span className="bg-brand-neon text-brand-navy text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5">
              <Tag size={12} /> {article.category}
            </span>
            <span className="text-white/40 text-sm flex items-center gap-1.5">
              <Calendar size={14} /> {article.date}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-8">
            {article.title}
          </h1>

          {/* Summary */}
          <p className="text-xl text-brand-neon/80 font-medium leading-relaxed mb-10 border-l-4 border-brand-neon pl-6">
            {article.summary}
          </p>

          {/* Content */}
          <div className="text-white/70 text-lg leading-relaxed whitespace-pre-wrap">
            {article.content}
          </div>

          {/* Back */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <Link to="/news" className="outline-button">
              <ArrowLeft size={18} /> ดูข่าวสารทั้งหมด
            </Link>
          </div>

        </motion.div>
      </div>
    </main>
  );
}
