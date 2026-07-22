import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { subscribeToPolls } from '../services/dataService';
import { Poll } from '../types';
import PollCard from '../components/PollCard';

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    const unsub = subscribeToPolls(setPolls);
    return () => unsub();
  }, []);

  return (
    <main className="pt-32 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">โพลที่ผ่านมา</h1>
          <p className="text-lg text-white/60 leading-relaxed">
            ย้อนดูโพลสอบถามความคิดเห็นทั้งหมดที่พรรคเคยจัดขึ้น — โหวตได้ถ้ายังไม่เคยโหวตในโพลนั้นๆ
          </p>
        </motion.div>

        {polls.length === 0 ? (
          <p className="text-white/30 text-center py-20">ยังไม่มีโพล</p>
        ) : (
          <div className="space-y-10">
            {polls.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                onUpdate={(updated) => setPolls(prev => prev.map(p => (p.id === updated.id ? updated : p)))}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
