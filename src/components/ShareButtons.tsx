import React, { useEffect, useState } from 'react';
import { Facebook, Link2, Check, Share2 } from 'lucide-react';

interface Props {
  /** URL ที่จะแชร์ — default = ที่อยู่หน้าปัจจุบัน */
  url?: string;
  /** ข้อความ/หัวข้อ (ใช้กับ LINE / X / native share) */
  title?: string;
  /** ข้อความนำหน้าปุ่ม — ตั้งเป็น '' เพื่อซ่อน */
  label?: string;
  className?: string;
}

// LINE ไม่มีใน lucide — ไอคอนเล็ก inline
function LineIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.55 7.39 8.35 8.03.32.07.77.21.88.49.1.25.06.64.03.9l-.14.86c-.04.25-.2.99.87.54s5.77-3.4 7.87-5.82C21.36 13.53 22 11.9 22 10.13 22 5.64 17.52 2 12 2ZM8.28 12.57H6.3a.53.53 0 0 1-.53-.53V8.08a.53.53 0 0 1 1.06 0v3.43h1.45a.53.53 0 0 1 0 1.06Zm2.07-.53a.53.53 0 0 1-1.06 0V8.08a.53.53 0 0 1 1.06 0v3.96Zm4.65 0a.53.53 0 0 1-.36.5.55.55 0 0 1-.17.03.53.53 0 0 1-.43-.21l-2.03-2.76v2.44a.53.53 0 0 1-1.06 0V8.08a.53.53 0 0 1 .36-.5.53.53 0 0 1 .6.18l2.03 2.77V8.08a.53.53 0 0 1 1.06 0v3.96Zm3.34-2.51a.53.53 0 0 1 0 1.06h-1.45v.92h1.45a.53.53 0 0 1 0 1.06h-1.98a.53.53 0 0 1-.53-.53V8.08a.53.53 0 0 1 .53-.53h1.98a.53.53 0 0 1 0 1.06h-1.45v.92h1.45Z" />
    </svg>
  );
}

function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2.5h3.32l-7.25 8.29L23.5 21.5h-6.68l-5.23-6.84-5.99 6.84H2.28l7.76-8.87L1.5 2.5h6.84l4.73 6.25L18.9 2.5Zm-1.17 17.02h1.84L7.36 4.38H5.39l12.34 15.14Z" />
    </svg>
  );
}

const openShare = (u: string) =>
  window.open(u, '_blank', 'noopener,noreferrer,width=600,height=560');

export default function ShareButtons({ url, title = '', label = 'แชร์:', className = '' }: Props) {
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const enc = encodeURIComponent;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback สำหรับเบราว์เซอร์เก่า / บริบทที่ clipboard API ใช้ไม่ได้
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = () => {
    navigator.share({ title, url: shareUrl }).catch(() => { /* ผู้ใช้ยกเลิก */ });
  };

  const btn =
    'w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 ' +
    'text-white/70 hover:bg-brand-neon hover:text-brand-navy hover:border-brand-neon ' +
    'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon';

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      {label && <span className="text-white/40 text-sm font-bold mr-1">{label}</span>}

      {canNative && (
        <button type="button" onClick={nativeShare} className={btn} aria-label="แชร์" title="แชร์">
          <Share2 size={16} />
        </button>
      )}

      <button
        type="button"
        onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`)}
        className={btn} aria-label="แชร์ไป Facebook" title="Facebook"
      >
        <Facebook size={17} />
      </button>

      <button
        type="button"
        onClick={() => openShare(`https://social-plugins.line.me/lineit/share?url=${enc(shareUrl)}${title ? `&text=${enc(title)}` : ''}`)}
        className={btn} aria-label="แชร์ไป LINE" title="LINE"
      >
        <LineIcon />
      </button>

      <button
        type="button"
        onClick={() => openShare(`https://twitter.com/intent/tweet?url=${enc(shareUrl)}${title ? `&text=${enc(title)}` : ''}`)}
        className={btn} aria-label="แชร์ไป X" title="X (Twitter)"
      >
        <XIcon />
      </button>

      <button
        type="button"
        onClick={copyLink}
        className={`${btn} ${copied ? '!bg-brand-neon !text-brand-navy !border-brand-neon' : ''}`}
        aria-label="คัดลอกลิงก์" title={copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
      >
        {copied ? <Check size={17} /> : <Link2 size={16} />}
      </button>

      {copied && <span className="text-brand-neon text-xs font-bold">คัดลอกลิงก์แล้ว</span>}
    </div>
  );
}
