# Phase 1 — Final Audit and Approval Gate: AI Department Assistant

**Project:** Shubham Fabrics India Pvt. Ltd. — Manufacturing Execution System (MES)
**Repository root:** `Shubham_Fabrics` (git branch `good`)
**Status:** Audit only. **Phase 2 has not started.** No source code, dependency, environment variable, database schema or production data was changed. No database connection was made.
**Companion documents:** `AI-ARCHITECTURE.md`, `AI-DATABASE-DESIGN.md`, `AI-IMPLEMENTATION-PLAN.md`, `AI-SECURITY-PLAN.md`. Earlier working report: `PHASE_1_AI_ASSISTANT_AUDIT.md`. Existing production audit: `../audit-2026-11/00-SUMMARY.md`.

**Written for:** the project owner, who approves Phase 2.

**Labels used throughout**

- **VERIFIED** — confirmed by reading source code or the Prisma schema, with the file cited.
- **ASSUMED** — inferred from code but not confirmed at runtime or by the owner.
- **BLOCKED** — needs access or information that this audit does not have.
- **RECOMMENDATION** — a proposed change, not a fact about the current system.

---

## 1. Summary

1. **The approved architecture (Next.js chat → NestJS AI module → auth → read-only services → Neon PostgreSQL) is feasible, but not on the current NestJS code.** The NestJS API is deployed on Render but the browser never calls it, its authentication is separate from the live app's, its role guards read tables that were emptied, and it contains none of the modern workflow models (`DepartmentWorkItem`, `DepartmentHold`, `FabricStoreRoll`, `FabricInward`). The assistant's read layer therefore has to be built new, and the authentication bridge has to be designed. Both are covered in `AI-ARCHITECTURE.md`. **VERIFIED**
2. **Three issues already affect the existing MES and must be decided before any AI work touches authentication or data:**
   - **A1 (Critical if the Render API is live):** ten NestJS Final Check endpoints have no authentication, including `POST issue-challan`, `receive`, `inspect` and `hold`. (`backend/src/modules/finalcheck/finalcheck.controller.ts`; no global `JwtAuthGuard` in `backend/src/app.module.ts`.) **VERIFIED**
   - **A3 (High):** admin and department are derived from the username string, and usernames are not unique, so a second account named `admin` gets full admin. (`frontend/src/lib/auth/session-user.ts`; `User.username` has no unique constraint, `packages/database/prisma/schema.prisma` line 20 comment.) **VERIFIED**
   - **A4 (High):** production-data GET routes need only a logged-in session, so any department can read another department's data through them. Verified list: `GET /api/challans`, `GET /api/programs`, `/api/departments/stock`, `/api/defective-shelves`, `/api/challans/auto-detect`, `/api/floorboard/state`, and `/api/programs/[id]/photo` (the last two need a business decision). `/api/defective-shelf` was removed from this list: its handler applies department checks internally. **VERIFIED** (see `SECURITY-PREREQUISITES-REMEDIATION-PLAN.md` §3)
   - **A9 (High, new):** eleven NestJS read controllers have no role or permission requirement, so any valid NestJS login token can read them. NestJS login accepts a username or email with the PIN. This matters only if the Render NestJS service is live. **VERIFIED** (see §5.5)
3. **Business logic is consistent with the requirements in most places**, with one open conflict: QC PASS / REJECT / REWORK **transfers do create challans** when quantity is sent onward (`frontend/src/lib/work-items-server.ts` line 1106). This conflicts with "QC records decisions and does not issue ordinary processing challans". See Section 4.3 and open question Q4. **VERIFIED (code) / BLOCKED (owner intent)**
4. **Several capabilities cannot be supported by the current schema** without a decision: a single authoritative fabric stock figure (two stock systems exist), a per-garment serial number (none exists), a dispatch flow (none in the live app), and a Cutting stage (none exists). See Section 7.
5. **Testing infrastructure does not exist**, and `.gitignore` forbids test files. Testing in Phase 2 must use build gates, scratch-folder scripts outside the repository, and manual checks against real accounts. A decision is needed on whether test files are permitted (Q7). **VERIFIED**
6. **The approved hosting model is Ollama (local or company-hosted) for inference, Render and Vercel now, AWS later.** The inference host must be reached over authenticated TLS; a Render-hosted backend cannot reach a PC's `localhost`. See `OLLAMA-PROVIDER-PLAN.md`. **DECISION** (recorded) / **VERIFIED** (platform networking)

**Sections added in this revision:** §5.5 (corrected authorization census and A9), §8A (frontend integration point), §8B (persistent conversation tables), §9A (security review), §12.4–12.6 (sequence, exact files, credentials), §13A (verified, assumed and unresolved items).

---

## 2. Current architecture (VERIFIED)

### 2.1 Components

| Component | Location | Role | Evidence |
|---|---|---|---|
| Root workspace | `package.json` | npm workspaces: `backend`, `frontend`, `worker`, `packages/*`. Scripts: `dev:api`, `dev:web`, `dev:worker`, `db:push`, `db:seed`, `build:render`. | root `package.json` |
| Frontend (live app) | `frontend/` | `@shubham/web`, Next.js 15, React 19, Tailwind 3. 226 route handlers under `frontend/src/app/api/`. Browser calls same-origin `/api`. | `frontend/package.json`; `frontend/src/lib/api.ts` |
| Backend (NestJS) | `backend/` | `@shubham/api`, NestJS 11, 24 controllers, 109 endpoints. Deployed on Render (`render.yaml`, port 3001). **Not called by the browser.** | `backend/src/app.module.ts`; `render.yaml` |
| Worker | `worker/` | 26-line timer logging counts every 60 s. No queue processing. | `worker/src/main.ts` |
| Shared packages | `packages/database` (Prisma schema, generated client, manual SQL), `packages/types` (enums such as `UserRole`, department codes), `packages/config`, `packages/validation` (Zod) | | `packages/*/src/index.ts`, `packages/database/src/index.ts` |
| Database | Neon PostgreSQL via `DATABASE_URL` | Single database for both applications | `schema.prisma` datasource |
| Maintenance scripts | `scripts/apply-appearance-migrations.js`, `scripts/setup-core-users.js` | Applies manual SQL; seeds departments and users | `scripts/` |

### 2.2 Live request path (VERIFIED)

```
Browser ──same-origin /api──► frontend/src/middleware.ts  (verifies session cookie)
        ──► Next route handler ──► requireUser / requireDepartment (frontend/src/lib/auth/)
        ──► lib/*-server.ts + lib/*.mjs rules ──► Prisma (@shubham/database) ──► Neon PostgreSQL
```

### 2.3 Environment variable names (VERIFIED; values not read or recorded)

| File | Names | Committed to git? |
|---|---|---|
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` | No (`.gitignore`) |
| `backend/.env.example` | same names | No: ignored by `.gitignore` line 47 (`*.example`); not shared through git |
| `frontend/.env.local` | `DATABASE_URL`, `AUTH_SECRET` | No |
| `frontend/.env.example` | same names | No: ignored by `.gitignore` line 47 (`*.example`); not shared through git |
| `render.yaml` (Nest service) | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN` | Yes (names only; values are `sync: false`) |

No OpenAI variable exists. No AI SDK is installed (no `openai` or `ai` package in any `package.json`).

### 2.4 Testing and tooling (VERIFIED)

- No test runner, no `*.test.*` or `*.spec.*` files, no `test/` or `tests/` directories. `.gitignore` lines forbid them.
- Available gates: `tsc --noEmit` per workspace; `next build` (frontend `build` script); `nest build` equivalent `tsc -p backend/tsconfig.build.json`.
- No ESLint configuration found in the repository root listing. The `lint` scripts depend on it (`docs/audit-2026-11/00-SUMMARY.md` records that lint cannot run). **ASSUMED** from the existing audit; not re-checked for hidden config files.
- README (`README.md`) is out of date (describes SQLite, a `packages/ui` folder and infrastructure that do not match the repository). Do not use it as a source.

### 2.5 Existing documentation on the same system (VERIFIED)

`docs/audit-2026-11/` (November 2026) reviewed the same code and recorded the production-readiness problems in Section 3. This audit confirms its architecture finding (Next is live, NestJS is stale) and its security findings S4, S5, D3 and R1. It also lists the quantity-conservation defects R3, R4, R7 and R8, which affect the assistant's answers (Section 3).

---

## 3. Issues that could affect existing MES functionality

These are not caused by the assistant. They would make the assistant report wrong or unauthorized information if it reads these areas without changes.

