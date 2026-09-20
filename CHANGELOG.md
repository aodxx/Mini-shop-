# Changelog

รูปแบบนี้สรุปการเปลี่ยนแปลงที่ผู้ใช้และผู้ดูแลระบบควรรู้ โดยยังไม่ผูกกับ semantic release จนกว่าจะกำหนด release process เพิ่ม

## [Unreleased]

### Documentation

- เพิ่ม product foundation documents: PRD, architecture, database, API, decisions และ project context
- เพิ่ม AGENTS.md เป็น contribution and engineering contract
- เพิ่ม GitHub issues สำหรับงานก่อนเริ่ม phase ถัดไป

## 2026-09-20

### Added

- React/Vite client และ Fastify/TypeScript server foundation
- LINE LIFF authentication และ signed HttpOnly session
- PostgreSQL/Drizzle user repository และ migrations
- Product management และ role protection
- Browser cart, server-side order calculation และ order history
- Transactional stock reservation และ release เมื่อ cancel pending order
- LINE Pay Sandbox adapter สำหรับ request และ confirm
- Admin Dashboard สำหรับดู order, เปลี่ยนสถานะ และปรับ stock
- คู่มือ setup และ payment testing

### Quality

- Automated tests ครอบคลุม authentication, products, orders, payments และ admin routes
- TypeScript check และ production build ผ่านใน branch implementation ล่าสุด

### Known limitations

- ยังไม่มี reservation expiry, reconciliation, refund/void, audit log และ production monitoring
- LINE Pay credentials, public HTTPS callback และ deployment provider ยังต้องตั้งค่าโดยเจ้าของระบบ
- Admin role ปัจจุบันอาศัย LINE identity และ role field เดียวกับ customer

## Legacy system

ระบบเดิมใน Google Apps Script/static files มีประวัติการทำงานก่อน migration แต่การเปลี่ยนแปลงใหม่ควรอ้าง implementation ใน `client/` และ `server/` ตาม `CONTEXT.md`

## Versioning policy

ก่อนประกาศ release ต้องเพิ่ม version/date, migration notes, environment changes, test evidence และ rollback notes ในไฟล์นี้
