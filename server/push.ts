import fs from 'fs';
import path from 'path';

interface PushToken {
  id: string;
  token: string;
  platform: 'ios' | 'android';
  createdAt: string;
  lastSeenAt: string;
}

function readPushTokens(dataDir: string): PushToken[] {
  const file = path.join(dataDir, 'pushTokens.json');
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ยิงตรงไปที่ Expo push API แบบ raw fetch แทนการใช้ expo-server-sdk — เพราะจำนวนเครื่องยัง
// น้อย (หลักร้อย-พัน) ไม่คุ้มเพิ่ม dependency ใหม่แค่เพื่อ receipt-checking ที่ยังไม่จำเป็นตอนนี้
async function sendExpoPush(messages: Record<string, unknown>[]): Promise<void> {
  for (const batch of chunk(messages, 100)) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      console.error('[push] send failed', err);
    }
  }
}

// เรียกหลังบันทึกข่าวสำเร็จ เฉพาะตอนข่าวชิ้นนี้ "กลายเป็นเผยแพร่จริง" ในการบันทึกครั้งนี้ (เพิ่งสร้างใหม่
// แบบเผยแพร่เลย หรือแก้จาก draft เป็นเผยแพร่) — fire-and-forget เสมอ ไม่ await จาก caller เพื่อไม่ให้
// การบันทึกข่าวของ admin ช้าลงหรือ fail ตามไปด้วยถ้า Expo push service ล่ม
export function notifyNewsPublished(dataDir: string, item: { id: string; title: string }) {
  const tokens = readPushTokens(dataDir);
  if (tokens.length === 0) return;
  const messages = tokens.map((t) => ({
    to: t.token,
    title: 'ไทยก้าวใหม่',
    body: item.title,
    data: { newsId: item.id },
  }));
  sendExpoPush(messages).catch(() => {});
}
