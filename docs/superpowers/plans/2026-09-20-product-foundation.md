# Product Foundation Documentation and Pre-Phase Plan

> **For agentic workers:** Read `PRD.md`, `AGENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DECISIONS.md` and `CONTEXT.md` before implementing any task. Steps use checkbox syntax for tracking.

**Goal:** ทำให้ Mini Shop มี product contract, architecture boundary, data invariants, API contract และ operational gates ที่สอดคล้องกันก่อนเริ่ม Phase ใหม่

**Architecture:** คง modular monolith ด้วย React/Vite, Fastify/TypeScript และ PostgreSQL/Drizzle ในระยะนี้ ใช้ REST routes เป็น current API contract และแยก payment/provider boundary ผ่าน interfaces งาน refactor ไปสู่ module routers ทำหลังจาก behavior contract มี tests รองรับ

**Tech Stack:** React, Vite, TypeScript strict, Fastify, Zod, Drizzle ORM, PostgreSQL, Vitest, LINE LIFF, LINE Pay adapter

**Spec:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md` และ `API.md`

## Global constraints

- เงินต้องเก็บเป็น integer satang
- ราคาสุดท้ายต้องคำนวณจาก server/database
- ทุก protected API ต้องตรวจ session และ role ที่ backend
- order/stock mutation ที่เกี่ยวข้องต้องใช้ transaction หรือ atomic predicate
- payment provider ต้องเรียกผ่าน adapter
- ต้องมี failing test ก่อน production code สำหรับ behavior ใหม่
- ห้ามเพิ่ม feature ใน legacy `Gs/`, root HTML, `js/` หรือ `css/` โดยไม่สร้าง decision ใหม่
- quality gates คือ `pnpm test`, `pnpm check`, `pnpm build` และ `git diff --check`

---

### Task 1: Freeze documentation contract

**Files:** `PRD.md`, `AGENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `DECISIONS.md`, `CONTEXT.md`, `README.md`, `CHANGELOG.md`

- [x] Review current implementation and legacy boundaries.
- [x] Record current state separately from target state.
- [x] Record API, database and authorization invariants.
- [x] Add release and contribution gates.
- [ ] Review documents with the project owner and open issues for unresolved decisions.

**Exit criteria:** ไม่มีเอกสาร root ใดอ้าง feature ที่ยังไม่มี implementation โดยไม่ระบุว่าเป็น target หรือ limitation

### Task 2: Add reservation lifecycle

**Files:** `server/src/orders/service.ts`, `server/src/orders/repository.ts`, `server/src/jobs/` or equivalent, `server/tests/orders.test.ts`, `DATABASE.md`, `API.md`

- [ ] Define reservation expiry duration and timezone policy in an ADR.
- [ ] Write a failing test for a pending order that expires and releases reserved stock exactly once.
- [ ] Add an idempotent expiry command with a database predicate on order status and expiry timestamp.
- [ ] Add the expiry timestamp migration and index.
- [ ] Add a worker or scheduled execution mechanism appropriate for the deployment platform.
- [ ] Test retry, duplicate execution and already-paid orders.

**Exit criteria:** pending payment that exceeds the approved duration releases stock, while paid/cancelled orders are not released twice

### Task 3: Introduce explicit order state machine and audit events

**Files:** `server/src/orders/state-machine.ts`, `server/src/orders/service.ts`, `server/src/orders/repository.ts`, `server/src/db/schema.ts`, `server/tests/orders.test.ts`, `DATABASE.md`, `API.md`, `DECISIONS.md`

- [ ] Define allowed fulfillment transitions and role requirements.
- [ ] Write failing tests for valid, invalid and repeated transitions.
- [ ] Add `order_events` schema and migration with actor, old status, new status and timestamp.
- [ ] Route all admin status changes through the state machine.
- [ ] Keep payment status independent from fulfillment status.

**Exit criteria:** API rejects illegal transitions and every accepted transition has an audit event

### Task 4: Separate payment attempts and reconciliation

**Files:** `server/src/payments/`, `server/src/db/schema.ts`, `server/tests/payments.test.ts`, `DATABASE.md`, `API.md`

- [ ] Define payment attempt lifecycle and provider error mapping.
- [ ] Write failing tests for lost callback, duplicate callback, failed confirm and retry.
- [ ] Add `payments` table or equivalent immutable attempt record.
- [ ] Add reconciliation command/worker using provider transaction IDs.
- [ ] Add safe admin visibility for pending/failed payments without exposing secrets.

**Exit criteria:** every provider attempt is traceable and a lost redirect can be reconciled without manual SQL

### Task 5: Harden admin identity and permissions

**Files:** `server/src/auth.ts`, `server/src/admin/`, `server/tests/auth.test.ts`, `server/tests/admin.test.ts`, `API.md`, `DECISIONS.md`

- [ ] Decide whether staff keeps LINE login or uses a separate staff identity.
- [ ] Define permissions independently from coarse roles.
- [ ] Write failing tests for least-privilege operations.
- [ ] Add session expiry/revocation and security event logging.
- [ ] Add audit information to stock adjustments.

**Exit criteria:** staff permissions are explicit, auditable and do not depend on frontend role labels

### Task 6: Split route-heavy app into modules without API break

**Files:** `server/src/app.ts`, `server/src/modules/`, `server/tests/`

- [ ] Add route contract tests before moving code.
- [ ] Move auth, catalog, orders, payments and admin routes one module at a time.
- [ ] Keep response shapes and status codes documented in `API.md`.
- [ ] Remove duplicated auth/role guards only after tests stay green.

**Exit criteria:** module boundaries are clear, public API is unchanged, and all quality gates pass

### Task 7: Production readiness

**Files:** deployment configuration, `docs/`, `CONTEXT.md`, `CHANGELOG.md`

- [ ] Choose deployment provider and record decision.
- [ ] Add HTTPS, secret manager, database backup and migration runbook.
- [ ] Add structured logs, metrics and alerting.
- [ ] Add smoke test and rollback procedure.
- [ ] Complete LINE Pay Sandbox evidence before production credentials.

**Exit criteria:** release checklist is complete and production can be rolled back without data loss

## Review checkpoints

เอกสารชุดนี้เป็น planning gate ไม่ใช่การอนุมัติ production ทุก task ต้องเปิด issue และมี owner/acceptance criteria ก่อนเริ่ม implementation ห้ามเริ่ม Task 2–7 เพียงเพราะเอกสารถูกสร้างแล้ว ต้อง resolve open decisions ที่เกี่ยวข้องก่อน
