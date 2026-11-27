# Security Prerequisites — Remediation Plan (A1, A3, A4)

**Status:** Plan only. **No source code, dependency, environment variable, Render or Vercel setting, database schema or production data was changed.** No migration was run. Nothing is deployed. Waiting for approval.
**Read:** `docs/ai-assistant/PHASE-1-FINAL-AUDIT.md`, `docs/ai-assistant/OLLAMA-PROVIDER-PLAN.md`, `docs/deployment/EXISTING-DEPLOYMENT-VERIFICATION.md`.

**Labels:** **VERIFIED** (read in the code by me), **REPORTED** (from you), **ASSUMED**, **DECISION NEEDED**, **RECOMMENDATION**.

---

## 0. Summary and corrections to Phase 1

### 0.1 What is confirmed

| ID | Finding | Status today | Where |
|---|---|---|---|
| **A1** | NestJS Final Check endpoints have no guard and write to the database | **Still present** | `backend/src/modules/finalcheck/finalcheck.controller.ts` (no `@UseGuards`); module registered in `backend/src/app.module.ts` line 66 |
| **A3** | Admin and department derived from username strings | **Still present** | `frontend/src/lib/auth/session-user.ts` (`username.toLowerCase() === 'admin'` and department username branches) |
| **A4** | Production-data reads that need only a logged-in session | **Still present**, and the list is larger than Phase 1 stated (§0.2) | Route handlers listed in §4 |
| **A9** (new) | NestJS read endpoints with no role or permission requirement, readable with any NestJS login token | **Present** if the Render service is live | 11 controllers, §5 |

### 0.2 Corrections to the Phase 1 report

1. **`defective-shelf` is not a cross-department exposure.** Phase 1 listed `frontend/src/app/api/defective-shelf/route.ts` as session-only. The handler applies department checks inside (`userBelongsToDepartment`, `departmentKeyFor`; lines 17–24). **Removed from A4.** Its top-level `requireUser` call is acceptable because the department rule follows it.
2. **Two session-only reads were missing from Phase 1 A4**, both verified: `GET /api/challans` (`frontend/src/app/api/challans/route.ts`, line 70) and `GET /api/programs` (`frontend/src/app/api/programs/route.ts`, line 14).
3. **The route census in Phase 1 was approximate.** It counted a file as guarded if it contained a guard call anywhere, even in another method. For example, `challans/route.ts` has `requireUser` only in its `POST` (line 207). A per-method check is required (§8).
4. **NestJS exposure (A9) was not in Phase 1.** Confirmed in §5.

---

## 1. A1 — Final Check endpoints in NestJS without authorization

### 1.1 Current implementation (VERIFIED)

- `FinalCheckController` (`@Controller('final-check')`) defines 10 endpoints: `GET dashboard`, `GET incoming`, `GET queue`, `GET jobs/:id`, `POST challans/:id/receive`, `POST jobs/:id/inspect`, `POST jobs/:id/hold`, `POST issue-challan`, `GET floor-board`, `GET reports`.
- The controller has **no `@UseGuards`** and takes **no `@CurrentUser()`** parameter, so the service receives no caller identity.
- `FinalCheckService` contains 7 Prisma write calls (`create`, `update`, `updateMany`, `delete`, `upsert`) and writes challans, items and inspections.
- `AppModule` imports `FinalCheckModule` (line 66). No global `APP_GUARD` applies the JWT guard (`app.module.ts` registers only `ThrottlerGuard` and `IdempotencyInterceptor`).
- The live browser never calls these routes. The frontend has its own `final-check/*` Next.js route handlers, which are separate code (`frontend/src/app/api/final-check/`). **VERIFIED** (no frontend reference to the Nest host; `final-check` absent from `frontend/src/lib/api.ts`).

### 1.2 Security vulnerability

- Anyone who can reach the Render service on the network can call `POST /api/final-check/issue-challan`, `…/receive`, `…/inspect`, `…/hold`, and write challans and inspections with no identity recorded.
- Because the write has no actor, the audit trail cannot say who made the change.
- Exposure depends on whether `subham-fabrics-api` is live and publicly reachable (NEEDS DASHBOARD VERIFICATION, deployment audit §13.1).

### 1.3 Recommended correction (smallest safe change)

**Option 1 (recommended): remove the module from the application.**

- In `backend/src/app.module.ts`, delete the `FinalCheckModule` import (line 30) and its entry in `imports` (line 66).
- Effect: the ten routes are not registered. Requests return 404. No database change, no data change.
- Frontend unaffected (separate code path, verified).
- The files stay in the repository, so the module can be restored by reverting one change.

