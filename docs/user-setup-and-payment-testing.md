# คู่มือสิ่งที่เจ้าของโปรเจกต์ต้องทำเอง

เอกสารนี้อธิบายงานที่เจ้าของโปรเจกต์ต้องดำเนินการเองเพื่อทำให้ Mini Shop รุ่นใหม่ทำงานจริง ตั้งแต่เตรียมบัญชีและฐานข้อมูล ไปจนถึงการตั้งค่า LINE LIFF, LINE Pay Sandbox, การทดสอบ payment flow และการเตรียม production

ระบบใหม่อยู่ในโฟลเดอร์ `client/` และ `server/` ส่วนไฟล์ใน `Gs/` เป็นระบบ Google Apps Script รุ่นเดิม จึงไม่ถูกใช้โดย React/Fastify stack ใหม่

> **ข้อควรจำ:** ห้ามส่ง LINE Pay channel secret, LINE Login channel secret, session secret, database password หรือไฟล์ `.env` ให้ผู้อื่น และห้าม commit ค่าเหล่านี้ขึ้น GitHub

## 1. สิ่งที่คุณต้องเตรียม

ก่อนเริ่มติดตั้ง ต้องมีสิ่งต่อไปนี้

1. บัญชี GitHub ที่เข้าถึง repository `aodxx/Mini-shop-`
2. Node.js และ pnpm
3. PostgreSQL หรือบริการ PostgreSQL ที่เข้าถึงได้จาก backend
4. LINE Developers Provider และ LINE Login channel สำหรับ LIFF
5. LINE Pay Merchant/Sandbox credentials สำหรับประเทศไทย
6. URL แบบ HTTPS ที่ LINE Pay เรียกกลับได้ สำหรับ `PAYMENT_CALLBACK_URL`
7. สถานที่ deploy frontend และ backend หากต้องการทดสอบ LINE LIFF และ LINE Pay แบบ end-to-end จากโทรศัพท์จริง

LINE Pay ระบุว่า LINE Pay ในประเทศไทยยังรองรับการใช้งาน และมี Sandbox สำหรับทดสอบ payment flow [1] ส่วน API ที่ระบบใช้คือ Online API v3 สำหรับ request และ confirm payment [2] [3]

## 2. ดาวน์โหลดโค้ดและเลือก branch

Clone repository หากยังไม่มีในเครื่อง

```bash
git clone https://github.com/aodxx/Mini-shop-.git
cd Mini-shop-
```

ตรวจสอบ branch ที่มี Phase 6

```bash
git fetch origin
git checkout feature/import-linemini-app
git pull origin feature/import-linemini-app
```

ตรวจสอบ commit ล่าสุด

```bash
git log --oneline -5
```

ควรเห็น commit ล่าสุดที่เกี่ยวกับ payment เช่น

```text
72bc8de fix: reuse pending payment URL
5f01d24 feat: add payments and stock reservation
```

ถ้าคุณทำงานร่วมกับคนอื่น ให้สร้าง branch ของตัวเองจาก branch นี้ และอย่าแก้ `main` โดยตรง

```bash
git checkout -b chore/configure-sandbox
```

## 3. ติดตั้งเครื่องมือและ dependencies

ตรวจสอบเวอร์ชัน

```bash
node --version
pnpm --version
psql --version
```

ติดตั้ง dependencies ของ monorepo

```bash
pnpm install
```

ตรวจสอบว่า installation สำเร็จ

```bash
pnpm check
pnpm build
```

ถ้าสองคำสั่งนี้ผ่าน แปลว่า client และ server compile ได้ในเครื่องของคุณแล้ว

## 4. สร้าง PostgreSQL database

คุณเลือกใช้ PostgreSQL ในเครื่องหรือ managed PostgreSQL เช่น Supabase, Neon หรือบริการ cloud ที่คุณดูแลเองได้

### 4.1 PostgreSQL ในเครื่อง

สร้าง database และ user ตัวอย่าง

```bash
sudo -u postgres psql
```

ภายใน `psql` ให้รันคำสั่งต่อไปนี้

```sql
CREATE USER mini_shop_user WITH PASSWORD 'เปลี่ยนเป็นรหัสผ่านของคุณ';
CREATE DATABASE mini_shop OWNER mini_shop_user;
\q
```

จากนั้นทดสอบการเชื่อมต่อ

