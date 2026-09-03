import { ThemeSettings } from '../types';

export const DEFAULT_THEME: ThemeSettings = {
  bgLevel: 2,
  textContrast: 'normal',
  fontScale: 'md',
  accentLevel: 'high',
  showEyebrows: true,
};

/** เติมค่าที่ขาด + จำกัดให้อยู่ในช่วง enum */
export function normalizeTheme(t: Partial<ThemeSettings> | undefined | null): ThemeSettings {
  const bg = Number((t as any)?.bgLevel);
  return {
    bgLevel: (bg === 1 || bg === 2 || bg === 3 || bg === 4 ? bg : DEFAULT_THEME.bgLevel) as ThemeSettings['bgLevel'],
    textContrast: t?.textContrast === 'high' ? 'high' : 'normal',
    fontScale: t?.fontScale === 'sm' || t?.fontScale === 'lg' ? t.fontScale : 'md',
    accentLevel: t?.accentLevel === 'low' ? 'low' : 'high',
    showEyebrows: t?.showEyebrows !== false,
  };
}

// ── ตารางค่า (curate ให้ทุก combination อ่านออก + on-brand) ───────────────────
const BG = {
  1: { navy: '#181534', section: 'rgba(0,0,0,0.20)',     card: 'rgba(255,255,255,0.05)' },
  2: { navy: '#1b1d33', section: 'rgba(255,255,255,0.02)', card: 'rgba(255,255,255,0.06)' },
  3: { navy: '#21243d', section: 'rgba(255,255,255,0.03)', card: 'rgba(255,255,255,0.07)' },
  4: { navy: '#282c49', section: 'rgba(255,255,255,0.045)', card: 'rgba(255,255,255,0.085)' },
} as const;

const TEXT = {
  normal: { muted: 'rgba(255,255,255,0.62)', faint: 'rgba(255,255,255,0.45)' },
  high:   { muted: 'rgba(255,255,255,0.80)', faint: 'rgba(255,255,255,0.62)' },
} as const;

const FONT = { sm: '15px', md: '16px', lg: '17.5px' } as const;

/** แปลง ThemeSettings → map ของ CSS custom properties สำหรับเซ็ตที่ :root */
export function themeCssVars(raw: Partial<ThemeSettings> | undefined | null): Record<string, string> {
  const t = normalizeTheme(raw);
  const bg = BG[t.bgLevel];
  const text = TEXT[t.textContrast];
  return {
    '--color-brand-navy': bg.navy,
    '--surface-section': bg.section,
    '--surface-card': bg.card,
    '--text-muted': text.muted,
    '--text-faint': text.faint,
    '--root-font-size': FONT[t.fontScale],
    // นีออนเป็นตัวหนังสือ: high = ใช้สีนีออน, low = ขาว (ปุ่มยังนีออนเสมอ)
    '--accent-text': t.accentLevel === 'low' ? '#ffffff' : '#E6FF00',
    '--accent-bar': t.accentLevel === 'low' ? 'rgba(255,255,255,0.28)' : 'rgba(230,255,0,0.40)',
  };
}
