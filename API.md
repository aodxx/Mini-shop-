# Mini Shop API Contract

## 1. Conventions

Base URL คือ API origin เช่น `http://localhost:3000` ตัวอย่างต่อไปนี้ใช้ JSON และ session เป็น HttpOnly cookie ชื่อ `mini_shop_session` ทุก protected request ต้องส่ง cookie ด้วย `credentials: include`

เงินใช้ satang integer เช่น `4500` คือ 45 บาท วันที่ใช้ ISO-8601 status code ใช้ `200` สำหรับ success, `201` สำหรับ create, `204` สำหรับ no content, `400` สำหรับ validation, `401` สำหรับ unauthenticated, `403` สำหรับ unauthorized role, `404` สำหรับ missing resource, `409` สำหรับ business conflict และ `503` สำหรับ dependency ที่ยังไม่พร้อม

Error shape:

```json
{ "error": "Human-readable stable error message" }
```

## 2. Authentication

| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| POST | `/api/auth/line` | public | verify LINE ID token และ set session |
| GET | `/api/auth/me` | session | คืน current user |
| POST | `/api/auth/logout` | optional | clear session |

`POST /api/auth/line` body:

```json
{ "idToken": "LINE_ID_TOKEN" }
```

Backend ต้อง verify token กับ LINE และห้ามเชื่อ profile ที่ client ส่งมาเอง

## 3. Catalog

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/products` | public | ทุกคนเห็น active products |
| GET | `/api/products?includeInactive=true` | session | staff/manager/owner |
| POST | `/api/products` | session | staff/manager/owner |
| PATCH | `/api/products/:id` | session | staff/manager/owner |
| DELETE | `/api/products/:id` | session | staff/manager/owner |
| POST | `/api/admin/products/:id/stock` | session | staff/manager/owner |

Product payload ใช้ `priceSatang`, `stockQuantity`, `category`, `isActive`, `sortOrder` และ optional `description`, `imageUrl` การปรับ stock ใช้:

```json
{ "delta": 5 }
```

`delta` ต้องเป็น integer ที่ไม่ใช่ศูนย์ ระบบคืน `409` ถ้าค่าใหม่ต่ำกว่า reserved quantity

## 4. Customer orders

| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| POST | `/api/orders` | session | สร้าง order ของ current user |
| GET | `/api/orders` | session | ดู order ของ current user |
| POST | `/api/orders/:id/cancel` | session | cancel pending order ของตนเอง |

Create body:

```json
{
  "items": [{ "productId": "uuid", "quantity": 2 }],
  "customerNote": "ไม่ใส่ผักชี"
}
```

`unitPriceSatang` อาจพบจาก client legacy แต่ server ต้องไม่ใช้เป็น source of truth

## 5. Payments

| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| POST | `/api/orders/:id/payment` | session | สร้างหรือ reuse payment request ของ order |
| GET | `/api/payments/line/confirm?transactionId=...` | provider callback | confirm LINE Pay และ redirect กลับ client |

Payment request ต้องคืน `paymentUrl` และ transaction data ที่ client จำเป็นต้องใช้เท่านั้น ห้ามคืน channel secret หรือ provider payload ที่มีความลับ Payment request ซ้ำต้อง reuse pending transaction และ confirm ซ้ำต้องไม่เปลี่ยน state ซ้ำ

## 6. Admin operations

| Method | Path | Query/body | หน้าที่ |
|---|---|---|---|
| GET | `/api/admin/database` | - | ตรวจ database connectivity และแสดง user summary สูงสุด 50 รายการ |
| GET | `/api/admin/orders` | `status`, `search` | ดู order ทั้งร้าน |
| PATCH | `/api/admin/orders/:id/status` | `{status}` | เปลี่ยน fulfillment status |

ทุกคำสั่งต้อง verify role ที่ backend โดย `/api/admin/database` คืนเฉพาะ `id`, `displayName`, `role`, `createdAt` ของ user และไม่คืน `lineUserId`

สถานะที่รับคือ `pending`, `paid`, `cooking`, `ready`, `completed`, `cancelled`

## 7. State transition contract

สถานะ payment และ fulfillment แยกกัน Payment callback mark payment เป็น `paid` และระบบปัจจุบันเปลี่ยน order เป็น `paid` ในจังหวะ confirm ส่วนการเปลี่ยนเป็น `cooking`, `ready` และ `completed` เป็น operation ของ staff/admin

ก่อน production ต้องเพิ่ม explicit state machine เพื่อปฏิเสธ transition ที่ข้ามขั้นหรือย้อนสถานะโดยไม่มี permission การเปลี่ยน status ทุกครั้งควรบันทึก actor และ event ใน `order_events`

## 8. Pagination and versioning policy

Current list endpoints ยังไม่มี pagination เพราะอยู่ใน foundation stage ก่อน production ต้องเพิ่ม `limit`, `cursor` และ stable ordering ให้ admin order list การเปลี่ยน response ที่ทำให้ client เดิมใช้ไม่ได้ต้องเพิ่ม version หรือ migration period ห้ามเปลี่ยน field name เงียบ ๆ