```bash
psql "postgresql://mini_shop_user:เปลี่ยนเป็นรหัสผ่านของคุณ@localhost:5432/mini_shop" -c "SELECT 1;"
```

### 4.2 Managed PostgreSQL

ถ้าใช้ managed PostgreSQL ให้สร้าง project/database ตามคู่มือของผู้ให้บริการ แล้ว copy connection string ที่เป็น PostgreSQL URL มาใช้ใน `DATABASE_URL`

ตรวจสอบว่า connection string มีรูปแบบใกล้เคียงนี้

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

หากผู้ให้บริการบังคับ SSL อาจต้องใช้ query parameter เช่น `?sslmode=require` ตาม connection string ที่ผู้ให้บริการให้มา

## 5. สร้างไฟล์ environment

สร้างไฟล์จาก template

```bash
cp .env.example .env
```

เปิด `.env` แล้วกำหนดค่าพื้นฐานก่อน

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://mini_shop_user:your-password@localhost:5432/mini_shop
SESSION_SECRET=สร้างข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร
CLIENT_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000
VITE_LIFF_ID=ยังไม่ใส่ได้จนกว่าจะสร้าง LIFF app
LINE_CHANNEL_ID=ยังไม่ใส่ได้จนกว่าจะสร้าง LINE Login channel
```

สร้าง session secret ที่ปลอดภัยด้วยคำสั่งนี้ได้

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

นำผลลัพธ์ไปใส่ใน `SESSION_SECRET`

> อย่าใช้ข้อความ `replace-with-at-least-32-random-characters` ในระบบจริง

## 6. สร้าง LINE Login channel และ LIFF app

### 6.1 สร้าง Provider และ channel

1. เปิด [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider หรือเลือก Provider ของร้าน
3. สร้าง **LINE Login channel**
4. จดค่า Channel ID
5. เปิดหน้า LIFF ของ channel
6. สร้าง LIFF app ใหม่
7. เลือก endpoint URL ของ frontend
8. จด LIFF ID

ในระบบนี้ `LINE_CHANNEL_ID` ต้องเป็น Channel ID ของ LINE Login channel ที่ใช้สร้าง LIFF ไม่ใช่ LINE Pay Channel ID

ตั้งค่าใน `.env`

```env
LINE_CHANNEL_ID=LINE_LOGIN_CHANNEL_ID
VITE_LIFF_ID=LIFF_ID
```

### 6.2 ตั้งค่า LIFF endpoint URL

ถ้าทดสอบจากเครื่องเดียวอาจใช้ frontend URL ในเครื่องได้เฉพาะกรณีที่สภาพแวดล้อมนั้นเข้าถึงได้จากอุปกรณ์ที่เปิด LINE ถ้าจะทดสอบผ่านโทรศัพท์จริง ให้ใช้ frontend URL แบบ HTTPS ที่ deploy แล้ว

ค่าที่ตั้งใน LINE Console ต้องตรงกับ URL ที่เปิดจริง รวมถึง protocol และ path

ตัวอย่าง production frontend:

```text
https://shop.example.com
```

ตัวอย่าง local development ที่ใช้ public HTTPS frontend:

```text
https://mini-shop-frontend.example.com
```

## 7. ตั้งค่า LINE Pay Sandbox

### 7.1 สมัครหรือขอใช้ merchant sandbox

1. เปิด [LINE Pay Developers](https://developers-pay.line.me/)
2. สมัครหรือขอ merchant account ตามขั้นตอนของ LINE Pay
3. เลือก environment เป็น Sandbox
4. เตรียม channel credentials สำหรับ LINE Pay
5. เตรียม merchant device profile หากบัญชีของคุณกำหนดให้ใช้
6. เปิดใช้ประเทศไทยและสกุลเงิน THB ตามการตั้งค่าของ merchant

ค่า LINE Pay แยกจาก LINE Login ดังนี้

| ค่า | มาจากระบบใด | ใส่ในตัวแปร |
| --- | --- | --- |
| LINE Login Channel ID | LINE Developers / LINE Login | `LINE_CHANNEL_ID` |
| LIFF ID | LINE Developers / LIFF | `VITE_LIFF_ID` |
| LINE Pay Channel ID | LINE Pay Merchant/Sandbox | `LINE_PAY_CHANNEL_ID` |
| LINE Pay Channel Secret | LINE Pay Merchant/Sandbox | `LINE_PAY_CHANNEL_SECRET` |
| Device Profile ID | LINE Pay Merchant/Sandbox | `LINE_PAY_MERCHANT_DEVICE_PROFILE_ID` |

### 7.2 ใส่ค่า Sandbox ลง `.env`

```env
LINE_PAY_ENV=sandbox
LINE_PAY_CHANNEL_ID=LINE_PAY_SANDBOX_CHANNEL_ID
LINE_PAY_CHANNEL_SECRET=LINE_PAY_SANDBOX_CHANNEL_SECRET
LINE_PAY_MERCHANT_DEVICE_PROFILE_ID=LINE_PAY_DEVICE_PROFILE_ID
```

อย่าใช้ LINE Login Channel ID แทน LINE Pay Channel ID เพราะจะทำให้ signature หรือ merchant authorization ไม่ถูกต้อง

## 8. เตรียม callback URL แบบ public HTTPS

LINE Pay ต้อง redirect กลับมายัง backend หลังผู้ใช้ทำรายการ ระบบใช้ endpoint นี้

```text
GET /api/payments/line/confirm
```

ดังนั้นค่าที่ต้องใส่คือ URL เต็มของ backend

```env
PAYMENT_CALLBACK_URL=https://api.example.com/api/payments/line/confirm
```

URL นี้ต้องเป็น URL ที่ LINE Pay Sandbox เรียกได้จากอินเทอร์เน็ต ห้ามใช้ `localhost` ในการทดสอบกับ LINE Pay โดยตรง

ถ้า backend อยู่ที่:

```text
https://api.example.com
```

ให้ตั้งค่า:

```env
PAYMENT_CALLBACK_URL=https://api.example.com/api/payments/line/confirm
```

และ frontend ต้องตั้งค่าให้เรียก backend ตัวเดียวกัน

```env
CLIENT_ORIGIN=https://shop.example.com
VITE_API_URL=https://api.example.com
```

> Callback URL ต้องใช้ HTTPS ในสภาพแวดล้อมที่ LINE Pay เรียกจากภายนอกได้ และต้องไม่มีการปิดกั้นด้วย firewall หรือ basic authentication

## 9. Apply database migrations

หลังตั้ง `DATABASE_URL` แล้ว รัน migration

```bash
pnpm --filter @mini-shop/server db:migrate
```

ตรวจสอบตารางหลัก

```bash
psql "$DATABASE_URL" -c "\dt"
```

ควรมีตารางอย่างน้อย:

```text
users
menus
orders
order_items
__drizzle_migrations
```

ตรวจสอบคอลัมน์ของสินค้าและ order

```bash
psql "$DATABASE_URL" -c "\d menus"
psql "$DATABASE_URL" -c "\d orders"
```

ต้องเห็นฟิลด์สำคัญ:

```text
menus.stock_quantity
menus.reserved_quantity
orders.payment_status
orders.payment_transaction_id
orders.payment_url
orders.paid_at
```

## 10. สร้างสินค้าและตั้ง stock

ระบบใหม่จะเริ่มสินค้าใหม่ด้วย stock เป็นศูนย์ ถ้ายังไม่เติม stock ลูกค้าจะไม่สามารถสั่งได้

คุณสามารถสร้างสินค้าผ่าน staff UI หรือใช้ SQL ชั่วคราวเพื่อเตรียมข้อมูลทดสอบ

ตรวจสอบสินค้า

```bash
psql "$DATABASE_URL" -c "SELECT id, name, price_satang, is_active, stock_quantity, reserved_quantity FROM menus;"
```

เพิ่ม stock ให้สินค้าที่มีอยู่

```sql
UPDATE menus
SET stock_quantity = 10,
    reserved_quantity = 0,
    is_active = true
