import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, User } from 'lucide-react';
import { subscribeToTeam } from '../services/dataService';
import { TeamMember } from '../types';
import { TEAM as FALLBACK } from '../constants';
import { SkeletonBox } from '../components/Skeleton';

const CATEGORY_LABEL: Record<TeamMember['category'], string> = {
  chairman: 'ประธานพรรค',
  leader: 'ทีมผู้นำพรรค',
  expert: 'กรรมการบริหารพรรค',
};

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTeam((data) => {
      if (data.length > 0) setTeam(data);
      setLoading(false);
    });
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const member = team.find(m => m.id === id);

  useEffect(() => {
    if (!loading && !member) navigate('/team', { replace: true });
  }, [loading, member]);

  // Dynamic SEO meta tags
  useEffect(() => {
    if (!member) return;
    const siteName = 'พรรคไทยก้าวใหม่';
    const prevTitle = document.title;
    document.title = `${member.name} — ${siteName}`;

    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr.split('=')[0], attr.split('=')[1] || ''); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };

    setMeta('meta[name="description"]', 'name=description', member.bio);
    setMeta('meta[property="og:title"]', 'property=og:title', `${member.name} — ${siteName}`);
    setMeta('meta[property="og:description"]', 'property=og:description', member.bio);
    setMeta('meta[property="og:type"]', 'property=og:type', 'profile');
    if (member.image) setMeta('meta[property="og:image"]', 'property=og:image', member.image);

    return () => {
      document.title = prevTitle;
    };
  }, [member]);

  if (loading) {
    return (
      <main className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SkeletonBox className="h-6 w-32 mb-10" />
        <SkeletonBox className="aspect-[3/4] w-64 rounded-[40px] mb-10" />
        <SkeletonBox className="h-12 w-3/4 mb-4" />
        <SkeletonBox className="h-5 w-full mb-3" />
        <SkeletonBox className="h-5 w-4/5 mb-3" />
      </main>
    );
  }

  if (!member) return null;

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          <Link to="/team" className="inline-flex items-center gap-2 text-white/50 hover:text-brand-neon transition-colors mb-10 font-bold">
            <ArrowLeft size={18} /> กลับหน้าทีมพรรค
          </Link>

          <div className="flex flex-col md:flex-row gap-10 mb-10">
            <div className="w-full md:w-80 lg:w-96 aspect-[3/4] rounded-[40px] overflow-hidden border border-white/10 shrink-0 bg-white/5 flex items-center justify-center">
              {member.image ? (
                <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={80} strokeWidth={1} className="text-white/15" />
              )}
            </div>

            <div className="flex flex-col justify-center">
              <span className="bg-brand-neon text-brand-navy text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest w-fit mb-4">
                {CATEGORY_LABEL[member.category]}
              </span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-3">
                {member.name}
              </h1>
              <p className="text-brand-neon font-bold uppercase tracking-widest text-sm">{member.role}</p>
            </div>
          </div>

          {/* Bio summary */}
          <p className="text-xl text-brand-neon/80 font-medium leading-relaxed mb-10 border-l-4 border-brand-neon pl-6">
            {member.bio}
          </p>

          {/* Full history */}
          {member.content ? (
            <div className="text-white/70 text-lg leading-relaxed whitespace-pre-wrap">
              {member.content}
            </div>
          ) : (
            <p className="text-white/30 text-base">ยังไม่มีข้อมูลประวัติเพิ่มเติม</p>
          )}

          {/* Back */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <Link to="/team" className="outline-button">
              <ArrowLeft size={18} /> ดูทีมพรรคทั้งหมด
            </Link>
          </div>

        </motion.div>
      </div>
    </main>
  );
}