**Option 2: add a guard to the controller.** Rejected for now. The only existing guard that would apply is `JwtAuthGuard`, which accepts NestJS-issued tokens. That path is itself part of A9. Adding it would keep two authorization systems for a function the live app already provides, so it would be a duplicate control.

**Option 3: stop the Render service.** Valid as an operational step, but it is a Render setting change and therefore needs your action. Option 1 is a code change that also protects any service that still runs the old build.

**Related, same change set (optional but recommended):** CORS (§5.4).

### 1.4 Files affected

| File | Change | Type |
|---|---|---|
| `backend/src/app.module.ts` | Remove `FinalCheckModule` import and registration | Modified (2 lines) |
| `backend/src/modules/finalcheck/*` | None (kept for reference) | Unchanged |

### 1.5 Tests required

Run against a **local** build only. **Do not** send unauthenticated write requests to the production Render URL; if Option 1 were broken, such a request could write to production.

| ID | Test | Expected |
|---|---|---|
| A1-T1 | Build the backend (`npx tsc -p backend/tsconfig.build.json`) | Zero errors |
| A1-T2 | Start the local backend; `GET /api/final-check/dashboard` without token | 404 |
| A1-T3 | Same for `POST /api/final-check/issue-challan` with a body | 404, and no database row created (check counts in the local development branch before and after) |
| A1-T4 | Start the local backend; `GET /api/health` | 200 (unchanged) |
| A1-T5 | Frontend Final Check pages (owner smoke test, staging or development environment) | Unchanged behaviour |

### 1.6 Risks and rollback

| Risk | Mitigation |
|---|---|
| A process still depends on the Nest Final Check routes | Verified: no frontend or worker reference (only `app.module.ts`). Confirm no external integration (DECISION NEEDED: owner confirms no outside system calls these routes) |
| Deploy not yet active | The change takes effect only after a Render deploy, which needs your approval. Until then the old build still runs |
| Test performed against production by mistake | Test list in §1.5 is local-only |

**Rollback:** revert the single change to `app.module.ts`, then redeploy. No data is affected.

---

## 2. A3 — Admin and department derived from usernames

### 2.1 Current implementation (VERIFIED)

`frontend/src/lib/auth/session-user.ts` function `buildSessionUser`:

- `isAdmin` is true when `username.toLowerCase() === 'admin'` **or** `departmentCode === 'ADMIN'` **or** a role code is `ADMIN`/`SUPER_ADMIN`.
- Department branches test usernames directly: `store`, `program`, `programmer`, `dyeing`, `dyeingqc`, `qc1`, `qc_insp`, `washingqc`, `qc3`, `threadcut`, `cutting`, `qc2`, `washing`, `recutting`, `stitching`, `finishing`, `inventory`, `packing`, `finalqc`, `steampress`, and others. Each branch assigns `normalizedDept`, `normalizedRole` and `defaultRedirect`.
- Role codes (`roleCodes.includes(...)`) are read from the `Role` table. That table is empty (migration `20261102_remove_roles.sql`), so those branches are inactive today.
- The result is used in:
  - `frontend/src/lib/auth/require-user.ts` (`getSessionUser` returns `isAdmin` and `sessionDepartment`; `requireUser` lets `isAdmin` pass every check, and `requireUser` passes department checks on `sessionDepartment` as well as `departmentCode`);
  - the login route, which writes `role` and `dept` into the **session token** (`frontend/src/app/api/auth/login/route.ts`);
  - `frontend/src/middleware.ts` (`isAdminClaims` on token claims, for `/api/admin/*` and `/admin`).
- Client-side: `frontend/src/lib/rbac.ts` (`isAdminUser`, which also tests `username === 'admin'`) controls only what the UI shows. It is not authorization.
- Account resolution maps the login name `system administrator` to username `admin` (`frontend/src/lib/auth/account-resolution.ts`, line 33). This is **login**, not authorization, and is out of scope.

**Database relationships:** `User.username` is not unique (schema, `User` model; comment on line 20). `User.departmentCode` is a plain string with no foreign key to `Department.code`.

### 2.2 Security vulnerability

