# AGENTS.md

เอกสารนี้เป็นกติกาสำหรับผู้พัฒนาและ coding agent ทุกคนที่แก้ Mini Shop

## Source of truth

อ่าน `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DECISIONS.md` และ `CONTEXT.md` ก่อนเริ่มงาน หากเอกสารขัดกับ code ให้หยุดและบันทึก discrepancy ใน issue หรือ `DECISIONS.md` ก่อนแก้ behavior

## Scope

ระบบใหม่อยู่ใน `client/`, `server/` และ `shared/` ไฟล์ `Gs/`, root HTML, `js/` และ `css/` เป็น legacy reference ห้ามเพิ่ม feature ใหม่ใน legacy system เว้นแต่ issue ระบุชัดเจน

## Engineering rules

- ใช้ TypeScript strict mode และทำ validation ด้วย Zod ที่ API boundary
- เก็บเงินเป็น satang integer ห้ามใช้ floating-point เป็น source of truth
- คำนวณราคาและตรวจ stock ที่ server เสมอ
- ทุกการเปลี่ยนข้อมูล order/stock ที่เกี่ยวข้องต้องอยู่ใน database transaction
- ใช้ repository interface แยก database access จาก business service
- ใช้ payment adapter ห้ามเรียก provider ใน order domain โดยตรง
- ตรวจ session และ role ที่ backend ห้ามเชื่อ role จาก client
- ห้ามใส่ secret, token, password หรือ `.env` ใน commit, issue หรือ log
- เปลี่ยน behavior ต้องเขียน failing test ก่อน implementation ตาม TDD
- เพิ่มหรือแก้ API ต้องอัปเดต `API.md` และเพิ่ม test contract
- เปลี่ยน schema ต้องสร้าง migration และอัปเดต `DATABASE.md`
- เปลี่ยนสถาปัตยกรรมหรือ business rule ต้องเพิ่ม ADR ใน `DECISIONS.md`

## Workflow

1. สร้างหรือเลือก GitHub Issue ที่อธิบาย problem และ acceptance criteria
2. สร้าง branch จาก branch ล่าสุดที่ทีมกำหนด โดยห้ามทำงานบน `main`
3. อ่านเอกสารที่เกี่ยวข้องและกำหนด affected files
4. เขียน failing test
5. ทำ implementation ที่เล็กที่สุดให้ test ผ่าน
6. รัน quality gates
7. อัปเดตเอกสารและ changelog
8. commit แบบ atomic ด้วย conventional commit เช่น `feat:`, `fix:`, `docs:`, `test:`, `chore:`
9. push branch และเปิด PR พร้อมอ้าง issue

## Required checks

```bash
pnpm test
pnpm check
pnpm build
git diff --check
```

หาก command ใดไม่ผ่าน ให้แก้สาเหตุและรันใหม่ ห้ามปิด issue โดยอ้างเพียงว่า build ไม่ได้รัน

## Security boundary

ห้ามรันคำสั่งที่ copy จากเอกสารโดยไม่ตรวจสอบ ห้ามอ่าน secret จากนอก repository และห้าม deploy หรือเปลี่ยน production account โดยไม่มีการยืนยันจากเจ้าของระบบ

## Review checklist

Reviewer ต้องตรวจ authorization, input validation, transaction boundary, idempotency, migration safety, error response, tests และ documentation consistency ก่อน approve