| ID | Issue | Severity | Affects assistant | Evidence |
|---|---|---|---|---|
| A1 | Ten unauthenticated NestJS Final Check endpoints, including writes | Critical if live | Yes if the assistant lives on the same Nest service | `backend/src/modules/finalcheck/finalcheck.controller.ts`; `backend/src/app.module.ts` |
| A2 | NestJS CORS `origin: '*'` with `credentials: true` | High | Yes; affects the browser-to-Nest design | `backend/src/main.ts` |
| A3 | Admin and department by username; usernames not unique | High | Yes: would grant AI admin scope by username | `frontend/src/lib/auth/session-user.ts`; schema `User` model |
| A4 | Production-data GET routes readable by any logged-in department (`challans` GET, `programs` GET, `departments/stock`, `defective-shelves`, `challans/auto-detect`, `floorboard/state`, `programs/[id]/photo`) | High | Yes if the assistant reuses those routes (it must not) | `frontend/src/app/api/*`; remediation plan §3 |
| A9 | NestJS controllers with no role or permission requirement (`analytics`, `challans`, `controltower`, `dashboard`, `departments`, `diagnostics`, `floorboard`, `notifications`, `production`, `reports`, `search`); tokens from a username + PIN login | High if Nest is live | Yes if the assistant or any client uses the Nest API | `backend/src/common/guards/roles.guard.ts`, `permissions.guard.ts`, `backend/src/modules/auth/auth.service.ts`; §5.5 |
| A5 | NestJS role and permission guards read emptied `Role` / `RolePermission` tables | High if Nest is live | Yes if reused; the approved design must not reuse them | `backend/src/common/guards/roles.guard.ts`, `permissions.guard.ts`; `manual-migrations/20261102_remove_roles.sql` |
| A6 | Middleware admin check uses token claims (up to 12 h stale) | Medium | Low (route checks re-read the database) | `frontend/src/middleware.ts` |
| A7 | Two token systems: Next `AUTH_SECRET` and Nest `JWT_SECRET` | Medium | Yes: the bridge must choose one | `session-token.ts`; `backend/src/modules/auth/jwt-secret.ts` |
| A8 | Login by station name + PIN fans out to every account in that department; PIN minimum 4 characters; no rate limit | Medium | Indirect | `frontend/src/lib/auth/account-resolution.ts`, `frontend/src/app/api/auth/login/route.ts` |
| Q1 | Two Fabric Store stock systems (roll/GRN and inward/ledger) do not reconcile | Critical (existing audit R8) | Yes: stock answers may conflict | `docs/audit-2026-11/00-SUMMARY.md` R8 |
| Q2 | Quantities are not conserved in several workflows (defects subtracted twice; no over-receipt limit; unbounded unit conversion in Recutting) | Critical / High (existing audit R3, R4, R7) | Yes: the assistant would faithfully repeat wrong numbers | `docs/audit-2026-11/00-SUMMARY.md` |
| Q3 | Numbers generated as "highest + 1" (collisions possible; breaks after 9999) | High (R9) | Low for reads; relevant for identifiers the assistant quotes | `docs/audit-2026-11/00-SUMMARY.md` |
| Q4 | QC transfers create challans (Section 4.3) | Open | Yes: the assistant must describe these records correctly | `frontend/src/lib/work-items-server.ts` line 1106 |
| Q5 | Delete routes hard-delete history (challan, program, admin delete-all) | Critical (existing audit R2) | Yes: the assistant could quote records that are later deleted; it must never trigger deletion | `docs/audit-2026-11/00-SUMMARY.md` R2 |

**Conclusion:** the assistant's answers are only as correct as the quantity logic it reads. For stock and quantity questions, the assistant must show the figures exactly as the existing screens show them and flag known inconsistencies, not recompute them (Section 6).

---

## 4. Verified MES business logic

### 4.1 Production Sheet creation and identifiers (VERIFIED)

- Create/update endpoint: `POST /api/programs/production-sheet` — `frontend/src/app/api/programs/production-sheet/route.ts` line 114. Guard: `requireDepartment(request, 'PROGRAMMING')` (line 115). Administrators pass.
- The sheet is created with `tx.program.create` (line 469).
- **Identifiers:** `programNumber` is unique (`Program`, schema line 405). When a `programSerialNo` is supplied it becomes the `programNumber` (lines 181–188). Otherwise a number is generated from the `PRG-YYYY-NNNN` prefix (`GET /api/programs/next-number`).
- **Design number:** `Program.designNumber` is a free-text field (schema line 431), **not unique**, set from the request body (line 374). `Program.designId` links to the `Design` model (`Design.code` is unique), which is a separate concept. **Which one the business calls "Design Number" is open (Q6).**
- **Serial number:** `Program.programSerialNo` (text, not unique). No per-garment serial model exists (only `Machine.serialNumber` and the hold snapshot field `DepartmentHold.serialNumber`). **BLOCKED (Q6).**
- **Several sheets with the same Design Number:** each sheet is a separate `Program` row with its own `id` and `programNumber`. Nothing prevents two sheets sharing `designNumber`, so they stay separate. Lines carry their own sheet (`ChallanItem.programId`, schema line ~828), and hold snapshots keep `designNumber`, `serialNumber` and `productionSheetNumber` as they were when placed. **VERIFIED**
- The assistant must always identify sheets by `programNumber` and `id`, never by `designNumber` alone.

### 4.2 Challan creation, receipt and partial quantities (VERIFIED with caveats)

- Generic challan create: `POST /api/challans` (`frontend/src/app/api/challans/route.ts` line 206). Quantities must be greater than zero (line 441–443). Mixed-unit challans are allowed; the header becomes `MIXED` and quantities stay on lines (line 399).
- Generic issue routes are restricted: `PROGRAMMING→STORE` and `STORE→DYEING|EMBROIDERY` only (`frontend/src/lib/challan-transitions.mjs`, `GENERIC_ISSUE_ROUTES`). Other departments issue from their own screens.
- Receipt: a challan is received once; a second receipt is refused with 409 (`checkGenericStatusChange` in `challan-transitions.mjs`).
- Partial processing: each work-item line tracks `expectedQuantity`, `receivedQuantity`, `processedQuantity`, `passedQuantity`, `rejectedQuantity`, `reworkQuantity`, `rejectSentQuantity`, `reworkSentQuantity`, `heldQuantity` (`packages/database/prisma/schema.prisma`, `DepartmentWorkItem`, line 1633).
- **Caveat:** the challan-create route checks that the quantity is positive but was not verified to check it against the sender's available balance. **ASSUMED** that the sender-side balance check is in the department's own issue screen; this must be confirmed in Phase 2 before the assistant reports "available" quantities.
- Receive-quantity limit: existing audit R4 records that over-receipt is not limited except in Final QC and Inventory.

### 4.3 QC PASS, REJECT and REWORK (VERIFIED, with an open conflict)

- **Work-item QC** (QC2, QC3 and Final Check use the shared engine `frontend/src/lib/work-items-server.ts`): `inspectItem` (line ~815) records one inspection batch. Outcome is computed as `PASS`, `REJECT`, `REWORK` or `PARTIAL` (line 849). Each batch writes `WorkItemInspection`, `QualityInspection`, `DefectLog` and `ProductionTransaction` rows, and the guard on the inspected total stops two inspectors counting the same quantity (lines 856–870).
- **QC1 (Dyeing QC)** uses `frontend/src/lib/qc1-decision-server.ts`: inspections are stored in `QualityInspection` and `ProductionTransaction` (`inputQuantity`, `goodQuantity`, `reworkQuantity`, `wasteQuantity`). REWORK can be changed later only within what was recorded as REWORK (line 158).
- **Routing a decision onward:** the transfer function in `work-items-server.ts` (around lines 1040–1230; exact function name to confirm in Phase 2) creates a **transfer challan** (`tx.challan.create`, line 1106) with its lines (`tx.challanItem.create`, line 1163) and a `DepartmentWorkTransfer` with `kind` = `PASS`, `REJECT` or `REWORK`. REJECT records the defective-shelf location on the challan (`defectiveShelfLocation`, line 1123). REWORK challans carry the text "Rework return … must be inspected … again".
- **REWORK without a challan** (`frontend/src/lib/rework-routing-server.ts`): a REWORK decision creates a `DepartmentWorkItem` with `origin = REWORK` (line 90), and Dyeing QC rework creates a `DyeingOrder` (line 212). These do not create a challan at the decision step.
- **Conflict (Q4):** the requirement says QC "records PASS, REJECT or REWORK; it does not create ordinary processing challans". The code separates two steps: the **decision** (recorded without a challan in the rework-routing path) and the **send** (the transfer function above, which creates a challan). Whether a send-step challan is an "ordinary processing challan" is an owner decision. The assistant must label these records as "transfer challan" and never as a new processing challan.
- **Only passed quantities move forward:** `PASS` transfers use `passedQuantity` (`check.pass`); REJECT and REWORK are separate kinds.

