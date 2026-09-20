# Architecture Decision Records

เอกสารนี้เก็บ decision ที่มีผลต่อหลายส่วนของระบบ หากเปลี่ยน decision ให้เพิ่ม record ใหม่แทนการแก้ประวัติเดิม

## ADR-001: ใช้ modular monolith ก่อน microservices

**Status:** Accepted

**Decision:** ใช้ Fastify process เดียว แบ่ง capability ด้วย service/repository และค่อยแยก service เมื่อมีเหตุผลด้าน scale หรือ ownership

**Why:** Order, stock และ payment ต้องประสาน transaction/state การแยกเร็วเกินไปเพิ่ม distributed consistency และ deployment burden

## ADR-002: PostgreSQL เป็น source of truth

**Status:** Accepted

**Decision:** ข้อมูล users, menus, orders, order_items และ payment state อยู่ PostgreSQL ส่วน Google Sheets/Apps Script เป็น legacy reference เท่านั้น

**Why:** ต้องใช้ foreign keys, unique constraints, transactions และ query ที่ตรวจสอบได้

## ADR-003: เงินเป็น integer satang

**Status:** Accepted

**Decision:** ทุก domain type และ database field ใช้ integer satang เช่น 100 บาทเป็น `10000`

**Why:** ป้องกัน floating-point error และทำให้ payment amount ตรงกันระหว่างระบบ

## ADR-004: LINE auth + HttpOnly signed session

**Status:** Accepted

**Decision:** Client ส่ง LINE ID token ให้ backend verify แล้ว backend ออก HttpOnly signed cookie

**Why:** ไม่เชื่อ profile จาก client, ลด token exposure และให้ authorization อยู่ฝั่ง server

## ADR-005: Payment provider ผ่าน adapter

**Status:** Accepted

**Decision:** Order domain เรียก `PaymentGateway` interface ผ่าน payment service ส่วน LINE Pay อยู่ใน provider adapter

**Why:** ทำให้ทดสอบโดย fake gateway ได้ และรองรับ provider ใหม่โดยไม่แก้ order calculation

## ADR-006: Reserve stock ตอนสร้าง order

**Status:** Accepted with follow-up

**Decision:** เพิ่ม `reserved_quantity` ใน transaction เดียวกับ order creation และคืนเมื่อ cancel pending

**Why:** ป้องกัน overselling ด้วย atomic predicate

**Follow-up:** ต้องเพิ่ม reservation expiry และ reconciliation ก่อน production

## ADR-007: REST routes เป็น current API contract

**Status:** Accepted

**Decision:** แม้มี tRPC foundation แต่ feature routes ปัจจุบันใช้ Fastify REST/JSON ตาม `API.md`

**Why:** โค้ดปัจจุบันและ payment callback ใช้ HTTP endpoints อยู่แล้ว การเปลี่ยนทั้งหมดเป็น tRPC ระหว่าง Phase จะทำให้ migration scope ใหญ่โดยไม่เพิ่มคุณค่าทันที

## ADR-008: Admin ใช้ LINE identity ชั่วคราว

**Status:** Accepted with follow-up

**Decision:** Admin role ปัจจุบันอยู่ใน user record เดียวกับ LINE customer identity และตรวจ role ที่ backend

**Why:** ใช้ foundation ที่มีอยู่และไม่ฝัง shared admin key

**Follow-up:** ก่อน production ควรออกแบบ staff authentication แยกหรือเพิ่ม MFA/permission matrix

## ADR-009: ไม่ merge main อัตโนมัติ

**Status:** Accepted

**Decision:** งานทั้งหมดอยู่ feature branch และต้อง review/approve ก่อน merge

**Why:** ป้องกันการนำ foundation ที่ยังมี production gaps ไปใช้จริงโดยไม่ตรวจสอบ
