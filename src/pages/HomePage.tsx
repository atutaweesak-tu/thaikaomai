import React, { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import PoliciesSection from '../components/PoliciesSection';
import TeamSection from '../components/TeamSection';
import NewsSection from '../components/NewsSection';
import CTASection from '../components/CTASection';
import PromoBannerBlock from '../components/PromoBannerBlock';
import { DEFAULT_HOME_BLOCKS } from '../constants';
import { subscribeToHomeBlocks } from '../services/dataService';
import { PageBlock } from '../types';

function renderBlock(block: PageBlock) {
  switch (block.type) {
    case 'hero': return <Hero key={block.id} />;
    case 'policies': return <PoliciesSection key={block.id} />;
    case 'team': return <TeamSection key={block.id} />;
    case 'news': return <NewsSection key={block.id} />;
    case 'cta': return <CTASection key={block.id} />;
    case 'promo': return <PromoBannerBlock key={block.id} block={block} />;
    default: return null;
  }
}

export default function HomePage() {
  const [blocks, setBlocks] = useState<PageBlock[]>(DEFAULT_HOME_BLOCKS);

  useEffect(() => {
    const unsub = subscribeToHomeBlocks((data) => {
      if (data.length > 0) setBlocks(data);
    });
    return () => unsub();
  }, []);

  const visibleBlocks = blocks
    .filter(b => {
      if (b.published === false) return false;
      const now = new Date();
      if (b.publishAt && new Date(b.publishAt) > now) return false;
      if (b.unpublishAt && new Date(b.unpublishAt) < now) return false;
      return true;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <main>
      {visibleBlocks.map(renderBlock)}
    </main>
  );
}