WHERE id = 'PRODUCT_UUID';
```

ตรวจจำนวนที่ขายได้จริง

```sql
SELECT
  id,
  name,
  stock_quantity,
  reserved_quantity,
  stock_quantity - reserved_quantity AS available_quantity
FROM menus
WHERE is_active = true;
```

ควรมีค่า:

```text
available_quantity > 0
```

## 11. ตั้ง role ให้ผู้ดูแลร้าน

ผู้ใช้ที่ login ครั้งแรกจะมี role เป็น `customer` โดย default

1. เปิดระบบและ login ด้วยบัญชี LINE ของคุณ
2. ตรวจสอบ LINE user ID ที่ถูกบันทึกใน `users`
3. เปลี่ยน role ของบัญชีทดสอบเป็น `owner` หรือ `manager`

ตรวจสอบผู้ใช้

```bash
psql "$DATABASE_URL" -c "SELECT id, line_user_id, display_name, role FROM users;"
```

เปลี่ยน role โดยใช้ user ID ที่ถูกต้อง

```sql
UPDATE users
SET role = 'owner', updated_at = NOW()
WHERE line_user_id = 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

อย่าใช้ `display_name` เป็นตัวระบุผู้ใช้ เพราะชื่ออาจซ้ำกันได้

## 12. รันระบบในเครื่อง

