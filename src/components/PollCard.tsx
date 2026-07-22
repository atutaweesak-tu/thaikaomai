import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Vote, Check } from 'lucide-react';
import { castPollVote } from '../services/dataService';
import { Poll } from '../types';

const VOTED_KEY_PREFIX = 'tkm_poll_voted_';

// การ์ดโหวต 1 โพล — ใช้ทั้งใน PollWidget.tsx (หน้าแรก โชว์แค่โพลล่าสุด) และ PollsPage.tsx
// (หน้าประวัติโพลทั้งหมด) แยกออกมาเพราะทั้งสองที่ต้องมี state โหวต/ผลลัพธ์อิสระต่อโพลเหมือนกันเป๊ะ
// key?: ไม่ได้ใช้จริงในตัว component — ใส่ไว้เฉยๆ เพราะโปรเจกต์นี้ไม่มี @types/react
// TS เลยไม่รู้ว่า "key" เป็น prop พิเศษที่ JSX อนุญาตเสมอ (ดู PromoBannerBlock.tsx ที่เจอปัญหาเดียวกัน)
export default function PollCard({ poll, onUpdate }: { poll: Poll; onUpdate?: (updated: Poll) => void; key?: string }) {
  const [selectedOption, setSelectedOption] = useState('');
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setVotedOptionId(localStorage.getItem(VOTED_KEY_PREFIX + poll.id));
    setSelectedOption('');
    setError('');
  }, [poll.id]);

  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
  const hasVoted = !!votedOptionId;

  const handleVote = async () => {
    if (!selectedOption) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await castPollVote(poll.id, selectedOption);
      localStorage.setItem(VOTED_KEY_PREFIX + poll.id, selectedOption);
      setVotedOptionId(selectedOption);
      onUpdate?.(updated);
    } catch (err: any) {
      // โหวตซ้ำจาก IP เดิม (localStorage หายไปเอง เช่นเปลี่ยนเบราว์เซอร์/ล้างข้อมูล) — server กันไว้ที่ 409
      // อยู่แล้ว ถือว่าโหวตแล้วเหมือนกัน ไม่ต้องให้ผู้ใช้เห็นเป็น error
      if (err?.message?.includes('โหวตโพลนี้ไปแล้ว')) {
        localStorage.setItem(VOTED_KEY_PREFIX + poll.id, selectedOption);
        setVotedOptionId(selectedOption);
      } else {
        setError(err?.message || 'โหวตไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12"
    >
      <div className="flex items-center gap-2 mb-6 text-brand-neon">
        <Vote size={20} />
        <span className="text-xs font-black uppercase tracking-widest">ร่วมโหวต</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-8">{poll.question}</h2>

      {hasVoted ? (
        <div className="space-y-3">
          {poll.options.map(opt => {
            const pct = totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0;
            const isMine = opt.id === votedOptionId;
            return (
              <div key={opt.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className={`font-bold flex items-center gap-1.5 ${isMine ? 'text-brand-neon' : 'text-white/70'}`}>
                    {isMine && <Check size={14} />} {opt.label}
                  </span>
                  <span className="text-white/50">{pct}%</span>
                </div>
                <div className="bg-white/5 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isMine ? 'bg-brand-neon' : 'bg-white/20'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-white/40 text-xs mt-4">{totalVotes.toLocaleString('th-TH')} โหวตทั้งหมด — ขอบคุณที่ร่วมแสดงความคิดเห็น</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {poll.options.map(opt => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border cursor-pointer transition-all ${
                  selectedOption === opt.id ? 'bg-brand-neon/10 border-brand-neon' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <input
                  type="radio" name={`poll-option-${poll.id}`} value={opt.id}
                  checked={selectedOption === opt.id}
                  onChange={() => setSelectedOption(opt.id)}
                  className="w-4 h-4"
                />
                <span className="font-bold">{opt.label}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleVote} disabled={!selectedOption || submitting} className="neon-button w-full justify-center disabled:opacity-50">
            {submitting ? 'กำลังส่ง...' : 'โหวต'}
          </button>
        </div>
      )}
    </motion.div>
  );
}
