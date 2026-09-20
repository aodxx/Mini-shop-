# Mini Shop Database Contract

## 1. Database authority

PostgreSQL เป็น source of truth ของ user, product, order, order item และ payment fields ระบบ client และ legacy Google Sheets ห้ามเป็นแหล่งตัดสินราคา stock หรือ payment status

## 2. Current tables

### users

เก็บ LINE identity ที่ผ่าน backend verification แล้ว

```text
id uuid primary key
line_user_id varchar unique
display_name varchar
picture_url varchar nullable
role user_role default customer
created_at timestamptz
updated_at timestamptz
```

### menus

เก็บ product/menu และ inventory counters

```text
id uuid primary key
name varchar
description varchar nullable
price_satang integer
stock_quantity integer default 0
reserved_quantity integer default 0
image_url varchar nullable
category varchar
is_active boolean default true
sort_order integer default 0
created_at timestamptz
updated_at timestamptz
```

Invariant: `stock_quantity >= reserved_quantity >= 0` สำหรับข้อมูลที่ใช้งานจริง และ available stock คำนวณเป็น `stock_quantity - reserved_quantity`

### orders

เก็บ order aggregate และ payment snapshot fields

```text
id uuid primary key
order_number varchar unique
user_id uuid references users(id)
status order_status default pending
payment_status payment_status default unpaid
payment_provider varchar nullable
payment_transaction_id varchar unique nullable
payment_url varchar nullable
paid_at timestamptz nullable
subtotal_satang integer
delivery_fee_satang integer
total_satang integer
customer_note varchar nullable
delivery_address jsonb nullable
created_at timestamptz
updated_at timestamptz
```

### order_items

เก็บ snapshot ณ เวลาสั่งซื้อ ไม่อ่านชื่อหรือราคาใหม่จาก menus เพื่อคำนวณ order เก่า

```text
id uuid primary key
order_id uuid references orders(id) on delete cascade
product_id uuid references menus(id)
product_name varchar
unit_price_satang integer
quantity integer
line_total_satang integer
created_at timestamptz
```

## 3. Enums

```text
user_role: customer | staff | manager | owner
order_status: pending | paid | cooking | ready | completed | cancelled
payment_status: unpaid | pending | paid | failed | refunded
```

การเพิ่ม enum value ต้องมี migration และอัปเดต `API.md`, state transition tests และ UI labels พร้อมกัน

## 4. Transaction rules

การสร้าง order ต้องทำใน transaction เดียว: ตรวจ active products, ตรวจ available stock, เพิ่ม reserved quantity, สร้าง order และสร้าง order items หากขั้นใดล้มเหลวต้อง rollback ทั้งหมด

การยกเลิก `pending` order ต้องลด reserved quantity ตาม order items ใน transaction เดียวกับการเปลี่ยน status เป็น `cancelled` การปรับ stock ใช้ atomic update ที่รับเฉพาะค่าซึ่งทำให้ stock ใหม่ไม่ต่ำกว่า reserved quantity

Payment confirm ใช้เงื่อนไข `payment_transaction_id` และ `payment_status = pending` เพื่อป้องกันการ mark paid ซ้ำ หาก transaction ถูก mark paid แล้ว callback ซ้ำต้องคืนผลเดิมหรือเป็น no-op

## 5. Migration rules

สร้าง migration ด้วย:

```bash
pnpm --filter @mini-shop/server db:generate
```

ตรวจ SQL และ snapshot ด้วยตนเองก่อน apply ใช้:

```bash
pnpm --filter @mini-shop/server db:migrate
```

ห้ามแก้ migration ที่ apply ไปแล้วใน shared environment ให้สร้าง migration ใหม่แทน Migration ที่ทำลายข้อมูลต้องมี backup plan, rollback plan และ issue ที่อธิบายผลกระทบ

## 5.1 Neon initial setup

สำหรับ Neon ที่ยังว่าง ให้ใช้วิธีใดวิธีหนึ่งเท่านั้น:

วิธีที่แนะนำคือใช้ Drizzle migration จาก repository:

```bash
pnpm --filter @mini-shop/server db:migrate
```

หากต้องการใช้ Neon SQL Editor สามารถใช้ SQL ฉบับตรวจสอบได้ที่ [`docs/neon-bootstrap.sql`](docs/neon-bootstrap.sql) ไฟล์นี้เป็น manual equivalent ของ migration ปัจจุบันและเหมาะสำหรับ empty database เท่านั้น ห้ามรัน SQL นี้แล้วรัน `db:migrate` ต่อบน database เดียวกันโดยไม่ reconcile Drizzle migration history เพราะจะเกิดการสร้างตารางซ้ำ

SQL bootstrap เพิ่ม check constraints สำหรับ stock, reserved quantity, price และ order item quantity เพื่อป้องกันข้อมูลผิดรูปแบบตั้งแต่ระดับ database ส่วน owner/admin user ไม่ได้ถูก seed เพราะต้องมาจาก LINE identity ที่ login ผ่าน backend ก่อน

## 6. Required future tables

ก่อน production ควรพิจารณา `order_events` สำหรับ audit trail, `payments` สำหรับแยก payment attempts, `inventory_adjustments` สำหรับผู้แก้ stock/เหตุผล, และ `jobs` หรือ provider queue สำหรับ reservation expiry/reconciliation โดยต้องออกแบบใน ADR ก่อน

## 7. Query safety

ใช้ Drizzle query builder หรือ parameterized query เท่านั้น ทุก list endpoint ต้องมี filter/pagination เมื่อข้อมูลโต ห้าม select ข้อมูลเกินจำเป็นใน admin list และห้ามส่ง provider payload หรือ secret กลับไป client