รัน frontend และ backend พร้อมกัน

```bash
pnpm dev
```

URL เริ่มต้น:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000
Health:   http://localhost:3000/health
```

ตรวจ health endpoint

```bash
curl http://localhost:3000/health
```

ควรได้ JSON ที่มีค่า:

```json
{
  "status": "ok",
  "service": "mini-shop-api"
}
```

ถ้าแก้ `.env` ต้องหยุดแล้วรัน `pnpm dev` ใหม่ เพื่อให้ backend อ่านค่าใหม่

## 13. ตรวจว่า Payment Gateway ถูกเปิดใช้งาน

ถ้า config ครบ ระบบจะสร้าง payment service อัตโนมัติ

ถ้าค่าใดค่าหนึ่งขาด:

```text
LINE_PAY_CHANNEL_ID
LINE_PAY_CHANNEL_SECRET
PAYMENT_CALLBACK_URL
```

endpoint payment จะตอบ:

```text
503 Payment gateway is not configured
```

นี่เป็นพฤติกรรมที่ตั้งใจไว้ เพราะ local development ไม่ควรบังคับให้ทุกคนมี LINE Pay secret

## 14. ทดสอบ Payment Flow แบบละเอียด

### ขั้นที่ 1: Login

1. เปิด frontend
2. Login ด้วย LINE LIFF
3. ตรวจว่าหน้าแสดงชื่อผู้ใช้
4. ตรวจว่ามี session และ user record ใน PostgreSQL

### ขั้นที่ 2: ตรวจสินค้า

1. ตรวจว่าสินค้า active
2. ตรวจว่า `available_quantity` มากกว่า 0
3. ตรวจราคาที่หน้าเว็บตรงกับ database
4. เพิ่มสินค้าเข้าตะกร้า

### ขั้นที่ 3: สร้าง order

1. เปิด cart
2. เพิ่มหรือลดจำนวน
3. กดยืนยันการสั่งซื้อ
4. ตรวจว่ามี order ใหม่ในตาราง `orders`
5. ตรวจว่ามีรายการใน `order_items`
6. ตรวจว่า `reserved_quantity` เพิ่มขึ้น

ตรวจด้วย SQL

```sql
SELECT
  id,
  order_number,
  user_id,
  status,
  payment_status,
  total_satang,
  payment_transaction_id,
  payment_url
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

ตรวจ reservation

```sql
SELECT
  name,
  stock_quantity,
  reserved_quantity,
  stock_quantity - reserved_quantity AS available_quantity
FROM menus;
```

### ขั้นที่ 4: สร้าง payment request

จากหน้า order history ให้กด `ชำระเงิน`

Backend จะเรียก:

```http
POST /api/orders/:orderId/payment
```

LINE Pay request จะส่งข้อมูลไปที่ Sandbox endpoint:

```text
https://sandbox-api-pay.line.me/v3/payments/request
```

ตรวจใน database ว่า order มีค่า:

```text
payment_status = pending
payment_transaction_id ไม่เป็น NULL
payment_url ไม่เป็น NULL
```

### ขั้นที่ 5: จ่ายใน Sandbox

1. ระบบ redirect ไปยัง LINE Pay Sandbox
2. ตรวจ order number และยอดเงิน
3. ตรวจรายการสินค้า
4. ดำเนินการชำระเงินด้วยข้อมูลทดสอบของ Sandbox
5. ยืนยันรายการ

### ขั้นที่ 6: ตรวจ callback

LINE Pay จะเรียก:

```text
GET /api/payments/line/confirm?transactionId=...
```

ระบบจะค้นหา order จาก transaction ID แล้วเรียก confirm API โดยใช้ยอดเงินจาก database

