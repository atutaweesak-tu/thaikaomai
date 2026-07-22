import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToPolls } from '../services/dataService';
import { Poll } from '../types';
import PollCard from './PollCard';

// แสดงเฉพาะโพลตัวแรกที่เผยแพร่อยู่ (subscribeToPolls กรอง isPublicNow ให้แล้วฝั่ง server สำหรับ
// ผู้เข้าชมที่ไม่ login) — POST ใหม่ถูก prepend ไว้บนสุดของ collection เสมอ ตัวแรกจึงเป็นโพลล่าสุดที่ publish
// โพลเก่าที่เหลือดูได้ที่หน้า /polls (PollsPage.tsx)
export default function PollWidget() {
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    const unsub = subscribeToPolls(setPolls);
    return () => unsub();
  }, []);

  const poll = polls[0];
  if (!poll) return null;

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <PollCard
          poll={poll}
          onUpdate={(updated) => setPolls(prev => prev.map(p => (p.id === updated.id ? updated : p)))}
        />
        {polls.length > 1 && (
          <div className="text-center mt-6">
            <Link to="/polls" className="text-white/50 hover:text-brand-neon text-sm font-bold transition-colors">
              ดูโพลที่ผ่านมาทั้งหมด →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
