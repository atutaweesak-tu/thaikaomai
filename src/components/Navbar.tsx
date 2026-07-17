import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { name: 'หน้าหลัก', path: '/' },
  { name: 'เกี่ยวกับพรรค', path: '/about' },
  { name: 'นโยบาย', path: '/policies' },
  { name: 'ทีมพรรค', path: '/team' },
  { name: 'ข่าวสาร', path: '/news' },
  { name: 'ติดต่อ', path: '/contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-2">
            <img src="/tkm-logo.png" alt="ไทยก้าวใหม่" className="h-12 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-brand-neon",
                  location.pathname === link.path ? "text-brand-neon" : "text-white/70"
                )}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/register"
              className="bg-brand-neon text-brand-navy text-sm font-black px-5 py-2.5 rounded-full hover:bg-brand-accent transition-colors duration-200"
            >
              สมัครสมาชิก
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white p-2"
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-brand-navy border-b border-white/10 px-4 py-6"
        >
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "text-lg font-medium",
                  location.pathname === link.path ? "text-brand-neon" : "text-white/70"
                )}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/register"
              onClick={() => setIsOpen(false)}
              className="bg-brand-neon text-brand-navy text-lg font-black px-6 py-3 rounded-full text-center hover:bg-brand-accent transition-colors duration-200"
            >
              สมัครสมาชิก
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