- Any account whose username is `admin` (case-insensitive) is a full administrator, regardless of its department. Usernames are not unique, so an administrator can create a second such account by mistake, or someone with account-creation rights can grant admin without setting the department.
- The token stores `role` and `dept` derived from the username. Those claims are used by the middleware to allow `/api/admin/*` for up to 12 hours (token lifetime) even if the database changes.
- Department access can be granted by username: an account named `store` with `departmentCode = DYEING` gets Store access (because `sessionDepartment` is `STORE`).

### 2.3 Recommended correction (two steps; step A3a first)

**A3a: admin only from the database department code.**

- In `buildSessionUser`, set `isAdmin = user.departmentCode === 'ADMIN'`.
- Remove the `username === 'admin'` test.
- Remove the role-code admin test (roles are empty; the test is dead code and should not stay as a future trap).
- Effect on existing accounts: only the account whose `departmentCode` is `ADMIN` remains administrator. The seed script creates the `admin` account with `departmentCode: 'ADMIN'` (`scripts/setup-core-users.js`, lines 40–52). Whether the production account has that value is **NEEDS DASHBOARD VERIFICATION** (§7 query Q-A3-1).
- Tokens issued before the change still carry the old `role`/`dept` claims for up to 12 hours. Options: wait the 12 hours, or rotate `AUTH_SECRET` (forces re-login for all users; coordinate with shift schedule). **DECISION NEEDED.**

**A3b: department derived from the database only.**

- In `buildSessionUser`, remove the username branches and set `normalizedDept` from `departmentCode` alone, mapped through `DEPARTMENT_ACCESS` (`frontend/src/lib/auth/department-access.ts`). Role branches are removed in the same change.
- `requireUser`'s department check then uses `departmentCode` only. Remove the `sessionDepartment` fallback there, or keep it equal to `departmentCode`.
- Before this step, the data must be checked (§7 Q-A3-2): any user whose username suggests a department but whose `departmentCode` differs, or is empty, would lose access. Those records must be corrected by an administrator through the existing admin screen, not by a script, unless you approve a data change.

**Client (UI only, with A3a):** update `frontend/src/lib/rbac.ts` `isAdminUser` to match the same rule, so the admin screens are not shown to other accounts. This does not change security; it removes a misleading signal.

### 2.4 Reuse of existing authorization (VERIFIED)

- Existing helpers already implement the department model: `requireUser`, `requireDepartment`, `userBelongsToDepartment`, `departmentKeyFor`, and the `DEPARTMENT_ACCESS` map (`frontend/src/lib/auth/department-access.ts`). A3 needs no new permission system; it needs these helpers to stop reading usernames.
- The optional database admin flag (Phase 1 Q8) is a later option. It requires a migration and is **not** needed for A3a. For A3a, `departmentCode = 'ADMIN'` is the existing data model and is what the seed uses.

### 2.5 Files affected

| File | Change | Step |
|---|---|---|
| `frontend/src/lib/auth/session-user.ts` | Admin rule; then department rule | A3a, A3b |
| `frontend/src/lib/auth/require-user.ts` | `sessionDepartment` fallback (A3b only) | A3b |
| `frontend/src/lib/rbac.ts` | `isAdminUser` (client display) | A3a |
| `frontend/src/app/api/auth/login/route.ts` | No code change; token claims follow `buildSessionUser` | — |
| `frontend/src/middleware.ts` | No code change; behaviour follows claims | — |

### 2.6 Tests required

Use **real accounts that the owner designates for testing**, or owner-approved test accounts in the development branch. Do not create dummy production records (project rule).

| ID | Test | Expected |
|---|---|---|
| A3-T1 | Account `departmentCode = ADMIN`, any username | Admin: `/api/admin/*` 200, `/admin` loads |
| A3-T2 | Account username `admin`, `departmentCode = QC1` (owner can create this in the development branch only) | Not admin: `/api/admin/*` 403 |
| A3-T3 | Account username `store`, `departmentCode = DYEING` (development branch only) | Dyeing access only; Store endpoints 403 |
| A3-T4 | Account username `dyeing`, `departmentCode = DYEING` | Dyeing access (unchanged) |
| A3-T5 | Each department account in its own department | Own pages and APIs work (regression matrix §8.3) |
| A3-T6 | Token issued before the change | Middleware admin decision follows the old token until expiry; document, then confirm after expiry or rotation |
| A3-T7 | Deactivated admin | Refused on next request (existing behaviour, unchanged) |

### 2.7 Risks and rollback

