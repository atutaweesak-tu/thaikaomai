import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User } from 'lucide-react';
import { TEAM as FALLBACK_TEAM } from '../constants';
import { subscribeToTeam, subscribeToSiteSettings } from '../services/dataService';
import { TeamMember, SiteSettings, DEFAULT_SETTINGS } from '../types';

export default function TeamPage() {
  const [teamData, setTeamData] = useState<TeamMember[]>(FALLBACK_TEAM);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsubTeam = subscribeToTeam((data) => {
      if (data.length > 0) setTeamData(data);
    });
    const unsubSettings = subscribeToSiteSettings(setSettings);
    return () => { unsubTeam(); unsubSettings(); };
  }, []);

  const visibleTeam = teamData
    .filter(m => m.published !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const chairmen = visibleTeam.filter(m => m.category === 'chairman');
  const leaders = visibleTeam.filter(m => m.category === 'leader');
  const experts = visibleTeam.filter(m => m.category === 'expert');

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-20"
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
            {settings.pages.teamHeading}
          </h1>
          <p className="text-xl text-white/60 max-w-3xl leading-relaxed">
            {settings.pages.teamDescription}
          </p>
          {settings.pages.teamImage && (
            <div className="mt-10 rounded-[32px] overflow-hidden aspect-[21/7]">
              <img src={settings.pages.teamImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: settings.pages.teamImagePos || '50% 50%' }} referrerPolicy="no-referrer" />
            </div>
          )}
        </motion.div>

        {chairmen.length > 0 && (
          <div className="mb-32">
            <h2 className="text-3xl font-black tracking-tighter mb-12 uppercase border-b border-white/10 pb-4">ประธานพรรค</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {chairmen.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center"
                >
                  <div className="w-48 h-48 rounded-3xl overflow-hidden shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
                    {member.image ? <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <User size={48} strokeWidth={1} className="text-white/15" />}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter mb-2">{member.name}</h3>
                    <p className="text-brand-neon font-bold uppercase tracking-widest text-sm mb-4">{member.role}</p>
                    <p className="text-white/60 leading-relaxed">{member.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {leaders.length > 0 && (
          <div className="mb-32">
            <h2 className="text-3xl font-black tracking-tighter mb-12 uppercase border-b border-white/10 pb-4">ทีมผู้นำพรรค</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {leaders.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center"
                >
                  <div className="w-48 h-48 rounded-3xl overflow-hidden shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
                    {member.image ? <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <User size={48} strokeWidth={1} className="text-white/15" />}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter mb-2">{member.name}</h3>
                    <p className="text-brand-neon font-bold uppercase tracking-widest text-sm mb-4">{member.role}</p>
                    <p className="text-white/60 leading-relaxed">{member.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {experts.length > 0 && (
          <div>
            <h2 className="text-3xl font-black tracking-tighter mb-12 uppercase border-b border-white/10 pb-4">กรรมการบริหารพรรค</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {experts.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bento-card"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden mb-6 border border-white/10 bg-white/5 flex items-center justify-center">
                    {member.image ? <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <User size={40} strokeWidth={1} className="text-white/15" />}
                  </div>
                  <h3 className="text-xl font-bold mb-1">{member.name}</h3>
                  <p className="text-brand-neon text-xs font-bold uppercase tracking-widest mb-3">{member.role}</p>
                  <p className="text-white/40 text-sm">{member.bio}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
