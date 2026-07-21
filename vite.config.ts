import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { readRawEnv } from './server/env';
import { createApiHandlers } from './server/api';

function localApiPlugin(): Plugin {
  const dataDir = path.resolve(__dirname, 'data');
  // dev mode ไม่ได้ใช้ renderSpaHtml/sitemap (Vite เองเสิร์ฟ index.html ตอน dev ผ่าน pipeline ของมันเอง
  // พร้อม HMR) เลยไม่ได้ผูกเข้า server.middlewares ด้านล่าง — ค่านี้เลยแค่ทำให้ signature ตรงเฉยๆ
  const distDir = path.resolve(__dirname, 'dist');

  return {
    name: 'local-api',
    configureServer(server) {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      const env = readRawEnv(__dirname);
      const handlers = createApiHandlers(env, dataDir, distDir);

      server.middlewares.use('/api/auth/login', handlers.login);
      server.middlewares.use('/api/auth/logout', handlers.logout);
      server.middlewares.use('/api/settings/stream', handlers.settingsStream);
      server.middlewares.use('/api/settings', handlers.settings);
      server.middlewares.use('/api/upload', handlers.upload);
      server.middlewares.use('/api/data', handlers.data);
      server.middlewares.use('/api/analytics', handlers.analytics);
      server.middlewares.use('/api/media', handlers.media);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      host: '0.0.0.0',
      port: 3001,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/data/**'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            motion: ['motion'],
          },
        },
      },
    },
  };
});
