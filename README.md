# Mini Shop

Mini Shop คือระบบสั่งอาหาร/สินค้าใน LINE Mini App ที่กำลังย้ายจากระบบ HTML + Google Apps Script + Google Sheets รุ่นเดิม ไปเป็นระบบแบบ modular monolith ที่ใช้ React, Fastify, PostgreSQL และ TypeScript

## สถานะปัจจุบัน

ระบบใหม่อยู่บน branch `feature/import-linemini-app` และมีความสามารถระดับ foundation ถึง Phase 7 ได้แก่ LINE LIFF authentication, product management, cart, order, stock reservation, LINE Pay adapter สำหรับ Sandbox และ Admin Dashboard

> **Development gate:** ก่อนเริ่ม Phase ถัดไป ต้องอ่าน [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md) และ [AGENTS.md](AGENTS.md) ให้เข้าใจก่อน การออกแบบในเอกสารเหล่านี้ถือเป็น source of truth จนกว่าจะมี decision ใหม่ใน [DECISIONS.md](DECISIONS.md)

## โครงสร้าง repository

```text
client/                  React + Vite customer/admin UI
server/                  Fastify + TypeScript API and domain repositories
server/src/db/           PostgreSQL schema, client, and migrations
server/tests/            Vitest API and service tests
shared/                  Cross-package domain constants and types
docs/                    Operational and historical implementation notes
Gs/, *.html, js/, css/   Legacy Google Apps Script/static implementation
```

## เริ่มต้นใช้งาน

```bash
pnpm install
cp .env.example .env
# แก้ DATABASE_URL, SESSION_SECRET และ LINE values ใน .env
pnpm --filter @mini-shop/server db:migrate
pnpm dev
```

Frontend เปิดที่ `http://localhost:5173` และ API เปิดที่ `http://localhost:3000` ตรวจสุขภาพระบบได้ที่ `http://localhost:3000/health` สำหรับ managed PostgreSQL ระยะแรก project เลือกใช้ [Neon Free Plan](https://neon.com/pricing) โดยตั้งค่า connection string ผ่าน `DATABASE_URL` เท่านั้น

## Quality gates

```bash
pnpm test
pnpm check
pnpm build
git diff --check
```

ต้องผ่านทุกคำสั่งก่อน commit หรือเปิด Pull Request

## เอกสารหลัก

| เอกสาร | หน้าที่ |
|---|---|
| [PRD.md](PRD.md) | เป้าหมาย ผู้ใช้ ขอบเขต และ acceptance criteria |
| [AGENTS.md](AGENTS.md) | กติกาสำหรับคนและ agent ที่แก้ repository |
| [ARCHITECTURE.md](ARCHITECTURE.md) | ขอบเขตระบบและแนวทางออกแบบระยะยาว |
| [DATABASE.md](DATABASE.md) | schema, invariants, migration และ transaction rules |
| [API.md](API.md) | API contract, auth, role และ state transitions |
| [DECISIONS.md](DECISIONS.md) | Architecture Decision Records ที่ยืนยันแล้ว |
| [CONTEXT.md](CONTEXT.md) | สถานะปัจจุบันและสิ่งที่ยังไม่ใช้งานจริง |
| [CHANGELOG.md](CHANGELOG.md) | ประวัติการเปลี่ยนแปลงที่ผู้ใช้ควรรู้ |
| [คู่มือตั้งค่าและทดสอบ](docs/user-setup-and-payment-testing.md) | ขั้นตอนสำหรับเจ้าของโปรเจกต์ |

## Legacy system

ไฟล์ระบบเดิมยังคงอยู่เพื่อใช้เป็น reference และวางแผน migration เท่านั้น ห้ามเพิ่ม feature ใหม่ในระบบเดิมโดยไม่บันทึก decision และไม่ควรนำ credentials จากระบบเดิมมาใช้ซ้ำ ระบบใหม่ต้องใช้ environment variables และ PostgreSQL ตามเอกสารหลัก

## การพัฒนา

ทุก feature ใหม่ต้องมี issue ที่อธิบาย problem, scope และ acceptance criteria ก่อนเริ่ม implementation งานที่เปลี่ยน behavior ต้องเริ่มจาก failing test และจบด้วย tests, typecheck, build และ diff check ที่ผ่าน ห้าม merge เข้า `main` โดยไม่มีการ review

## License

ยังไม่ได้กำหนด license สำหรับการเผยแพร่ภายนอก repository
