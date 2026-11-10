const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** แปลงลิงก์ YouTube ที่ admin กรอกเอง (watch?v=, youtu.be/, embed/, shorts/, live/) เป็น video id
 *  คืนค่า null ถ้าไม่ใช่ลิงก์ YouTube ที่รู้จัก — กัน URL ใดๆ หลุดเข้าไปเป็น iframe src ตรงๆ (iframe injection) */
export function extractYouTubeId(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

export type YouTubeChannelRef = { kind: 'id' | 'handle' | 'username' | 'custom'; value: string };

/** แยกสิ่งที่ admin วาง (ลิงก์ช่อง / @handle / channel id) — แค่แยกรูปแบบ ยังไม่ยืนยันว่ามีจริง
 *  ต้องส่งต่อให้ channels.list ฝั่ง server แปลงเป็น channel id จริงเสมอ (server/youtubeSync.ts) */
export function parseYouTubeChannelInput(value: string | undefined | null): YouTubeChannelRef | null {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(v)) return { kind: 'id', value: v };
  const handle = /^@([A-Za-z0-9._-]{3,30})$/.exec(v);
  if (handle) return { kind: 'handle', value: handle[1] };
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    const host = url.hostname.replace(/^(www|m)\./, '');
    if (host !== 'youtube.com') return null;
    const [first, second] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (!first) return null;
    if (first.startsWith('@') && /^@[A-Za-z0-9._-]{3,30}$/.test(first)) return { kind: 'handle', value: first.slice(1) };
    if (first === 'channel' && second && /^UC[A-Za-z0-9_-]{22}$/.test(second)) return { kind: 'id', value: second };
    if (first === 'user' && second && /^[A-Za-z0-9]{1,40}$/.test(second)) return { kind: 'username', value: second };
    if (first === 'c' && second) return { kind: 'custom', value: second };
    return null;
  } catch {
    return null;
  }
}

// ใช้โดเมน youtube-nocookie.com ลดการตั้ง tracking cookie จนกว่าคนดูจะกดเล่นจริง
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
