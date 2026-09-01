# node:22-alpine — จำเป็นสำหรับ core module `node:sqlite` (ต้อง >= 22.13) ที่ใช้ใน
# server/verify/ (ThaID KYC broker). Node 22 เป็น LTS, ไม่มีผลต่อโค้ดเดิม
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
