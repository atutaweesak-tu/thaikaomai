#!/usr/bin/env node
// ใช้สร้าง bcrypt hash สำหรับใส่ใน .env เป็น ADMIN_n_PASSWORD_HASH
// วิธีใช้: node scripts/hashPassword.mjs "รหัสผ่านใหม่"
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('วิธีใช้: node scripts/hashPassword.mjs "รหัสผ่านของคุณ"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
