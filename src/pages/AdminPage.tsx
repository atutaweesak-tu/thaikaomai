import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Pencil, Trash2, Save, X, Database, Newspaper,
  Calendar, BookOpen, Users, Mail, MessageSquare, LogIn,
  AlertTriangle, Eye, EyeOff, ShieldCheck, UserPlus, LogOut, Settings,
  ChevronUp, ChevronDown, Heart, Phone, LayoutTemplate, BarChart3, Vote
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import {
  subscribeToNews, addNews, updateNews, deleteNews,
  subscribeToEvents, addEvent, updateEvent, deleteEvent,
  subscribeToPolicies, addPolicy, updatePolicy, deletePolicy,
  subscribeToTeam, addTeamMember, updateTeamMember, deleteTeamMember,
  subscribeToPolls, addPoll, updatePoll, deletePoll,
  subscribeToNewsletter, subscribeToContact,
  subscribeToVolunteer, deleteVolunteer,
  fetchSiteSettings, updateSiteSettings,
  fetchCategories, addCategory, deleteCategory,
  subscribeToHomeBlocks, addHomeBlock, updateHomeBlock, deleteHomeBlock,
  subscribeToAdminAccounts, addAdminAccount, updateAdminAccount, deleteAdminAccount,
  seedInitialData, fetchAnalytics,
} from '../services/dataService';
import { NewsItem, EventItem, Policy, TeamMember, Poll, NewsletterSubscriber, ContactMessage, VolunteerItem, SiteSettings, DEFAULT_SETTINGS, NewsCategory, PageBlock, TextStyle, HeroSlide, AdminAccount, AnalyticsData } from '../types';
import { POLICIES, TEAM, NEWS, EVENTS, DEFAULT_HOME_BLOCKS } from '../constants';
import ImageUploadField from '../components/ImageUploadField';

type Tab = 'news' | 'events' | 'policies' | 'team' | 'homeBlocks' | 'polls' | 'newsletter' | 'contact' | 'volunteer' | 'users' | 'settings' | 'analytics';

// ค่า default ของแท็บที่ admin ธรรมดา (role='admin') ได้ ถ้าตอนสร้างบัญชีไม่ได้เลือกแท็บเอง —
// ตรงกับ DEFAULT_ADMIN_TABS ฝั่ง server (server/api.ts) คือทุกแท็บยกเว้น users/settings
const DEFAULT_ADMIN_TABS_CLIENT: Tab[] = ['news', 'events', 'policies', 'team', 'polls', 'newsletter', 'contact', 'volunteer'];

// จัดกลุ่มแท็บให้เห็นเป็นหมวดหมู่ชัดเจนในแถบเมนู — ไม่กระทบ logic ด้านใน แค่จัดการแสดงผล
const TAB_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: 'เนื้อหาเว็บ', tabs: ['news', 'events', 'policies', 'team', 'homeBlocks', 'polls'] },
  { label: 'ข้อมูลติดต่อ', tabs: ['newsletter', 'contact', 'volunteer'] },
  { label: 'ระบบ', tabs: ['users', 'settings', 'analytics'] },
];

// homeBlocks/analytics ไม่ใช่แท็บสิทธิ์จริงฝั่ง server (COLLECTION_TAB['homeblocks'] = 'settings', และ
// GET /api/analytics ใช้ requireTab(...,'settings') เดียวกัน) — ทั้งสองใช้สิทธิ์ระดับ "ตั้งค่าเว็บ" แทน
// ไม่ต้องเพิ่มปุ่มสิทธิ์ใหม่ใน .env
const TAB_PERMISSION: Partial<Record<Tab, string>> = { homeBlocks: 'settings', analytics: 'settings' };

const EMPTY_NEWS: Omit<NewsItem, 'id'> = { title: '', summary: '', content: '', date: '', image: '', category: '', published: true, publishAt: '', unpublishAt: '' };
const EMPTY_EVENT: Omit<EventItem, 'id'> = { title: '', date: '', location: '', time: '', published: true, publishAt: '', unpublishAt: '' };
const EMPTY_POLICY: Omit<Policy, 'id'> = { title: '', description: '', icon: 'BookOpen', iconImage: '', color: '#E6FF00', published: true, publishAt: '', unpublishAt: '', featuredHome: false };
const EMPTY_MEMBER: Omit<TeamMember, 'id'> = { name: '', role: '', image: '', bio: '', content: '', category: 'leader', published: true, featuredHome: false };
const EMPTY_PROMO_BLOCK: Omit<PageBlock, 'id'> = { type: 'promo', order: 0, title: '', description: '', image: '', link: '', buttonText: '', published: true, publishAt: '', unpublishAt: '' };
const FONT_SIZE_OPTIONS = [
  { value: '', label: 'ค่าเริ่มต้น' },
  { value: 'text-sm', label: 'เล็ก' },
  { value: 'text-base', label: 'ปกติ' },
  { value: 'text-lg', label: 'ใหญ่กว่าปกติ' },
  { value: 'text-xl', label: 'ใหญ่' },
  { value: 'text-2xl', label: 'ใหญ่ x2' },
  { value: 'text-3xl', label: 'ใหญ่ x3' },
  { value: 'text-4xl', label: 'ใหญ่ x4' },
  { value: 'text-5xl', label: 'ใหญ่ x5' },
  { value: 'text-6xl', label: 'ใหญ่ x6' },
  { value: 'text-7xl', label: 'ใหญ่ x7' },
  { value: 'text-8xl', label: 'ใหญ่พิเศษ' },
];
const HERO_STYLE_KEYS = ['badge', 'heading1', 'heading2', 'heading3'] as const;
// เปิด/ปิดได้อย่างเดียว ไม่มีปรับขนาด/สี (ต่างจาก HERO_STYLE_KEYS)
const HERO_VISIBILITY_ONLY_KEYS = ['buttonPrimary', 'buttonSecondary', 'leaderName', 'leaderTitle'] as const;
const HERO_LINK_OPTIONS = [
  { value: '/', label: 'หน้าแรก' },
  { value: '/about', label: 'เกี่ยวกับพรรค' },
  { value: '/policies', label: 'นโยบาย' },
  { value: '/team', label: 'ทีมพรรค' },
  { value: '/news', label: 'ข่าวสาร' },
  { value: '/contact', label: 'ติดต่อเรา' },
  { value: '/volunteer', label: 'อาสาสมัคร' },
  { value: '/register', label: 'สมัครสมาชิก' },
];
const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero (ส่วนหัว)', policies: 'นโยบาย (ธนู 4 ดอก)', team: 'ทีมพรรค',
  news: 'ข่าวสาร & กิจกรรม', cta: 'ชวนสมัครสมาชิก (CTA)', promo: 'แบนเนอร์โปรโมท',
};

