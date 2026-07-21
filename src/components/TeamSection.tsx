import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, User } from 'lucide-react';
import { TEAM as FALLBACK_TEAM } from '../constants';
import { subscribeToTeam } from '../services/dataService';
import { TeamMember } from '../types';

export default function TeamSection() {
  const [team, setTeam] = useState<TeamMember[]>(FALLBACK_TEAM);

  useEffect(() => {
    const unsub = subscribeToTeam((data) => {
      if (data.length > 0) setTeam(data);
    });
    return () => unsub();
  }, []);

  const visibleTeam = team.filter(m => m.published !== false);
  const featured = visibleTeam.filter(m => m.featuredHome === true).slice(0, 3);
  const homeTeam = featured.length > 0 ? featured : visibleTeam.slice(0, 3);

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            ทีมผู้นำ<br />
            <span className="text-brand-neon">พรรคไทยก้าวใหม่</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            ทีมนักวิชาการ นักการศึกษา และผู้เชี่ยวชาญที่มุ่งมั่นพัฒนาประเทศไทยให้ก้าวหน้า
          </p>
        </div>

        {/* มือถือ: เลื่อนซ้าย-ขวาแบบ snap แทน stack เต็มความกว้างทีละใบ — จอ md ขึ้นไปกลับไปใช้ grid ปกติ */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible">
          {homeTeam.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative shrink-0 w-[80%] snap-center md:w-auto md:shrink"
            >
              <div className="aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 mb-6 relative bg-white/5">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover transition-all duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={64} strokeWidth={1} className="text-white/15" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-transparent to-transparent opacity-60" />
              </div>
              <h3 className="text-2xl font-black tracking-tighter mb-1">{member.name}</h3>
              <p className="text-brand-neon text-sm font-bold uppercase tracking-widest mb-3">{member.role}</p>
              <p className="text-white/40 text-sm">{member.bio}</p>
            </motion.div>
          ))}
        </div>

        {visibleTeam.length > 3 && (
          <div className="text-center mt-16">
            <Link to="/team" className="neon-button text-lg px-10 py-4">
              ดูทีมทั้งหมด {visibleTeam.length} คน <ArrowRight size={20} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
