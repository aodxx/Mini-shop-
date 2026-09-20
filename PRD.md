# Mini Shop Product Requirements Document

## 1. Product summary

Mini Shop เป็นระบบสั่งอาหารหรือสินค้าแบบ mobile-first ที่เปิดจาก LINE Mini App ลูกค้าต้องเห็นเมนูที่ขายอยู่ เลือกสินค้า ใส่ตะกร้า สร้างออเดอร์ ชำระเงิน และติดตามสถานะได้ พนักงานต้องจัดการเมนู stock และสถานะออเดอร์จากหลังร้านได้โดยไม่ใช้ shared admin key

ระบบอยู่ระหว่าง migration จากระบบเดิมที่ใช้ static web, Google Apps Script และ Google Sheets ไปสู่ระบบใหม่ที่มี PostgreSQL เป็น source of truth สำหรับข้อมูลธุรกิจ

## 2. Goals

1. ให้ลูกค้าสั่งซื้อผ่าน LINE identity ได้อย่างปลอดภัย
2. ให้ server เป็นผู้คำนวณราคาและตรวจ stock ทุกครั้ง
3. ป้องกัน overselling ด้วย transaction และ stock reservation
4. แยก payment state ออกจาก fulfillment state
5. ให้ staff จัดการออเดอร์และ stock ได้จาก dashboard เดียว
6. ทำให้ payment provider เปลี่ยนได้ผ่าน adapter interface
7. ให้ทุก business rule มี automated tests และเอกสารสัญญาที่ตรวจสอบได้

## 3. Non-goals ระยะนี้

ระบบยังไม่ทำ multi-branch inventory, delivery dispatch, loyalty points, coupon engine, subscription, accounting integration หรือ native mobile app การรองรับ payment provider อื่นต้องทำผ่าน issue และ adapter contract ใหม่ ไม่แก้ business logic ให้ผูกกับ provider โดยตรง

## 4. Personas

### Customer

ลูกค้าที่เปิด Mini App ผ่าน LINE ต้อง login ด้วย LIFF และสร้างออเดอร์ของตนเองได้ ลูกค้าต้องไม่เห็นออเดอร์ของคนอื่นหรือข้อมูลหลังร้าน

### Staff

พนักงานหน้าร้านหรือครัวที่ดูออเดอร์ เปลี่ยนสถานะการทำอาหาร และปรับ stock ได้ตามสิทธิ์ที่กำหนด

### Manager

ผู้จัดการที่ทำงานของ staff ได้ทั้งหมด และดูแลเมนู/operation ของร้าน

### Owner

เจ้าของร้านที่มีสิทธิ์สูงสุดในระบบปัจจุบัน แต่การจัดการ role และการตั้งค่าความปลอดภัยต้องทำผ่าน administrative workflow ที่แยกต่างหากในอนาคต

## 5. User journeys

### Customer checkout

ลูกค้า login → ดู active products → เพิ่มลง cart → server ตรวจราคาและ stock → สร้าง order → reserve stock → เริ่ม payment → callback confirm → order เป็น paid → ร้านเปลี่ยนเป็น cooking, ready และ completed

### Staff fulfillment

พนักงาน login → เปิด Admin Dashboard → filter pending/paid orders → ตรวจรายการ → เปลี่ยนเป็น cooking → เปลี่ยนเป็น ready → ส่งมอบ → เปลี่ยนเป็น completed

### Stock adjustment

staff ตรวจ available stock → ใส่ delta → server ตรวจว่า stock ใหม่ไม่ต่ำกว่า reserved quantity → บันทึกแบบ atomic → UI refresh ค่าล่าสุด

## 6. Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | LINE authentication | Backend verify ID token ก่อนออก HttpOnly session |
| FR-02 | Catalog | ลูกค้าเห็นเฉพาะ active product และราคาจาก database |
| FR-03 | Cart | Cart เพิ่ม/ลด/ลบได้และ persist ใน browser ได้ |
| FR-04 | Order | server รวมรายการซ้ำ คำนวณราคาใหม่ และสร้าง order/items ใน transaction |
| FR-05 | Stock | checkout reserve stock แบบ atomic และ cancel pending คืน reservation |
| FR-06 | Payment | LINE Pay request/confirm ใช้ adapter และรองรับ idempotency |
| FR-07 | Admin orders | role staff/manager/owner ดู ค้นหา และเปลี่ยนสถานะออเดอร์ได้ |
| FR-08 | Admin stock | role staff/manager/owner ปรับ stock โดยลดต่ำกว่า reservation ไม่ได้ |
| FR-09 | Authorization | customer ได้ 403 เมื่อเรียก admin endpoints |
| FR-10 | Quality | tests, typecheck, build และ diff check ต้องผ่านก่อน merge |

## 7. Business rules

เงินเก็บเป็นจำนวนเต็มหน่วยสตางค์ เช่น `6000` แทน 60 บาท ห้ามใช้ราคาจาก client เป็นราคาสุดท้าย ออเดอร์หนึ่งรายการจะอ้าง snapshot ของชื่อและราคาในเวลาสั่ง สินค้าที่ไม่ active สั่งไม่ได้ `available = stock_quantity - reserved_quantity` และต้องไม่ติดลบ

Payment status (`unpaid`, `pending`, `paid`, `failed`, `refunded`) แยกจาก order status (`pending`, `paid`, `cooking`, `ready`, `completed`, `cancelled`) Payment callback ห้ามเปลี่ยน fulfillment state เกินกว่าการยืนยันการจ่าย ระบบต้องไม่ confirm transaction ที่จ่ายแล้วซ้ำ

## 8. Success metrics

ระยะ foundation ให้ผ่าน automated tests ทั้งหมด ไม่มี order ที่ยอดรวมไม่ตรงกับ item snapshot ไม่มี stock ติดลบ ไม่มี customer เข้าถึง admin data และ payment callback ซ้ำไม่ทำให้เกิดการเปลี่ยนแปลงซ้ำ ระยะ production จะเพิ่ม metric ด้าน checkout success, payment latency, failed payment และ reservation expiry

## 9. Release gates

ก่อนเปิดให้ผู้ใช้จริงต้องมี production HTTPS, secrets ใน secret manager, database backup, payment reconciliation, reservation expiry, audit log, rate limiting, monitoring และทดสอบ Sandbox ครบตามคู่มือ [docs/user-setup-and-payment-testing.md](docs/user-setup-and-payment-testing.md)

## 10. Open product decisions

เรื่องต่อไปนี้ยังต้องมี decision ก่อน implementation: policy การหมดอายุ reservation, refund/void, staff authentication ที่ไม่พึ่ง LINE customer identity, notification channel, delivery/pickup model และ production deployment provider
