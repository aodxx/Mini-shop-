# Mini Shop

ระบบสั่งอาหารและสินค้าใน LINE Mini App ที่กำลังย้ายจากระบบเดิมซึ่งใช้ HTML, Google Apps Script และ Google Sheets ไปเป็นระบบ TypeScript แบบ modular monolith ที่ดูแลได้ง่ายขึ้น ปลอดภัยขึ้น และพร้อมต่อยอดสำหรับ production

ระบบปัจจุบันประกอบด้วย React/Vite frontend, Fastify/TypeScript backend, Drizzle ORM, PostgreSQL และ LINE LIFF Authentication โดยใช้ Neon เป็น managed PostgreSQL provider สำหรับ development และ staging ระยะแรก

> **สถานะ:** ระบบอยู่ในช่วง foundation ถึง Phase 7 มี authentication, product management, cart, order, stock reservation, LINE Pay Sandbox adapter, Admin Dashboard และหน้า Neon Database Test แล้ว แต่ยังไม่ถือว่า production-ready

## สารบัญ

- [ความสามารถปัจจุบัน](#ความสามารถปัจจุบัน)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [ข้อกำหนดเบื้องต้น](#ข้อกำหนดเบื้องต้น)
- [เริ่มต้นใช้งานแบบเร็ว](#เริ่มต้นใช้งานแบบเร็ว)
- [ตั้งค่า Neon](#ตั้งค่า-neon)
- [ตั้งค่า Environment Variables](#ตั้งค่า-environment-variables)
- [ตั้งค่า LINE LIFF](#ตั้งค่า-line-liff)
- [ตั้งค่า LINE Pay Sandbox](#ตั้งค่า-line-pay-sandbox)
- [คำสั่งสำหรับพัฒนา](#คำสั่งสำหรับพัฒนา)
- [การใช้งาน Admin Dashboard](#การใช้งาน-admin-dashboard)
- [API สำคัญ](#api-สำคัญ)
- [การทดสอบและ Quality Gates](#การทดสอบและ-quality-gates)
- [โครงสร้าง Repository](#โครงสร้าง-repository)
- [ความปลอดภัย](#ความปลอดภัย)
- [ข้อจำกัดก่อนใช้งานจริง](#ข้อจำกัดก่อนใช้งานจริง)
- [เอกสารอ้างอิงใน Repository](#เอกสารอ้างอิงใน-repository)
- [License](#license)

## ความสามารถปัจจุบัน

| พื้นที่ | ความสามารถ | สถานะ |
|---|---|---|
| Authentication | LINE LIFF ID token verification และ HttpOnly session cookie | พร้อมทดสอบ |
| Catalog | แสดงสินค้า active และ CRUD สำหรับ staff/manager/owner | พร้อมทดสอบ |
| Cart | ตะกร้าฝั่ง browser พร้อม persistence ใน `localStorage` | พร้อมใช้งาน |
| Orders | สร้าง ดู และยกเลิกออเดอร์ของผู้ใช้ | พร้อมทดสอบ |
| Stock | จอง stock แบบ transaction และ atomic adjustment | พร้อมทดสอบ |
| Payments | LINE Pay request/confirm adapter สำหรับ Sandbox | ต้องใช้ credentials จริง |
| Admin | ดูออเดอร์ เปลี่ยนสถานะ ปรับ stock และทดสอบ Neon | พร้อมทดสอบ |
| Database | PostgreSQL schema และ migration ผ่าน Drizzle | พร้อมใช้กับ Neon |

## สถาปัตยกรรม

```text
LINE LIFF / Browser
        |
        v
React + Vite client :5173
        |
        | HttpOnly session cookie + JSON API
        v
Fastify + TypeScript server :3000
        |
        +--> Drizzle ORM --> Neon PostgreSQL
        |
        +--> LINE Login token verification
        |
        +--> LINE Pay Sandbox adapter
```

ระบบเป็น modular monolith ในระยะปัจจุบัน แยก client, server และ shared package แต่ยัง deploy และดูแลเป็น application เดียวได้ง่าย ไม่จำเป็นต้องติดตั้ง PostgreSQL ในเครื่องหากใช้ Neon

## ข้อกำหนดเบื้องต้น

- Node.js 22 หรือรุ่น LTS ที่รองรับ TypeScript project นี้
- pnpm 10.x
- บัญชี Neon สำหรับ managed PostgreSQL
- LINE Developers channel และ LIFF app หากต้องการทดสอบ login
- LINE Pay Sandbox credentials หากต้องการทดสอบ payment
- Git สำหรับ checkout repository

> หากอุปกรณ์มีพื้นที่หรือทรัพยากรจำกัด ให้ใช้ Neon แทนการติดตั้ง PostgreSQL ในเครื่อง และใช้ Codespaces, CI runner หรือ development environment บน cloud สำหรับติดตั้ง dependencies และรันคำสั่ง build/test

## เริ่มต้นใช้งานแบบเร็ว

Clone repository และติดตั้ง dependencies:

```bash
git clone https://github.com/aodxx/Mini-shop-.git
cd Mini-shop-
pnpm install
```

สร้าง environment file:

```bash
cp .env.example .env
```

แก้ค่าอย่างน้อย:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=ใส่ค่าสุ่มที่ยาวอย่างน้อย 32 ตัวอักษร
CLIENT_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

สร้างตารางด้วย Drizzle migration:

```bash
pnpm --filter @mini-shop/server db:migrate
```

รัน frontend และ backend พร้อมกัน:

```bash
pnpm dev
```

เปิดใช้งาน:

| บริการ | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health check | http://localhost:3000/health |
| API | http://localhost:3000 |

ตรวจ health endpoint:

```bash
curl http://localhost:3000/health
```

ควรได้ response ลักษณะนี้:

```json
{
  "status": "ok",
  "service": "mini-shop-api",
  "timestamp": "2026-09-20T00:00:00.000Z"
}
```

## ตั้งค่า Neon

Neon เป็น PostgreSQL แบบ managed จึงไม่ต้องติดตั้ง database server ในเครื่อง

### วิธีที่แนะนำ: ใช้ Drizzle migration

1. สร้าง project ใหม่ใน [Neon Console](https://console.neon.tech/)
2. เลือก Free Plan และ region ที่ใกล้ผู้ใช้งาน
3. เปิดเมนู **Connect**
4. คัดลอก connection string ของ branch ที่ต้องการใช้
5. ใส่ connection string ใน `.env` ที่ `DATABASE_URL`
6. รัน migration:

```bash
pnpm --filter @mini-shop/server db:migrate
```

สำหรับ runtime ให้ใช้ connection string แบบ pooled หาก Neon แสดงตัวเลือกนี้ ส่วน migration ควรใช้ connection ที่ provider แนะนำสำหรับ migration โดยเฉพาะ

### วิธีสำรอง: ใช้ Neon SQL Editor

หากต้องการสร้าง schema ผ่าน SQL Editor ให้ใช้ไฟล์:

[docs/neon-bootstrap.sql](docs/neon-bootstrap.sql)

เลือกใช้วิธีใดวิธีหนึ่งเท่านั้น ห้ามรัน `docs/neon-bootstrap.sql` แล้วรัน Drizzle migrations ซ้ำบน database เดียวกันโดยไม่ reconcile migration history

ตรวจสอบตารางหลัง migration:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

ควรมีตารางหลัก:

```text
menus
order_items
orders
users
```

## ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env` แล้วกำหนดค่าตามตารางนี้

| ตัวแปร | จำเป็น | ใช้สำหรับ |
|---|---:|---|
| `NODE_ENV` | ใช่ | environment ของ server |
| `PORT` | ใช่ | port ของ backend ปกติคือ `3000` |
| `DATABASE_URL` | ใช่ | Neon PostgreSQL connection string |
| `SESSION_SECRET` | ใช่ | signing session ต้องยาวอย่างน้อย 32 ตัวอักษร |
| `CLIENT_ORIGIN` | ใช่ | origin ของ React frontend |
| `VITE_API_URL` | ใช่ | API origin ที่ frontend เรียก |
| `VITE_LIFF_ID` | สำหรับ LINE | LIFF ID จาก LINE Developers |
| `LINE_CHANNEL_ID` | สำหรับ LINE | LINE Login channel ID สำหรับ verify token |
| `LINE_PAY_ENV` | สำหรับ payment | ใช้ `sandbox` ระหว่างพัฒนา |
| `LINE_PAY_CHANNEL_ID` | สำหรับ payment | LINE Pay channel ID |
| `LINE_PAY_CHANNEL_SECRET` | สำหรับ payment | LINE Pay secret ห้ามเผยแพร่ |
| `LINE_PAY_MERCHANT_DEVICE_PROFILE_ID` | optional | merchant device profile ถ้า provider กำหนด |
| `PAYMENT_CALLBACK_URL` | สำหรับ payment | public HTTPS callback สำหรับ LINE Pay |

ตัวอย่าง local ที่ไม่เปิด payment:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters
CLIENT_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

ไม่ commit `.env` หรือ secret ใด ๆ ลง GitHub

## ตั้งค่า LINE LIFF

1. สร้างหรือเลือก LINE Login channel ใน [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง LIFF app ภายใต้ channel เดียวกัน
3. ตั้ง endpoint URL ให้ชี้ไปที่ frontend ที่ deploy แล้ว หรือใช้ URL สำหรับ development ที่เข้าถึงได้
4. ใส่ LIFF ID ใน `VITE_LIFF_ID`
5. ใส่ channel ID เดียวกันใน `LINE_CHANNEL_ID`
6. ตรวจว่า callback/origin และ URL ที่ใช้ทดสอบตรงกับการตั้งค่าใน LINE Console
7. รัน frontend ใหม่หลังแก้ `VITE_*` เพราะ Vite ฝังค่าลงใน build

Authentication flow คือ:

```text
LIFF login
  -> client obtains LINE ID token
  -> server verifies token with LINE
  -> server upserts user in PostgreSQL
  -> server issues HttpOnly session cookie
```

Backend ไม่ควรเชื่อชื่อหรือ profile ที่ client ส่งมาเอง ต้องใช้ claims จาก token ที่ตรวจสอบแล้วเท่านั้น

## ตั้งค่า LINE Pay Sandbox

LINE Pay เป็น optional integration หากยังไม่มี credentials สามารถใช้ระบบ catalog, cart, order และ Admin Dashboard ได้โดยไม่เปิด payment

กำหนดค่า:

```env
LINE_PAY_ENV=sandbox
LINE_PAY_CHANNEL_ID=your-line-pay-channel-id
LINE_PAY_CHANNEL_SECRET=your-line-pay-channel-secret
PAYMENT_CALLBACK_URL=https://your-public-api.example.com/api/payments/line/confirm
```

เงื่อนไขสำคัญ:

- callback ต้องเป็น public HTTPS URL ที่ LINE Pay เรียกได้
- ใช้ credentials ของ Sandbox ระหว่างพัฒนา
- ห้ามใส่ channel secret ใน frontend หรือ repository
- payment request และ confirm ต้องทดสอบซ้ำเพื่อยืนยัน idempotency
- อ่าน [LINE Pay request documentation](https://developers-pay.line.me/online-api-v3/request-payment) และ [confirm documentation](https://developers-pay.line.me/online-api-v3/confirm-payment) ก่อนเปิดใช้จริง

คู่มือทดสอบแบบละเอียดอยู่ที่ [docs/user-setup-and-payment-testing.md](docs/user-setup-and-payment-testing.md)

## คำสั่งสำหรับพัฒนา

ติดตั้ง dependencies:

```bash
pnpm install
```

รัน client และ server พร้อมกัน:

```bash
pnpm dev
```

รันเฉพาะ client:

```bash
pnpm --filter @mini-shop/client dev
```

รันเฉพาะ server:

```bash
pnpm --filter @mini-shop/server dev
```

สร้าง migration จาก schema:

```bash
pnpm --filter @mini-shop/server db:generate
```

ตรวจ migration ที่สร้างก่อน apply แล้วรัน:

```bash
pnpm --filter @mini-shop/server db:migrate
```

จัด format:

```bash
pnpm format
```

## การใช้งาน Admin Dashboard

Admin Dashboard แสดงให้ผู้ใช้ที่มี role เหล่านี้เท่านั้น:

```text
staff
manager
owner
```

สิ่งที่ทำได้:

- ดูรายการออเดอร์ทั้งหมด
- ค้นหาออเดอร์ด้วย order number
- กรองตามสถานะ
- เปลี่ยน fulfillment status
- เพิ่มหรือลด stock
- ตรวจสอบการเชื่อมต่อ Neon
- แสดง user summary สูงสุด 50 รายการโดยไม่ส่ง `lineUserId` ไปยัง browser

API ตรวจ Neon:

```http
GET /api/admin/database
```

หาก user login ครั้งแรกยังเป็น `customer` ให้ promote ผ่าน database หลังยืนยันตัวตนแล้วเท่านั้น:

```sql
UPDATE users
SET role = 'owner',
    updated_at = NOW()
WHERE line_user_id = 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

ตรวจสอบ role:

```sql
SELECT id, display_name, role, created_at
FROM users
ORDER BY created_at DESC;
```

อย่า seed หรือเดา `line_user_id` ของผู้ใช้จากข้อมูลภายนอก ระบบควรใช้ identity ที่ได้จาก LINE login จริง

## API สำคัญ

### Authentication

| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/auth/line` | ตรวจ LINE ID token และสร้าง session |
| `GET` | `/api/auth/me` | อ่าน current session user |
| `POST` | `/api/auth/logout` | ล้าง session |

### Catalog และ stock

| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/api/products` | แสดง active products |
| `POST` | `/api/products` | สร้างสินค้าโดย staff/admin |
| `PATCH` | `/api/products/:id` | แก้ไขสินค้าโดย staff/admin |
| `DELETE` | `/api/products/:id` | soft delete สินค้า |
| `POST` | `/api/admin/products/:id/stock` | ปรับ stock แบบ atomic |

### Orders และ payments

| Method | Path | หน้าที่ |
|---|---|---|
| `POST` | `/api/orders` | สร้างออเดอร์และ reserve stock |
| `GET` | `/api/orders` | ดูออเดอร์ของผู้ใช้ปัจจุบัน |
| `POST` | `/api/orders/:id/cancel` | ยกเลิก pending order |
| `POST` | `/api/orders/:id/payment` | สร้างหรือ reuse payment request |
| `GET` | `/api/payments/line/confirm` | รับ LINE Pay callback |

### Admin

| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `/api/admin/database` | ตรวจ Neon และอ่าน safe user summary |
| `GET` | `/api/admin/orders` | ดูและค้นหาออเดอร์ทั้งหมด |
| `PATCH` | `/api/admin/orders/:id/status` | เปลี่ยนสถานะ fulfillment |

รายละเอียด payload และ response อยู่ใน [API.md](API.md)

## การทดสอบและ Quality Gates

รัน test ทั้งหมด:

```bash
pnpm test
```

รัน test แบบ watch:

```bash
pnpm test:watch
```

ตรวจ TypeScript:

```bash
pnpm check
```

สร้าง production build:

```bash
pnpm build
```

ตรวจ whitespace และ patch errors:

```bash
git diff --check
```

ก่อน commit หรือเปิด Pull Request ต้องผ่านทั้งหมด:

```bash
pnpm test && pnpm check && pnpm build && git diff --check
```

## โครงสร้าง Repository

```text
client/
  src/                    React UI, auth, catalog, cart, orders และ admin client
server/
  src/app.ts              Fastify routes และ application wiring
  src/auth.ts             LINE token verification และ session service
  src/db/                 Drizzle schema, client และ migration runner
  src/users/              User repository
  src/products/           Product repository
  src/orders/             Order repository และ service
  src/payments/           LINE Pay gateway และ payment service
  tests/                  Vitest tests
shared/                   Domain constants/types ที่ใช้ร่วมกัน
server/drizzle/migrations/ Drizzle migrations
 docs/                    คู่มือ operational และ SQL bootstrap
PRD.md                    Product Requirements Document
AGENTS.md                 กติกาสำหรับ developer และ coding agent
ARCHITECTURE.md           System architecture contract
DATABASE.md               Database contract และ migration rules
API.md                    API contract
DECISIONS.md              Architecture Decision Records
CONTEXT.md                สถานะจริงของโครงการและ production gaps
CHANGELOG.md              ประวัติการเปลี่ยนแปลง
```

ระบบเดิมอยู่ใน `Gs/`, `*.html`, `js/` และ `css/` ใช้เป็น reference สำหรับ migration เท่านั้น ไม่ควรเพิ่ม feature ใหม่หรือ reuse credentials จากระบบเดิมโดยไม่มี decision ที่บันทึกไว้

## ความปลอดภัย

- ใช้ HttpOnly session cookie สำหรับ session
- ตรวจ LINE ID token ฝั่ง backend
- ไม่รับ client price เป็น source of truth ตอนสร้าง order
- คำนวณราคาและ reserve stock จากข้อมูลใน PostgreSQL
- จำกัด Admin API ด้วย role guard ฝั่ง backend
- จำกัด user diagnostics ให้คืนเฉพาะข้อมูลที่จำเป็น
- เก็บ secret ใน environment/secret manager ไม่ใช่ source code
- ใช้ HTTPS สำหรับ public deployment และ payment callback
- หลีกเลี่ยงการ log token, cookie, channel secret หรือ connection string

## ข้อจำกัดก่อนใช้งานจริง

โครงการยังต้องทำงานต่อไปนี้ก่อน production:

- reservation expiry worker สำหรับ pending orders ที่ค้างนาน
- payment reconciliation เมื่อ callback หรือ redirect หาย
- refund/void flow
- explicit order state machine และ transition audit log
- payment attempts table แยกจาก orders
- staff authentication/MFA และ granular permissions
- pagination สำหรับ admin endpoints
- structured logs, metrics, tracing และ alerting
- production deployment และ secret manager
- backup/restore และ rollback runbook
- ตั้งค่า LINE Pay Sandbox credentials และ public HTTPS callback จริง

อย่าใช้ repository นี้เป็นระบบ production โดยถือว่า quality gates เพียงอย่างเดียวเพียงพอ ต้องทบทวนรายการ production gaps ใน [CONTEXT.md](CONTEXT.md) ก่อน deploy

## เอกสารอ้างอิงใน Repository

| เอกสาร | หน้าที่ |
|---|---|
| [PRD.md](PRD.md) | ขอบเขตผลิตภัณฑ์ ผู้ใช้ และ acceptance criteria |
| [AGENTS.md](AGENTS.md) | กติกาสำหรับ developer และ coding agent |
| [ARCHITECTURE.md](ARCHITECTURE.md) | ขอบเขต module และแนวทางออกแบบ |
| [DATABASE.md](DATABASE.md) | schema, invariants, transaction และ migration |
| [API.md](API.md) | endpoint, payload, auth และ state contract |
| [DECISIONS.md](DECISIONS.md) | decisions ที่มีผลข้ามระบบ |
| [CONTEXT.md](CONTEXT.md) | สถานะ implementation และ gap ที่เหลือ |
| [CHANGELOG.md](CHANGELOG.md) | ประวัติการเปลี่ยนแปลง |
| [docs/neon-bootstrap.sql](docs/neon-bootstrap.sql) | SQL สำหรับสร้าง schema ใน Neon database ว่าง |
| [docs/foundation.md](docs/foundation.md) | คู่มือ foundation และ migration เดิม |
| [docs/user-setup-and-payment-testing.md](docs/user-setup-and-payment-testing.md) | คู่มือ setup และทดสอบ payment แบบละเอียด |

## License

ยังไม่ได้กำหนด license สำหรับการเผยแพร่ภายนอก repository การนำไปใช้งานภายนอกควรได้รับอนุญาตจากเจ้าของ repository ก่อน
