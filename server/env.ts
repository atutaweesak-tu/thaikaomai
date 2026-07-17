import fs from 'fs';
import path from 'path';

/**
 * อ่าน .env / .env.local โดยตรง (ไม่ผ่าน dotenv-expand) เพื่อป้องกัน
 * อักขระ $ ใน password ถูก expand โดยไม่ตั้งใจ ใช้ร่วมกันทั้ง dev (vite.config.ts)
 * และ production (server/index.ts) เพื่อไม่ให้ logic สองฝั่งเพี้ยนไปจากกัน
 */
export function readRawEnv(rootDir: string = process.cwd()): Record<string, string> {
  const result: Record<string, string> = {};
  const files = ['.env', '.env.local'].map(f => path.resolve(rootDir, f));
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}
