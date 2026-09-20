# Project Context

## Last reviewed

2026-09-20

## Current branch

`docs/product-foundation` เป็น branch สำหรับเอกสารชุดนี้ โดย branch ที่มี implementation ล่าสุดคือ `feature/import-linemini-app`

## Implemented

- pnpm monorepo with React/Vite client, Fastify/TypeScript server and shared package
- environment validation and health endpoint
- LINE LIFF ID token verification and HttpOnly session
- PostgreSQL schema via Drizzle for users, menus, orders and order_items
- product CRUD with staff/manager/owner guard
- browser cart and server-side order total calculation
- transactional stock reservation and pending cancellation release
- LINE Pay request/confirm adapter with Sandbox configuration
- Admin Dashboard for order list/status and stock adjustment
- Vitest tests, TypeScript checks and production builds

## Not yet production-ready

- reservation expiry worker
- payment reconciliation when redirect/callback is lost
- refund/void flow
- explicit order state machine and transition audit log
- separate payment attempts table
- staff authentication/MFA and granular permissions
- pagination for admin list endpoints
- structured logs, metrics, tracing and alerting
- production deployment configuration and secret manager
- backup/restore and rollback runbook
- real LINE Pay Sandbox credentials and public HTTPS callback are not configured in repository

## Known documentation boundary

`docs/architecture.md` เป็น design exploration เดิมที่มีข้อเสนอ target เช่น tRPC modules, sessions table, option groups, jobs และ audit logs ซึ่งยังไม่ตรงกับ implementation ปัจจุบัน ให้ใช้ `ARCHITECTURE.md` ฉบับ root เป็น contract ใหม่ และถือ `docs/architecture.md` เป็น historical reference จนกว่าจะ archive ภายหลัง

`docs/foundation.md` และ `docs/user-setup-and-payment-testing.md` เป็น operational guides ที่ยังมีคุณค่า แต่รายละเอียดที่เกี่ยวกับ contract ต้องสอดคล้องกับ root `PRD.md`, `DATABASE.md` และ `API.md`

## Current source-of-truth order

1. `PRD.md` สำหรับ product scope และ acceptance criteria
2. `API.md` สำหรับ external API behavior
3. `DATABASE.md` สำหรับ data invariants และ migrations
4. `ARCHITECTURE.md` สำหรับ boundaries และ ownership
5. `DECISIONS.md` สำหรับ decisions ที่มีผลข้าม module
6. Code/tests สำหรับ behavior ที่ implement แล้ว
7. `docs/` สำหรับ operational guides และ historical notes

## Working agreement

ทุก feature ถัดไปต้องเริ่มจาก GitHub Issue และต้องระบุว่าแก้ gap ใดใน context นี้ หาก feature ทำให้ current context เปลี่ยน ให้แก้ไฟล์นี้พร้อม changelog ใน commit เดียวกัน