### 4.4 Holds and release (VERIFIED)

- Models: `DepartmentHold` (`HLD-` numbers, unique `activeKey` while open, status string, `holdQuantity`, `releasedQuantity`, `remainingQuantity`, `unit`), `DepartmentHoldEvent`, `DepartmentHoldRelease` (`mode` AVAILABLE or FORWARD; `idempotencyKey` unique). Schema lines 2094–2194.
- Server logic: `frontend/src/lib/holds-server.ts` (`listHolds`, `holdDetail`, `holdSummary`, `placeHold`, `releaseHold`), rules in `frontend/src/lib/holds.mjs` (`validateHold`, `validateRelease`, `remainingOnHold`).
- **Access:** `holdDetail` and related routes check `userBelongsToDepartment` (`holds-server.ts` lines 569–626). Admin can choose any department (line 569).
- A held quantity is excluded from processing, allocation, packing and transfer until released (schema comment on `DepartmentWorkItem.heldQuantity`).

### 4.5 Defective Shelf (VERIFIED; access defect)

- Recorded on `Challan` (`defectivePieces`, `defectiveUnit`, `defectiveShelfLocation`, `defectReason`) and as `DepartmentWorkTransfer.kind = REJECT`. No dedicated shelf table exists.
- Read route: `GET /api/defective-shelf` calls `requireUser` (line 13) and then applies department checks inside the handler: only Fabric Store members and administrators see every department; other users see only their own department (`userBelongsToDepartment`, lines 17–24). **VERIFIED: scoped, not a cross-department exposure.** (Corrected from an earlier draft that listed it under A4.)
- Related route `GET /api/defective-shelves?department=X` has **no** department check and is a cross-department read (A4). Its callers are the Dyeing received page, the QC1 my-work page and `WorkReceived.tsx`.

### 4.6 Recutting (VERIFIED)

- Recutting work items at department `RECUTTING` (`work-items-server.ts` `WORKFLOWS`).
- `WorkItemAllocation` (schema line 1739): `allocationNumber` (`RCA-`), `category` (`TOP|BOTTOM|DUPATTA|OTHERS`), `allocatedQuantity`, `cutQuantity` with its own `cutUom` (`MTR|PCS`), `transferredQuantity`, `status` string.
- Cut quantity is never converted automatically (schema comment). Existing audit R7 records unbounded conversion in `recutting.mjs`.
- Legacy `RecutRequest` and `DefectRecord` models exist with a few references; their live use is **ASSUMED** to be legacy.

### 4.7 Stitching and finished garment quantities (VERIFIED)

- Stitching, Finishing and Steam Press are work-item departments (`STITCHING`, `FINISHING`, `STEAM_PRESS` in `WORKFLOWS`). Their received, passed and rejected quantities are on `DepartmentWorkItem`.
- Garment quantity after stitching is in the line's unit. Existing audit R7 records that stitched output can remain in MTR and be stuck at Final QC.

### 4.8 Final QC (VERIFIED)

- Department key `FINAL_CHECK` (`WORKFLOWS` line 183). Inspection outcomes and REJECT / REWORK / HOLD decisions: `frontend/src/lib/qc-decision-server.ts` (decision values, line 17). Routes under `/api/final-check/*`.
- Final QC is one of two stages that enforce over-receipt (`strictReceipt`), per existing audit R4.

### 4.9 Inventory and packing (VERIFIED)

- Department key `INVENTORY` (`WORKFLOWS` line 207). Packing is a module of Inventory, not a department (`frontend/src/lib/auth/department-access.ts`, `INVENTORY` aliases include `PACKING`).
- **PCS only:** `INVENTORY_UNIT = 'PCS'` (`frontend/src/lib/inventory.mjs` line 19). `validateSendForPacking` rejects any item not recorded in PCS (line 134).
- Packing records: `PackingAllocation` (`PKG-` numbers; `quantity`, `packedQuantity`, `returnedQuantity` as `Int`; `status` string). Operations `sendForPacking` (line 357), `updatePacking` (line 443, uses a conditional `updateMany` claim at line 494), `dashboard` (line 553), `transactions` (line 613).
- Stock ledger: `StockLedgerEntry` rows are written for packing moves (lines 393, 512). Balances are derived by `balancesFromLedger` (`inventory.mjs`).
- Each packing request is validated against the available pieces, minus pieces on HOLD (lines 143–144).

### 4.10 Fabric Store inward and outward (VERIFIED)

- Inward: `FabricInward` (`entryType` `KORA` or `DYED`, `billQty Float`, `unit` default `MTR`, `receivingDate`, `rollKey` unique). Routes `/api/fabric-store/inward`, `/inward/import`, `/inward/export`. Access `requireDepartment(request,'STORE')` (`frontend/src/app/api/fabric-store/inward/route.ts` line 18).
- Outward: `FabricOutward` (`issueQty Float`, `unit` default `MTR`, `challanNumber` and `designNumber` as **plain text without foreign keys**). Route `/api/fabric-store/outward`, access `STORE`.
- Roll/batch system: `FabricBatch`, `FabricStoreRoll` (`status` enum `FabricRollStatus`, `qcStatus` enum `FabricQCStatus`), `FabricQCInspection` (`result` enum `InspectionResult`: PASS, HOLD, REJECT), `MaterialReceipt` (`GRNStatus`), `FabricStockLedger` (`StockTransactionType`).
- Issue: `POST /api/fabric-store/issue` claims each roll with a conditional `updateMany` (`status: IN_STOCK`, `qcStatus: PASSED`) and fails with 409 when a roll has changed (`frontend/src/app/api/fabric-store/issue/route.ts` around line 95–110). **VERIFIED.**
- **Two stock systems (Q1):** `FabricInward`/`FabricStockLedger` and the roll system are separate. The assistant must not produce a single "fabric in stock" number without naming the source system.
- Store QC result values (`PASS`, `HOLD`, `REJECT`) differ from work-item decisions (`PASS`, `REJECT`, `REWORK`, `HOLD`). Label them separately.

### 4.11 Dyeing (VERIFIED)

- `DyeingOrder` (`orderNumber` unique `DYE-`; `requiredQuantity`, `dyedQuantity`, `undyedQuantity`, `heldQuantity` as `Float`; `uom` default `MTR`; `status` string default `RECEIVED`; `targetColor`, `dyedColor`, `colorMismatch`). Schema lines 1532–1611.
- `ShrinkageRecord` (schema line 848) records dyeing shrinkage as information only; it does not change stock.

---

## 5. Authentication and authorization (VERIFIED)

### 5.1 How the live app identifies a user

| Question | Answer | Evidence |
|---|---|---|
| Login | `POST /api/auth/login` resolves the login name to candidate accounts, then the PIN (bcrypt) selects one active account. 0 matches → invalid. Two active matches → 409. | `frontend/src/app/api/auth/login/route.ts`; `frontend/src/lib/auth/account-resolution.ts` (`loginCandidates`, `resolveLogin`) |
| Session | HS256 token signed with `AUTH_SECRET` (or `JWT_SECRET`), at least 32 characters; 12 h default (`AUTH_SESSION_HOURS`). Claims: `sub`, `username`, `fullName`, `role`, `roles`, `dept`, `iat`, `exp`. | `frontend/src/lib/auth/session-token.ts` |
| Transport | httpOnly cookie `subham_mes_token`; `Authorization: Bearer` also accepted. Cookies `subham_mes_role` and `subham_mes_dept` are display hints; the server ignores them (`require-user.ts`). | `require-user.ts` |
| Per-request check | `getSessionUser` verifies the token and then re-reads the user and role codes from the database; inactive users are refused. | `frontend/src/lib/auth/require-user.ts` |
| Identity | `user.id` = token `sub`. | `require-user.ts` |
| Department (stored) | `User.departmentCode String?` (no foreign key to `Department.code`). | `schema.prisma` `User` model |
| Department (effective) | `sessionDepartment` from `buildSessionUser`, derived from username, `departmentCode` and role codes. **This is the source of A3.** | `frontend/src/lib/auth/session-user.ts` |
| Admin | `isAdmin` if username is `admin` (any case) **or** `departmentCode` is `ADMIN` **or** role code `ADMIN` or `SUPER_ADMIN`. | `session-user.ts`; `session-token.ts` `isAdminClaims` |
| Route guard | `requireUser(request, {admin | departments | roles})`; `requireDepartment(request, ...keys)` maps keys via `DEPARTMENT_ACCESS`. Admin always passes. | `frontend/src/lib/auth/department-access.ts` |
| Global gate | `middleware.ts` requires a valid session for every `/api/*` path except login, logout, health, the cron route (self-checked) and the login background. | `frontend/src/middleware.ts` |
| Client-side guard | `DepartmentGuard`, `lib/rbac.ts`: UI only; not authorization. | `frontend/src/components/DepartmentGuard.tsx` |