หลังสำเร็จควรได้:

```text
orders.payment_status = paid
orders.status = paid
orders.paid_at มีค่า
```

จากนั้นระบบจะ redirect กลับ frontend ด้วย query:

```text
?payment=success&orderId=...
```

## 15. Test cases ที่ต้องทำให้ครบ

### กรณีสำเร็จ

```text
login
→ เพิ่มสินค้า
→ สร้าง order
→ reservation เพิ่ม
→ สร้าง LINE Pay request
→ จ่ายใน Sandbox
→ callback สำเร็จ
→ payment_status = paid
```

### กรณีไม่มี stock

ตั้งค่าให้สินค้าไม่มีของเหลือ

```sql
UPDATE menus
SET stock_quantity = 1,
    reserved_quantity = 1
WHERE id = 'PRODUCT_UUID';
```

พยายามสั่งเพิ่ม 1 ชิ้น ต้องไม่สร้าง order สำเร็จ

### กรณีสั่งเกิน stock

ถ้ามีของเหลือ 2 ชิ้น ให้สั่ง 3 ชิ้น ต้องได้ error ประมาณนี้:

```text
Insufficient stock for product ...
```

และต้องตรวจว่า `reserved_quantity` ไม่เพิ่มผิดพลาด

### กรณียกเลิก order

1. สร้าง order ที่ยัง `pending`
2. ตรวจ reservation เพิ่มขึ้น
3. กดยกเลิก
4. ตรวจว่า status เป็น `cancelled`
5. ตรวจว่า reservation ลดลง

### กรณีจ่ายซ้ำ

1. จ่าย order ให้สำเร็จ
2. กดปุ่มชำระเงินซ้ำ
3. เรียก callback เดิมซ้ำ
4. ตรวจว่าไม่สร้าง transaction ใหม่และไม่ confirm ซ้ำ

### กรณีเปิดสองหน้าต่าง

1. เปิด browser สองหน้าต่าง
2. ให้ทั้งสองหน้าต่างสั่งสินค้าจำนวนใกล้เคียงกับ stock ที่เหลือ
3. ตรวจว่า stock รวมไม่ติดลบ
4. คำขอที่เกิน stock ต้องถูกปฏิเสธ

### กรณีแก้ราคาใน browser

1. เปิด DevTools
2. แก้ `unitPriceSatang` เป็นค่าต่ำมาก
3. ส่ง order
4. ตรวจยอดใน database

ยอดที่บันทึกต้องใช้ราคาจาก `menus.price_satang` ไม่ใช่ค่าจาก browser

### กรณีไม่มี login

เรียก endpoint เหล่านี้โดยไม่มี cookie:

```text
GET /api/orders
POST /api/orders
POST /api/orders/:id/payment
```

ทุก endpoint ต้องตอบ `401`

## 16. ใช้งาน Admin Dashboard

หลังจาก login ด้วยบัญชีที่มี role `staff`, `manager` หรือ `owner` ระบบจะแสดงส่วน `ADMIN DASHBOARD` ใต้รายการออเดอร์ของลูกค้า หน้านี้เป็นพื้นที่หลังร้านและจะไม่แสดงให้ role `customer`

### ดูและค้นหาออเดอร์

1. ใช้ช่องค้นหาเพื่อค้นหาจากเลขออเดอร์ เช่น `MS-20260920`
2. ใช้ตัวกรองสถานะเพื่อดูเฉพาะ `pending`, `paid`, `cooking`, `ready`, `completed` หรือ `cancelled`
3. ตรวจชื่อสินค้า จำนวน และยอดรวมในแต่ละรายการ
4. ใช้ dropdown ด้านขวาของออเดอร์เพื่อเปลี่ยนสถานะ
5. กด `รีเฟรช` เมื่อต้องการโหลดข้อมูลจาก backend ใหม่

การเปลี่ยนสถานะผ่าน dashboard เรียก API:

```http
PATCH /api/admin/orders/:id/status
```

### ปรับ stock

1. ดูจำนวน `คงเหลือ`, `จองแล้ว` และ `ขายได้`
2. ใส่จำนวนเต็มในช่อง stock โดยใช้ค่าบวกเพื่อเพิ่มและค่าลบเพื่อลด เช่น `10` หรือ `-2`
3. กด `ปรับ`
4. ตรวจจำนวน stock ที่อัปเดตแล้ว

