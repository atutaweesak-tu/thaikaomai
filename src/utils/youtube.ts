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

// ใช้โดเมน youtube-nocookie.com ลดการตั้ง tracking cookie จนกว่าคนดูจะกดเล่นจริง
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
