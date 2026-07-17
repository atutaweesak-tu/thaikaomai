import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { readRawEnv } from './env';
import { createApiHandlers } from './api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.resolve(rootDir, 'data');
const distDir = path.resolve(rootDir, 'dist');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

if (!fs.existsSync(distDir)) {
  console.error(`[server] ไม่พบโฟลเดอร์ dist/ ที่ ${distDir} — ต้องรัน "npm run build" ก่อน start production server`);
  process.exit(1);
}

const env = readRawEnv(rootDir);
const handlers = createApiHandlers(env, dataDir);

const app = express();
app.disable('x-powered-by');

// Security headers พื้นฐาน
// img-src เปิดกว้างเป็น https: เพราะรูปข่าว/ทีมงานเป็น URL ที่ admin กรอกเอง อาจเป็นลิงก์นอกไซต์
// style-src มี unsafe-inline เพราะ Framer Motion (motion.div style={{...}}) ตั้งค่า inline style ตอน animate
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

app.use('/api/auth/login', handlers.login);
app.use('/api/auth/logout', handlers.logout);
app.use('/api/settings/stream', handlers.settingsStream);
app.use('/api/settings', handlers.settings);
app.use('/api/upload', handlers.upload);
app.use('/api/data', handlers.data);

app.use(express.static(distDir));
app.use('/uploads', express.static(path.join(rootDir, 'public/uploads')));

// SPA fallback สำหรับ client-side routing (react-router)
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] production server listening on http://0.0.0.0:${port}`);
});
