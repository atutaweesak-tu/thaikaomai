import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Pencil, Trash2, Save, X, Database, Newspaper,
  Calendar, BookOpen, Users, Mail, MessageSquare, LogIn,
  AlertTriangle, Eye, EyeOff, ShieldCheck, UserPlus, LogOut, Settings, Upload,
  ChevronUp, ChevronDown, Heart, Phone
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import {
  subscribeToNews, addNews, updateNews, deleteNews,
  subscribeToEvents, addEvent, updateEvent, deleteEvent,
  subscribeToPolicies, addPolicy, updatePolicy, deletePolicy,
  subscribeToTeam, addTeamMember, updateTeamMember, deleteTeamMember,
  subscribeToNewsletter, subscribeToContact,
  subscribeToVolunteer, deleteVolunteer,
  subscribeToSiteSettings, updateSiteSettings,
  fetchCategories, addCategory, deleteCategory,
  seedInitialData, getApiToken,
} from '../services/dataService';
import { NewsItem, EventItem, Policy, TeamMember, NewsletterSubscriber, ContactMessage, VolunteerItem, SiteSettings, DEFAULT_SETTINGS, NewsCategory } from '../types';
import { POLICIES, TEAM, NEWS, EVENTS } from '../constants';

type Tab = 'news' | 'events' | 'policies' | 'team' | 'newsletter' | 'contact' | 'volunteer' | 'users' | 'settings';

// จัดกลุ่มแท็บให้เห็นเป็นหมวดหมู่ชัดเจนในแถบเมนู — ไม่กระทบ logic ด้านใน แค่จัดการแสดงผล
const TAB_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: 'เนื้อหาเว็บ', tabs: ['news', 'events', 'policies', 'team'] },
  { label: 'ข้อมูลติดต่อ', tabs: ['newsletter', 'contact', 'volunteer'] },
  { label: 'ระบบ', tabs: ['users', 'settings'] },
];