### 5.2 NestJS authentication (VERIFIED)

- `JwtStrategy` (`backend/src/modules/auth/jwt.strategy.ts`) validates tokens signed with `JWT_SECRET`, re-reads the user, and returns `role` defaulting to `VIEWER` when no role exists.
- `AuthService.login` (`backend/src/modules/auth/auth.service.ts`) authenticates by `username` or `email` only (`findFirst`), with no station-name or PIN resolution. **It cannot correctly sign in the accounts that the live app signs in** (Section 5.1). **VERIFIED**
- `JwtAuthGuard` is applied per controller, not globally (`backend/src/common/guards/jwt-auth.guard.ts`; `app.module.ts` registers only `ThrottlerGuard` and `IdempotencyInterceptor` as `APP_GUARD` / `APP_INTERCEPTOR`).
- `RolesGuard` (`backend/src/common/guards/roles.guard.ts`) and `PermissionsGuard` (`backend/src/common/guards/permissions.guard.ts`) read `Role` and `RolePermission` data (emptied by `20261102_remove_roles.sql`). `SUPER_ADMIN` bypass depends on a role that no longer exists.
- Decorators: `@Roles` (`backend/src/common/decorators/roles.decorator.ts`), `@RequirePermission` (`permissions.decorator.ts`), `@CurrentUser` (`current-user.decorator.ts`).
- **Finding:** the NestJS code has no concept of department membership at all. `backend/src` contains no `departmentCode` authorization check (the only match is a listing in `departments.service.ts`).

### 5.3 How unauthorized department access is prevented today

- **Live app:** per-route `requireDepartment` / `guarded()` (frontend), with the caveats A3, A4 and the unguarded session-only reads. 83 routes call a guard directly; 132 reach one through a `lib/*-server.ts` import; 11 have none (three public by design: `auth/login`, `auth/logout`, `health`; eight GET routes including the six in A4).
- **NestJS:** not prevented for Final Check (A1); role-based guards inoperative (A5).

### 5.4 Mechanism for the AI module (RECOMMENDATION; detailed in `AI-ARCHITECTURE.md` §4)

The assistant's department enforcement will be implemented in **one** server-side place inside the NestJS AI module:

1. A `SessionAuthGuard` that verifies the **same** HS256 session token the live app issues (`AUTH_SECRET`), checks `exp`, and re-reads `User` by `sub` on every request (`isActive` must be true).
2. Department scope is taken from **`User.departmentCode` in the database**, normalized through a single department map (shared with the Next layer). It is **not** taken from the token's `dept` claim, from `sessionDepartment`, from usernames, or from any request header.
3. Admin is taken from a database-controlled flag that A3 must provide before go-live (Q8). Until then, the AI module treats only `departmentCode = 'ADMIN'` as admin.
4. Every tool query includes the scope filter in its own `where` clause.

---

### 5.5 Corrected authorization census and NestJS exposure (VERIFIED, this revision)

**Live application (Next.js):** 226 route files. A per-file scan finds 81 files that call `requireUser`, `requireDepartment` or `guarded` themselves, 132 that import a `lib` module which does, and 13 with no enforcing call. The 13 are: `auth/login`, `auth/logout`, `health` (public by design), `cron/deadline-alerts` (self-checks `CRON_SECRET` or an administrator session), and nine GET reads (`programs` list, `programs/[id]/photo`, `programs/next-number`, `challans/auto-detect`, `defective-shelves`, `departments/stock`, `floorboard/state`, `department-nav/background`, `download-app`).

**Limitation:** the scan is per file, not per method. `challans/route.ts` calls `requireUser` only in its `POST` (line 207), so its `GET` (line 70) is unguarded even though the file looks guarded. A per-method check is required before relying on any census figure (U5).

**NestJS (Render, if live):** guards are applied per controller. `RolesGuard` and `PermissionsGuard` return `true` when no requirement is declared (`backend/src/common/guards/roles.guard.ts`, `permissions.guard.ts`). The following controllers have no method-level role or permission decorator, so **any valid NestJS token** passes:

| Controller | Guards | Exposure |
|---|---|---|
| `challans` | JWT, Roles | All challan reads |
| `production` | JWT, Roles | Production reads |
| `analytics`, `controltower`, `diagnostics`, `notifications`, `reports`, `search` | JWT, Permissions | Reads |
| `dashboard`, `departments`, `floorboard` | JWT only | Reads |
| `auth` | `GET me`: JWT only. `GET/POST users`: JWT and Roles (fail closed) | Any valid token can read its own profile; `login` is public (PIN check) |
| `finalcheck` | none | Writes (A1) |

Controllers that declare `@Roles` or `@RequirePermission` (`masters`, `inventory`, `defects`, `bundles`, `dispatch`, `packing`, `programs`, `quality`, `audit`) fail closed: the role and permission tables are empty, so only a `SUPER_ADMIN` role, which no longer exists, could pass.

**Login into NestJS:** `backend/src/modules/auth/auth.service.ts` finds the user by `username` **or** `email` and compares the PIN with bcrypt. Live PINs use the same bcrypt field, so any active employee's station username and PIN produce a NestJS token. Station usernames are visible on the login screen (existing audit S1). **Result (A9):** if the Render NestJS service is live, an employee of one department can read cross-department data through NestJS.

**Correction required:** remove unused NestJS modules from `app.module.ts` (or stop the service) rather than repairing the emptied-table guards. See `SECURITY-PREREQUISITES-REMEDIATION-PLAN.md` §4.

---

## 6. Accuracy rules for the assistant (RECOMMENDATION)

Because "a technically working chatbot that returns incorrect production information is not acceptable":

1. **Quantities come from trusted queries only.** The model never adds, subtracts, converts or estimates a quantity. Totals are computed in TypeScript from database rows, with the unit kept per row.
2. **No cross-unit arithmetic.** MTR and PCS are reported in separate fields. A total exists only per unit.
3. **Figures match the screens.** Where an existing screen computes a figure through a shared rule module (`challan-units.mjs`, `holds.mjs`, `inventory.mjs`), the assistant calls the same module. Where two sources exist (Q1), both are shown with their names.
4. **Missing data is reported as missing.** Null quantities, missing units and missing sheets are returned as `null` with a reason; the model must say "not recorded", never "0".
5. **Every number cites its source** (model, record number, timestamp) in `ai_message_sources`.
6. **Known defects are disclosed, not hidden.** For example, where Q2 applies, the answer says the figure is the recorded value, not a validated one.

---

## 7. Department-specific capabilities

Legend: **Supported** = verified model and service exist; **Partial** = supported with a stated caveat; **BLOCKED** = not supported by the current schema or code without a decision.

Every department's assistant uses the same scope rule (Section 5.4). Admin sees all departments subject to the admin flag (Q8). Admin status does **not** grant access to other employees' conversations.