export default function AdminPage() {
  const { user, profile, login, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('news');
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Data
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollModal, setPollModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: any }>({ open: false, mode: 'add', data: null });
  const [savingPoll, setSavingPoll] = useState(false);
  const [pollSaveError, setPollSaveError] = useState('');
  const [deletePollTarget, setDeletePollTarget] = useState<string | null>(null);
  const [newsletter, setNewsletter] = useState<NewsletterSubscriber[]>([]);
  const [contact, setContact] = useState<ContactMessage[]>([]);
  const [volunteer, setVolunteer] = useState<VolunteerItem[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [homeBlocks, setHomeBlocks] = useState<PageBlock[]>([]);
  const [seedingHomeBlocks, setSeedingHomeBlocks] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [adminModal, setAdminModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<AdminAccount> & { password?: string } }>({ open: false, mode: 'add', data: {} });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState('');
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<string | null>(null);
const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  // Modal
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: any; activeTab: Tab }>({ open: false, mode: 'add', data: null, activeTab: 'news' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  // แท็บที่บัญชีนี้มีสิทธิ์เห็น/จัดการ — มาจาก session (ตั้งค่าได้ต่อ admin ผ่าน ADMIN_n_TABS ใน .env)
  const allowedTabs = profile?.allowedTabs?.length ? profile.allowedTabs : (isSuperAdmin ? TAB_GROUPS.flatMap(g => g.tabs) : []);
  // homeBlocks ไม่มีสิทธิ์ของตัวเอง — ใช้สิทธิ์แท็บ 'settings' แทนผ่าน TAB_PERMISSION ด้านบน
  const hasTabPermission = (t: Tab) => allowedTabs.includes(TAB_PERMISSION[t] ?? t);

  const reloadCategories = () => { fetchCategories().then(setCategories); };

  useEffect(() => {
    if (!isAdmin) return;
    const unsubs = [
      subscribeToNews(setNews),
      subscribeToEvents(setEvents),
      subscribeToPolicies(setPolicies),
      subscribeToTeam(setTeam),
      subscribeToPolls(setPolls),
      subscribeToNewsletter(setNewsletter),
      subscribeToContact(setContact),
      subscribeToVolunteer(setVolunteer),
      subscribeToHomeBlocks(setHomeBlocks),
    ];
    // จัดการบัญชีผู้ดูแลได้เฉพาะ super_admin — ไม่ subscribe/เรียก API เลยถ้าไม่ใช่ (server ก็บังคับอยู่แล้ว
    // แต่ฝั่ง UI ไม่จำเป็นต้องยิง request ไปให้เสียเวลาถ้ารู้อยู่แล้วว่าจะไม่แสดงผล)
    if (isSuperAdmin) unsubs.push(subscribeToAdminAccounts(setAdminAccounts));
    reloadCategories(); // หมวดหมู่เปลี่ยนไม่บ่อย — โหลดครั้งเดียวตอนเข้าหน้า ไม่ต้อง poll ต่อเนื่อง
    // settings ก็โหลดครั้งเดียวเช่นกัน (ไม่ live-subscribe) — ป้องกัน draft ที่ยังไม่ได้บันทึกโดนโพลลิ่ง
    // เขียนทับกลับเป็นค่าเดิมกลางคัน ถ้า SSE หลุดแล้ว fallback ไป poll ทุก 3 วิ (ดู fetchSiteSettings)
    fetchSiteSettings().then(setSiteSettings);
    return () => unsubs.forEach(u => u());
  }, [isAdmin, isSuperAdmin]);

  // ถ้าแท็บปัจจุบันไม่อยู่ในสิทธิ์ของ user นี้ (เช่นสลับบัญชี) ให้สลับไปแท็บแรกที่มีสิทธิ์
  useEffect(() => {
    if (!isAdmin || allowedTabs.length === 0) return;
    if (!hasTabPermission(tab)) setTab(allowedTabs[0] as Tab);
  }, [isAdmin, tab, allowedTabs.join(',')]);

  // โหลดสถิติเมื่อเปิดแท็บ "สถิติ" หรือเปลี่ยนช่วงวัน — ไม่ต้อง poll ต่อเนื่องเหมือน collection อื่น
  // (ข้อมูลนับสด flush ทุก 5 นาทีฝั่ง server อยู่แล้ว ไม่จำเป็นต้อง fetch ถี่กว่านั้น)
  useEffect(() => {
    if (tab !== 'analytics' || !hasTabPermission('analytics')) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    fetchAnalytics(analyticsDays)
      .then(setAnalyticsData)
      .catch(err => setAnalyticsError(err?.message || 'โหลดข้อมูลสถิติไม่สำเร็จ'))
      .finally(() => setAnalyticsLoading(false));
  }, [tab, analyticsDays]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError('');
    try {
      await updateSiteSettings(siteSettings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      setSettingsError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingSettings(false);
    }
  };

  const setHero = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, hero: { ...s.hero, [key]: val } }));
  const setHeroTextStyle = (
    key: 'badge' | 'heading1' | 'heading2' | 'heading3' | 'description' | 'buttonPrimary' | 'buttonSecondary' | 'leaderName' | 'leaderTitle',
    field: keyof TextStyle,
    value: string | boolean,
  ) =>
    setSiteSettings(s => ({
      ...s,
      hero: { ...s.hero, textStyle: { ...s.hero.textStyle, [key]: { ...s.hero.textStyle?.[key], [field]: value } } },
    }));
  // ลำดับ fallback เดียวกับ Hero.tsx: slides ใหม่ -> leaderImages เดิม -> leaderImage เดี่ยวเดิมสุด
  // ใช้กับ layout 'split' — รูปควรเป็นสัดส่วนแนวตั้ง (การ์ด 4:5)
  const heroSplitSlides: HeroSlide[] = siteSettings.hero.slides?.length
    ? siteSettings.hero.slides
    : siteSettings.hero.leaderImages?.length
      ? siteSettings.hero.leaderImages.map(image => ({ image }))
      : siteSettings.hero.leaderImage ? [{ image: siteSettings.hero.leaderImage }] : [];
  const setHeroSplitSlides = (slides: HeroSlide[]) =>
    setSiteSettings(s => ({ ...s, hero: { ...s.hero, slides } }));
  const addHeroSplitSlide = (image: string) => setHeroSplitSlides([...heroSplitSlides, { image }]);
  const removeHeroSplitSlide = (index: number) => setHeroSplitSlides(heroSplitSlides.filter((_, i) => i !== index));
  const updateHeroSplitSlideLink = (index: number, link: string) =>
    setHeroSplitSlides(heroSplitSlides.map((s, i) => (i === index ? { ...s, link } : s)));
  const moveHeroSplitSlide = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= heroSplitSlides.length) return;
    const next = [...heroSplitSlides];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setHeroSplitSlides(next);
  };
  // ใช้กับ layout 'full'/'imageOnly' — รูปควรเป็นสัดส่วนเต็มจอ แยกชุดจาก split เพราะการครอปต่างกัน
  const heroFullSlides: HeroSlide[] = siteSettings.hero.fullSlides?.length ? siteSettings.hero.fullSlides : [];
  const setHeroFullSlides = (slides: HeroSlide[]) =>
    setSiteSettings(s => ({ ...s, hero: { ...s.hero, fullSlides: slides } }));
  const addHeroFullSlide = (image: string) => setHeroFullSlides([...heroFullSlides, { image }]);
  const removeHeroFullSlide = (index: number) => setHeroFullSlides(heroFullSlides.filter((_, i) => i !== index));
  const updateHeroFullSlideLink = (index: number, link: string) =>
    setHeroFullSlides(heroFullSlides.map((s, i) => (i === index ? { ...s, link } : s)));
  const moveHeroFullSlide = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= heroFullSlides.length) return;
    const next = [...heroFullSlides];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setHeroFullSlides(next);
  };
  const setCta = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, cta: { ...s.cta, [key]: val } }));
  const setContactInfo = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, contact: { ...s.contact, [key]: val } }));
  const setFooterInfo = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, footer: { ...s.footer, [key]: val } }));
  const setPageInfo = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, pages: { ...s.pages, [key]: val } }));
  const setPopup = (key: string, val: string | boolean) =>
    setSiteSettings(s => ({ ...s, popup: { ...s.popup, [key]: val } }));
  const setAbout = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, about: { ...s.about, [key]: val } }));
  const setPrivacyInfo = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, privacy: { ...s.privacy, [key]: val } }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoginLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="pt-32 pb-24 min-h-screen flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
            <div className="text-center mb-10">
              <img src="/tkm-logo.png" alt="ไทยก้าวใหม่" className="h-16 w-auto mx-auto mb-6" />
              <h1 className="text-3xl font-black tracking-tighter mb-2">Admin Dashboard</h1>
              <p className="text-white/40 text-sm">เข้าสู่ระบบเพื่อจัดการเนื้อหา</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-white/60 mb-2">อีเมล</label>
                <input
                  type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="admin@thaikaomai.or.th" required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white/60 mb-2">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors pr-12"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
              <button type="submit" disabled={loginLoading} className="neon-button w-full justify-center text-lg py-4 mt-2">
                <LogIn size={20} /> {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="pt-32 pb-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={64} className="text-red-400 mx-auto mb-6" />
          <h1 className="text-4xl font-black mb-4">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-white/50 mb-8">บัญชีนี้ไม่มีสิทธิ์ Admin</p>
          <button onClick={logout} className="outline-button"><LogOut size={18} /> ออกจากระบบ</button>
        </div>
      </main>
    );
  }

  if (allowedTabs.length === 0) {
    return (
      <main className="pt-32 pb-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={64} className="text-red-400 mx-auto mb-6" />
          <h1 className="text-4xl font-black mb-4">ไม่มีแท็บที่เข้าถึงได้</h1>
          <p className="text-white/50 mb-8">บัญชีนี้ไม่ถูกกำหนดสิทธิ์แท็บใดเลย — ตรวจสอบค่า ADMIN_n_TABS ใน .env</p>
          <button onClick={logout} className="outline-button"><LogOut size={18} /> ออกจากระบบ</button>
        </div>
      </main>
    );
  }

  const exportCsv = (data: any[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(row =>
      keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')
    )];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  };

  const handleBulkToggle = async (published: boolean) => {
    const tabData = currentData[tab] as any[];
    if (!tabData.length) return;
    setBulkLoading(true);
    try {
      for (const item of tabData) {
        if (tab === 'news') await updateNews(item.id, { published });
        else if (tab === 'events') await updateEvent(item.id, { published });
        else if (tab === 'policies') await updatePolicy(item.id, { published });
        else if (tab === 'team') await updateTeamMember(item.id, { published });
        else if (tab === 'homeBlocks') await updateHomeBlock(item.id, { published });
      }
    } catch (err: any) { alert(err?.message || 'เกิดข้อผิดพลาดระหว่าง bulk update'); }
    finally { setBulkLoading(false); }
  };

  const handleTogglePublished = async (item: any) => {
    const published = item.published === false;
    setTogglingId(item.id);
    try {
      if (tab === 'news') await updateNews(item.id, { published });
      else if (tab === 'events') await updateEvent(item.id, { published });
      else if (tab === 'policies') await updatePolicy(item.id, { published });
      else if (tab === 'team') await updateTeamMember(item.id, { published });
      else if (tab === 'homeBlocks') await updateHomeBlock(item.id, { published });
    } catch (err: any) { alert(err?.message || 'เกิดข้อผิดพลาดระหว่างเปลี่ยนสถานะ'); }
    finally { setTogglingId(null); }
  };

  const handleResetSettings = () => {
    if (!confirm('รีเซ็ต Settings ทั้งหมดกลับเป็นค่าเริ่มต้น?')) return;
    setSiteSettings(DEFAULT_SETTINGS);
  };

  const handleSeed = async () => {
    if (!confirm('จะเพิ่มข้อมูลตั้งต้นทั้งหมดลง ใช่ไหม?')) return;
    setSeeding(true);
    try {
      await seedInitialData(
        POLICIES.map(({ id, ...rest }) => rest),
        TEAM.map(({ id, ...rest }) => rest),
        NEWS.map(({ id, ...rest }) => rest),
        EVENTS.map(({ id, ...rest }) => rest),
      );
      setSeedDone(true);
    } catch {
      alert('Seed ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedHomeBlocks = async () => {
    setSeedingHomeBlocks(true);
    try {
      for (const block of DEFAULT_HOME_BLOCKS) {
        const { id, ...rest } = block;
        await addHomeBlock(rest);
      }
    } catch {
      alert('Seed ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSeedingHomeBlocks(false);
    }
  };

  const openAddAdmin = () => {
    setAdminSaveError('');
    setAdminModal({ open: true, mode: 'add', data: { role: 'admin', allowedTabs: DEFAULT_ADMIN_TABS_CLIENT } });
  };

  const openEditAdmin = (acc: AdminAccount) => {
    setAdminSaveError('');
    setAdminModal({ open: true, mode: 'edit', data: { ...acc, password: '' } });
  };

  const handleSaveAdmin = async () => {
    setSavingAdmin(true);
    setAdminSaveError('');
    try {
      const { id, password, ...rest } = adminModal.data;
      const payload = password ? { ...rest, password } : rest;
      if (adminModal.mode === 'add') {
        await addAdminAccount(payload as Partial<AdminAccount> & { password: string });
      } else if (id) {
        await updateAdminAccount(id, payload);
      }
      setAdminModal({ open: false, mode: 'add', data: {} });
    } catch (err: any) {
      setAdminSaveError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    try {
      await deleteAdminAccount(id);
    } catch (err: any) {
      alert(err?.message || 'ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeleteAdminTarget(null);
    }
  };

  const openAdd = () => {
    const emptyMap: Record<string, any> = {
      news: { ...EMPTY_NEWS }, events: { ...EMPTY_EVENT },
      policies: { ...EMPTY_POLICY }, team: { ...EMPTY_MEMBER },
      homeBlocks: { ...EMPTY_PROMO_BLOCK, order: homeBlocks.length ? Math.max(...homeBlocks.map(b => b.order ?? 0)) + 1 : 0 },
    };
    setModal({ open: true, mode: 'add', data: emptyMap[tab], activeTab: tab });
  };

  const openEdit = (item: any) => {
    const { id, createdAt, updatedAt, createdBy, updatedBy, order, ...rest } = item;
    setModal({ open: true, mode: 'edit', data: { id, ...rest }, activeTab: tab });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    const savedTab = modal.activeTab;
    try {
      const { id, ...rest } = modal.data;
      if (modal.mode === 'add') {
        if (savedTab === 'news') await addNews(rest);
        else if (savedTab === 'events') await addEvent(rest);
        else if (savedTab === 'policies') await addPolicy(rest);
        else if (savedTab === 'team') await addTeamMember(rest);
        else if (savedTab === 'homeBlocks') await addHomeBlock(rest);
      } else {
        if (savedTab === 'news') await updateNews(id, rest);
        else if (savedTab === 'events') await updateEvent(id, rest);
        else if (savedTab === 'policies') await updatePolicy(id, rest);
        else if (savedTab === 'team') await updateTeamMember(id, rest);
        else if (savedTab === 'homeBlocks') await updateHomeBlock(id, rest);
      }
      setModal({ open: false, mode: 'add', data: null, activeTab: savedTab });
      setTab(savedTab);
    } catch (err: any) {
      setSaveError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const savedTab = tab;
    try {
      if (savedTab === 'news') await deleteNews(id);
      else if (savedTab === 'events') await deleteEvent(id);
      else if (savedTab === 'policies') await deletePolicy(id);
      else if (savedTab === 'team') await deleteTeamMember(id);
      else if (savedTab === 'homeBlocks') await deleteHomeBlock(id);
    } catch {
      alert('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeleteTarget(null);
      setTab(savedTab);
    }
  };

  const handleReorder = async (list: any[], index: number, direction: 'up' | 'down') => {
    const savedTab = tab;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;
    const a = list[index];
    const b = list[swapIndex];
    const aOrder = a.order ?? index;
    const bOrder = b.order ?? swapIndex;
    try {
      if (savedTab === 'policies') {
        await updatePolicy(a.id, { order: bOrder });
        await updatePolicy(b.id, { order: aOrder });
      } else if (savedTab === 'homeBlocks') {
        await updateHomeBlock(a.id, { order: bOrder });
        await updateHomeBlock(b.id, { order: aOrder });
      } else if (savedTab === 'team') {
        await updateTeamMember(a.id, { order: bOrder });
        await updateTeamMember(b.id, { order: aOrder });
      }
    } finally {
      setTab(savedTab);
    }
  };

  // โพลเป็นแท็บแบบ bespoke แยกต่างหาก ไม่ใช้ fieldConfig/modal กลาง เพราะ options[] เป็น array
  // ของ sub-object ที่ระบบ fieldConfig เดิมไม่รองรับ (ไม่มี field type แบบ repeater)
  const openAddPoll = () => {
    setPollSaveError('');
    setPollModal({
      open: true, mode: 'add',
      data: {
        question: '',
        options: [
          { id: `opt_${Date.now()}_1`, label: '', votes: 0 },
          { id: `opt_${Date.now()}_2`, label: '', votes: 0 },
        ],
        published: true, publishAt: '', unpublishAt: '',
      },
    });
  };
  const openEditPoll = (poll: Poll) => {
    setPollSaveError('');
    setPollModal({ open: true, mode: 'edit', data: { ...poll } });
  };
  const addPollOption = () => setPollModal(m => ({
    ...m, data: { ...m.data, options: [...m.data.options, { id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, label: '', votes: 0 }] },
  }));
  const removePollOption = (index: number) => setPollModal(m => ({
    ...m, data: { ...m.data, options: m.data.options.filter((_: any, i: number) => i !== index) },
  }));
  const updatePollOptionLabel = (index: number, label: string) => setPollModal(m => ({
    ...m, data: { ...m.data, options: m.data.options.map((o: any, i: number) => (i === index ? { ...o, label } : o)) },
  }));
  const handleSavePoll = async () => {
    if (!pollModal.data.question.trim()) { setPollSaveError('กรุณากรอกคำถาม'); return; }
    const validOptions = pollModal.data.options.filter((o: any) => o.label.trim());
    if (validOptions.length < 2) { setPollSaveError('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ'); return; }
    setSavingPoll(true);
    setPollSaveError('');
    try {
      const payload = {
        question: pollModal.data.question.trim(),
        options: validOptions,
        published: pollModal.data.published !== false,
        publishAt: pollModal.data.publishAt || '',
        unpublishAt: pollModal.data.unpublishAt || '',
      };
      if (pollModal.mode === 'add') await addPoll(payload);
      else await updatePoll(pollModal.data.id, payload);
      setPollModal({ open: false, mode: 'add', data: null });
    } catch (err: any) {
      setPollSaveError(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingPoll(false);
    }
  };
  const handleTogglePollPublished = async (poll: Poll) => {
    try { await updatePoll(poll.id, { published: poll.published === false }); }
    catch (err: any) { alert(err?.message || 'เกิดข้อผิดพลาด'); }
  };
  const handleDeletePoll = async (id: string) => {
    try { await deletePoll(id); }
    catch { alert('ลบไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setDeletePollTarget(null); }
  };

  const ALL_TABS: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'news', label: 'ข่าวสาร', icon: Newspaper, count: news.length },
    { key: 'events', label: 'กิจกรรม', icon: Calendar, count: events.length },
    { key: 'policies', label: 'นโยบาย', icon: BookOpen, count: policies.length },
    { key: 'team', label: 'ทีมพรรค', icon: Users, count: team.length },
    { key: 'homeBlocks', label: 'หน้าแรก', icon: LayoutTemplate, count: homeBlocks.length },
    { key: 'polls', label: 'โพล', icon: Vote, count: polls.length },
    { key: 'newsletter', label: 'Newsletter', icon: Mail, count: newsletter.length },
    { key: 'contact', label: 'ข้อความ', icon: MessageSquare, count: contact.length },
    { key: 'volunteer', label: 'อาสาสมัคร', icon: Heart, count: volunteer.length },
    { key: 'users', label: 'ผู้ดูแล', icon: ShieldCheck },
    { key: 'settings', label: 'ตั้งค่าเว็บ', icon: Settings },
    { key: 'analytics', label: 'สถิติ', icon: BarChart3 },
  ];
  // แสดงเฉพาะแท็บที่บัญชีนี้มีสิทธิ์ — แยกตามสิทธิ์ของ user (role/allowedTabs)
  const TABS = ALL_TABS.filter(t => hasTabPermission(t.key));
  // ใช้เลือกสิทธิ์แท็บตอนสร้าง/แก้บัญชีผู้ดูแล — ตัด homeBlocks/analytics ออกเพราะไม่ใช่แท็บสิทธิ์จริงฝั่ง server
  // (ทั้งคู่ map ไปที่สิทธิ์ 'settings' ผ่าน TAB_PERMISSION ด้านบน ไม่ใช่ key สิทธิ์ของตัวเอง)
  const ADMIN_PERMISSION_TABS = ALL_TABS.filter(t => t.key !== 'homeBlocks' && t.key !== 'analytics');

  // ประวัติการแก้ไข — ใช้ audit fields (createdBy/updatedBy/updatedAt) ที่ทุก item มีอยู่แล้ว ไม่ต้องเก็บ
  // ข้อมูลเพิ่ม แค่รวม 4 collection ที่ subscribe ไว้อยู่แล้วเป็นลิสต์เดียวแล้วเรียงตามเวลาแก้ไขล่าสุด
  const ACTIVITY_COLLECTIONS: { label: string; items: any[]; titleKey: string }[] = [
    { label: 'ข่าวสาร', items: news, titleKey: 'title' },
    { label: 'กิจกรรม', items: events, titleKey: 'title' },
    { label: 'นโยบาย', items: policies, titleKey: 'title' },
    { label: 'ทีมพรรค', items: team, titleKey: 'name' },
  ];
  const activityLog = ACTIVITY_COLLECTIONS
    .flatMap(c => c.items.filter((i: any) => i.updatedAt).map((i: any) => ({
      label: c.label, title: i[c.titleKey] || '(ไม่มีชื่อ)', updatedBy: i.updatedBy, updatedAt: i.updatedAt,
    })))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  const sortedPolicies = [...policies].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const sortedCategories = [...categories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const sortedHomeBlocks = [...homeBlocks].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const sortedTeam = [...team].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const currentData: Record<string, any[]> = { news, events, policies: sortedPolicies, team: sortedTeam, homeBlocks: sortedHomeBlocks, newsletter, contact, volunteer };
  const canEdit = ['news', 'events', 'policies', 'team', 'homeBlocks'].includes(tab) && hasTabPermission(tab);

  const fieldConfig: Record<string, { key: string; label: string; type: string; maxLength?: number; options?: string[]; optionLabels?: string[] }[]> = {
    news: [
      { key: 'title', label: 'หัวข้อข่าว', type: 'text', maxLength: 200 },
      { key: 'summary', label: 'สรุปข่าว', type: 'textarea', maxLength: 500 },
      { key: 'content', label: 'เนื้อหาเต็ม', type: 'textarea', maxLength: 20000 },
      { key: 'date', label: 'วันที่แสดง', type: 'text' },
      { key: 'image', label: 'รูปภาพ — แนะนำแนวนอน 16:9 อย่างน้อย 1600×900px ไม่เกิน 5MB', type: 'image-upload' },
      {
        key: 'category', label: 'หมวดหมู่', type: 'select',
        options: Array.from(new Set([
          ...sortedCategories.map(c => c.name),
          ...(modal.data?.category ? [modal.data.category] : []), // กันค่าเก่าที่ไม่อยู่ในลิสต์หายไปจากหน้าจอ
        ])),
      },
      { key: 'videoUrl', label: 'ลิงก์วิดีโอ YouTube (ไม่บังคับ) — เช่น https://youtube.com/watch?v=...', type: 'text' },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'seoTitle', label: 'SEO: หัวข้อสำหรับ Google/แชร์โซเชียล (ไม่บังคับ — ว่างไว้ใช้หัวข้อข่าวแทน)', type: 'text', maxLength: 200 },
      { key: 'seoDescription', label: 'SEO: คำอธิบายสำหรับ Google/แชร์โซเชียล (ไม่บังคับ — ว่างไว้ใช้สรุปข่าวแทน)', type: 'textarea', maxLength: 300 },
    ],
    events: [
      { key: 'title', label: 'ชื่อกิจกรรม', type: 'text' },
      { key: 'date', label: 'วันที่', type: 'text' },
      { key: 'location', label: 'สถานที่', type: 'text' },
      { key: 'time', label: 'เวลา', type: 'text' },
      { key: 'videoUrl', label: 'ลิงก์วิดีโอ YouTube (ไม่บังคับ) — เช่น https://youtube.com/watch?v=...', type: 'text' },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
    ],
    policies: [
      { key: 'title', label: 'ชื่อนโยบาย', type: 'text', maxLength: 200 },
      { key: 'description', label: 'รายละเอียด', type: 'textarea', maxLength: 2000 },
      { key: 'iconImage', label: 'รูป Icon (อัพโหลดจากเครื่อง) — แนะนำอัตราส่วน 16:9 เช่น 1200×675px ไม่เกิน 5MB', type: 'image-upload' },
      { key: 'icon', label: 'Icon (Lucide name) — ใช้ถ้าไม่มีรูป', type: 'text' },
      { key: 'color', label: 'สีพื้นหลัง', type: 'color-picker' },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'featuredHome', label: 'ธนูดอกใหญ่ — แสดงในหน้าหลัก และเป็นกาดใหญ่ในหน้านโยบาย (เลือกได้สูงสุด 4 นโยบาย)', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'seoTitle', label: 'SEO: หัวข้อสำหรับ Google/แชร์โซเชียล (ไม่บังคับ)', type: 'text', maxLength: 200 },
      { key: 'seoDescription', label: 'SEO: คำอธิบายสำหรับ Google/แชร์โซเชียล (ไม่บังคับ)', type: 'textarea', maxLength: 300 },
    ],
    team: [
      { key: 'name', label: 'ชื่อ-นามสกุล', type: 'text', maxLength: 100 },
      { key: 'role', label: 'ตำแหน่ง', type: 'text', maxLength: 100 },
      { key: 'bio', label: 'ประวัติย่อ (แสดงในการ์ดหน้ารวมทีม)', type: 'textarea', maxLength: 500 },
      { key: 'content', label: 'ประวัติฉบับเต็ม (แสดงในหน้าโปรไฟล์รายบุคคลเท่านั้น — ไม่บังคับกรอก)', type: 'textarea', maxLength: 20000 },
      { key: 'image', label: 'รูปภาพ — แนะนำภาพครึ่งตัว/เต็มตัวแนวตั้ง เช่น 1000×1200px (ระบบจะครอบเป็นจัตุรัสหรือ 3:4 อัตโนมัติ) ไม่เกิน 5MB', type: 'image-upload' },
      { key: 'category', label: 'ประเภท', type: 'select', options: ['chairman', 'leader', 'expert'], optionLabels: ['ประธานพรรค', 'ผู้นำพรรค', 'กรรมการบริหาร'] },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'featuredHome', label: 'แสดงในหน้าหลัก (เลือกได้สูงสุด 3 คน)', type: 'toggle' },
    ],
    homeBlocks: [
      { key: 'title', label: 'หัวข้อ', type: 'text', maxLength: 200 },
      { key: 'description', label: 'รายละเอียด', type: 'textarea', maxLength: 500 },
      { key: 'image', label: 'รูปภาพ — แนะนำแนวนอน 16:9 เช่น 1200×675px ไม่เกิน 5MB', type: 'image-upload' },
      { key: 'link', label: 'ลิงก์ปลายทาง', type: 'text' },
      { key: 'buttonText', label: 'ข้อความปุ่ม', type: 'text', maxLength: 50 },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
    ],
  };

  return (
    <main className="pt-24 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2">
              ADMIN <span className="text-brand-neon">DASHBOARD</span>
            </h1>
            <p className="text-white/40 text-sm">ยินดีต้อนรับ {user.displayName || user.email}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSeed} disabled={seeding || seedDone}
              className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-full hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <Database size={18} className={seeding ? 'animate-spin' : ''} />
              {seedDone ? 'Seed สำเร็จแล้ว' : seeding ? 'กำลัง Seed...' : 'Seed ข้อมูลตั้งต้น'}
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} className="outline-button py-3 px-5 flex items-center gap-2">
              <LogOut size={18} />
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-4 mb-10">
          {TABS.map(t => (
            <div key={t.key} className="bento-card text-center py-4">
              <t.icon size={20} className="text-brand-neon mx-auto mb-2" />
              <p className="text-2xl font-black">{t.count}</p>
              <p className="text-white/40 text-xs">{t.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs — จัดกลุ่มตามหมวด: เนื้อหาเว็บ / ข้อมูลติดต่อ / ระบบ */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-8">
          {TAB_GROUPS.map(group => {
            const groupTabs = TABS.filter(t => group.tabs.includes(t.key));
            if (groupTabs.length === 0) return null;
            return (
              <div key={group.label} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mr-1">{group.label}</span>
                {groupTabs.map(t => (
                  <button
                    key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                      tab === t.key ? 'bg-brand-neon text-brand-navy' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <t.icon size={16} />
                    {t.label}
                    {t.count !== undefined && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-brand-navy/20' : 'bg-white/10'}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Settings Tab */}
        {tab === 'settings' ? (
          <div className="space-y-8">
            {/* Save Button */}
            <div className="flex flex-col items-end gap-3">
              {settingsError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-2">{settingsError}</p>
              )}
              <button onClick={handleSaveSettings} disabled={savingSettings} className="neon-button text-lg px-10 py-4">
                <Save size={18} /> {savingSettings ? 'กำลังบันทึก...' : settingsSaved ? '✓ บันทึกแล้ว' : 'บันทึกทั้งหมด'}
              </button>
            </div>

            {/* Hero */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">①</span> Hero Section</h2>
              <div className="mb-6">
                <label className="block text-xs font-bold text-white/50 mb-2">รูปแบบ Hero Section</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'split', label: '2 คอลัมน์ (ข้อความ + รูป)' },
                    { value: 'full', label: 'รูปเต็มพื้นที่ (ข้อความซ้อนทับ)' },
                    { value: 'imageOnly', label: 'รูปเต็มพื้นที่ (ไม่มีข้อความ)' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHero('layout', opt.value)}
                      className={`flex-1 min-w-[9rem] text-sm font-bold px-4 py-3 rounded-xl border transition-colors ${
                        (siteSettings.hero.layout ?? 'split') === opt.value
                          ? 'bg-brand-neon/20 border-brand-neon text-brand-neon'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {siteSettings.hero.layout === 'imageOnly' && (
                  <p className="text-white/40 text-xs mt-2">
                    โหมดนี้จะไม่แสดงข้อความ/ปุ่มด้านล่างบนหน้าเว็บ — ยังตั้งค่าไว้ได้ตามปกติเผื่อสลับกลับมาใช้ภายหลัง
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'badge', label: 'Badge (ข้อความเล็กบนสุด)' },
                  { key: 'heading1', label: 'หัวเรื่องบรรทัด 1' },
                  { key: 'heading2', label: 'หัวเรื่องบรรทัด 2 (สีเขียว)' },
                  { key: 'heading3', label: 'หัวเรื่องบรรทัด 3' },
                  { key: 'buttonPrimary', label: 'ปุ่มหลัก' },
                  { key: 'buttonSecondary', label: 'ปุ่มรอง' },
                  { key: 'leaderName', label: 'ชื่อหัวหน้าพรรค' },
                  { key: 'leaderTitle', label: 'ตำแหน่ง' },
                ].map(f => {
                  const styleKey = HERO_STYLE_KEYS.find(k => k === f.key);
                  const visibilityOnlyKey = HERO_VISIBILITY_ONLY_KEYS.find(k => k === f.key);
                  const linkKey = f.key === 'buttonPrimary' ? 'buttonPrimaryLink' : f.key === 'buttonSecondary' ? 'buttonSecondaryLink' : null;
                  const linkDefault = f.key === 'buttonPrimary' ? '/policies' : '/team';
                  return (
                    <div key={f.key}>
                      <label className="block text-xs font-bold text-white/50 mb-1">{f.label}</label>
                      <input type="text" value={(siteSettings.hero as any)[f.key]}
                        onChange={e => setHero(f.key, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />

                      {styleKey && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <select
                            value={siteSettings.hero.textStyle?.[styleKey]?.fontSize || ''}
                            onChange={e => setHeroTextStyle(styleKey, 'fontSize', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-brand-neon"
                          >
                            {FONT_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <input
                            type="color"
                            value={siteSettings.hero.textStyle?.[styleKey]?.color || '#ffffff'}
                            onChange={e => setHeroTextStyle(styleKey, 'color', e.target.value)}
                            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer bg-transparent"
                            title="สีข้อความ"
                          />
                          <button
                            type="button"
                            onClick={() => setHeroTextStyle(styleKey, 'visible', siteSettings.hero.textStyle?.[styleKey]?.visible === false)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                              siteSettings.hero.textStyle?.[styleKey]?.visible === false
                                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                : 'bg-green-500/20 border-green-500/30 text-green-400'
                            }`}
                          >
                            {siteSettings.hero.textStyle?.[styleKey]?.visible === false ? '● ซ่อน' : '● แสดง'}
                          </button>
                        </div>
                      )}

                      {linkKey && (
                        <select
                          value={(siteSettings.hero as any)[linkKey] || linkDefault}
                          onChange={e => setHero(linkKey, e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-brand-neon transition-colors"
                        >
                          {HERO_LINK_OPTIONS.map(o => <option key={o.value} value={o.value}>ลิงก์ไปหน้า: {o.label}</option>)}
                        </select>
                      )}

                      {visibilityOnlyKey && (
                        <button
                          type="button"
                          onClick={() => setHeroTextStyle(visibilityOnlyKey, 'visible', siteSettings.hero.textStyle?.[visibilityOnlyKey]?.visible === false)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors mt-2 ${
                            siteSettings.hero.textStyle?.[visibilityOnlyKey]?.visible === false
                              ? 'bg-red-500/20 border-red-500/30 text-red-400'
                              : 'bg-green-500/20 border-green-500/30 text-green-400'
                          }`}
                        >
                          {siteSettings.hero.textStyle?.[visibilityOnlyKey]?.visible === false ? '● ซ่อน' : '● แสดง'}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">คำอธิบาย</label>
                  <textarea value={siteSettings.hero.description} onChange={e => setHero('description', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <select
                      value={siteSettings.hero.textStyle?.description?.fontSize || ''}
                      onChange={e => setHeroTextStyle('description', 'fontSize', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-brand-neon"
                    >
                      {FONT_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      type="color"
                      value={siteSettings.hero.textStyle?.description?.color || '#ffffff'}
                      onChange={e => setHeroTextStyle('description', 'color', e.target.value)}
                      className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer bg-transparent"
                      title="สีข้อความ"
                    />
                    <button
                      type="button"
                      onClick={() => setHeroTextStyle('description', 'visible', siteSettings.hero.textStyle?.description?.visible === false)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        siteSettings.hero.textStyle?.description?.visible === false
                          ? 'bg-red-500/20 border-red-500/30 text-red-400'
                          : 'bg-green-500/20 border-green-500/30 text-green-400'
                      }`}
                    >
                      {siteSettings.hero.textStyle?.description?.visible === false ? '● ซ่อน' : '● แสดง'}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">
                    รูปสำหรับ "2 คอลัมน์" — เพิ่มได้ไม่จำกัด สไลด์อัตโนมัติถ้ามีมากกว่า 1 รูป ใส่ลิงก์ต่อรูปได้
                  </label>
                  <p className="text-brand-neon/70 text-xs mb-2">
                    ขนาดรูปที่แนะนำ: 1000 × 1250 px (แนวตั้ง อัตราส่วน 4:5) — ให้คนตัดรูปเว้นระยะขอบไว้บ้าง เผื่อจอบางขนาดครอปภาพเข้ามาอีกนิด
                  </p>
                  <div className="space-y-2 mb-3">
                    {heroSplitSlides.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2">
                        <img src={s.image} alt={`รูปที่ ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0" />
                        <input
                          type="text"
                          value={s.link || ''}
                          onChange={e => updateHeroSplitSlideLink(i, e.target.value)}
                          placeholder="ลิงก์ (ไม่บังคับ) เช่น https://..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-neon transition-colors"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <button type="button" disabled={i === 0} onClick={() => moveHeroSplitSlide(i, 'up')}
                            className="w-6 h-4 rounded bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20">
                            <ChevronUp size={11} />
                          </button>
                          <button type="button" disabled={i === heroSplitSlides.length - 1} onClick={() => moveHeroSplitSlide(i, 'down')}
                            className="w-6 h-4 rounded bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20">
                            <ChevronDown size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHeroSplitSlide(i)}
                          className="w-8 h-8 rounded-lg border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <ImageUploadField value="" onChange={addHeroSplitSlide} allowRemove={false} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">
                    รูปสำหรับ "รูปเต็มพื้นที่" — แยกจากชุดด้านบนเพราะสัดส่วนการครอปต่างกัน ใส่ลิงก์ต่อรูปได้
                  </label>
                  <p className="text-brand-neon/70 text-xs mb-2">
                    ขนาดรูปที่แนะนำ: 1920 × 1080 px ขึ้นไป (แนวนอน กว้างเต็มจอ) — จัดองค์ประกอบสำคัญไว้กลางภาพ เพราะขอบซ้าย-ขวา/บน-ล่างอาจถูกครอปออกตามขนาดจอ
                  </p>
                  <div className="space-y-2 mb-3">
                    {heroFullSlides.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2">
                        <img src={s.image} alt={`รูปที่ ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0" />
                        <input
                          type="text"
                          value={s.link || ''}
                          onChange={e => updateHeroFullSlideLink(i, e.target.value)}
                          placeholder="ลิงก์ (ไม่บังคับ) เช่น https://..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-neon transition-colors"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <button type="button" disabled={i === 0} onClick={() => moveHeroFullSlide(i, 'up')}
                            className="w-6 h-4 rounded bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20">
                            <ChevronUp size={11} />
                          </button>
                          <button type="button" disabled={i === heroFullSlides.length - 1} onClick={() => moveHeroFullSlide(i, 'down')}
                            className="w-6 h-4 rounded bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20">
                            <ChevronDown size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHeroFullSlide(i)}
                          className="w-8 h-8 rounded-lg border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {heroFullSlides.length === 0 && (
                      <p className="text-white/30 text-xs">ยังไม่มีรูป — ตอนนี้ใช้ชุด "2 คอลัมน์" ด้านบนแทนไปก่อนสำหรับโหมดเต็มพื้นที่</p>
                    )}
                  </div>
                  <ImageUploadField value="" onChange={addHeroFullSlide} allowRemove={false} />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">②</span> CTA Section</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'heading1', label: 'หัวเรื่องบรรทัด 1' },
                  { key: 'heading2', label: 'หัวเรื่องบรรทัด 2' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-white/50 mb-1">{f.label}</label>
                    <input type="text" value={(siteSettings.cta as any)[f.key]} onChange={e => setCta(f.key, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">คำอธิบาย</label>
                  <textarea value={siteSettings.cta.description} onChange={e => setCta('description', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
              </div>
            </div>

            {/* Contact & Social */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">③</span> ข้อมูลติดต่อ & โซเชียล</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'address', label: 'ที่อยู่' },
                  { key: 'email', label: 'อีเมล' },
                  { key: 'phone', label: 'เบอร์โทร' },
                  { key: 'facebook', label: 'Facebook URL' },
                  { key: 'twitter', label: 'Twitter/X URL' },
                  { key: 'instagram', label: 'Instagram URL' },
                  { key: 'youtube', label: 'YouTube URL' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-white/50 mb-1">{f.label}</label>
                    <input type="text" value={(siteSettings.contact as any)[f.key]} onChange={e => setContactInfo(f.key, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                  </div>
                ))}
              </div>

              {/* QR Code Upload */}
              <div className="mt-6">
                <label className="block text-xs font-bold text-white/50 mb-2">QR Code โซเชียล — แนะนำภาพจัตุรัส เช่น 600×600px ไม่เกิน 5MB</label>
                <ImageUploadField value={siteSettings.contact.qrCode || ''} onChange={v => setContactInfo('qrCode', v)} label="QR Code" />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">④</span> Footer</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">คำอธิบายพรรค</label>
                  <textarea value={siteSettings.footer.description} onChange={e => setFooterInfo('description', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">Copyright</label>
                  <input type="text" value={siteSettings.footer.copyright} onChange={e => setFooterInfo('copyright', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                </div>
              </div>
            </div>

            {/* Popup Banner */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">⑤</span> Popup โปรโมท</h2>
              <div className="space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">เปิดใช้งาน Popup</p>
                    <p className="text-white/40 text-xs mt-0.5">แสดง popup เมื่อผู้เยี่ยมชมเปิดเว็บ (ครั้งเดียวต่อ session)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPopup('enabled', !siteSettings.popup.enabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${siteSettings.popup.enabled ? 'bg-brand-neon' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${siteSettings.popup.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Image upload */}
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-2">รูปภาพ Popup — แนะนำแนวตั้งหรือจัตุรัส เช่น 800×1000px ไม่เกิน 5MB</label>
                  <ImageUploadField value={siteSettings.popup.image || ''} onChange={v => setPopup('image', v)} label="Popup" />
                </div>

                {/* Link */}
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">ลิงก์ (เมื่อคลิกที่รูป — ไม่บังคับ)</label>
                  <input type="url" value={siteSettings.popup.link}
                    onChange={e => setPopup('link', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                </div>

                {/* Date range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-white/50 mb-1">วันที่เริ่มแสดง</label>
                    <input type="datetime-local" value={siteSettings.popup.startDate}
                      onChange={e => setPopup('startDate', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                    <p className="text-white/30 text-xs mt-1">เว้นว่างไว้ = แสดงทันที</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/50 mb-1">วันที่หยุดแสดง</label>
                    <input type="datetime-local" value={siteSettings.popup.endDate}
                      onChange={e => setPopup('endDate', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                    <p className="text-white/30 text-xs mt-1">เว้นว่างไว้ = แสดงตลอด</p>
                  </div>
                </div>

{/* Status badge */}
                {siteSettings.popup.enabled && siteSettings.popup.image && (() => {
                  const now = new Date();
                  const start = siteSettings.popup.startDate ? new Date(siteSettings.popup.startDate) : null;
                  const end = siteSettings.popup.endDate ? new Date(siteSettings.popup.endDate) : null;
                  const active = (!start || now >= start) && (!end || now <= end);
                  return (
                    <div className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border ${active ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-white/30'}`} />
                      {active ? 'Popup กำลังแสดงอยู่' : 'Popup ยังไม่ถึงเวลา หรือหมดเวลาแล้ว'}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Pages */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">⑥</span> หน้าต่างๆ</h2>
              <div className="space-y-5">
                {[
                  { label: 'หน้าทีมพรรค', hKey: 'teamHeading', dKey: 'teamDescription', iKey: 'teamImage', pKey: 'teamImagePos' },
                  { label: 'หน้าข่าวสาร & กิจกรรม', hKey: 'newsHeading', dKey: 'newsDescription', iKey: 'newsImage', pKey: 'newsImagePos' },
                  { label: 'หน้านโยบายพรรค', hKey: 'policiesHeading', dKey: 'policiesDescription', iKey: 'policiesImage', pKey: 'policiesImagePos' },
                  { label: 'หน้าติดต่อเรา', hKey: 'contactHeading', dKey: 'contactDescription', iKey: 'contactImage', pKey: 'contactImagePos' },
                ].map(({ label, hKey, dKey, iKey, pKey }) => {
                  const imgUrl = (siteSettings.pages as any)[iKey] as string;
                  const pos = ((siteSettings.pages as any)[pKey] as string) || '50% 50%';
                  const [px, py] = pos.split(' ').map(v => parseInt(v));
                  return (
                  <React.Fragment key={hKey}>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest pt-2">{label}</p>
                    <div>
                      <label className="block text-xs font-bold text-white/50 mb-1">หัวเรื่อง</label>
                      <input type="text" value={(siteSettings.pages as any)[hKey]} onChange={e => setPageInfo(hKey, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/50 mb-1">คำอธิบาย</label>
                      <textarea value={(siteSettings.pages as any)[dKey]} onChange={e => setPageInfo(dKey, e.target.value)}
                        rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/50 mb-1">รูปภาพ Banner (ถ้าต้องการ) — แนะนำแนวนอนกว้างมาก เช่น 2100×700px ไม่เกิน 5MB</label>
                      {imgUrl && (
                        <>
                          <div className="relative mb-2 rounded-xl overflow-hidden aspect-[21/5]">
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: pos }} />
                          </div>
                          <div className="space-y-2 mb-3 bg-white/5 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-white/40 mb-1">ปรับตำแหน่งรูป</p>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/40 w-12 shrink-0">ซ้าย↔ขวา</span>
                              <input type="range" min={0} max={100} value={px}
                                onChange={e => setPageInfo(pKey, `${e.target.value}% ${py}%`)}
                                className="flex-1 accent-brand-neon" />
                              <span className="text-xs text-white/40 w-8 text-right">{px}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/40 w-12 shrink-0">บน↕ล่าง</span>
                              <input type="range" min={0} max={100} value={py}
                                onChange={e => setPageInfo(pKey, `${px}% ${e.target.value}%`)}
                                className="flex-1 accent-brand-neon" />
                              <span className="text-xs text-white/40 w-8 text-right">{py}%</span>
                            </div>
                          </div>
                        </>
                      )}
                      <ImageUploadField value={imgUrl || ''} onChange={v => setPageInfo(iKey, v)} label="Banner" />
                    </div>
                  </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* About Page */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">⑦</span> หน้าเกี่ยวกับพรรค</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">ประวัติความเป็นมา</label>
                  <textarea value={siteSettings.about.history} onChange={e => setAbout('history', e.target.value)}
                    rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none mb-3" />
                  <p className="text-[11px] text-white/30 mb-1.5">รูปประกอบ — แนะนำอัตราส่วน 16:9 เช่น 1200×675px ไม่เกิน 5MB</p>
                  <ImageUploadField value={siteSettings.about.historyImage || ''} onChange={v => setAbout('historyImage', v)} label="รูปประกอบ" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">อุดมการณ์พรรค</label>
                  <textarea value={siteSettings.about.ideology} onChange={e => setAbout('ideology', e.target.value)}
                    rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none mb-3" />
                  <p className="text-[11px] text-white/30 mb-1.5">รูปประกอบ — แนะนำอัตราส่วน 16:9 เช่น 1200×675px ไม่เกิน 5MB</p>
                  <ImageUploadField value={siteSettings.about.ideologyImage || ''} onChange={v => setAbout('ideologyImage', v)} label="รูปประกอบ" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">วิสัยทัศน์</label>
                  <textarea value={siteSettings.about.vision} onChange={e => setAbout('vision', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none mb-3" />
                  <p className="text-[11px] text-white/30 mb-1.5">รูปประกอบ — แนะนำอัตราส่วน 16:9 เช่น 1200×675px ไม่เกิน 5MB</p>
                  <ImageUploadField value={siteSettings.about.visionImage || ''} onChange={v => setAbout('visionImage', v)} label="รูปประกอบ" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-2">รูปภาพ Banner หน้าเกี่ยวกับพรรค — แนะนำแนวนอนกว้างมาก เช่น 1920×600px ไม่เกิน 5MB</label>
                  <ImageUploadField value={siteSettings.about.image || ''} onChange={v => setAbout('image', v)} label="Banner" />
                </div>
              </div>
            </div>

            {/* Privacy Policy */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><span className="text-brand-neon">⑧</span> นโยบายความเป็นส่วนตัว (PDPA)</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">วันที่อัพเดตล่าสุด</label>
                  <input type="text" value={siteSettings.privacy.updatedAt}
                    onChange={e => setPrivacyInfo('updatedAt', e.target.value)}
                    placeholder="เช่น 2568-04-01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">เนื้อหานโยบาย</label>
                  <textarea value={siteSettings.privacy.content}
                    onChange={e => setPrivacyInfo('content', e.target.value)}
                    rows={14} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none font-mono" />
                  <p className="text-white/30 text-xs mt-1">รองรับการขึ้นบรรทัดใหม่ (Enter)</p>
                </div>
              </div>
            </div>

            {/* Save / Reset Buttons */}
            <div className="flex justify-between items-center pb-4">
              <button onClick={handleResetSettings}
                className="flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full border border-white/20 text-white/50 hover:border-red-400/50 hover:text-red-400 transition-all">
                ↺ รีเซ็ตกลับค่าเริ่มต้น
              </button>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="neon-button text-lg px-10 py-4">
                <Save size={18} /> {savingSettings ? 'กำลังบันทึก...' : settingsSaved ? '✓ บันทึกแล้ว' : 'บันทึกทั้งหมด'}
              </button>
            </div>
          </div>

        ) : tab === 'volunteer' ? (
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Heart size={22} className="text-brand-neon" /> อาสาสมัคร ({volunteer.length})
              </h2>
              <button
                onClick={() => exportCsv(volunteer, 'volunteer.csv')}
                disabled={!volunteer.length}
                className="flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-40"
              >
                ⬇ Export CSV
              </button>
            </div>
            {volunteer.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Heart size={40} className="mx-auto mb-4 opacity-30" />
                <p>ยังไม่มีผู้สมัครอาสาสมัคร</p>
              </div>
            ) : (
              <div className="space-y-4">
                {volunteer.map(v => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <p className="font-bold text-white">{v.name}</p>
                          <span className="text-xs bg-brand-neon/10 text-brand-neon px-2 py-0.5 rounded-full font-bold">{v.province}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-white/50 mb-2">
                          <span className="flex items-center gap-1.5"><Mail size={13} />{v.email}</span>
                          <span className="flex items-center gap-1.5"><Phone size={13} />{v.phone}</span>
                        </div>
                        {v.skills && <p className="text-sm text-white/60 mb-1"><span className="font-bold text-white/40">ทักษะ:</span> {v.skills}</p>}
                        {v.message && <p className="text-sm text-white/60"><span className="font-bold text-white/40">ข้อความ:</span> {v.message}</p>}
                        <p className="text-xs text-white/30 mt-2">{new Date(v.submittedAt).toLocaleString('th-TH')}</p>
                      </div>
                      <button
                        onClick={() => { if (confirm(`ลบข้อมูลอาสาสมัคร "${v.name}"?`)) deleteVolunteer(v.id); }}
                        className="text-white/30 hover:text-red-400 transition-colors shrink-0 p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

        ) : tab === 'users' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* .env accounts — bootstrap/fallback layer, unchanged */}
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                  <UserPlus size={20} className="text-brand-neon" /> บัญชี .env (สำรอง)
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  บัญชีชุดนี้ตั้งค่าผ่านไฟล์ <code className="bg-white/10 px-1 rounded">.env</code> บนเซิร์ฟเวอร์โดยตรง เป็นชั้นสำรองที่ยังต้องแก้มือ +
                  restart เซิร์ฟเวอร์เหมือนเดิม แยกต่างหากจากบัญชีที่จัดการผ่านหน้านี้ด้านล่าง
                </p>
                <div className="bg-brand-neon/5 border border-brand-neon/20 rounded-2xl p-4 text-sm">
                  <p className="font-bold text-brand-neon mb-2">วิธีเพิ่มผู้ดูแลใหม่แบบ .env</p>
                  <ol className="text-white/60 space-y-1 list-decimal list-inside text-xs leading-relaxed">
                    <li>เปิดไฟล์ <code className="bg-white/10 px-1 rounded">.env</code></li>
                    <li>เพิ่มบรรทัดใหม่ต่อจาก admin คนล่าสุด เช่น <code className="bg-white/10 px-1 rounded">ADMIN_3_*</code></li>
                    <li>ตั้งค่า <code className="bg-white/10 px-1 rounded">ADMIN_3_EMAIL</code>, <code className="bg-white/10 px-1 rounded">ADMIN_3_PASSWORD_HASH</code>, <code className="bg-white/10 px-1 rounded">ADMIN_3_NAME</code></li>
                    <li>Restart เซิร์ฟเวอร์</li>
                  </ol>
                </div>
              </div>

              {/* Current user */}
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[32px] p-8">
                <h2 className="text-xl font-black mb-6">เซสชันปัจจุบัน</h2>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 mb-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-neon/10 text-brand-neon">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{user?.displayName || user?.email}</p>
                      <p className="text-white/40 text-xs truncate">{user?.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-brand-neon/10 text-brand-neon shrink-0">
                    {isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}
                  </span>
                </motion.div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-xs font-bold text-white/40 mb-2">แท็บที่บัญชีนี้มีสิทธิ์จัดการ</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TABS.map(t => (
                      <span key={t.key} className={`text-xs font-bold px-3 py-1 rounded-full ${
                        allowedTabs.includes(t.key) ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/25'
                      }`}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* UI-managed admin accounts — super_admin only, both client-gated here and server-enforced */}
            {isSuperAdmin && (
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <UserPlus size={20} className="text-brand-neon" /> จัดการบัญชีผู้ดูแล (ผ่านหน้านี้)
                  </h2>
                  <button onClick={openAddAdmin} className="neon-button">
                    <Plus size={18} /> เพิ่มผู้ดูแลใหม่
                  </button>
                </div>
                {adminAccounts.length === 0 && (
                  <p className="text-white/30 text-center py-12">ยังไม่มีบัญชีที่สร้างผ่านหน้านี้ — กด "เพิ่มผู้ดูแลใหม่"</p>
                )}
                <div className="space-y-3">
                  {adminAccounts.map(acc => {
                    const isSelf = user?.email?.toLowerCase() === acc.email.toLowerCase();
                    return (
                      <div key={acc.id} className="flex items-start justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-5">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg truncate">{acc.name} {isSelf && <span className="text-white/30 text-xs font-normal">(คุณ)</span>}</p>
                          <p className="text-white/40 text-sm mt-1 truncate">{acc.email}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                              acc.role === 'super_admin' ? 'bg-brand-neon/20 text-brand-neon' : 'bg-white/10 text-white/50'
                            }`}>
                              {acc.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                            </span>
                            {acc.role === 'super_admin' ? (
                              <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-500/15 text-green-400">ทุกแท็บ</span>
                            ) : (
                              ADMIN_PERMISSION_TABS.map(t => (
                                <span key={t.key} className={`text-xs font-bold px-3 py-1 rounded-full ${
                                  acc.allowedTabs.includes(t.key) ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/25'
                                }`}>
                                  {t.label}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => openEditAdmin(acc)} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => !isSelf && setDeleteAdminTarget(acc.id)}
                            disabled={isSelf}
                            title={isSelf ? 'ลบบัญชีตัวเองไม่ได้' : undefined}
                            className="w-9 h-9 rounded-xl border border-red-500/30 flex items-center justify-center hover:bg-red-500/10 transition-all text-red-400 disabled:opacity-20 disabled:hover:bg-transparent"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Activity log — ดูว่าใครแก้อะไรเมื่อไหร่ จาก audit fields ที่มีอยู่แล้วทุก item */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-6">ประวัติการแก้ไขล่าสุด</h2>
              {activityLog.length === 0 ? (
                <p className="text-white/30 text-center py-8">ยังไม่มีประวัติการแก้ไข</p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map((a, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wide text-brand-neon bg-brand-neon/10 px-2 py-1 rounded-full shrink-0">{a.label}</span>
                        <span className="text-sm font-bold truncate">{a.title}</span>
                      </div>
                      <div className="text-xs text-white/40 shrink-0 text-right">
                        <div>{a.updatedBy || '—'}</div>
                        <div>{new Date(a.updatedAt).toLocaleString('th-TH')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        ) : tab === 'analytics' ? (
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <BarChart3 size={22} className="text-brand-neon" /> สถิติผู้เข้าชม
                </h2>
                <div className="flex gap-2">
                  {[7, 30, 90].map(d => (
                    <button
                      key={d} onClick={() => setAnalyticsDays(d)}
                      className={`text-sm font-bold px-4 py-2 rounded-xl border transition-colors ${
                        analyticsDays === d ? 'bg-brand-neon/20 border-brand-neon text-brand-neon' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {d} วัน
                    </button>
                  ))}
                </div>
              </div>

              {analyticsError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 mb-4">{analyticsError}</p>
              )}

              {analyticsLoading && !analyticsData ? (
                <p className="text-white/30 text-center py-16">กำลังโหลด...</p>
              ) : analyticsData && analyticsData.byDate.length === 0 ? (
                <p className="text-white/30 text-center py-16">ยังไม่มีข้อมูลผู้เข้าชมในช่วงนี้</p>
              ) : analyticsData ? (() => {
                const max = Math.max(1, ...analyticsData.byDate.map(d => d.total));
                const chartHeight = 180;
                const barGap = 4;
                const n = analyticsData.byDate.length;
                const barWidth = n > 0 ? Math.max(2, (100 / n) - (barGap / 4)) : 0;
                const totalVisits = analyticsData.byDate.reduce((a, d) => a + d.total, 0);
                return (
                  <>
                    <p className="text-white/40 text-sm mb-4">
                      รวม <span className="text-brand-neon font-black">{totalVisits.toLocaleString('th-TH')}</span> ครั้ง ในช่วง {analyticsDays} วันล่าสุด
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 overflow-x-auto">
                      <svg viewBox={`0 0 100 ${chartHeight + 20}`} preserveAspectRatio="none" className="w-full" style={{ height: chartHeight + 20, minWidth: n * 8 }}>
                        {analyticsData.byDate.map((d, i) => {
                          const barHeight = (d.total / max) * chartHeight;
                          const x = i * (100 / n);
                          return (
                            <g key={d.date}>
                              <rect
                                x={x + barGap / 4} y={chartHeight - barHeight}
                                width={barWidth} height={barHeight}
                                fill="#E6FF00" opacity={0.85} rx={0.5}
                              >
                                <title>{`${d.date}: ${d.total.toLocaleString('th-TH')} ครั้ง`}</title>
                              </rect>
                            </g>
                          );
                        })}
                      </svg>
                      <div className="flex justify-between text-[10px] text-white/30 mt-2">
                        <span>{analyticsData.byDate[0]?.date}</span>
                        <span>{analyticsData.byDate[analyticsData.byDate.length - 1]?.date}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-black mb-4">หน้ายอดนิยม</h3>
                    <div className="space-y-2">
                      {analyticsData.topPages.length === 0 && (
                        <p className="text-white/30 text-sm">ไม่มีข้อมูล</p>
                      )}
                      {analyticsData.topPages.map(p => {
                        const topMax = analyticsData.topPages[0]?.count || 1;
                        return (
                          <div key={p.path} className="flex items-center gap-3">
                            <span className="text-xs text-white/50 font-mono w-40 truncate shrink-0" title={p.path}>{p.path}</span>
                            <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                              <div className="h-full bg-brand-neon/40 rounded-full" style={{ width: `${(p.count / topMax) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-white/70 w-14 text-right shrink-0">{p.count.toLocaleString('th-TH')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })() : null}
            </div>
          </div>

        ) : tab === 'polls' ? (
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-2xl font-black tracking-tight">โพล</h2>
              {hasTabPermission('polls') && (
                <button onClick={openAddPoll} className="neon-button">
                  <Plus size={18} /> เพิ่มโพลใหม่
                </button>
              )}
            </div>

            <div className="space-y-4">
              {polls.length === 0 && (
                <p className="text-white/30 text-center py-12">ยังไม่มีโพล — กด "เพิ่มโพลใหม่"</p>
              )}
              {polls.map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                return (
                  <div key={poll.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg">{poll.question}</p>
                        <p className="text-white/40 text-xs mt-1">{totalVotes.toLocaleString('th-TH')} โหวตทั้งหมด</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleTogglePollPublished(poll)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                            poll.published !== false ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-white/5 border border-white/20 text-white/40'
                          }`}
                        >
                          {poll.published !== false ? 'เผยแพร่อยู่' : 'ซ่อนอยู่'}
                        </button>
                        {hasTabPermission('polls') && (
                          <>
                            <button onClick={() => openEditPoll(poll)} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setDeletePollTarget(poll.id)} className="w-9 h-9 rounded-xl border border-red-500/30 flex items-center justify-center hover:bg-red-500/10 transition-all text-red-400 shrink-0">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      {poll.options.map(opt => (
                        <div key={opt.id} className="flex items-center gap-3">
                          <span className="text-xs text-white/60 w-32 truncate shrink-0" title={opt.label}>{opt.label}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                            <div className="h-full bg-brand-neon/40 rounded-full" style={{ width: `${totalVotes ? (opt.votes / totalVotes) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-white/70 w-24 text-right shrink-0">
                            {(opt.votes || 0).toLocaleString('th-TH')} ({totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        ) : (
          /* Content Tabs */
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-2xl font-black tracking-tight">
                {TABS.find(t => t.key === tab)?.label}
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                {/* Bulk publish/unpublish */}
                {['news', 'events', 'policies', 'team', 'homeBlocks'].includes(tab) && (
                  <>
                    <button onClick={() => handleBulkToggle(true)} disabled={bulkLoading}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50">
                      <Eye size={13} /> แสดงทั้งหมด
                    </button>
                    <button onClick={() => handleBulkToggle(false)} disabled={bulkLoading}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <EyeOff size={13} /> ซ่อนทั้งหมด
                    </button>
                  </>
                )}
                {/* Export CSV */}
                {['newsletter', 'contact', 'news', 'events', 'policies', 'team'].includes(tab) && (
                  <button onClick={() => exportCsv(currentData[tab], `${tab}-${Date.now()}.csv`)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-brand-neon/10 border border-brand-neon/30 text-brand-neon hover:bg-brand-neon/20 transition-all">
                    ↓ Export CSV
                  </button>
                )}
                {canEdit && (
                  <button onClick={openAdd} className="neon-button">
                    <Plus size={18} /> เพิ่มใหม่
                  </button>
                )}
              </div>
            </div>
            {/* Search for newsletter/contact */}
            {(tab === 'newsletter' || tab === 'contact') && (
              <input
                type="text" value={adminSearch} onChange={e => setAdminSearch(e.target.value)}
                placeholder={tab === 'newsletter' ? 'ค้นหาอีเมล...' : 'ค้นหาชื่อ/อีเมล/ข้อความ...'}
                className="w-full mb-6 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
              />
            )}

            {/* จัดการหมวดหมู่ข่าว */}
            {tab === 'news' && (
              <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-sm font-bold text-white/60 mb-3">จัดการหมวดหมู่ข่าว</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sortedCategories.length === 0 && (
                    <p className="text-white/30 text-sm">ยังไม่มีหมวดหมู่ — เพิ่มด้านล่างเพื่อใช้เลือกตอนเพิ่ม/แก้ไขข่าว</p>
                  )}
                  {sortedCategories.map(c => (
                    <span key={c.id} className="flex items-center gap-2 bg-brand-neon/10 text-brand-neon text-xs font-bold pl-3 pr-1.5 py-1.5 rounded-full">
                      {c.name}
                      <button
                        type="button"
                        onClick={async () => { if (confirm(`ลบหมวดหมู่ "${c.name}"? (ข่าวที่ใช้หมวดนี้อยู่จะไม่ถูกลบ แต่จะไม่มีในตัวเลือกอีก)`)) { await deleteCategory(c.id); reloadCategories(); } }}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-500/30 hover:text-red-300 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="ชื่อหมวดหมู่ใหม่ เช่น ประกาศพรรค"
                    maxLength={50}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-neon transition-colors"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const name = newCategoryName.trim();
                      if (!name) return;
                      await addCategory({ name, order: sortedCategories.length });
                      setNewCategoryName('');
                      reloadCategories();
                    }}
                    className="bg-brand-neon text-brand-navy font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brand-accent transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Plus size={14} /> เพิ่ม
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {currentData[tab].length === 0 && tab === 'homeBlocks' && (
                <div className="text-center py-12">
                  <p className="text-white/30 mb-4">ยังไม่มีข้อมูลลำดับหน้าแรก — กดปุ่มด้านล่างเพื่อสร้างแถวเริ่มต้นจาก 5 ส่วนที่ใช้อยู่ตอนนี้ (Hero/นโยบาย/ทีมพรรค/ข่าวสาร/CTA)</p>
                  {canEdit && (
                    <button
                      onClick={handleSeedHomeBlocks} disabled={seedingHomeBlocks}
                      className="neon-button mx-auto disabled:opacity-50"
                    >
                      <Database size={18} className={seedingHomeBlocks ? 'animate-spin' : ''} />
                      {seedingHomeBlocks ? 'กำลัง Seed...' : 'Seed ลำดับหน้าแรกเริ่มต้น'}
                    </button>
                  )}
                </div>
              )}
              {currentData[tab].length === 0 && tab !== 'homeBlocks' && (
                <p className="text-white/30 text-center py-12">ยังไม่มีข้อมูล — กด "Seed ข้อมูลตั้งต้น" หรือ "เพิ่มใหม่"</p>
              )}
              {currentData[tab].filter((item: any) => {
                if (!adminSearch || !['newsletter', 'contact'].includes(tab)) return true;
                const q = adminSearch.toLowerCase();
                return [item.email, item.name, item.message].filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
              }).map((item: any, index: number) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">
                      {(tab === 'homeBlocks' ? BLOCK_TYPE_LABELS[item.type] : null) || item.title || item.name || item.email || item.message?.slice(0, 60) || item.id}
                    </p>
                    <p className="text-white/40 text-sm mt-1 truncate">
                      {item.summary || item.description || item.bio || item.role || item.location || item.email || ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(item.category || item.date) && (
                        <span className="bg-brand-neon/10 text-brand-neon text-xs font-bold px-3 py-1 rounded-full">
                          {item.category || item.date}
                        </span>
                      )}
                      {tab === 'homeBlocks' && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          item.type === 'promo' ? 'bg-brand-neon/20 text-brand-neon' : 'bg-white/10 text-white/40'
                        }`}>
                          {item.type === 'promo' ? 'โปรโมท' : 'ส่วนหลัก (ลบไม่ได้)'}
                        </span>
                      )}
                      {(tab === 'news' || tab === 'events' || tab === 'policies' || tab === 'team' || tab === 'homeBlocks') && (
                        canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(item)}
                            disabled={togglingId === item.id}
                            title="กดเพื่อเปลี่ยนสถานะ"
                            className={`text-xs font-bold px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
                              item.published === false
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                          >
                            {togglingId === item.id ? '...' : item.published === false ? '● ซ่อน' : '● แสดง'}
                          </button>
                        ) : (
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            item.published === false ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {item.published === false ? '● ซ่อน' : '● แสดง'}
                          </span>
                        )
                      )}
                      {(tab === 'team' || tab === 'policies') && item.featuredHome && (
                        <span className="bg-brand-neon/20 text-brand-neon text-xs font-bold px-3 py-1 rounded-full">
                          ★ หน้าหลัก
                        </span>
                      )}
                      {(tab === 'news' || tab === 'events' || tab === 'policies' || tab === 'homeBlocks') && item.publishAt && (
                        <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                          เริ่ม {new Date(item.publishAt).toLocaleDateString('th-TH')}
                        </span>
                      )}
                      {(tab === 'news' || tab === 'events' || tab === 'policies' || tab === 'homeBlocks') && item.unpublishAt && (
                        <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                          หมด {new Date(item.unpublishAt).toLocaleDateString('th-TH')}
                        </span>
                      )}
                    </div>
                    {(item.createdBy || item.updatedBy) && ['news', 'events', 'policies', 'team', 'homeBlocks'].includes(tab) && (
                      <p className="text-white/25 text-xs mt-2">
                        {item.createdBy && <>สร้างโดย {item.createdBy}</>}
                        {item.updatedBy && item.updatedBy !== item.createdBy && <> · แก้ไขล่าสุดโดย {item.updatedBy}</>}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      {(tab === 'policies' || tab === 'homeBlocks' || tab === 'team') && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleReorder(currentData[tab], index, 'up')}
                            disabled={index === 0}
                            className="w-9 h-4 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-20"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            onClick={() => handleReorder(currentData[tab], index, 'down')}
                            disabled={index === currentData[tab].length - 1}
                            className="w-9 h-4 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-20"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                      )}
                      {(tab !== 'homeBlocks' || item.type === 'promo') && (
                        <>
                          <button onClick={() => openEdit(item)} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(item.id)} className="w-9 h-9 rounded-xl border border-red-500/30 flex items-center justify-center hover:bg-red-500/10 transition-all text-red-400">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {modal.open && modal.data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="bg-brand-navy border border-white/10 rounded-t-[32px] sm:rounded-[32px] w-full max-w-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-8 pt-8 pb-4 shrink-0">
              <h3 className="text-2xl font-black">
                {modal.mode === 'add' ? 'เพิ่ม' : 'แก้ไข'} {TABS.find(t => t.key === modal.activeTab)?.label}
              </h3>
              <button onClick={() => { setModal({ open: false, mode: 'add', data: null, activeTab: modal.activeTab }); setSaveError(''); setTab(modal.activeTab); }} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-8 pb-2">
            <div className="space-y-5">
              {(fieldConfig[modal.activeTab] || []).map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-bold text-white/60 mb-2">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <button
                      type="button"
                      onClick={() => setModal(m => ({ ...m, data: { ...m.data, [field.key]: !m.data[field.key] } }))}
                      className={`flex items-center gap-3 px-5 py-3 rounded-2xl border font-bold transition-all ${
                        modal.data[field.key]
                          ? 'bg-brand-neon/20 border-brand-neon text-brand-neon'
                          : 'bg-white/5 border-white/20 text-white/40'
                      }`}
                    >
                      <div className={`w-10 h-6 rounded-full transition-all relative ${modal.data[field.key] ? 'bg-brand-neon' : 'bg-white/20'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${modal.data[field.key] ? 'right-1' : 'left-1'}`} />
                      </div>
                      {modal.data[field.key] ? 'แสดงผล (เปิด)' : 'ซ่อน (ปิด)'}
                    </button>
                  ) : field.type === 'datetime' ? (
                    <input
                      type="datetime-local"
                      value={modal.data[field.key] || ''}
                      onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field.key]: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                    />
                  ) : field.type === 'image-upload' ? (
                    <ImageUploadField
                      value={modal.data[field.key] || ''}
                      onChange={v => setModal(m => ({ ...m, data: { ...m.data, [field.key]: v } }))}
                      label={field.label}
                    />
                  ) : field.type === 'color-picker' ? (
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={modal.data[field.key] || '#E6FF00'}
                        onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field.key]: e.target.value } }))}
                        className="w-12 h-12 rounded-xl border border-white/20 cursor-pointer bg-transparent"
                      />
                      <span className="text-white/60 text-sm font-mono">{modal.data[field.key] || '#E6FF00'}</span>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <div>
                      <textarea
                        value={modal.data[field.key] || ''}
                        onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field.key]: e.target.value } }))}
                        rows={4}
                        maxLength={field.maxLength}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors resize-none"
                      />
                      {field.maxLength && <p className="text-right text-xs text-white/30 mt-1">{(modal.data[field.key] || '').length}/{field.maxLength}</p>}
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      value={modal.data[field.key] || ''}
                      onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field.key]: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                    >
                      {field.options?.map((opt, i) => (
                        <option key={opt} value={opt} className="bg-brand-navy">
                          {field.optionLabels?.[i] || opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text" value={modal.data[field.key] || ''}
                      onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field.key]: e.target.value } }))}
                      maxLength={field.maxLength}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
            </div>
            <div className="shrink-0 px-8 pb-8 pt-4 border-t border-white/10">
              {saveError && (
                <p className="mb-4 text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">{saveError}</p>
              )}
              <div className="flex gap-4">
                <button onClick={handleSave} disabled={saving} className="neon-button flex-1 justify-center text-lg py-4">
                  <Save size={18} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => { setModal({ open: false, mode: 'add', data: null, activeTab: modal.activeTab }); setSaveError(''); setTab(modal.activeTab); }} className="outline-button px-8 py-4">
                  ยกเลิก
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirm */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-navy border border-white/10 rounded-[32px] p-10 text-center max-w-md w-full"
          >
            <LogOut size={48} className="text-brand-neon mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-3">ออกจากระบบ?</h3>
            <p className="text-white/50 mb-8">คุณต้องการออกจากระบบใช่หรือไม่?</p>
            <div className="flex gap-4">
              <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="flex-1 bg-brand-neon text-brand-navy font-black py-3 rounded-full hover:bg-brand-accent transition-colors">
                ออกจากระบบ
              </button>
              <button onClick={() => setShowLogoutConfirm(false)} className="outline-button flex-1 justify-center">
                ยกเลิก
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-navy border border-red-500/30 rounded-[32px] p-10 text-center max-w-md w-full"
          >
            <Trash2 size={48} className="text-red-400 mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-3">ยืนยันการลบ?</h3>
            <p className="text-white/50 mb-8">ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
            <div className="flex gap-4">
              <button onClick={() => handleDelete(deleteTarget)} className="flex-1 bg-red-500 text-white font-black py-3 rounded-full hover:bg-red-600 transition-colors">
                ลบเลย
              </button>
              <button onClick={() => setDeleteTarget(null)} className="outline-button flex-1 justify-center">
                ยกเลิก
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Poll Add/Edit Modal */}
      {pollModal.open && pollModal.data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="bg-brand-navy border border-white/10 rounded-t-[32px] sm:rounded-[32px] w-full max-w-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-8 pt-8 pb-4 shrink-0">
              <h3 className="text-2xl font-black">{pollModal.mode === 'add' ? 'เพิ่มโพลใหม่' : 'แก้ไขโพล'}</h3>
              <button onClick={() => { setPollModal({ open: false, mode: 'add', data: null }); setPollSaveError(''); }} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-8 pb-2">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">คำถาม</label>
                  <input
                    type="text" value={pollModal.data.question || ''}
                    onChange={e => setPollModal(m => ({ ...m, data: { ...m.data, question: e.target.value } }))}
                    maxLength={300}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">ตัวเลือกคำตอบ (อย่างน้อย 2 ข้อ)</label>
                  <div className="space-y-2">
                    {pollModal.data.options.map((opt: any, i: number) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="text" value={opt.label}
                          onChange={e => updatePollOptionLabel(i, e.target.value)}
                          placeholder={`ตัวเลือกที่ ${i + 1}`}
                          maxLength={100}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-brand-neon transition-colors"
                        />
                        {pollModal.mode === 'edit' && (
                          <span className="text-xs text-white/30 w-16 text-right shrink-0">{opt.votes || 0} โหวต</span>
                        )}
                        {pollModal.data.options.length > 2 && (
                          <button type="button" onClick={() => removePollOption(i)} className="w-9 h-9 rounded-xl border border-red-500/30 flex items-center justify-center hover:bg-red-500/10 transition-all text-red-400 shrink-0">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addPollOption} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-brand-neon hover:text-brand-accent transition-colors">
                    <Plus size={16} /> เพิ่มตัวเลือก
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">สถานะการแสดงผล</label>
                  <button
                    type="button"
                    onClick={() => setPollModal(m => ({ ...m, data: { ...m.data, published: m.data.published === false } }))}
                    className={`flex items-center gap-3 px-5 py-3 rounded-2xl border font-bold transition-all ${
                      pollModal.data.published !== false ? 'bg-brand-neon/20 border-brand-neon text-brand-neon' : 'bg-white/5 border-white/20 text-white/40'
                    }`}
                  >
                    <div className={`w-10 h-6 rounded-full transition-all relative ${pollModal.data.published !== false ? 'bg-brand-neon' : 'bg-white/20'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${pollModal.data.published !== false ? 'right-1' : 'left-1'}`} />
                    </div>
                    {pollModal.data.published !== false ? 'แสดงผล (เปิด)' : 'ซ่อน (ปิด)'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2">เริ่มแสดงวันที่ (ไม่บังคับ)</label>
                    <input
                      type="datetime-local" value={pollModal.data.publishAt || ''}
                      onChange={e => setPollModal(m => ({ ...m, data: { ...m.data, publishAt: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2">หยุดแสดงวันที่ (ไม่บังคับ)</label>
                    <input
                      type="datetime-local" value={pollModal.data.unpublishAt || ''}
                      onChange={e => setPollModal(m => ({ ...m, data: { ...m.data, unpublishAt: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-8 pb-8 pt-4 border-t border-white/10">
              {pollSaveError && (
                <p className="mb-4 text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">{pollSaveError}</p>
              )}
              <div className="flex gap-4">
                <button onClick={handleSavePoll} disabled={savingPoll} className="neon-button flex-1 justify-center text-lg py-4">
                  <Save size={18} /> {savingPoll ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => { setPollModal({ open: false, mode: 'add', data: null }); setPollSaveError(''); }} className="outline-button px-8 py-4">
                  ยกเลิก
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {deletePollTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-navy border border-red-500/30 rounded-[32px] p-10 text-center max-w-md w-full"
          >
            <Trash2 size={48} className="text-red-400 mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-3">ยืนยันการลบโพล?</h3>
            <p className="text-white/50 mb-8">ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
            <div className="flex gap-4">
              <button onClick={() => handleDeletePoll(deletePollTarget)} className="flex-1 bg-red-500 text-white font-black py-3 rounded-full hover:bg-red-600 transition-colors">
                ลบเลย
              </button>
              <button onClick={() => setDeletePollTarget(null)} className="outline-button flex-1 justify-center">
                ยกเลิก
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Admin account Add/Edit Modal */}
      {adminModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="bg-brand-navy border border-white/10 rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-8 pt-8 pb-4 shrink-0">
              <h3 className="text-2xl font-black">{adminModal.mode === 'add' ? 'เพิ่มผู้ดูแลใหม่' : 'แก้ไขผู้ดูแล'}</h3>
              <button onClick={() => setAdminModal({ open: false, mode: 'add', data: {} })} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-8 pb-2">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">อีเมล</label>
                  <input
                    type="email"
                    value={adminModal.data.email || ''}
                    onChange={e => setAdminModal(m => ({ ...m, data: { ...m.data, email: e.target.value } }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">ชื่อ</label>
                  <input
                    type="text"
                    value={adminModal.data.name || ''}
                    onChange={e => setAdminModal(m => ({ ...m, data: { ...m.data, name: e.target.value } }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">
                    รหัสผ่าน {adminModal.mode === 'edit' && '(เว้นว่างไว้ถ้าไม่เปลี่ยน)'}
                  </label>
                  <input
                    type="password"
                    value={adminModal.data.password || ''}
                    onChange={e => setAdminModal(m => ({ ...m, data: { ...m.data, password: e.target.value } }))}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-brand-neon transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/60 mb-2">สิทธิ์</label>
                  <div className="flex gap-2">
                    {(['admin', 'super_admin'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAdminModal(m => ({
                          ...m,
                          data: { ...m.data, role: r, allowedTabs: r === 'super_admin' ? ADMIN_PERMISSION_TABS.map(t => t.key) : (m.data.allowedTabs?.length ? m.data.allowedTabs : DEFAULT_ADMIN_TABS_CLIENT) },
                        }))}
                        className={`flex-1 text-sm font-bold px-4 py-3 rounded-xl border transition-colors ${
                          (adminModal.data.role || 'admin') === r
                            ? 'bg-brand-neon/20 border-brand-neon text-brand-neon'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {r === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </button>
                    ))}
                  </div>
                </div>
                {adminModal.data.role === 'super_admin' ? (
                  <p className="text-white/40 text-sm bg-white/5 border border-white/10 rounded-2xl px-5 py-3">ทุกแท็บ (Super Admin)</p>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-white/60 mb-2">แท็บที่จัดการได้</label>
                    <div className="flex flex-wrap gap-2">
                      {ADMIN_PERMISSION_TABS.map(t => {
                        const checked = (adminModal.data.allowedTabs || []).includes(t.key);
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setAdminModal(m => {
                              const cur = m.data.allowedTabs || [];
                              const next = cur.includes(t.key) ? cur.filter(k => k !== t.key) : [...cur, t.key];
                              return { ...m, data: { ...m.data, allowedTabs: next } };
                            })}
                            className={`text-xs font-bold px-3 py-2 rounded-full border transition-colors ${
                              checked ? 'bg-brand-neon/20 border-brand-neon text-brand-neon' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {adminSaveError && <p className="text-red-400 text-sm">{adminSaveError}</p>}
              </div>
            </div>
            <div className="flex gap-3 p-8 pt-4 shrink-0">
              <button onClick={handleSaveAdmin} disabled={savingAdmin} className="neon-button flex-1 justify-center">
                <Save size={18} /> {savingAdmin ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setAdminModal({ open: false, mode: 'add', data: {} })} className="outline-button flex-1 justify-center">
                ยกเลิก
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteAdminTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-navy border border-red-500/30 rounded-[32px] p-10 text-center max-w-md w-full"
          >
            <Trash2 size={48} className="text-red-400 mx-auto mb-6" />
            <h3 className="text-2xl font-black mb-3">ลบบัญชีผู้ดูแลนี้?</h3>
            <p className="text-white/50 mb-8">บัญชีนี้จะเข้าสู่ระบบไม่ได้อีกทันที</p>
            <div className="flex gap-4">
              <button onClick={() => handleDeleteAdmin(deleteAdminTarget)} className="flex-1 bg-red-500 text-white font-black py-3 rounded-full hover:bg-red-600 transition-colors">
                ลบเลย
              </button>
              <button onClick={() => setDeleteAdminTarget(null)} className="outline-button flex-1 justify-center">
                ยกเลิก
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating User Bar (Discord-style) */}
      {showUserMenu && (
        <div className="fixed inset-0 z-[55]" onClick={() => setShowUserMenu(false)} />
      )}
      <div className="fixed bottom-0 left-0 z-[56] w-64">
        {showUserMenu && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-2 mb-2 bg-[#111214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* User info header */}
            <div className="px-4 py-3 bg-white/5">
              <p className="font-black text-sm text-white truncate">{user.displayName || user.email}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
            <div className="border-t border-white/10" />
            {/* Logout */}
            <button
              onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-bold"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </motion.div>
        )}
        {/* Bottom user bar */}
        <button
          onClick={() => setShowUserMenu(v => !v)}
          className="w-full flex items-center gap-3 bg-[#0f1012] border-t border-white/10 px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-brand-neon flex items-center justify-center text-brand-navy font-black text-sm shrink-0">
            {(user.displayName || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">{user.displayName || user.email}</p>
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />ออนไลน์
            </p>
          </div>
          <LogOut size={16} className="text-white/30 shrink-0" />
        </button>
      </div>
    </main>
  );
}