| Risk | Mitigation |
|---|---|
| The real administrator account does not have `departmentCode = 'ADMIN'` | Query Q-A3-1 before the change. If it differs, the fix is a data correction approved by you, made before deploying |
| A department account depends on its username for access | Query Q-A3-2 and review by an administrator before A3b |
| Old tokens retain elevated claims for up to 12 hours | Accept, or rotate `AUTH_SECRET` (DECISION NEEDED) |
| UI shows admin menus to the wrong accounts during the change window | Deploy `rbac.ts` change with A3a |

**Rollback:** revert the commit for `session-user.ts` (and `rbac.ts`), redeploy. No database change is made by the minimal fix. If a data correction was made, it is reversed by the administrator screen.

---

## 3. A4 — Production-data reads that need only a logged-in session

### 3.1 Summary of confirmed routes

The middleware (`frontend/src/middleware.ts`) requires a valid session for `/api/*`, but does **not** check department. A route with no department check therefore lets any signed-in employee of any department read its data.

| # | Route | Handler behaviour (VERIFIED) | Cross-department? | Callers (VERIFIED) | Severity |
|---|---|---|---|---|---|
| 1 | `GET /api/challans` | Lists challans with optional `department`, `fromDepartment`, `toDepartment`, `status`, `programId` filters; **no user check at all** (line 70 onward) | **Yes** | Several pages; the floor board uses `api.getChallans` (`frontend/src/lib/api.ts`) | **High** |
| 2 | `GET /api/programs` | Lists production sheets with optional `status`, `search`; uses `getSessionUser` only to decide whether client code is visible (line 70–71) | **Yes** (all sheets) | Programming, floor board, production history, others | **High** (client-code visibility is already gated; the sheet list is not) |
| 3 | `GET /api/departments/stock?department=X` | `department` parameter selects the stock view; no check against the user | **Yes** | `frontend/src/components/DepartmentStockView.tsx`, used by Dyeing received, QC1 my-work, Fabric Store stock, WorkReceived | **High** |
| 4 | `GET /api/defective-shelves?department=X` | `department` parameter filters rejected records; no check | **Yes** | `dyeing/my-work/received`, `qc1/my-work`, `WorkReceived.tsx` (`department=${flow.code}`) | **High** |
| 5 | `GET /api/challans/auto-detect?programId&department` | Returns the parent challan and its items for any `parentChallanId`/`programId` | **Yes** | `ColorFabricMeasurementTable.tsx` (used by `my-work/issue-challan` and Fabric Store issue view) | **Medium** |
| 6 | `GET /api/floorboard/state` | Returns every production sheet with customer, design, creator name and username, fabrics and challans; no filter | **Yes** (all sheets and customers) | `api.getFloorBoard` (`frontend/src/lib/api.ts`), floor board page | **Medium to High** (depends on decision D-A4-1) |
| 7 | `GET /api/programs/[id]/photo` | Returns a base or Wilcom design photo for any program ID | **Yes** (design images) | Program pages | **Low to Medium** (decision D-A4-2) |
| 8 | `GET /api/programs/next-number` | Returns the next program number only | Low (no sheet content) | `api.getNextProgramNumber` (Programming) | **Low**: accept |
| 9 | `GET /api/defective-shelf` | **Scoped inside the handler** (§0.2) | No | — | **Not a finding** |

### 3.2 Security vulnerability

- A dyeing employee can list every challan (route 1), every production sheet (route 2), any department's stock (route 3), and any department's rejected records (route 4). That bypasses the department separation that the MES relies on.
- Route 6 returns customer and creator details for every sheet. Route 7 returns design images for any sheet.
- The assistant would be exposed to the same problem if it reused these routes, which is why Phase 1 prohibits reuse.

### 3.3 Recommended correction (smallest safe change, per route)

**Common pattern (reusing existing helpers, no new permission system):**

```
const { user, response } = await requireUser(request);        // or requireDepartment(request, KEY)
if (!user) return response;
const scope = user.isAdmin ? null : departmentCodesFor(user);  // from DEPARTMENT_ACCESS
// apply scope in the Prisma where-clause; reject a caller-supplied department outside scope with 403
```

Per route:

1. **`GET /api/challans`**
   - `requireUser` at the top.
   - Non-admin: force `where` to challans where `fromDepartment` or `toDepartment` is in the user's department codes. Caller-supplied `department`, `fromDepartment` or `toDepartment` outside that set returns 403.
   - Admin: unchanged.
   - Callers must be checked first (§8.2): pages that list all challans for a department they belong to keep working; pages that expect company-wide lists for non-admins would lose rows. **DECISION NEEDED** if any such page exists.

