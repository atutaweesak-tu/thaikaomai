import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { POLICIES as FALLBACK_POLICIES } from '../constants';
import { subscribeToPolicies, subscribeToSiteSettings } from '../services/dataService';
import { Policy, SiteSettings, DEFAULT_SETTINGS } from '../types';

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

        <div className="space-y-12">
          {visiblePolicies.map((policy, index) => {
            const IconComponent = (Icons as any)[policy.icon];
            return (
              <motion.div
                key={policy.id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              >
                <div className={index % 2 === 0 ? "order-1" : "order-1 lg:order-2"}>
                  <div className="w-20 h-20 bg-brand-neon rounded-3xl flex items-center justify-center text-brand-navy mb-8 overflow-hidden">
                    {policy.iconImage
                      ? <img src={policy.iconImage} alt={policy.title} className="w-full h-full object-cover" />
                      : IconComponent ? <IconComponent size={40} /> : null}
                  </div>
                  <h2 className="text-4xl font-black tracking-tighter mb-6">{policy.title}</h2>
                  <p className="text-white/60 text-lg leading-relaxed">
                    {policy.description}
                  </p>
                </div>
                {policy.iconImage && (
                  <div className={index % 2 === 0 ? "order-2" : "order-2 lg:order-1"}>
                    <div className="aspect-video bg-brand-navy rounded-3xl border border-white/10 overflow-hidden">
                      <img
                        src={policy.iconImage}
                        alt={policy.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
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