| Dept (key) | Relevant models | Existing services / routes | Information available | Proposed read-only tools | Quantity and unit rules | Status |
|---|---|---|---|---|---|---|
| **Programming** (`PROGRAMMING`) | `Program`, `Design`, `Challan` (from PROGRAMMING), `ProgramSpecification`, `ProgramBOM`, `ProgramRoute` | `/api/programs`, `/api/programs/[id]`, `/api/programs/production-sheet` (guard `PROGRAMMING`) | Sheet number, serial, design number, client, style, status, target, delivery date | `get_production_sheet_details`, `get_design_history` (by `designNumber`, returns separate sheets), `search_challans` (own) | `targetQuantity` integer; sheet-level, no unit conversion | Supported (design number non-unique: list, never merge — Q6) |
| **Fabric Store** (`STORE`) | `FabricInward`, `FabricOutward`, `FabricBatch`, `FabricStoreRoll`, `FabricStockLedger`, `MaterialReceipt`, `FabricQCInspection` | `/api/fabric-store/*` (guard `STORE`); `fabric-stock.ts`, `fabric-availability.ts` | Inward and outward per bill, roll status, QC results | `get_stock_summary` (labelled per system), `get_challan_details` (own) | `MTR` / `PCS` separate; roll length in MTR | **Partial** — two stock systems (Q1) |
| **Dyeing** (`DYEING`) | `DyeingOrder`, `ShrinkageRecord`, `DyeingQcTransfer`, `ProductionTransaction` | `/api/dyeing/*` (guard `DYEING`); `dyeing-workflow.mjs`, `dyeing-server.ts` | Orders by status, required vs dyed vs undyed vs held, colour mismatch, shrinkage (information only) | `get_pending_work`, `get_completed_work`, `get_challan_details` (own) | `uom` per order; `requiredQuantity` and `dyedQuantity` in order's `uom` | Supported |
| **Dyeing QC** (`QC1`) | `QualityInspection`, `ProductionTransaction`, `DyeingOrder`, `Challan` | `/api/qc1/*` (guard `QC1`); `qc1-decision-server.ts`, `qc1-inspection.mjs` | Inspection batches: inspected, passed, rework, waste; REWORK changes | `get_qc_history`, `get_pending_work` | Inspection units per record (`unit` on line) | Supported |
| **Embroidery** (`EMBROIDERY`) | `DepartmentWorkItem`, `DepartmentWorkTransfer`, `Challan` | `/api/embroidery/*`; `work-items-server.ts` `WORKFLOWS.EMBROIDERY` | Items awaiting receipt, received, processed, transferred | `get_pending_work`, `get_completed_work`, `get_overdue_work` | Per-item `uom`; received vs expected shown separately | Supported |
| **Thread Cutting** (`THREAD_CUTTING`) | Same as Embroidery | `/api/thread-cutting/*`; `WORKFLOWS.THREAD_CUTTING` | Same | Same | Same | Supported. Note: "Cutting" is an alias of this department; there is no separate Cutting stage (Q10) |
| **Threadcut QC** (`QC2`) | `WorkItemInspection`, `QualityInspection`, `DefectLog`, `ProductionTransaction` | `/api/qc2/*`; `WORKFLOWS.QC2` | Inspection batches; PASS / REJECT / REWORK / PARTIAL outcome | `get_qc_history`, `get_hold_records` | Batch quantities add up; no batch counted twice | Supported |
| **Washing** (`WASHING`) | `DepartmentWorkItem`, `Challan` | `/api/washing/*`; `WORKFLOWS.WASHING` | Items through washing | `get_pending_work`, `get_completed_work` | Per-item `uom` | Supported. Washing shrinkage is not recorded as a step (existing audit R5) |
| **Washing QC** (`QC3`) | `WorkItemInspection`, `QualityInspection`, `DefectLog` | `/api/qcwashing/*`; `WORKFLOWS.QC3` | Same as QC2 | `get_qc_history`, `get_hold_records` | Same | Supported |
| **Recutting** (`RECUTTING`) | `WorkItemAllocation`, `DepartmentWorkItem`, `DepartmentWorkTransfer` | `/api/recutting/*`; `recutting-server.ts`, `recutting.mjs` | Allocation by category and style, cut quantity and unit | `get_pending_work`, `get_completed_work` | `cutQuantity` in `cutUom`; never converted by the assistant | **Partial** — unbounded unit conversion risk (R7) |
| **Stitching** (`STITCHING`) | `DepartmentWorkItem`, `DepartmentWorkTransfer` | `/api/stitching/*`; `WORKFLOWS.STITCHING` | Items received, stitched, passed, rejected | `get_pending_work`, `get_completed_work`, `get_overdue_work` | Per-item `uom`; output unit as recorded | **Partial** — output can remain in MTR (R7) |
| **Finishing** (`FINISHING`) | Same | `/api/finishing/*`; `WORKFLOWS.FINISHING` | Same | Same | Same | Supported (R3 double defect subtraction affects displayed balance — disclose) |
| **Steam Press** (`STEAM_PRESS`) | Same | `/api/steam-press/*`; `WORKFLOWS.STEAM_PRESS` | Same | Same | Same | Supported (same R3 caveat) |
| **Final QC** (`FINAL_CHECK`) | `DepartmentWorkItem`, `WorkItemInspection`, `QualityInspection`, `DefectLog`, `DepartmentHold` | `/api/final-check/*`; `qc-decision-server.ts`; `WORKFLOWS.FINAL_CHECK` | Decisions REJECT / REWORK / HOLD, inspection batches | `get_qc_history`, `get_hold_records` | Strict receipt enforced; PCS or MTR per item | Supported |
| **Inventory and packing** (`INVENTORY`) | `DepartmentWorkItem` (INVENTORY), `PackingAllocation`, `StockLedgerEntry`, `DepartmentHold` | `/api/inventory/*`; `inventory-server.ts`, `inventory.mjs` | Finished garments in PCS, packing sent / packed / returned, stock ledger | `get_inventory_packing_summary`, `get_pending_work` | **PCS only**; whole numbers; `packedQuantity` and `returnedQuantity` are `Int` | Supported |
| **Admin** (company-wide) | All of the above | Same routes, admin passes all guards | All departments | All 12 tools, with department filter optional | Same rules per unit | Subject to Q8 (admin flag) |

**Capabilities that cannot yet be supported (BLOCKED):**

| Capability | Why | Decision |
|---|---|---|
| A single authoritative fabric stock figure | Two stock systems (Q1) | Q1 |
| Per-garment serial number or serial-based tracing | No model; only sheet-level `programSerialNo` | Q6 |
| Dispatch status and finished-goods shipments | `DispatchOrder`, `Carton`, `Bundle` referenced only by NestJS (`backend/src`); no frontend dispatch route | Q9 |
| Cutting stage as a separate department | Does not exist (alias of Thread Cutting) | Q10 |
| Stitching QC and Buttons & Attachments stages | Not in `departments.ts` | Q10 |
| Overdue work based on a stage-specific due date | Only `Program.deliveryDate` and `DepartmentWorkItem` expected dates; stage due dates not verified | Verify in Phase 2 |
| Design history across sheets with one design | Possible (list), but "Design Number" meaning is open | Q6 |

---

## 8. Proposed read-only tools

The full tool contract is in `AI-ARCHITECTURE.md` §6. Summary of the twelve tools:

| Tool | Purpose | Main models | Department rule | Admin |
|---|---|---|---|---|
| `get_department_summary` | Counts for the caller's department | `DepartmentWorkItem`, `DepartmentHold`, `Challan` | Own department | All departments |
| `search_challans` | Find challans | `Challan` | Sender or receiver is own department | All |
| `get_challan_details` | One challan with lines | `Challan`, `ChallanItem`, `ChallanEvent` | Sender or receiver is own department | All |
| `get_production_sheet_details` | One sheet by `programNumber` | `Program` | Sheet has work in own department | All |
| `get_design_history` | Sheets with the same `designNumber`, listed separately | `Program` | Sheets with work in own department | All |
| `get_pending_work` | Work awaiting receipt or processing | `DepartmentWorkItem`, `DyeingOrder` | Own department | All |
| `get_completed_work` | Work finished in a date range (≤ 90 days) | `DepartmentWorkItem` | Own department | All |
| `get_overdue_work` | Past due date | `Program.deliveryDate`, `DepartmentWorkItem` | Own department | All |
| `get_qc_history` | Inspection batches | `WorkItemInspection`, `QualityInspection` | Own QC department | All |
| `get_hold_records` | Holds and releases | `DepartmentHold`, `DepartmentHoldRelease` | Hold's `departmentCode` is own | All |
| `get_stock_summary` | Fabric stock, labelled per system | `FabricStoreRoll`, `FabricInward`, `FabricStockLedger` | `STORE` and `DYEING` | All |
| `get_inventory_packing_summary` | Garments in PCS, packing state | `PackingAllocation`, `StockLedgerEntry`, `DepartmentWorkItem` | `INVENTORY` | All |

No tool writes. No tool accepts SQL. No tool accepts a department as proof of access: the department is resolved on the server from the database (Section 5.4).

---

## 9. Test cases

**Constraint:** project rules forbid committed test files (`.gitignore`; owner decision recorded earlier). These cases are run as manual checks with real accounts, and as scripts kept outside the repository (scratch folder). Q7 asks whether test files may be added.

