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

แก้ค่า `DATABASE_URL` และ `SESSION_SECRET` ใน `.env` ให้ตรงกับเครื่องของคุณ ค่า `SESSION_SECRET` ต้องมีความยาวอย่างน้อย 32 ตัวอักษร สำหรับ Phase 2 ให้ตั้งค่า `VITE_LIFF_ID` เป็น LIFF ID จาก LINE Developers Console และตั้งค่า `LINE_CHANNEL_ID` เป็น Channel ID เดียวกับ LIFF app

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

เมื่อตั้งค่า PostgreSQL แล้ว ให้ apply migration ด้วยคำสั่ง:

```bash
pnpm --filter @mini-shop/server db:migrate
```

Phase 3 เชื่อม `UserRepository` เข้ากับตาราง `users` ด้วย Drizzle โดยการ login ผ่าน LINE จะ upsert `line_user_id`, ชื่อ และรูปโปรไฟล์ที่ได้จาก token ที่ LINE ตรวจสอบแล้วก่อนสร้าง session

Phase 4 เพิ่ม `ProductRepository` สำหรับตาราง `menus` และ product management API ได้แก่ `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id` และ `DELETE /api/products/:id` การอ่านสินค้าที่ active เปิดให้ผู้ใช้ทั่วไป ส่วนการสร้าง แก้ไข ปิดขาย และดูสินค้าที่ inactive ต้องเป็น role `staff`, `manager` หรือ `owner` การลบสินค้าเป็น soft delete โดยเปลี่ยน `is_active` เป็น `false` และมี indexes สำหรับ active/sort order กับ category

Phase 5 เพิ่ม `order_items` และ order workflow โดยมี `POST /api/orders`, `GET /api/orders` และ `POST /api/orders/:id/cancel` ผู้ใช้ที่ login แล้วเท่านั้นจึงสร้างหรืออ่านออเดอร์ของตัวเองได้ server จะอ่านราคาและสถานะสินค้าใหม่จาก PostgreSQL ทุกครั้ง จึงไม่เชื่อราคาใน cart ของ browser และจะบันทึก order กับ item ใน transaction เดียวกัน Cart ฝั่ง React persist ใน `localStorage` เพื่อให้ผู้ใช้กลับมาใช้งานต่อได้

Phase 6 เพิ่ม stock reservation และ payment lifecycle โดยสินค้าใหม่มี `stock_quantity` กับ `reserved_quantity` การ checkout จะ reserve stock แบบ atomic ภายใน transaction และการยกเลิกออเดอร์ที่ยัง `pending` จะคืน reservation ป้องกัน overselling เมื่อมี checkout พร้อมกันหลายคำขอ เพิ่ม `POST /api/orders/:id/payment` สำหรับสร้าง LINE Pay request และ `GET /api/payments/line/confirm` สำหรับ confirm callback โดย payment service ทำให้ request/confirm ซ้ำได้อย่างปลอดภัย

การเปิด LINE Pay ต้องตั้งค่า `LINE_PAY_CHANNEL_ID`, `LINE_PAY_CHANNEL_SECRET`, `PAYMENT_CALLBACK_URL` และใช้ `LINE_PAY_ENV=sandbox` ระหว่างพัฒนา ระบบใช้ HMAC-SHA256 ตาม LINE Pay Online API v3 และไม่ควรใส่ secret ลง Git สามารถทดสอบกับ LINE Pay sandbox ก่อนเปลี่ยนเป็น production

อ้างอิง: [LINE Pay Payment Request](https://developers-pay.line.me/online-api-v3/request-payment), [LINE Pay Payment Confirmation](https://developers-pay.line.me/online-api-v3/confirm-payment) และ [LINE MINI App payment availability](https://developers.line.biz/en/docs/line-mini-app/develop/payment/)

Phase 7 เพิ่ม Admin Dashboard สำหรับ role `staff`, `manager` และ `owner` โดยมี `GET /api/admin/orders` สำหรับดูและค้นหาออเดอร์ `PATCH /api/admin/orders/:id/status` สำหรับเปลี่ยนสถานะ และ `POST /api/admin/products/:id/stock` สำหรับเพิ่มหรือลด stock ระบบตรวจสิทธิ์จาก signed session ก่อนทุก route และปรับ stock แบบ atomic โดยไม่อนุญาตให้ stock ต่ำกว่า `reserved_quantity` การยกเลิกออเดอร์ที่ `pending` ผ่าน dashboard จะคืน stock reservation ให้ด้วย

## สิ่งที่มีใน Foundation

Backend มี health endpoint, tRPC router เริ่มต้น, environment validation, LINE ID token verification และ PostgreSQL schema เบื้องต้นสำหรับ users, menus และ orders ส่วน frontend มี React application shell ที่เรียก health endpoint และแสดงสถานะการเชื่อมต่อ API รวมถึงปุ่ม login ด้วย LINE

ระบบ authentication มี `POST /api/auth/line`, `GET /api/auth/me` และ `POST /api/auth/logout` โดย backend ตรวจ ID token ผ่าน LINE ก่อนออก HttpOnly session cookie และไม่รับข้อมูล profile ที่ frontend ส่งมาเอง

ระบบยังไม่รวม order workflow, payment, notification worker หรือการบันทึก user ลงฐานข้อมูลจริงใน runtime ซึ่งจะเพิ่มใน Phase ถัดไปหลังจากยืนยัน provider และ environment ของ deployment แล้ว
