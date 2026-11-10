import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import TeamSection from '../components/TeamSection';
import PromoBannerBlock from '../components/PromoBannerBlock';
import PollWidget from '../components/PollWidget';
import ErrorBoundary from '../components/ErrorBoundary';
import UfHero from '../components/uf/UfHero';
import QuickDiscovery from '../components/uf/QuickDiscovery';
import PolicyUniverse from '../components/uf/PolicyUniverse';
import PolicyHub from '../components/uf/PolicyHub';
import Newsroom from '../components/uf/Newsroom';
import VideoChannel from '../components/uf/VideoChannel';
import InstagramFeed from '../components/uf/InstagramFeed';
import ActivitiesMap from '../components/uf/ActivitiesMap';
import GuideSection from '../components/uf/GuideSection';
import JoinFuture from '../components/uf/JoinFuture';
import JourneyBackdrop from '../components/uf/JourneyBackdrop';
import { DEFAULT_HOME_BLOCKS, POLICIES as FALLBACK_POLICIES, NEWS as FALLBACK_NEWS, EVENTS as FALLBACK_EVENTS } from '../constants';
import { subscribeToHomeBlocks, subscribeToPolicies, subscribeToNews, subscribeToEvents, subscribeToVideos, subscribeToInstagram, subscribeToSiteSettings } from '../services/dataService';
import { PageBlock, Policy, NewsItem, EventItem, VideoItem, InstagramItem, SiteSettings, DEFAULT_SETTINGS } from '../types';
import { groupPolicies, visiblePolicies } from '../utils/policies';
import { isPublished } from '../utils/events';
import { extractYouTubeId } from '../utils/youtube';
import { LEGACY_EXPANSION, isLegacyLayout } from '../utils/homeBlocks';

const isLive = (i: { published?: boolean; publishAt?: string; unpublishAt?: string }, now: Date) =>
  i.published !== false && !(i.publishAt && new Date(i.publishAt) > now) && !(i.unpublishAt && new Date(i.unpublishAt) < now);

/** หน้าแรก Ultra Future 2035 — ยังเรียงตาม PageBlock ที่ admin จัดไว้ (แท็บ "หน้าแรก") เหมือนเดิม
 *  แต่ละแถวคือส่วนย่อยหนึ่งส่วน (heroMain, quickDiscovery, … ดู src/utils/homeBlocks.ts) — เปิด/ปิด/ย้ายได้ทีละส่วน
 *  ข้อมูลลำดับแบบเดิม (hero/policies/news/cta รวมหลายส่วน) ยังแสดงผลได้ตามเดิมจนกว่า admin จะกด "แยกเป็นส่วนย่อย" */