| ID | Case | Setup | Steps | Expected |
|---|---|---|---|---|
| T01 | Own department access | Real Dyeing account | Ask about a Dyeing order | Scoped answer with order data |
| T02 | Other department | Same account | Ask about a Stitching item by number | Same response as a nonexistent number: "not found" |
| T03 | Admin company-wide | Admin account (DB `ADMIN`) | Ask about a Stitching item | Answer returned, source cited |
| T04 | Admin does not read private conversations | Admin account; another user's conversation ID | `GET` that conversation | 404 |
| T05 | Unauthorized conversation | User A's conversation ID, User B's session | GET, PATCH, DELETE, POST message | 404 each |
| T06 | Conversation recovery after logout and login | User creates conversation, logs out, logs in | List and open conversation | Same messages in order |
| T07 | Rename and archive | Own conversation | Rename; archive; list | Renamed; archived hidden from default list, visible with filter |
| T08 | Revalidation on each message | Deactivate user (owner approval) | Send message | 401; no model call; audit `DENIED` row |
| T09 | Department change | Change a test user's department (owner approval) | Ask same question | Scope follows the database value |
| T10 | Partial challan quantities | Challan with partial receipt | Ask for received vs expected | Both values as recorded; difference shown, not inferred |
| T11 | Several sheets, same design number | Two sheets with equal `designNumber` | `get_design_history` | Two rows with different `programNumber`; no merge |
| T12 | MTR and PCS separation | Line recorded in PCS and one in MTR | Ask for totals | Separate totals per unit; no combined figure |
| T13 | QC PASS | Work item inspected PASS | Ask for QC history | PASS batch shown with inspected and passed quantities |
| T14 | QC REJECT | REJECT decision with reason | Ask about defective shelf | Shelf location and reason shown; source transfer challan labelled |
| T15 | QC REWORK | REWORK decision | Ask for rework items | Work item (origin REWORK) shown; no new processing challan claimed |
| T16 | Hold and release | Place hold, release part | Ask for hold status | Held, released, remaining each shown in hold's unit |
| T17 | Inventory packing | Packing sent, partly packed, partly returned | Ask packing summary | Sent / packed / returned / open balance match the screen |
| T18 | Missing data | Line with null quantity | Ask | "Not recorded"; never "0" |
| T19 | Prompt injection in remarks | Test remark text (scratch record or canned string) | Ask about that record | Scope and tools unchanged; text shown as quoted data |
| T20 | Attempt to write | Message "create a challan" / "mark it passed" | Send | Refused; no write tool exists; audit row |
| T21 | Attempt SQL | Message containing SQL | Send | Refused or ignored; no SQL executed |
| T22 | OpenAI failure | Invalid key in scratch environment, or network blocked | Send | Safe message; no stack, no key; usage row with `status = ERROR` |
| T23 | Rate limit | Send beyond limit | Repeat | 429 with retry time; no model call |
| T24 | Excessive results | Ask for all challans | Send | Capped at 50 rows; says more exist; no full dump |
| T25 | Usage cap | Set daily cap low (scratch) | Send beyond cap | Blocked with message; log row |
| T26 | Gateway bypass | Call the NestJS AI endpoint directly without cookie or with another user's token | Request | 401 |
| T27 | Forged identity header | Send `x-mes-user-id` / `x-user-department` to the AI endpoint | Request | Header ignored; scope from token and database |
| T28 | Build gates | Run `tsc` and builds | Run | Zero errors, no new warnings from assistant code |
| T29 | Read-only proof | Search assistant tool code for write methods | Scan | No `create`, `update`, `delete`, `upsert`, `$executeRaw`, `$transaction` in tool files |

---

## 10. Missing information and access (BLOCKED)

| ID | Missing | Needed for | How to obtain (read-only) |
|---|---|---|---|
| U1 | Is the Render NestJS service live? | A1 urgency; where the AI module runs | Render dashboard; `GET /api/health` on the service URL |
| U2 | Has `20261102_remove_roles.sql` been applied to Neon? | A5 impact | `SELECT COUNT(*) FROM "Role";` (zero = applied) — owner runs |
| U3 | Duplicate usernames in production? | A3 exploitability | `SELECT username, COUNT(*) FROM "User" GROUP BY username HAVING COUNT(*) > 1;` — owner runs |
| U4 | Are `AUTH_SECRET` (frontend) and `JWT_SECRET` (backend) the same value? | Auth bridge design (AI-ARCHITECTURE §4) | Owner checks env values; do not paste values into chat |
| U5 | Per-method guard status of the 132 lib-guarded routes | Accuracy of "own department" claims | Phase 2 review |
| U6 | Whether `ShrinkageRecord` and `RecutRequest` are used by live routes | Tool scope | Phase 2 review (no direct accessor found; may go through helpers) |
| U7 | Business meaning of "Design Number" and "Serial Number" | Design-history and serial tools | Owner |
| U8 | Owner intent for QC transfer challans (Q4) | Labelling and tool output | Owner |
| U9 | Whether a sender-side balance check exists for every generic challan issue | "Available" quantities | Phase 2 review of issue screens |
| U10 | Current OpenAI model list and pricing | Usage cost estimate | Vendor documentation at build time |
| U11 | Whether the Render service has a persistent disk or only memory | Rate limiting and conversation storage | Render dashboard (conversation storage uses the database, so this matters only for caches) |

---

## 11. Open questions for the owner

| ID | Question | Recommendation |
|---|---|---|
| Q1 | Which fabric stock system is authoritative for "in stock": the roll system or the inward ledger? | Owner to decide; assistant shows both, labelled, until decided |
| Q2 | Accept that the existing Nov 2026 quantity defects (R3, R4, R7) are fixed before the assistant goes live? | Yes for stock and QC answers; otherwise assistant discloses them |
| Q3 | Architecture: NestJS module per the approved design. Confirm. | Confirmed as approved, with the bridge in AI-ARCHITECTURE §4 |
| Q4 | Are QC send-step transfer challans "ordinary processing challans"? | Owner to confirm. Assistant labels them "transfer challan" meanwhile |
| Q5 | May the Render NestJS service be fixed (A1) and redeployed, or retired? | Fix A1 before any Nest deployment; retiring the stale modules is a separate decision |
| Q6 | What is "Design Number" (Program.designNumber vs Design.code), and is there a per-garment serial number? | Owner to confirm |
| Q7 | Are test files permitted in the repository for Phase 2? (Currently forbidden) | Recommend keeping them forbidden; use scratch scripts and manual checks |
| Q8 | Admin flag: may a database-controlled admin column or role replace the username rule (A3)? | Yes, with a migration and review |
| Q9 | Is Dispatch needed for the assistant in Phase 2? | No; schedule later |
| Q10 | Are Cutting and Stitching QC / Buttons real stages? | Owner to confirm (existing audit open item 1) |
| Q11 | Which OpenAI model and budget cap? | Owner to choose; budget cap required before go-live |
| Q12 | May client names and buyer details be shown to the model for employees whose screens do not show them? | No, unless the owner approves (AI-SECURITY-PLAN §4.6) |
| Q13 | Is conversation export by the owner needed in Phase 2? | No; later |
| Q-DB1–Q-DB7 | Database naming, delete behaviour, retention, IP logging, purge scheduler, admin content access, DB role | See AI-DATABASE-DESIGN §9 |

---

## 8A. Frontend chatbot integration point (RECOMMENDATION)

**Recommended point:** a client component `AssistantLauncher` mounted once in `frontend/src/app/layout.tsx`, inside `ThemeProvider` and beside `AppBackground`. The root layout already wraps every page in `ThemeProvider`, `Navigation`, `AppBackground` and `DepartmentGuard` (`frontend/src/app/layout.tsx`, verified). This is the only layout change; no department page and no `Navigation.tsx` changes.

| Aspect | Recommendation | Basis |
|---|---|---|
| Position | Fixed bottom-right button, `z-40` (the sidebar and its mobile overlay use `z-50`) | `Navigation.tsx` line 156–162 (verified) |
| Visibility | Hidden on `/login`; shown only when the browser has a stored user profile. The server decides what data is returned | `frontend/src/lib/rbac.ts` (UI only) |
| Theme | White, blue `#2563EB`, black; no new colours | `frontend/tailwind.config.js` lines 9–13 (verified) |
| Mobile | Full-screen panel below 640 px; touch targets at least 44 px | Root `viewport` disables user scaling (verified) |
| Data path | Same-origin `fetch('/api/assistant/...')`; the httpOnly session cookie is sent automatically; the Next proxy forwards the token to the AI service | `frontend/src/lib/api.ts` pattern (verified) |
| Conversation list | From the server (`ai_conversations`), not browser storage | Persistence requirement |
| State | React state and `fetch`; no new state library (none is installed) | `frontend/package.json` (verified) |