2. **`GET /api/programs`**
   - `requireUser`.
   - Decide whether all departments may see the production-sheet list. **DECISION D-A4-1.** If yes, keep the list company-wide but apply the client-code rule already implemented (`canViewClientCode`) to any client field returned to non-programming users. If no, scope to sheets that have work in the user's departments (`Challan.programId` or `DepartmentWorkItem.programId`).

3. **`GET /api/departments/stock`**
   - `requireUser`.
   - `department=ALL` or missing: admin or Fabric Store members only.
   - `department=X`: X must be in the user's department codes (admin passes).

4. **`GET /api/defective-shelves`**
   - `requireUser`.
   - Same pattern as route 3. `ALL` restricted to admin and Fabric Store, the same rule `defective-shelf` already applies (lines 17–24). Reusing that exact rule is the preferred approach.

5. **`GET /api/challans/auto-detect`**
   - `requireUser`.
   - Return the parent challan only if the user's departments include its `fromDepartment` or `toDepartment`, or the user is admin. Otherwise return the same response as "not found".

6. **`GET /api/floorboard/state`**
   - `requireUser`.
   - **DECISION D-A4-1 applies.** If the floor board is a company-wide shop-floor view, keep all sheets but strip customer, creator username and full name for non-admins. If not, scope like route 2.

7. **`GET /api/programs/[id]/photo`**
   - `requireUser`.
   - **DECISION D-A4-2:** are design images company-wide? If not, apply the sheet-scope rule from route 2.

8. **`GET /api/programs/next-number`**
   - Accept session-only. It exposes one number and no sheet content. Document the acceptance.

### 3.4 Reuse of existing authorization (VERIFIED)

- `requireUser`, `requireDepartment`, `userBelongsToDepartment`, `departmentKeyFor` and `DEPARTMENT_ACCESS` exist and are already used by 81 route files that enforce. A4 applies the same helpers to the eight routes above. No duplicate permission system is introduced.
- `canViewClientCode` (`frontend/src/lib/auth/require-user.ts`) already implements the client-code visibility rule for route 2.

### 3.5 Files affected

| File | Change |
|---|---|
| `frontend/src/app/api/challans/route.ts` (GET) | `requireUser` + scope |
| `frontend/src/app/api/programs/route.ts` (GET) | `requireUser` + scope or field stripping (D-A4-1) |
| `frontend/src/app/api/departments/stock/route.ts` | `requireUser` + department rule |
| `frontend/src/app/api/defective-shelves/route.ts` | `requireUser` + department rule |
| `frontend/src/app/api/challans/auto-detect/route.ts` | `requireUser` + parent scope |
| `frontend/src/app/api/floorboard/state/route.ts` | `requireUser` + D-A4-1 |
| `frontend/src/app/api/programs/[id]/photo/route.ts` | `requireUser` + D-A4-2 |
| New shared helper (optional) `frontend/src/lib/auth/scope.ts` | Scope builder used by the eight routes; avoids repeating the rule (this is the only new file) |

No page component is changed. The UI changes only if a caller is found to rely on an out-of-scope response (§8.2).

### 3.6 Tests required

For each route in §3.1, with accounts from each of the three classes (owner-designated):

| ID | Test | Expected |
|---|---|---|
| A4-T1 | Unauthenticated request | 401 |
| A4-T2 | Employee requesting own department | 200, rows only for that department |
| A4-T3 | Employee requesting another department | 403, or rows only within scope (per route) |
| A4-T4 | Employee requesting `ALL` / no department | Scoped rows, or 403 where `ALL` is store-only |
| A4-T5 | Admin | 200, all rows |
| A4-T6 | Response scan: no row from an out-of-scope department appears in the body | Pass |
| A4-T7 | Client-code fields on non-programming accounts | Not present (routes 2 and 6) |
| A4-T8 | Photo route for an out-of-scope sheet (if D-A4-2 scopes it) | 404 |

Run against the development branch. Read-only requests only.

### 3.7 Risks and rollback

| Risk | Mitigation |
|---|---|
| A page loses data because it relied on cross-department lists | Caller inventory (§8.2) and owner smoke test (§8.3) before deploy |
| Department code aliases mismatch (for example `QC3` / `QCWASHING`) | `DEPARTMENT_ACCESS` already lists the aliases; tests cover each alias |
| Performance of scoped queries | Scope is an indexed `where` on existing columns (`Challan.fromDepartment`, `toDepartment` are indexed in the schema); no change needed |
| Ambiguous business decision (D-A4-1, D-A4-2) | Do not implement until decided |