async function uploadImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 5 MB');
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
  const headers: Record<string, string> = { 'Content-Type': file.type };
  const token = getApiToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/upload?ext=${ext}`, { method: 'POST', headers, body: file });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'อัพโหลดรูปไม่สำเร็จ');
  }
  const data = await res.json();
  return data.url;
}

const EMPTY_NEWS: Omit<NewsItem, 'id'> = { title: '', summary: '', content: '', date: '', image: '', category: '', published: true, publishAt: '', unpublishAt: '' };
const EMPTY_EVENT: Omit<EventItem, 'id'> = { title: '', date: '', location: '', time: '', published: true, publishAt: '', unpublishAt: '' };
const EMPTY_POLICY: Omit<Policy, 'id'> = { title: '', description: '', icon: 'BookOpen', iconImage: '', color: '#E6FF00', published: true, publishAt: '', unpublishAt: '', featuredHome: false };
const EMPTY_MEMBER: Omit<TeamMember, 'id'> = { name: '', role: '', image: '', bio: '', category: 'leader', published: true, featuredHome: false };

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
  const [newsletter, setNewsletter] = useState<NewsletterSubscriber[]>([]);
  const [contact, setContact] = useState<ContactMessage[]>([]);
  const [volunteer, setVolunteer] = useState<VolunteerItem[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Modal
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: any; activeTab: Tab }>({ open: false, mode: 'add', data: null, activeTab: 'news' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  // แท็บที่บัญชีนี้มีสิทธิ์เห็น/จัดการ — มาจาก session (ตั้งค่าได้ต่อ admin ผ่าน ADMIN_n_TABS ใน .env)
  const allowedTabs = profile?.allowedTabs?.length ? profile.allowedTabs : (isSuperAdmin ? TAB_GROUPS.flatMap(g => g.tabs) : []);

  const reloadCategories = () => { fetchCategories().then(setCategories); };

  useEffect(() => {
    if (!isAdmin) return;
    const unsubs = [
      subscribeToNews(setNews),
      subscribeToEvents(setEvents),
      subscribeToPolicies(setPolicies),
      subscribeToTeam(setTeam),
      subscribeToNewsletter(setNewsletter),
      subscribeToContact(setContact),
      subscribeToVolunteer(setVolunteer),
      subscribeToSiteSettings(setSiteSettings),
    ];
    reloadCategories(); // หมวดหมู่เปลี่ยนไม่บ่อย — โหลดครั้งเดียวตอนเข้าหน้า ไม่ต้อง poll ต่อเนื่อง
    return () => unsubs.forEach(u => u());
  }, [isAdmin]);

  // ถ้าแท็บปัจจุบันไม่อยู่ในสิทธิ์ของ user นี้ (เช่นสลับบัญชี) ให้สลับไปแท็บแรกที่มีสิทธิ์
  useEffect(() => {
    if (!isAdmin || allowedTabs.length === 0) return;
    if (!allowedTabs.includes(tab)) setTab(allowedTabs[0] as Tab);
  }, [isAdmin, tab, allowedTabs.join(',')]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError('');
    await updateSiteSettings(siteSettings);
    setSettingsSaved(true);
    setSavingSettings(false);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const setHero = (key: string, val: string) =>
    setSiteSettings(s => ({ ...s, hero: { ...s.hero, [key]: val } }));
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
      }
    } catch { alert('เกิดข้อผิดพลาดระหว่าง bulk update'); }
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

  const openAdd = () => {
    const emptyMap: Record<string, any> = {
      news: { ...EMPTY_NEWS }, events: { ...EMPTY_EVENT },
      policies: { ...EMPTY_POLICY }, team: { ...EMPTY_MEMBER },
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
      } else {
        if (savedTab === 'news') await updateNews(id, rest);
        else if (savedTab === 'events') await updateEvent(id, rest);
        else if (savedTab === 'policies') await updatePolicy(id, rest);
        else if (savedTab === 'team') await updateTeamMember(id, rest);
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
      }
    } finally {
      setTab(savedTab);
    }
  };

  const ALL_TABS: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'news', label: 'ข่าวสาร', icon: Newspaper, count: news.length },
    { key: 'events', label: 'กิจกรรม', icon: Calendar, count: events.length },
    { key: 'policies', label: 'นโยบาย', icon: BookOpen, count: policies.length },
    { key: 'team', label: 'ทีมพรรค', icon: Users, count: team.length },
    { key: 'newsletter', label: 'Newsletter', icon: Mail, count: newsletter.length },
    { key: 'contact', label: 'ข้อความ', icon: MessageSquare, count: contact.length },
    { key: 'volunteer', label: 'อาสาสมัคร', icon: Heart, count: volunteer.length },
    { key: 'users', label: 'ผู้ดูแล', icon: ShieldCheck },
    { key: 'settings', label: 'ตั้งค่าเว็บ', icon: Settings },
  ];
  // แสดงเฉพาะแท็บที่บัญชีนี้มีสิทธิ์ — แยกตามสิทธิ์ของ user (role/allowedTabs)
  const TABS = ALL_TABS.filter(t => allowedTabs.includes(t.key));

  const sortedPolicies = [...policies].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const sortedCategories = [...categories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const currentData: Record<string, any[]> = { news, events, policies: sortedPolicies, team, newsletter, contact, volunteer };
  const canEdit = ['news', 'events', 'policies', 'team'].includes(tab) && allowedTabs.includes(tab);

  const fieldConfig: Record<string, { key: string; label: string; type: string; maxLength?: number; options?: string[]; optionLabels?: string[] }[]> = {
    news: [
      { key: 'title', label: 'หัวข้อข่าว', type: 'text', maxLength: 200 },
      { key: 'summary', label: 'สรุปข่าว', type: 'textarea', maxLength: 500 },
      { key: 'content', label: 'เนื้อหาเต็ม', type: 'textarea', maxLength: 20000 },
      { key: 'date', label: 'วันที่แสดง', type: 'text' },
      { key: 'image', label: 'รูปภาพ', type: 'image-upload' },
      {
        key: 'category', label: 'หมวดหมู่', type: 'select',
        options: Array.from(new Set([
          ...sortedCategories.map(c => c.name),
          ...(modal.data?.category ? [modal.data.category] : []), // กันค่าเก่าที่ไม่อยู่ในลิสต์หายไปจากหน้าจอ
        ])),
      },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
    ],
    events: [
      { key: 'title', label: 'ชื่อกิจกรรม', type: 'text' },
      { key: 'date', label: 'วันที่', type: 'text' },
      { key: 'location', label: 'สถานที่', type: 'text' },
      { key: 'time', label: 'เวลา', type: 'text' },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
    ],
    policies: [
      { key: 'title', label: 'ชื่อนโยบาย', type: 'text', maxLength: 200 },
      { key: 'description', label: 'รายละเอียด', type: 'textarea', maxLength: 2000 },
      { key: 'iconImage', label: 'รูป Icon (อัพโหลดจากเครื่อง)', type: 'image-upload' },
      { key: 'icon', label: 'Icon (Lucide name) — ใช้ถ้าไม่มีรูป', type: 'text' },
      { key: 'color', label: 'สีพื้นหลัง', type: 'color-picker' },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'featuredHome', label: 'แสดงในหน้าหลัก (เลือกได้สูงสุด 4 นโยบาย)', type: 'toggle' },
      { key: 'publishAt', label: 'เริ่มแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
      { key: 'unpublishAt', label: 'หยุดแสดงวันที่ (ไม่บังคับ)', type: 'datetime' },
    ],
    team: [
      { key: 'name', label: 'ชื่อ-นามสกุล', type: 'text', maxLength: 100 },
      { key: 'role', label: 'ตำแหน่ง', type: 'text', maxLength: 100 },
      { key: 'bio', label: 'ประวัติย่อ', type: 'textarea', maxLength: 500 },
      { key: 'image', label: 'รูปภาพ', type: 'image-upload' },
      { key: 'category', label: 'ประเภท', type: 'select', options: ['chairman', 'leader', 'expert'], optionLabels: ['ประธานพรรค', 'ผู้นำพรรค', 'กรรมการบริหาร'] },
      { key: 'published', label: 'สถานะการแสดงผล', type: 'toggle' },
      { key: 'featuredHome', label: 'แสดงในหน้าหลัก (เลือกได้สูงสุด 3 คน)', type: 'toggle' },
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
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-white/50 mb-1">{f.label}</label>
                    <input type="text" value={(siteSettings.hero as any)[f.key]}
                      onChange={e => setHero(f.key, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">คำอธิบาย</label>
                  <textarea value={siteSettings.hero.description} onChange={e => setHero('description', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-white/50 mb-1">รูปหัวหน้าพรรค</label>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input type="text" value={siteSettings.hero.leaderImage} onChange={e => setHero('leaderImage', e.target.value)}
                        placeholder="URL หรืออัพโหลดรูปจากเครื่อง"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors" />
                    </div>
                    <label className="cursor-pointer bg-white/10 hover:bg-brand-neon hover:text-brand-navy border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2">
                      <Upload size={14} /> อัพโหลดรูป
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try { setHero('leaderImage', await uploadImage(file)); }
                        catch (err) { alert(String(err)); }
                      }} />
                    </label>
                    {siteSettings.hero.leaderImage && (
                      <img src={siteSettings.hero.leaderImage} alt="preview"
                        className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0" />
                    )}
                  </div>
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
                <label className="block text-xs font-bold text-white/50 mb-2">QR Code โซเชียล</label>
                {siteSettings.contact.qrCode && (
                  <div className="relative mb-3 rounded-xl overflow-hidden max-w-[160px]">
                    <img src={siteSettings.contact.qrCode} alt="QR Code" className="w-full h-auto block rounded-xl border border-white/10" />
                    <button type="button" onClick={() => setContactInfo('qrCode', '')}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full transition-colors">
                      ลบ
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white/50 hover:text-brand-neon transition-colors">
                  <Upload size={14} />
                  {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด QR Code'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try { setContactInfo('qrCode', await uploadImage(file)); }
                    catch (err) { alert(String(err)); }
                    finally { setUploading(false); e.target.value = ''; }
                  }} />
                </label>
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
                  <label className="block text-xs font-bold text-white/50 mb-2">รูปภาพ Popup</label>
                  {siteSettings.popup.image && (
                    <div className="relative mb-3 rounded-xl overflow-hidden max-w-xs">
                      <img src={siteSettings.popup.image} alt="popup preview" className="w-full h-auto block rounded-xl border border-white/10" />
                      <button type="button" onClick={() => setPopup('image', '')}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full transition-colors">
                        ลบรูป
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white/50 hover:text-brand-neon transition-colors">
                    <Upload size={14} />
                    {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป Popup'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try { setPopup('image', await uploadImage(file)); }
                      catch (err) { alert(String(err)); }
                      finally { setUploading(false); e.target.value = ''; }
                    }} />
                  </label>
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
                      <label className="block text-xs font-bold text-white/50 mb-1">รูปภาพ Banner (ถ้าต้องการ)</label>
                      {imgUrl && (
                        <>
                          <div className="relative mb-2 rounded-xl overflow-hidden aspect-[21/5]">
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: pos }} />
                            <button type="button" onClick={() => setPageInfo(iKey, '')}
                              className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full transition-colors">
                              ลบรูป
                            </button>
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
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white/50 hover:text-brand-neon transition-colors">
                        <Upload size={14} />
                        {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป Banner'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try { setPageInfo(iKey, await uploadImage(file)); }
                          catch (err) { alert(String(err)); }
                          finally { setUploading(false); e.target.value = ''; }
                        }} />
                      </label>
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
                    rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">อุดมการณ์พรรค</label>
                  <textarea value={siteSettings.about.ideology} onChange={e => setAbout('ideology', e.target.value)}
                    rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-1">วิสัยทัศน์</label>
                  <textarea value={siteSettings.about.vision} onChange={e => setAbout('vision', e.target.value)}
                    rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-neon transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 mb-2">รูปภาพ Banner หน้าเกี่ยวกับพรรค</label>
                  {siteSettings.about.image && (
                    <div className="relative mb-3 rounded-xl overflow-hidden aspect-[21/5]">
                      <img src={siteSettings.about.image} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setAbout('image', '')}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full transition-colors">
                        ลบรูป
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white/50 hover:text-brand-neon transition-colors">
                    <Upload size={14} />
                    {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป Banner'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploading(true);
                      try { setAbout('image', await uploadImage(file)); }
                      catch (err) { alert(String(err)); }
                      finally { setUploading(false); e.target.value = ''; }
                    }} />
                  </label>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* How to add admins */}
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
              <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-brand-neon" /> การจัดการผู้ดูแล
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                บัญชีผู้ดูแลระบบจัดการผ่านไฟล์ <code className="bg-white/10 px-1 rounded">.env</code> บนเซิร์ฟเวอร์ ไม่สามารถเพิ่มหรือลบจากหน้านี้ได้โดยตรง
              </p>
              <div className="bg-brand-neon/5 border border-brand-neon/20 rounded-2xl p-4 text-sm">
                <p className="font-bold text-brand-neon mb-2">วิธีเพิ่มผู้ดูแลใหม่</p>
                <ol className="text-white/60 space-y-1 list-decimal list-inside text-xs leading-relaxed">
                  <li>เปิดไฟล์ <code className="bg-white/10 px-1 rounded">.env</code></li>
                  <li>เพิ่มบรรทัดใหม่ต่อจาก admin คนล่าสุด เช่น <code className="bg-white/10 px-1 rounded">ADMIN_3_*</code></li>
                  <li>ตั้งค่า <code className="bg-white/10 px-1 rounded">ADMIN_3_EMAIL</code>, <code className="bg-white/10 px-1 rounded">ADMIN_3_PASSWORD_HASH</code>, <code className="bg-white/10 px-1 rounded">ADMIN_3_NAME</code></li>
                  <li>
                    (ไม่บังคับ) กำหนดสิทธิ์: <code className="bg-white/10 px-1 rounded">ADMIN_3_ROLE=admin</code> และ{' '}
                    <code className="bg-white/10 px-1 rounded">ADMIN_3_TABS=news,events</code> เพื่อจำกัดให้จัดการได้แค่บางแท็บ —
                    ถ้าไม่ตั้ง จะได้สิทธิ์ทุกแท็บยกเว้น "ตั้งค่าเว็บ" และ "ผู้ดูแล"
                  </li>
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

        ) : (
          /* Content Tabs */
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-2xl font-black tracking-tight">
                {TABS.find(t => t.key === tab)?.label}
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                {/* Bulk publish/unpublish */}
                {['news', 'events', 'policies', 'team'].includes(tab) && (
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
                {(tab === 'newsletter' || tab === 'contact') && (
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
              {currentData[tab].length === 0 && (
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
                      {item.title || item.name || item.email || item.message?.slice(0, 60) || item.id}
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
                      {(tab === 'news' || tab === 'events' || tab === 'policies' || tab === 'team') && (
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
                      {(tab === 'news' || tab === 'events' || tab === 'policies') && item.publishAt && (
                        <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                          เริ่ม {new Date(item.publishAt).toLocaleDateString('th-TH')}
                        </span>
                      )}
                      {(tab === 'news' || tab === 'events' || tab === 'policies') && item.unpublishAt && (
                        <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                          หมด {new Date(item.unpublishAt).toLocaleDateString('th-TH')}
                        </span>
                      )}
                    </div>
                    {(item.createdBy || item.updatedBy) && ['news', 'events', 'policies', 'team'].includes(tab) && (
                      <p className="text-white/25 text-xs mt-2">
                        {item.createdBy && <>สร้างโดย {item.createdBy}</>}
                        {item.updatedBy && item.updatedBy !== item.createdBy && <> · แก้ไขล่าสุดโดย {item.updatedBy}</>}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      {tab === 'policies' && (
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
                      <button onClick={() => openEdit(item)} className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(item.id)} className="w-9 h-9 rounded-xl border border-red-500/30 flex items-center justify-center hover:bg-red-500/10 transition-all text-red-400">
                        <Trash2 size={15} />
                      </button>
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
                    <div className="flex items-center gap-4">
                      {modal.data[field.key] && (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/20 shrink-0">
                          <img src={modal.data[field.key]} alt="icon" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex gap-3 flex-wrap">
                        <label className={`cursor-pointer border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex items-center gap-2 ${uploading ? 'opacity-50 cursor-wait bg-white/5' : 'bg-white/10 hover:bg-brand-neon hover:text-brand-navy'}`}>
                          <Upload size={14} /> {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดรูป'}
                          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            try {
                              const url = await uploadImage(file);
                              setModal(m => ({ ...m, data: { ...m.data, [field.key]: url } }));
                            } catch (err) { alert(String(err)); }
                            finally { setUploading(false); }
                          }} />
                        </label>
                        {modal.data[field.key] && (
                          <button type="button" onClick={() => setModal(m => ({ ...m, data: { ...m.data, [field.key]: '' } }))}
                            className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm font-bold text-red-400 transition-all">
                            ลบรูป
                          </button>
                        )}
                      </div>
                    </div>
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