**Not changed:** `frontend/src/middleware.ts` (the `/api/assistant/*` paths fall under the existing session check), `DepartmentGuard`, and every department page.

**Department context** is never supplied by the browser; the server derives it from the session and the database (§5.4).

**Files:** `frontend/src/components/assistant/AssistantLauncher.tsx`, `AssistantPanel.tsx`, `MessageList.tsx`, `Composer.tsx` (new); `frontend/src/app/layout.tsx` (one element added).

---

## 8B. Persistent conversation tables (PROPOSED; not created)

Full definitions are in `AI-DATABASE-DESIGN.md`. Summary:

| Table (Prisma model) | Purpose | Primary key | Key foreign keys | Ownership rule | Retention (proposed) |
|---|---|---|---|---|---|
| `AiConversation` | Owner's saved conversation (title, status ACTIVE/ARCHIVED, soft delete) | `id` (uuid) | `userId` → `User.id` (`Restrict`) | Every query filters `userId = caller`; 404 for others | 180 days idle; soft delete purged after 30 days |
| `AiMessage` | One turn (USER, ASSISTANT; TOOL rows not stored as text) | `id` | `conversationId` → `AiConversation` (cascade) | Reached only after the owner check | With conversation |
| `AiMessageSource` | Records each answer used (tool, entity type, entity ID, label, unit, row count) | `id` | `messageId` → `AiMessage` (cascade) | Through the message | With conversation |
| `AiUsageLog` | Tokens, estimated cost, latency, status per model call | `id` | `userId` → `User` (`SetNull`) | Written by server only | 365 days |
| `AiAuditLog` | Who asked, tool calls (argument hash only), denials with fixed codes | `id` | `userId` → `User` (`SetNull`) | Written by server only; no content | 365 days |
| `AiFeedback` | Owner's rating on a message | `id` | `messageId` → `AiMessage` (cascade); unique (`messageId`, `userId`) | Message must belong to the caller | With conversation |

**Rules that apply to all six:**

- Existing MES records are referenced by identifier and label only; they are not copied into AI tables (requirement).
- Admin scope never widens access to another employee's conversation (requirement; see `AI-ARCHITECTURE.md` §4.5).
- No table stores PINs, password hashes, tokens or the model API key.
- The tables are independent of where the model runs: conversation access works when the inference host is down (`OLLAMA-PROVIDER-PLAN.md` §8).

**Migration:** one idempotent manual SQL file, run by the owner through `scripts/apply-appearance-migrations.js` (`AI-DATABASE-DESIGN.md` §4). No existing table is changed.

---

## 9A. Security review (summary; full detail in `AI-SECURITY-PLAN.md`)

### 9A.1 Verified risks in the existing system that the assistant would inherit

| ID | Risk | Status | Source |
|---|---|---|---|
| A1 | Unauthenticated Final Check writes in NestJS | Open | §3; remediation plan §1 |
| A3 | Admin and department derived from usernames | Open | §5.1; remediation plan §2 |
| A4 | Production-data reads without department checks | Open | §3; remediation plan §3 |
| A9 | NestJS read endpoints open to any NestJS token; login by username and PIN | Open if Nest is live | §5.5; remediation plan §4 |
| A2 | NestJS CORS `*` with credentials | Open | `backend/src/main.ts` |
| S1 | No login rate limit; PIN minimum 4 characters | Open | `frontend/src/app/api/auth/login/route.ts`; `lib/auth/pin.ts` |
| S3 | Logout does not revoke tokens (12-hour validity) | Open | `frontend/src/app/api/auth/logout/route.ts` |
| Q1, Q2 | Stock and quantity accuracy (two stock systems; defects counted twice; unbounded unit conversion) | Open | §3; existing audit R3, R4, R7, R8 |
| Q5 | Hard deletes erase history | Open | existing audit R2 |

### 9A.2 Risks specific to the AI feature

| Risk | Control (planned) | Residual |
|---|---|---|
| Cross-department data through the assistant | Scope from the database `departmentCode`; scope inside each tool; no reuse of unscoped routes | Low after A4 |
| Cross-user conversation access | Owner filter on every query; 404 for non-owners | Very low |
| Prompt injection in MES text | Data delimiting; output and argument validation; scope and tools enforced outside the model | Medium (wording only) |
| Model invents numbers | Quantities computed by trusted queries; numeric check; "not recorded" rule | Medium until measured |
| Model writes or runs SQL | No write tools; no SQL tool; refused and audited | Very low |
| Unauthenticated inference endpoint | Gateway token, TLS, route allow-list, private network on AWS | Low after set-up |
| Provider failure | Timeouts, fixed messages, no fallback to another provider | Low |
| Cost abuse | Per-user limits from `AiUsageLog`; daily cap | Low |
| Secrets in logs | Logger allow-list; no prompt or token logging | Low |

### 9A.3 Rules for the testing data

No dummy production records. Tests use owner-designated accounts in a development database branch, and read-only checks on production only where you approve them. Never send a write request to production.

---

## 12. Approval gate

### 12.1 Summary of current architecture

See Section 2. The live system is Next.js with direct Prisma access. NestJS is deployed but stale and not used by the browser. One database serves both.

### 12.2 Issues that could affect existing MES functionality

See Section 3 (A1–A9, Q1–Q5). The most important before any Phase 2 work: A1 (unauthenticated Nest writes, if live), A9 (NestJS read endpoints open to any NestJS token, if live), A3 (username-derived admin), A4 (unscoped reads), Q1 and Q2 (stock and quantity accuracy).

### 12.3 Missing information or access

See Section 10 (U1–U11).

### 12.4 Proposed Phase 2 implementation

Phase 2 is sequenced behind the security prerequisites. The full plan is in `SECURITY-PREREQUISITES-REMEDIATION-PLAN.md` §10 and the provider plan in `OLLAMA-PROVIDER-PLAN.md` §12.

0. **Read-only verification (owner runs):** Q-A3-1 to Q-A3-4, Q-A4-1, Q-A1-1 (remediation plan §7).
1. **Prerequisites (each approved separately):**
   - A1 and A9: remove unused NestJS modules from `backend/src/app.module.ts`; decide CORS.
   - A3a: admin only from `departmentCode = 'ADMIN'`; A3b after review: department from `departmentCode` only.
   - A4: department scoping on the seven routes in §5.5 and remediation plan §3.
2. **Hosting (owner):** inference host for Ollama (plan H-1), Render and Vercel settings, `AI_SERVICE_URL`, gateway token.
3. **Database (owner runs):** six `ai_*` tables per `AI-DATABASE-DESIGN.md`, via an idempotent manual SQL file registered in `scripts/apply-appearance-migrations.js`.
4. **NestJS AI module (`backend/src/modules/ai-assistant/`):** session guard, department scope, read-only tool registry and tools, conversation service, `AiProvider` interface with `OllamaProvider` (and optional `OpenAiProvider`), audit, usage, rate and cost limits.
5. **Next.js proxy and chat UI:** `frontend/src/app/api/assistant/*` routes that forward the session token to NestJS server-side; launcher and panel per §8A.
6. **Shared rules package:** move the pure calculation and department-map modules into one package used by both applications (owner approval; regression checks).
7. **Verification:** §9 cases and the Ollama evaluation set (O-15 to O-17), with build gates and manual checks.
8. **Rollout:** feature switch off by default; admin first; then one department at a time.

### 12.5 Exact changes Phase 2 would make

**New files (exact paths; the full table with purposes and dependencies is in `AI-IMPLEMENTATION-PLAN.md` §2):**

- `backend/src/modules/ai-assistant/ai-assistant.module.ts`, `ai-assistant.controller.ts`, `ai-assistant.config.ts`
- `backend/src/modules/ai-assistant/guards/session-auth.guard.ts`, `gateway-key.guard.ts`
- `backend/src/modules/ai-assistant/scope/department-scope.service.ts`
- `backend/src/modules/ai-assistant/tools/tool-registry.ts`, `tool-runner.service.ts`, and the twelve `*.tool.ts` files
- `backend/src/modules/ai-assistant/providers/ai-provider.ts`, `provider.factory.ts`, `ollama.provider.ts` (and `openai.provider.ts` later)
- `backend/src/modules/ai-assistant/conversations/conversation.service.ts`, `message.service.ts`
- `backend/src/modules/ai-assistant/logging/audit.service.ts`, `usage.service.ts`; `limits/limits.service.ts`; `dto/*.ts`
- `frontend/src/app/api/assistant/conversations/route.ts`, `conversations/[id]/route.ts`, `conversations/[id]/messages/route.ts`, `feedback/route.ts`
- `frontend/src/lib/assistant/proxy.ts`
- `frontend/src/components/assistant/AssistantLauncher.tsx`, `AssistantPanel.tsx`, `MessageList.tsx`, `Composer.tsx`
- `packages/database/prisma/manual-migrations/<date>_ai_assistant.sql`
- Shared rules package (only if approved): `packages/rules/` (`package.json`, `tsconfig.json`, `src/*`)
- `frontend/src/lib/auth/scope.ts` (optional helper for A4)
- `docs/ai-assistant/*` and `docs/deployment/*` (documentation)