**Rollback:** revert the per-route commits. No database change.

---

## 4. A9 (new) — NestJS read endpoints reachable with any NestJS login

### 4.1 Current implementation (VERIFIED)

- NestJS login (`backend/src/modules/auth/auth.service.ts`, `login`) finds a user by `username` **or** `email` equal to the login value and checks the password with bcrypt. It returns a token signed with `JWT_SECRET`.
- Live PINs are stored as bcrypt hashes in the same `User.passwordHash` field, so any active user's PIN is a valid NestJS password (VERIFIED: the Next login also compares bcrypt against `passwordHash`).
- Station usernames are visible on the login screen (existing audit S1).
- Authorization in NestJS:
  - `JwtAuthGuard` checks the token only.
  - `RolesGuard` returns **true when no `@Roles` is declared** (`backend/src/common/guards/roles.guard.ts`).
  - `PermissionsGuard` returns **true when no `@RequirePermission` is declared** (`backend/src/common/guards/permissions.guard.ts`).
- Controllers with **no method-level role or permission decorator** (count verified by grep):

| Controller | Class guards | Method-level decorators | Result for any valid NestJS token |
|---|---|---|---|
| `analytics` | JWT, Permissions | 0 | Readable |
| `challans` | JWT, Roles | 0 | Readable (includes `GET /challans`, `GET :id`) |
| `controltower` | JWT, Permissions | 0 | Readable |
| `dashboard` | JWT only | 0 | Readable |
| `departments` | JWT only | 0 | Readable |
| `diagnostics` | JWT, Permissions | 0 | Readable |
| `floorboard` | JWT only | 0 | Readable |
| `notifications` | JWT, Permissions | 0 | Readable |
| `production` | JWT, Roles | 0 | Readable |
| `reports` | JWT, Permissions | 0 | Readable |
| `search` | JWT, Permissions | 0 | Readable |
| `finalcheck` | none | 0 | Open (A1) |

- Controllers with decorators (`masters`, `inventory`, `defects`, `bundles`, `dispatch`, `packing`, `programs`, `quality`, `audit`) require a permission or role that the emptied tables can no longer grant. Those are **denied** to everyone except a `SUPER_ADMIN` role that no longer exists (fail closed).

### 4.2 Security vulnerability

- Any employee who knows a station username (visible on the login screen) and their PIN can obtain a NestJS token and read challan, dashboard, department, floor board, production, reporting and search data across all departments — **if the Render NestJS service is live**.
- This bypasses the department model that A4 fixes in Next.js, through a different service.

### 4.3 Recommended correction

**Immediate (same change as A1): stop the NestJS data surface.** Simplest safe option: do not register the controllers the live app does not use. The frontend uses none of them (verified: no frontend call to the Nest host). Remove them from `app.module.ts` in one change, after confirming (DECISION NEEDED) that no external system uses the Nest API.

**If any NestJS controller must stay:** require a real authorization, not a token alone. Use the same `Department` model as Next.js (`DEPARTMENT_ACCESS` through a shared package, Phase 1 §4) in a NestJS guard that reads `User.departmentCode` from the database on each request. Do **not** repair `RolesGuard` or `PermissionsGuard` against the emptied tables; that would create a second permission system.

**NestJS login (`auth.service.ts`):** after the change, the login is only needed for the AI module's own bridge (Phase 1 §5.4 / OLLAMA plan §4), which verifies the Next session token rather than issuing new ones. Until then, do not expose the Nest login.

### 4.4 CORS (`backend/src/main.ts`)

- `origin: '*'` with `credentials: true` (VERIFIED). Replace with an explicit allow-list only if the Nest API must stay browser-accessible. If the browser never calls it (current state), remove the CORS call or restrict it to the production Vercel domain. **DECISION NEEDED** (E-3 in the deployment audit).

### 4.5 Files affected

| File | Change |
|---|---|
| `backend/src/app.module.ts` | Remove unused module imports (same edit as A1) — **DECISION NEEDED** on the list |
| `backend/src/main.ts` | CORS restriction or removal (optional) |
| Controller files | None (kept, unregistered) |

### 4.6 Tests required

| ID | Test | Expected |
|---|---|---|
| A9-T1 | Local build; `GET /api/challans` with a valid NestJS token | 404 (module not registered) |
| A9-T2 | Local build; `GET /api/health` | 200 |
| A9-T3 | Local build; `POST /api/auth/login` with a station username and PIN | 404 if auth module removed, otherwise unchanged; no token issued to the frontend |
| A9-T4 | CORS: browser request from an unlisted origin | Refused (if CORS retained) |