export default function HomePage() {
  const location = useLocation();
  const [blocks, setBlocks] = useState<PageBlock[]>(DEFAULT_HOME_BLOCKS);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [policies, setPolicies] = useState<Policy[]>(FALLBACK_POLICIES);
  const [policyError, setPolicyError] = useState(false);
  const [news, setNews] = useState<NewsItem[]>(FALLBACK_NEWS);
  const [events, setEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [instagram, setInstagram] = useState<InstagramItem[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeToHomeBlocks(data => { if (data.length > 0) setBlocks(data); }),
      subscribeToSiteSettings(setSettings),
      subscribeToPolicies(data => { setPolicyError(false); if (data.length > 0) setPolicies(data); }, () => setPolicyError(true)),
      subscribeToNews(data => { if (data.length > 0) setNews(data); }),
      subscribeToEvents(data => { if (data.length > 0) setEvents(data); }),
      subscribeToVideos(setVideos),
      subscribeToInstagram(setInstagram),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ลิงก์ /#activities ฯลฯ — React Router ไม่ scroll ไปที่ hash ให้เอง
  useEffect(() => {
    if (!location.hash) return;
    const go = () => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' });
    const timers = [setTimeout(go, 80), setTimeout(go, 700)];
    return () => timers.forEach(clearTimeout);
  }, [location.hash]);

  const policyGroups = useMemo(() => groupPolicies(visiblePolicies(policies)), [policies]);
  const now = new Date();
  const liveNews = news.filter(n => isLive(n, now));
  const liveEvents = events.filter(e => isPublished(e, now));
  const liveVideos = videos.filter(v => isLive(v, now));
  const liveInstagram = instagram.filter(i => isLive(i, now));
  // จำนวนเนื้อหาที่ผู้ช่วยค้นหาได้ (แสดงใน Section 08) — นับจากข้อมูลที่หน้าโหลดอยู่จริง
  const guideCounts = {
    policies: policyGroups.reduce((n, g) => n + 1 + g.items.length, 0),
    news: liveNews.length,
    events: liveEvents.length,
    videos: liveVideos.filter(v => extractYouTubeId(v.url)).length,
  };

  // แต่ละส่วนย่อย (ดู src/utils/homeBlocks.ts) — admin เปิด/ปิด/ย้ายได้ทีละส่วนในแท็บ "หน้าแรก"
  const section = (type: string): React.ReactNode => {
    switch (type) {
      case 'heroMain': return <UfHero settings={settings} />;
      case 'quickDiscovery': return <QuickDiscovery />;
      case 'policyUniverse': return <PolicyUniverse groups={policyGroups} />;
      case 'policyHub': return <PolicyHub groups={policyGroups} loadError={policyError} />;
      case 'team': return <TeamSection />;
      case 'newsroom': return <Newsroom news={liveNews} />;
      case 'videos': return <ErrorBoundary fallback={null}><VideoChannel videos={liveVideos} channelUrl={settings.contact.youtube} display={settings.videoDisplay} /></ErrorBoundary>;
      case 'instagram': return <ErrorBoundary fallback={null}><InstagramFeed items={liveInstagram} profileUrl={settings.contact.instagram} /></ErrorBoundary>;
      case 'activities': return <ActivitiesMap events={liveEvents} news={liveNews} />;
      case 'poll': return <ErrorBoundary fallback={null}><PollWidget /></ErrorBoundary>;
      case 'guide': return <GuideSection counts={guideCounts} />;
      case 'join': return <JoinFuture settings={settings} />;
      default: return null;
    }
  };
  const renderBlock = (block: PageBlock, i: number, list: PageBlock[]) => {
    if (block.type === 'promo') return <PromoBannerBlock key={block.id} block={block} />;
    // ข้อมูลลำดับแบบเดิม: บล็อกรวมแสดงส่วนย่อยตามเดิม (admin กด "แยกเป็นส่วนย่อย" เพื่อจัดการทีละส่วน)
    const parts = LEGACY_EXPANSION[block.type];
    if (parts) {
      // แบบเดิม: Instagram ที่อยู่ถัดจาก "ข่าวสาร" พอดี วางระหว่าง YouTube กับแผนที่กิจกรรม
      const withIg = block.type === 'news' && list[i + 1]?.type === 'instagram' ? ['newsroom', 'videos', 'instagram', 'activities'] : parts;
      return <React.Fragment key={block.id}>{withIg.map(t => <React.Fragment key={t}>{section(t)}</React.Fragment>)}</React.Fragment>;
    }
    if (block.type === 'instagram' && legacy && list[i - 1]?.type === 'news') return null;
    return <React.Fragment key={block.id}>{section(block.type)}</React.Fragment>;
  };

  const visibleBlocks = blocks
    .filter(b => isLive(b, now))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const legacy = isLegacyLayout(blocks);
  const rendered = visibleBlocks.map(renderBlock);
  // แบบเดิมเท่านั้น: โพลไม่มีแถวของตัวเอง → แทรกก่อน cta (ไม่มี cta = ต่อท้าย) เหมือนเดิม
  // แบบแยกส่วน: โพลเป็นแถว "poll" ที่ admin เปิด/ปิด/ย้ายได้ (ไม่แทรกเอง — API สาธารณะตัดแถวที่ซ่อนออก จึงแยก "ไม่มี" กับ "ซ่อน" ไม่ได้)
  if (legacy) {
    const poll = <ErrorBoundary key="poll" fallback={null}><PollWidget /></ErrorBoundary>;
    const ctaIndex = visibleBlocks.findIndex(b => b.type === 'cta');
    if (ctaIndex >= 0) rendered.splice(ctaIndex, 0, poll);
    else rendered.push(poll);
  }

  return (
    // โหมดสำรวม (admin) = ปิดการเคลื่อนไหวของ motion ทุกคนเหมือนผู้ใช้ตั้งลด motion เอง
    <MotionConfig reducedMotion={settings.theme.solemn ? 'always' : 'user'}>
      <main className="uf-home relative isolate bg-uf-bg text-uf-text overflow-x-clip">
        <JourneyBackdrop />
        {rendered}
      </main>
    </MotionConfig>
  );
}
