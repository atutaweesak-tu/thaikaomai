import React from 'react';
import Hero from '../components/Hero';
import PoliciesSection from '../components/PoliciesSection';
import TeamSection from '../components/TeamSection';
import NewsSection from '../components/NewsSection';
import CTASection from '../components/CTASection';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <PoliciesSection />
      <TeamSection />
      <NewsSection />
      <CTASection />
    </main>
  );
}