### 4.7 Risks and rollback

| Risk | Mitigation |
|---|---|
| An external integration uses the Nest API | DECISION NEEDED: owner confirms none |
| The AI module later needs a Nest entry point | Re-add that single module with its own guard (Phase 1 §5.4); do not restore the old guards |

**Rollback:** revert the `app.module.ts` and `main.ts` changes.

---

## 5. Reuse of existing authorization — summary

| Need | Existing mechanism | Used? | Action |
|---|---|---|---|
| Who is signed in | `getSessionUser` / `requireUser` (Next.js) | Yes, 81 routes enforce | Reuse |
| Department membership | `requireDepartment`, `userBelongsToDepartment`, `DEPARTMENT_ACCESS` | Yes | Reuse for A4 |
| Admin | `requireUser({ admin: true })` (Next.js) | Yes | Reuse; A3 changes only the admin rule |
| Client-code visibility | `canViewClientCode` | Yes (programs route) | Reuse for D-A4-1 |
| NestJS roles and permissions | `RolesGuard`, `PermissionsGuard`, `JwtAuthGuard` | Dead tables | **Do not repair**; remove from exposure (A1/A9) |
| New permission system | — | — | **Not created** |

---

## 6. Migration and data compatibility

| Change | Schema change? | Data change? | Compatibility risk |
|---|---|---|---|
| A1 (remove Nest Final Check) | No | No | None for the live app (verified no frontend dependency) |
| A3a (admin from `departmentCode`) | No | No (unless a correction is approved) | The real admin account must carry `departmentCode = 'ADMIN'`; verify first (Q-A3-1). Existing tokens keep old claims until expiry |
| A3b (department from `departmentCode`) | No | Possibly, if records need correction | Users whose username implies a department but whose `departmentCode` differs lose access (Q-A3-2) |
| A4 (route scoping) | No | No | Pages depending on cross-department lists lose rows; caller inventory first |
| A9 (remove unused Nest modules) | No | No | None for the live app if unused |
| Optional Phase 1 Q8 admin flag | Yes (a column or role row) | Backfill for existing admins | Only if chosen; not required for the minimal fix |

**No migration is required for the minimal fixes.** The optional admin flag would need the manual-migration convention and owner approval.

---

## 7. Read-only verification queries (owner runs; do not change data)

These are read-only. Run them yourself in the Neon SQL editor, against the production branch if you need the real answer, or a copy. Share only counts and the minimum fields you are comfortable with.

| ID | Query | Purpose |
|---|---|---|
| Q-A3-1 | `SELECT username, "departmentCode", "isActive" FROM "User" WHERE username ILIKE 'admin' OR "departmentCode" = 'ADMIN';` | Confirms the real admin account has `departmentCode = 'ADMIN'` |
| Q-A3-2 | `SELECT "departmentCode", COUNT(*) FROM "User" GROUP BY "departmentCode" ORDER BY 2 DESC;` | Shows department codes in use and empty values |
| Q-A3-3 | `SELECT username, "departmentCode" FROM "User" WHERE "departmentCode" IS NULL OR "departmentCode" NOT IN (SELECT code FROM "Department");` | Accounts with no valid department (they lose access under A3b) |
| Q-A3-4 | `SELECT username, COUNT(*) FROM "User" GROUP BY username HAVING COUNT(*) > 1;` | Duplicate usernames (count only) |
| Q-A4-1 | `SELECT COUNT(*) FROM "Challan";` and `SELECT COUNT(*) FROM "Program";` | Size of the data exposed by A4 routes 1 and 2 |
| Q-A1-1 | Render dashboard: is `subham-fabrics-api` live? Recent request count | Urgency of A1 and A9 |

---

## 8. Verification plan (applies to all three findings)

### 8.1 Test environment

- **Never test against production.** Use a local backend and frontend pointing at an approved Neon **development branch** (Q-H4 in the Ollama plan). Any test that sends a write must run there.
- Test accounts: owner-designated accounts in the development branch, one per class: administrator (`departmentCode = ADMIN`), one employee per main department, and one account whose username suggests another department (for A3-T3).
- Tests are scripts stored outside the repository (scratch folder), as in earlier phases. No test files are committed (`.gitignore`).

### 8.2 Caller inventory (required before A4)