ระบบจะไม่ยอมให้ลด stock จนต่ำกว่า `reserved_quantity` เพื่อไม่ให้กระทบ order ที่ลูกค้าจองไว้แล้ว ถ้าต้องการลด stock ให้ต่ำกว่าจำนวนที่จอง ต้องจัดการ order ที่เกี่ยวข้องก่อน

API ที่ใช้คือ:

```http
POST /api/admin/products/:id/stock
```

### สิทธิ์ของแต่ละ role

| Role | ดู dashboard | เปลี่ยน order status | ปรับ stock |
| --- | --- | --- | --- |
| `customer` | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| `staff` | ได้ | ได้ | ได้ |
| `manager` | ได้ | ได้ | ได้ |
| `owner` | ได้ | ได้ | ได้ |

ถ้า user เป็น `customer` ให้เปลี่ยน role ใน PostgreSQL เฉพาะบัญชีผู้ดูแลที่คุณยืนยันตัวตนแล้วเท่านั้น

## 17. ตรวจสอบ automated tests

ก่อน push code ให้รัน:

```bash
pnpm test
pnpm check
pnpm build
git diff --check
```

ผลที่คาดหวัง:

```text
All tests passed
TypeScript check passed
Production build passed
No whitespace errors
```

## 18. ตรวจปัญหาที่พบบ่อย

### ได้ `Payment gateway is not configured`

ตรวจว่า `.env` มีค่าเหล่านี้ครบ:

```env
LINE_PAY_CHANNEL_ID=...
LINE_PAY_CHANNEL_SECRET=...
PAYMENT_CALLBACK_URL=https://...
```

จากนั้น restart:

```bash
pnpm dev
```

### Callback ไม่เข้า backend

ตรวจตามลำดับนี้

1. URL ใช้ `https://`
2. URL ชี้ไป backend ไม่ใช่ frontend
3. path เป็น `/api/payments/line/confirm`
4. backend เข้าถึงได้จากอินเทอร์เน็ต
5. ไม่มี firewall หรือ login page ขวาง
6. ค่าใน `.env` ตรงกับ URL ที่ deploy จริง
7. restart backend หลังแก้ environment

### ได้ `401 Not authenticated`

สาเหตุที่พบบ่อยคือ session cookie ไม่ถูกส่งไป backend ให้ตรวจว่า:

- frontend ใช้ `VITE_API_URL` ถูกต้อง
- backend เปิด CORS ให้ `CLIENT_ORIGIN` ถูกต้อง
- request ใช้ `credentials: include`
- browser ไม่ได้บล็อก third-party cookie
- login สำเร็จจริงและมี record ใน `users`

### ได้ `User is not persisted`

ให้ login ใหม่หลัง database migration แล้วตรวจ:

```sql
SELECT id, line_user_id, display_name, role
FROM users;
```

ถ้าไม่มี user ให้ตรวจ LINE token verification และ `DATABASE_URL`

### ได้ `Insufficient stock`

ตรวจ:

```sql
SELECT name, stock_quantity, reserved_quantity,
       stock_quantity - reserved_quantity AS available_quantity
FROM menus;
```

ถ้ามี order ค้างจากการทดสอบ ให้ยกเลิก order ผ่านระบบก่อน อย่าแก้ reservation โดยไม่ตรวจ order ที่เกี่ยวข้อง

### LINE Pay แจ้ง signature ไม่ถูกต้อง

ตรวจ:

- Channel ID เป็นของ LINE Pay ไม่ใช่ LINE Login
- Secret มาจาก environment เดียวกับ endpoint
- ใช้ `LINE_PAY_ENV=sandbox` กับ Sandbox credentials
- ไม่มี whitespace ใน secret
- server restart แล้วหลังแก้ `.env`

## 19. งานที่ต้องทำก่อน production

อย่าเปลี่ยน `LINE_PAY_ENV=production` ทันที ให้ทำรายการต่อไปนี้ก่อน