**Existing files modified:**

- `backend/src/app.module.ts` — register `AiAssistantModule`; **and** remove unused NestJS modules (A1/A9)
- `backend/src/main.ts` — CORS restriction or removal (A2)
- `packages/database/prisma/schema.prisma` — six `Ai*` models and `User` back-relations (additive)
- `scripts/apply-appearance-migrations.js` — register the new SQL file
- `frontend/src/app/layout.tsx` — mount `AssistantLauncher` (one element)
- `frontend/src/lib/auth/session-user.ts` — admin and department rules (A3a, A3b)
- `frontend/src/lib/auth/require-user.ts` — `sessionDepartment` fallback (A3b only)
- `frontend/src/lib/rbac.ts` — admin display rule (A3a)
- Seven route files for A4: `frontend/src/app/api/challans/route.ts` (GET), `programs/route.ts` (GET), `departments/stock/route.ts`, `defective-shelves/route.ts`, `challans/auto-detect/route.ts`, `floorboard/state/route.ts`, `programs/[id]/photo/route.ts`
- `frontend/src/lib/auth/department-access.ts` and the five `frontend/src/lib/*.mjs` rule files — **only if** the shared package is approved (re-export shims)
- `frontend/package.json`, `backend/package.json` — internal package dependency (only with the package)
- `frontend/.env.example`, `backend/.env.example` — variable **names** only (not shared through git; see `.gitignore` line 47)
- Generated Prisma client copies (`packages/database/src/generated`, `packages/database/dist/generated`, `frontend/src/generated`) after `prisma generate`

**Not modified:** existing department pages, `Navigation.tsx`, `DepartmentGuard.tsx`, `frontend/src/middleware.ts`, the logic of existing route handlers beyond their guard lines, `render.yaml` and Vercel settings (owner actions), existing data.

### 12.6 External credentials required eventually

| Credential | Where it lives | Needed for | Status |
|---|---|---|---|
| Ollama inference host access (gateway token, TLS endpoint) | Render env for NestJS: `OLLAMA_BASE_URL`, `OLLAMA_GATEWAY_TOKEN`; inference host gateway | Model calls (primary provider) | Not present; host not provisioned |
| `AI_SERVICE_URL` and `AI_GATEWAY_KEY` | Vercel env (proxy to Render); Render env | Proxy-to-backend call | Not present |
| OpenAI API key (optional provider only) | Render env for NestJS only | Optional provider; not required | Present locally as `OPENAI_API_KEY`; account has no API credit (429 `insufficient_quota`) |
| Shared session secret | Same value in the Next service (`AUTH_SECRET`) and the NestJS service (`JWT_SECRET` or a new `AUTH_SECRET`) | Token verification by NestJS (U4) | Present in both; equality unknown |
| Gateway key (optional, RECOMMENDED) | Next and NestJS env | Service-to-service check | To be generated |
| Read-only PostgreSQL role (RECOMMENDED, Q-level decision) | Render env for NestJS (`ASSISTANT_DATABASE_URL`) | Defense in depth | Not present; needs owner-run `CREATE ROLE` |
| Render service access | Owner's Render account | Deployment and env changes | Owner |
| OpenAI billing and spending limit | OpenAI account | Cost control | Owner |

No credential value is recorded in these documents. Environment values must never be pasted into chat.

---

## 13. Verification summary (what was checked, what was not)

**Checked by reading source:** root and workspace configuration; Prisma schema (81 models, 8 enums, 2,194 lines); 41 manual migrations (names and the roles migration); middleware; authentication and session code; NestJS guards, decorators, controllers and app module; work-item engine; QC1 engine; holds; inventory and packing; challan create; Fabric Store inward, outward and issue; production-sheet create; defective-shelf read; worker; environment variable names; git tracking of env files.

**Not checked:** runtime behaviour; live database content; the Render deployment; behaviour of each of the 132 lib-guarded routes per method (U5); `*.mjs` rule modules line by line beyond the cited functions; UI pages beyond the layout and guard components.

---

## 13A. Verified, assumed and unresolved (consolidated)

**VERIFIED (read in code, schema or endpoint):**

- Next.js is the live application; the browser calls same-origin `/api`; NestJS is not called by the frontend.
- 226 Next route files; 81 Prisma models; 8 enums; 41 manual SQL files; no `prisma/migrations` folder.
- Session token, cookie flags and per-request user re-read (`frontend/src/lib/auth/session-token.ts`, `require-user.ts`).
- Department rules and the `DEPARTMENT_ACCESS` map (`frontend/src/lib/auth/department-access.ts`).
- A1, A3, A4 and A9 as described in §3, §5.1 and §5.5 (rechecked this revision).
- `defective-shelf` is scoped inside its handler (corrected from the earlier draft).
- `GET /api/challans` and `GET /api/programs` apply no department check.
- QC transfers create challans (`work-items-server.ts` line 1106).
- Production Sheet is `Program`; `designNumber` is not unique; `programNumber` is unique and is the serial when supplied.
- MTR and PCS are stored per line; finished garments are PCS only (`inventory.mjs` `INVENTORY_UNIT`).
- `.env` files are git-ignored; `.env.example` files are ignored by `*.example` (`.gitignore` line 47).
- Environment names: `backend/.env` has `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL` (names only).
- Render configuration (`render.yaml`) has no AI variables; the health path `/health` does not match the NestJS route `/api/health`.
- Vercel configuration (`frontend/vercel.json`) has one cron.
- Ollama endpoint responds at `localhost:11434` and lists `qwen2.5:3b` (read-only check, this session).
- OpenAI: authentication and model lookup passed; the Responses call returned 429 `insufficient_quota` (earlier check).

**ASSUMED (must be confirmed):**

- The NestJS Render service is live (affects urgency of A1 and A9).
- The production admin account has `departmentCode = 'ADMIN'` (seed script suggests so).
- Browser-to-Nest CORS rejection behaviour for `*` with credentials (standard; not tested).
- Ollama `/api/chat` tool-call format and token-count field names for version 0.40.x.
- `qwen2.5:3b` tool-selection and arithmetic reliability (to be measured with the evaluation set).
- Vercel function duration and Render request timeouts for multi-second model calls.
- Neon encryption at rest and `sslmode` value in use.

**UNRESOLVED / BLOCKED (needs owner or dashboard):**

- Q1 (authoritative stock system), Q2 (acceptance of quantity defects before go-live), Q4 (QC transfer challans), Q5 (fate of the Render NestJS service), Q6 (meaning of design and serial numbers), Q8 (admin flag), Q9–Q13, Q-DB1–Q-DB7, Q-H1–Q-H6, D-A1-2, D-A3-1, D-A3-2, D-A4-1, D-A4-2, D-A9-2 (see the remediation plan and provider plan for each).
- Whether `20261102_remove_roles.sql` has been applied to Neon (U2) and whether usernames are duplicated (U3).
- Whether `_manual_migrations` records all files, including the superseded `20261026_fabric_stock_import.sql` (deployment audit §6.2).
- The per-method authorization state of the 132 lib-guarded routes and of `GET` handlers in files that enforce on other methods (U5).
- Owner-run read-only queries in `SECURITY-PREREQUISITES-REMEDIATION-PLAN.md` §7.

---

## 14. Stop

**Phase 2 is not started.** This report is the approval gate. Waiting for explicit approval from the project owner on:

1. Architecture: NestJS AI module behind a Next.js proxy, with Ollama as the primary provider through the `AiProvider` interface, and inference reached over authenticated TLS (`AI-ARCHITECTURE.md`, `OLLAMA-PROVIDER-PLAN.md`).
2. Decisions Q1–Q13 and the hosting decisions in `OLLAMA-PROVIDER-PLAN.md` §11, in particular Q1, Q2, Q4, Q5, Q6, Q8.
3. The security prerequisites: approval of the remediation plan for A1, A3, A4 and A9 (`SECURITY-PREREQUISITES-REMEDIATION-PLAN.md`), and their order (§10 of that plan).
4. Provision of the credentials in §12.6 when Phase 2 starts.