For each route in §3.1, the list of frontend pages and components that call it, and the department each page belongs to. This plan has identified the callers above; the caller check for each page's behaviour when a result is withheld is still to do.

### 8.3 Regression checklist (owner smoke test, per department)

Each department lead confirms the following on staging or the development branch after the change:

- Programming: create or open a production sheet; next program number appears.
- Fabric Store: stock view; issue challan; defective shelf for ALL.
- Dyeing: received list; defective shelf for DYEING; dye orders.
- Dyeing QC (QC1): my-work; defective shelf for QC1; inspection.
- Embroidery, Thread Cutting, Threadcut QC, Washing, Washing QC, Recutting, Stitching, Finishing, Steam Press, Final QC: their my-work and history pages; receive and transfer.
- Inventory: stock and packing summaries.
- Admin: admin console loads; `/api/admin/*` works; a non-admin is refused.
- Floor board and production history: as decided in D-A4-1.
- Logins: each station login still works, and a fake `admin` account does not gain admin (A3-T2).

### 8.4 Acceptance criteria

1. Every test in §1.5, §2.6, §3.6 and §4.6 passes, with actual results recorded.
2. The regression checklist passes for every department.
3. No production write is performed during testing.
4. Build gates pass: `tsc` for backend and frontend, and `next build`.
5. Rollback for each change has been rehearsed in the development branch.

---

## 9. Decisions needed before implementation

| ID | Decision | Default recommendation |
|---|---|---|
| D-A1-1 | Remove the Nest Final Check module (Option 1) | Yes |
| D-A1-2 | Confirm no external system calls the Nest API | Owner to confirm |
| D-A3-1 | Accept that existing tokens keep old admin claims for up to 12 hours, or rotate `AUTH_SECRET` | Accept 12 hours unless the admin account is suspected compromised |
| D-A3-2 | Corrections for accounts whose department is unclear (after Q-A3-2) | Owner corrects through the admin screen |
| D-A4-1 | Is the production-sheet list and the floor board company-wide (all departments), or scoped? | Owner decides; default scoped to departments with work on the sheet |
| D-A4-2 | Are design photos company-wide, or scoped to the sheet's departments? | Owner decides; default scoped |
| D-A9-1 | Remove the unused NestJS controllers, or keep and guard them | Remove |
| D-A9-2 | CORS on NestJS: remove, or restrict to the production Vercel domain | Remove if no browser use |
| D-PLAN-1 | Approve the order of implementation (§10) | Yes |
| D-PLAN-2 | Approve deploying the changes to Render and Vercel (a deploy action, not part of this plan) | Owner action |

---

## 10. Recommended implementation order (after approval)

1. **Read-only verification** (§7): run Q-A3-1 to Q-A3-4, Q-A4-1, Q-A1-1. Decide D-A1-2, D-A3-2, D-A4-1, D-A4-2, D-A9-2.
2. **A1 and A9 together** (one change to `app.module.ts`, optional CORS change in `main.ts`), built and tested locally (§1.5, §4.6).
3. **A3a** (`session-user.ts` admin rule, `rbac.ts` display), tested with §2.6 tests A3-T1, A3-T2, A3-T5.
4. **Caller inventory** (§8.2).
5. **A4 route scoping**, one route per commit, in this order: `departments/stock`, `defective-shelves`, `challans/auto-detect`, `challans` GET, `programs` GET, `floorboard/state`, `programs/[id]/photo`.
6. **A3b** (department from `departmentCode`), only after Q-A3-2 is reviewed and accepted.
7. **Full regression** (§8.3), then owner approval to deploy to Render and Vercel.
8. **Deploy** (owner action) and post-deploy checks: `/api/health` on Vercel and Render, and the read-only checks in §7 again.

---

## 11. Items this plan does not cover

- Phase 1 A5 (NestJS role guards reading emptied tables): covered by A9 (the guards are not repaired; the controllers are removed from exposure).
- Phase 1 A6 and A7: middleware admin claims and two token systems. Partly covered by D-A3-1 and the AI bridge design.
- Login rate limiting and PIN policy (existing audit S1). A separate change; it affects every login.
- Logout does not revoke tokens (existing audit S3). A separate change.
- Per-method authorization census. §0.2 item 3 notes the approximation. A per-method check of the 81 enforcing route files is recommended before the AI module is built, but it is not a prerequisite for the three fixes above.

---

## 12. Change log for this document

- Created: `docs/ai-assistant/SECURITY-PREREQUISITES-REMEDIATION-PLAN.md`.
- No other file was changed.
