import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { POLICIES as FALLBACK_POLICIES } from '../constants';
import { subscribeToPolicies, subscribeToSiteSettings } from '../services/dataService';
import { useLocation } from 'react-router-dom';
import { Policy, SiteSettings, DEFAULT_SETTINGS } from '../types';
import { groupPolicies } from '../utils/policies';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>(FALLBACK_POLICIES);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsubPolicies = subscribeToPolicies((data) => {
      if (data.length > 0) setPolicies(data);
    });
    const unsubSettings = subscribeToSiteSettings(setSettings);
    return () => { unsubPolicies(); unsubSettings(); };
  }, []);

  const visiblePolicies = [...policies].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).filter(p => {
    if (p.published === false) return false;
    const now = new Date();
    if (p.publishAt && new Date(p.publishAt) > now) return false;
    if (p.unpublishAt && new Date(p.unpublishAt) < now) return false;
    return true;
  });

  // ธนูดอกใหญ่ 4 ดอก (featuredHome) เป็นกาดใหญ่ ส่วนนโยบายที่ตามมาจนถึงดอกถัดไปคือกาดย่อยของดอกนั้น
  const groups = groupPolicies(visiblePolicies);

  // ลิงก์ /policies#<id> จากหน้าแรก/เมนู — เลื่อนไปที่การ์ดนั้นหลังข้อมูลโหลด
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    // smooth scroll โดนยกเลิกระหว่างหน้ายังจัด layout (lazy chunk/รูปโหลด) — ใช้แบบทันทีและยิงซ้ำอีกรอบหลัง layout นิ่ง
    const go = () => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
    const timers = [setTimeout(go, 120), setTimeout(go, 700)];
    return () => timers.forEach(clearTimeout);
  }, [hash, policies]);

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-20"
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8">
            {settings.pages.policiesHeading}
          </h1>
          <p className="text-xl text-white/60 max-w-3xl leading-relaxed">
            {settings.pages.policiesDescription}
          </p>
          {settings.pages.policiesImage && (
            <div className="mt-10 rounded-[32px] overflow-hidden aspect-[21/7]">
              <img src={settings.pages.policiesImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: settings.pages.policiesImagePos || '50% 50%' }} referrerPolicy="no-referrer" />
            </div>
          )}
        </motion.div>

        <div className="space-y-16">
          {groups.map((group, gIndex) => {
            const HeaderIcon = (Icons as any)[group.header.icon];
            return (
              <motion.div
                key={group.header.id}
                id={group.header.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-16 scroll-mt-28"
              >
                {/* กาดใหญ่ — หัวข้อธนูดอก */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-4">
                  <div className={gIndex % 2 === 0 ? "order-1" : "order-1 lg:order-2"}>
                    <div className="w-20 h-20 bg-brand-neon rounded-3xl flex items-center justify-center text-brand-navy mb-8 overflow-hidden">
                      {group.header.iconImage
                        ? <img src={group.header.iconImage} alt={group.header.title} className="w-full h-full object-cover" loading="lazy" />
                        : HeaderIcon ? <HeaderIcon size={40} /> : null}
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter mb-6">{group.header.title}</h2>
                    <p className="text-white/60 text-lg leading-relaxed">
                      {group.header.description}
                    </p>
                  </div>
                  {group.header.iconImage && (
                    <div className={gIndex % 2 === 0 ? "order-2" : "order-2 lg:order-1"}>
                      <div className="aspect-video bg-brand-navy rounded-3xl border border-white/10 overflow-hidden">
                        <img
                          src={group.header.iconImage}
                          alt={group.header.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* กาดย่อย — นโยบายภายใต้ธนูดอกนี้ แถวละ 2 กาด */}
                {group.items.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
                    {group.items.map((policy, index) => {
                      const IconComponent = (Icons as any)[policy.icon];
                      return (
                        <motion.div
                          key={policy.id}
                          id={policy.id}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: (index % 4) * 0.05 }}
                          viewport={{ once: true }}
                          className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 scroll-mt-28"
                        >
                          {policy.iconImage ? (
                            <div className="w-full aspect-video rounded-2xl overflow-hidden mb-5 bg-brand-navy border border-white/10">
                              <img
                                src={policy.iconImage}
                                alt={policy.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 bg-brand-neon/10 rounded-2xl flex items-center justify-center text-brand-neon mb-5">
                              {IconComponent ? <IconComponent size={26} /> : null}
                            </div>
                          )}
                          <h3 className="text-xl font-black tracking-tight mb-3">{policy.title}</h3>
                          <p className="text-white/60 text-sm md:text-base leading-relaxed">
                            {policy.description}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
