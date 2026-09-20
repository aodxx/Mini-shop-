# Phase 1 Foundation

โครงสร้างใหม่นี้เป็น monorepo สำหรับ Mini Shop รุ่น React และ TypeScript โดยแยกเป็น `client`, `server` และ `shared` packages

## โครงสร้างหลัก

```text
client/                 React 19 + Vite frontend
server/                 Fastify + tRPC + Drizzle backend
server/src/db/          PostgreSQL schema และ database client
server/tests/           Vitest tests
shared/                 constants และ domain types ที่ใช้ร่วมกัน
drizzle/                พื้นที่สำหรับ migration output
```

## เริ่มต้นใช้งาน

ติดตั้ง Node.js และ pnpm จากนั้นติดตั้ง dependencies:

```bash
pnpm install
cp .env.example .env
```

แก้ค่า `DATABASE_URL` และ `SESSION_SECRET` ใน `.env` ให้ตรงกับเครื่องของคุณ ค่า `SESSION_SECRET` ต้องมีความยาวอย่างน้อย 32 ตัวอักษร

รัน frontend และ backend พร้อมกัน:

```bash
pnpm dev
```

Frontend จะเปิดที่ `http://localhost:5173` และ backend จะเปิดที่ `http://localhost:3000` ส่วน health endpoint อยู่ที่ `http://localhost:3000/health`

## คำสั่งตรวจสอบ

```bash
pnpm test
pnpm check
pnpm build
```

การสร้าง migration จาก Drizzle schema ใช้คำสั่ง:

```bash
pnpm --filter @mini-shop/server db:generate
```

migration ที่สร้างแล้วต้องอ่านและตรวจสอบก่อนนำไป apply กับฐานข้อมูลจริง

## สิ่งที่มีใน Foundation

Backend มี health endpoint, tRPC router เริ่มต้น, environment validation และ PostgreSQL schema เบื้องต้นสำหรับ users, menus และ orders ส่วน frontend มี React application shell ที่เรียก health endpoint และแสดงสถานะการเชื่อมต่อ API

ระบบยังไม่รวม LINE authentication, order workflow, payment, notification worker หรือการเชื่อมฐานข้อมูลจริงใน runtime ซึ่งจะเพิ่มใน Phase ถัดไปหลังจากยืนยัน provider และ environment ของ deployment แล้ว