1. ทดสอบ Sandbox happy path สำเร็จ
2. ทดสอบ stock ไม่พอ
3. ทดสอบ callback ซ้ำ
4. ทดสอบ order cancellation
5. ทดสอบ payment failure
6. Deploy backend ด้วย HTTPS
7. ตั้งค่า production callback URL
8. ขอหรือเปิด production merchant credentials
9. แยก production database จาก development database
10. สร้าง backup และแผน rollback
11. เก็บ secrets ใน secret manager หรือ deployment environment
12. ตรวจ CORS ให้รับเฉพาะ frontend domain
13. เปลี่ยน `NODE_ENV=production`
14. ใช้ `SESSION_SECRET` ใหม่สำหรับ production
15. รัน migration บน production database อย่างระมัดระวัง
16. สร้างสินค้าและ stock จริง
17. ตั้ง staff/owner role อย่างน้อยหนึ่งบัญชี
18. ทดสอบ order มูลค่าต่ำมากใน production ตามขั้นตอนอนุมัติของ merchant

## 20. งานที่ยังต้องทำต่อในระบบ

Phase 6 รองรับ payment request, confirm และ stock reservation แล้ว แต่ก่อน production ควรเพิ่มงานเหล่านี้

- reservation expiry เช่น คืน stock เมื่อ pending payment เกินเวลาที่กำหนด
- payment reconciliation สำหรับกรณี callback หาย
- payment failure และ retry ที่ชัดเจน
- refund และ void flow
- admin dashboard สำหรับ payment ที่ค้าง
- audit log สำหรับการเปลี่ยนสถานะ payment
- monitoring และ alerting
- rate limiting สำหรับ payment endpoints
- การตรวจสอบ webhook หรือ callback replay ตามข้อกำหนด merchant

## 21. วิธี push การเปลี่ยนแปลงขึ้น GitHub

ตรวจ branch และ working tree

```bash
git status --short --branch
git branch --show-current
```

สร้าง branch ใหม่สำหรับงานของคุณ

```bash
git checkout -b chore/configure-sandbox
```

ตรวจว่าไม่มี secret หลุด

```bash
git status --short
rg -n -i "channel_secret|password|token|api[_-]?key|BEGIN PRIVATE" --glob '!node_modules/**' --glob '!.env'
```

อย่าใช้คำสั่ง `git add .env`

ตรวจ tests ก่อน commit

```bash
pnpm test
pnpm check
pnpm build
git diff --check
```

commit เฉพาะไฟล์ที่ต้องการ

```bash
git add docs/ .env.example
 git commit -m "docs: add sandbox setup guide"
```

push branch

```bash
git push -u origin chore/configure-sandbox
```

จากนั้นเปิด Pull Request ไปยัง branch ที่ทีมกำหนด โดยไม่ merge เข้า `main` เองหากยังไม่ได้รับอนุมัติ

## 22. Checklist สรุปก่อนบอกว่าใช้งานได้

- [ ] `pnpm install` ผ่าน
- [ ] PostgreSQL เชื่อมต่อได้
- [ ] `pnpm --filter @mini-shop/server db:migrate` ผ่าน
- [ ] มี LIFF ID และ LINE Login Channel ID
- [ ] Login ด้วย LINE สำเร็จ
- [ ] มี user record ใน PostgreSQL
- [ ] มี user ที่ role เป็น `owner` หรือ `manager`
- [ ] มีสินค้า active
- [ ] สินค้ามี stock มากกว่า 0
- [ ] สร้าง order ได้
- [ ] reservation เพิ่มขึ้นหลังสร้าง order
- [ ] ยกเลิก order แล้ว reservation ลดลง
- [ ] มี LINE Pay Sandbox credentials
- [ ] callback URL เป็น public HTTPS
- [ ] สร้าง payment request ได้
- [ ] Sandbox redirect สำเร็จ
- [ ] callback เปลี่ยนสถานะเป็น `paid`
- [ ] callback ซ้ำไม่ทำให้จ่ายซ้ำ
- [ ] `pnpm test` ผ่าน
- [ ] `pnpm check` ผ่าน
- [ ] `pnpm build` ผ่าน
- [ ] ไม่มี `.env` หรือ secret ใน Git

## References

[1]: https://developers.line.biz/en/docs/line-mini-app/develop/payment/ "LINE MINI App: Handling payments"
[2]: https://developers-pay.line.me/online-api-v3/request-payment "LINE Pay Online API v3: Payment request"
[3]: https://developers-pay.line.me/online-api-v3/confirm-payment "LINE Pay Online API v3: Payment confirmation"
[4]: https://developers.line.biz/console/ "LINE Developers Console"
[5]: https://developers-pay.line.me/ "LINE Pay Developers"
