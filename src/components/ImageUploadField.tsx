import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { getApiToken } from '../services/dataService';

async function uploadImageFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 5 MB');
  const headers: Record<string, string> = { 'Content-Type': file.type };
  const token = getApiToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/upload', { method: 'POST', headers, body: file });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'อัพโหลดรูปไม่สำเร็จ');
  }
  const data = await res.json();
  return data.url;
}

interface MediaFile { url: string; size: number; mtime: number }

// ปุ่มอัพโหลดรูป + ปุ่มเลือกจากรูปที่เคยอัพโหลดไว้แล้ว (ดึงจาก GET /api/media ซึ่งอ่านตรงจาก
// public/uploads บน server — ไม่มี tracking collection แยก) รวมเป็น component เดียวใช้แทน JSX
// อัพโหลดรูปที่เคยซ้ำกัน 7 จุดใน AdminPage.tsx
export default function ImageUploadField({
  value, onChange, label = 'รูปภาพ', allowRemove = true,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  allowRemove?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [media, setMedia] = useState<MediaFile[] | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const openPicker = async () => {
    setPickerOpen(true);
    if (media) return; // โหลดครั้งเดียว ไม่ fetch ซ้ำทุกครั้งที่เปิด popup
    setMediaLoading(true);
    setMediaError('');
    try {
      const headers: Record<string, string> = {};
      const token = getApiToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/media', { headers });
      if (!res.ok) throw new Error('โหลดรายการรูปไม่สำเร็จ');
      setMedia(await res.json());
    } catch (err: any) {
      setMediaError(err?.message || 'โหลดรายการรูปไม่สำเร็จ');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      onChange(await uploadImageFile(file));
    } catch (err) {
      alert(String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {value && (
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/20 shrink-0">
          <img src={value} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        <label className={`cursor-pointer border border-white/20 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex items-center gap-2 ${uploading ? 'opacity-50 cursor-wait bg-white/5' : 'bg-white/10 hover:bg-brand-neon hover:text-brand-navy'}`}>
          <Upload size={14} /> {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดรูป'}
          <input
            type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button" onClick={openPicker}
          className="border border-white/20 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex items-center gap-2"
        >
          <ImageIcon size={14} /> เลือกจากรูปที่เคยอัพโหลด
        </button>
        {allowRemove && value && (
          <button
            type="button" onClick={() => onChange('')}
            className="bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm font-bold text-red-400 transition-all"
          >
            ลบรูป
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setPickerOpen(false)}>
          <div className="bg-brand-navy border border-white/10 rounded-3xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black">เลือกรูปที่เคยอัพโหลด</h3>
              <button onClick={() => setPickerOpen(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {mediaLoading ? (
              <p className="text-white/30 text-center py-12">กำลังโหลด...</p>
            ) : mediaError ? (
              <p className="text-red-400 text-center py-12">{mediaError}</p>
            ) : !media || media.length === 0 ? (
              <p className="text-white/30 text-center py-12">ยังไม่มีรูปที่อัพโหลดไว้</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {media.map(m => (
                  <button
                    key={m.url} type="button"
                    onClick={() => { onChange(m.url); setPickerOpen(false); }}
                    className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-brand-neon transition-colors"
                  >
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
