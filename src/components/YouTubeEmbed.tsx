import React from 'react';
import { extractYouTubeId, youtubeEmbedUrl } from '../utils/youtube';

// ไม่ render อะไรเลยถ้า url ไม่ใช่ลิงก์ YouTube ที่ parse video id ได้ — กัน iframe src ที่ไม่ปลอดภัย
export default function YouTubeEmbed({ url, title, className = '' }: { url: string | undefined; title: string; className?: string }) {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return (
    <div className={`aspect-video rounded-2xl overflow-hidden border border-white/10 ${className}`}>
      <iframe
        src={youtubeEmbedUrl(id)}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}
