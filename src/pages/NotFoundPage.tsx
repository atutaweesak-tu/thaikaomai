import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center pt-20 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-4"
      >
        <h1 className="text-[12rem] font-black tracking-tighter leading-none text-brand-neon opacity-20 select-none">
          404
        </h1>
        <h2 className="text-4xl md:text-6xl font-black tracking-tighter -mt-8 mb-6">
          ไม่พบหน้าที่ต้องการ
        </h2>
        <p className="text-white/50 text-lg mb-12 max-w-md mx-auto">
          หน้าที่คุณกำลังมองหาอาจถูกย้าย ลบ หรือ URL ไม่ถูกต้อง
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/" className="neon-button text-lg px-8 py-4">
            <Home size={20} /> กลับหน้าหลัก
          </Link>
          <button onClick={() => window.history.back()} className="outline-button text-lg px-8 py-4">
            <ArrowLeft size={20} /> ย้อนกลับ
          </button>
        </div>
      </motion.div>
    </main>
  );
}
