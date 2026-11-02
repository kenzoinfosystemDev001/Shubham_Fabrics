# 02 — API & Authentication/Authorization Audit (Stage 1, §3.3 + §3.5)

Branch audited: `fix/mes-production-readiness` (= origin/main, HEAD 349af5a). Date: 2026-11-02.
Method: static reading of source only. No source edits, no dev server, no database connections. The endpoint
inventory (Appendix A) was produced by a read-only Node script that parses every `apps/web/src/app/api/**/route.ts`,
follows calls into `apps/web/src/lib/*` one or two levels, and classifies guards, validation, transactions and writes.
Heuristic results were spot-checked by hand; where the script was wrong it is corrected and marked "manual".

## 1. Summary

| Metric | Value |
|---|---|
| `route.ts` files | **211** |
| HTTP handlers (method × path) | **265** |
| Handlers that write to the DB (incl. via lib helpers) | 112 |
| Write handlers with **no** guard at all | **0** (every write passes `requireUser`/`requireDepartment`/`guarded`) |
| Write handlers guarded only by "any signed-in user" (`requireUser()` with no dept) | 10 — all but `alerts/[id]/dismiss` and `upload` then do a per-record department check |
| Handlers with no route-level guard (middleware session check only) | **18** (5 are intentionally public) |
| Route files using zod (or `@shubham/validation`) | **0 / 211** (lib: 0) — all validation is manual |
| Route files that call `$transaction` directly | 23 (92 handlers reach a `$transaction` incl. lib helpers) |
| Handlers with an unconditional status write (update by `id` only, status checked earlier outside the write) | ≥ 44 by script + 3 verified by hand (`PATCH /challans/[id]`, `PATCH /challans/[id]/status`, `PATCH /programs/[id]/status`) |
| Handlers returning raw `error.message` to the client | 107 handlers / 55 route files |
| Handlers with ≥1 `findMany` without `take` | 90 |
| POST create handlers without any idempotency key | 19 |
| Response shapes | bare object 177, `{data}` 65, `{success:true,…}` 23; errors use `{error}` except login (`{message}`) |

Overall: authentication is sound in design (HS256 JWT, httpOnly cookie, mandatory ≥32-char secret, DB re-check of
`isActive` in `requireUser`), and the department workflow APIs are consistently guarded through `guarded()` →
`requireDepartment(cfg.key)` with keys that match their URL prefixes. The main gaps are: no login throttling with
4-character PINs, no server-side session revocation, a set of read endpoints that rely only on the middleware
signature check (so deactivated users and other departments can read everything, including client codes), generic
challan endpoints that accept any status string with no transition rules, an unguarded NestJS controller, and
pervasive leakage of raw Prisma error messages.

### Top findings

| ID | Sev | Title |
|---|---|---|
| AUTH-01 | High | No login rate limiting / lockout; minimum PIN is 4 characters |
| API-01 | High | Generic challan status endpoints accept any status, no transition rules, unconditional update |
| API-02 | High | Read endpoints without route guard expose all programs incl. `metadataJson` (client code, artwork) to any department |
| API-03 | High | NestJS `final-check` controller has 10 handlers (4 writes) with no auth guard and CORS `*` + credentials |
| AUTH-02 | Medium | Logout does not revoke the JWT; no token versioning — PIN reset / theft cannot end a session for 12 h on middleware-only routes |
| AUTH-03 | Medium | Access still derived from username heuristics and legacy role codes, not only department |
| API-04 | Medium | `DELETE /api/admin/programs/delete-all` is not gated by `ALLOW_DESTRUCTIVE_ADMIN_ACTIONS` although docs say it is |
| API-05 | Medium | Check-then-act status transitions (TOCTOU) in receive / start-inspection / decision routes |
| API-06 | Medium | Raw `error.message` (Prisma internals) returned to clients in 55 route files, incl. public `/api/health` |
| API-07 | Medium | `/api/defective-shelves` bypasses the department scoping enforced by `/api/defective-shelf` |

## 2. Authentication & session findings

### 2.1 What exists (verified)

- **Token**: HS256 JWT signed with Web Crypto; secret from `AUTH_SECRET`/`JWT_SECRET`, must be ≥32 chars, no default
  (`apps/web/src/lib/auth/session-token.ts:36-40`). Header pinned to `{alg:HS256,typ:JWT}` so `alg:none` is rejected
  (`session-token.ts:85`). Expiry checked (`:108`). TTL `AUTH_SESSION_HOURS`, default 12 h (`:13,28-31`).
- **Cookie**: `subham_mes_token` httpOnly, `SameSite=Lax`, `Secure` only when request is HTTPS (via
  `x-forwarded-proto`), `maxAge` = TTL (`require-user.ts:134-146`). Role/dept cookies are non-httpOnly display hints
  (`:144-145`) and are not trusted server-side (verified: no server code reads `ROLE_COOKIE`/`DEPT_COOKIE` for authz).
- **Middleware** (`apps/web/src/middleware.ts`): every `/api/*` except 5 public paths (`:14-20`: login, logout, health,
  cron, branding/login-background) requires a valid signature; `/api/admin/*` and `/admin` additionally require admin
  claims (`:69-74`). Client-supplied identity headers are stripped (`:26`).
- **Per-route re-check**: `requireUser` re-reads the user and roles from the DB on every call and rejects
  `isActive=false` (`require-user.ts:56-84`), so deactivation is immediate **for routes that call it**.
- **Hashing**: bcryptjs cost **10** everywhere (`admin/users/route.ts:91`, `admin/users/[id]/route.ts:109`,
  `admin/clear-all-data/route.ts:64`, `scripts/setup-core-users.js:13`). Acceptable; OWASP now suggests ≥10, 12 preferred.
- **PIN policy**: min 4 chars, blocks repeated digits and 1234/12345/123456/0000/1111 (`lib/auth/pin.ts:1-12`).
- **Default credentials**: none found in code. Old master PINs/auto-seed noted in `docs/PRODUCTION_READINESS_AUDIT.md:15`
  are gone from `auth/login/route.ts`. `setup-core-users.js:9-11` requires `CORE_USER_PIN` (≥6) and `clear-all-data`
  recreates core users with a random unusable PIN (`clear-all-data/route.ts:63-64`). No bcrypt hash literals in repo.
- **Secrets**: no `npg_…` strings, no Cloudinary keys tracked; `.env` and `apps/web/.env` exist locally but are
  git-ignored (`.gitignore:23-24`). Only `apps/api/src/modules/auth/jwt-secret.ts` (enforces ≥32-char `JWT_SECRET`).
- **Cron**: `/api/cron/deadline-alerts` accepts `Bearer $CRON_SECRET` (≥16 chars, constant-time compare) or an admin
  session (`cron/deadline-alerts/route.ts:23-33`). OK.
- **User deletion**: admin-only, cannot delete self, `admin` or `deleted-user`; reassigns FKs to a disabled placeholder
  inside a transaction (`lib/auth/delete-user.ts:27-61`). Identifiers come from `pg_constraint`/`regclass`, so the
  `$executeRawUnsafe` is not user-controlled.
- **passwordHash exposure**: none found. Admin user list uses explicit `select` (`admin/users/route.ts:17-26`), PATCH
  returns a `select` (`[id]/route.ts:116`), and no route includes a whole `User` relation (`issuedBy: true` etc. — 0 hits).

### 2.2 Findings

| ID | Sev | Evidence | Problem | Impact | Fix |
|---|---|---|---|---|---|
| AUTH-01 | **High** | `app/api/auth/login/route.ts:13-73` (no counter, no delay); `lib/auth/pin.ts:1,5`; `apps/api/src/app.module.ts:37-40` throttles only the Nest app (1000/min) | No rate limiting, lockout or backoff on `/api/auth/login`; PINs may be 4 digits (~10 000 combos minus 5 blocked) and station accounts have well-known usernames (`lib/departments.ts:15-20`: `program`, `dyeingqc`, `threadcut`…) | Online brute force of a station PIN is feasible in minutes–hours; admin account `admin` is a known target | Add per-username + per-IP attempt counter (DB table or KV) with exponential backoff / temporary lock after ~5 failures; raise minimum to 6 digits; log failed attempts to AuditLog |
| AUTH-02 | Medium | `app/api/auth/logout/route.ts:6-10` only clears cookies; `session-token.ts:82-110` has no `jti`/version; `require-user.ts:67` checks only `isActive` | Stateless JWT cannot be revoked. Logout, PIN reset (`admin/users/[id]/route.ts:104-110`) and station-device loss leave the token valid until `exp` (12 h). Routes relying only on middleware (18 handlers, §3) do not even check `isActive` | Stolen/shared-tablet token keeps working after logout/PIN change; deactivated user can still read middleware-only endpoints | Add `User.sessionVersion` (or `passwordChangedAt`) embedded in the token and compared in `getSessionUser`; bump on logout-all/PIN change/deactivate; call `requireUser` in every route |
| AUTH-03 | Medium | `lib/auth/session-user.ts:28-33` (`username === 'admin'` ⇒ admin regardless of department); `:34-254` username heuristics (`store`, `qc1`, `cutting`, `washing`, …) take precedence over `departmentCode`; `department-access.ts:103-107` and `require-user.ts:116-119` grant access by `departmentCode` **or** session dept **or** legacy role codes; `session-token.ts:119-126` admin by role `ADMIN/SUPER_ADMIN` | Commit 1f233c6 says "access by department only", but effective access = union of DB department, username-derived department and any surviving `UserRole` rows. A user named e.g. `cutting` in STITCHING gets both THREAD_CUTTING (session) and STITCHING (DB) access. A user with no department falls back to `FINISHING` (`session-user.ts:322`). Admin self-lockout guard checks only department (`admin/users/[id]/route.ts:88`) while the `admin` username is admin anyway | Privilege confusion; an admin can unintentionally grant cross-department or admin access by choosing a username; residual roles (if migration `20261102_remove_roles.sql` not applied) still grant access | Derive department solely from `departmentCode`; drop username/role branches; reject unknown department codes; treat admin as `departmentCode==='ADMIN'` only (migrate the `admin` user) |
| AUTH-04 | Medium | `admin/users/route.ts:58,94-102`; `admin/users/[id]/route.ts:80-81,101` | Department code is free text; POST upserts a new `Department` row for any code, PATCH writes any string | Typos silently create departments with no access mapping (user lands in fallback), or `ADMIN` granted by a typo-free string without confirmation | Validate against `MES_DEPARTMENTS`; never create departments from the user form; require explicit confirm for `ADMIN` |
| AUTH-05 | Low | `middleware.ts:69-74` uses token claims for `/admin` and `/api/admin/*` | Admin claim in token is stale up to 12 h after demotion (API routes re-check via `requireUser({admin:true})`, but `/admin` pages render) | Demoted admin still sees admin UI shell | Accept; fixed by AUTH-02 versioning |
| AUTH-06 | Low | `auth/login/route.ts:46-48` | bcrypt only runs when user exists → timing difference reveals valid usernames | Username enumeration (low value given known station names) | Compare against a dummy hash when user not found |
| AUTH-07 | Low | `require-user.ts:128-139` `secure` derived from `x-forwarded-proto` | On a plain-HTTP LAN deployment the session cookie is sent without `Secure` | Token sniffable on factory Wi-Fi if HTTP is used | Force HTTPS in production; set `secure: process.env.NODE_ENV==='production'` |
| AUTH-08 | Low | `scripts/setup-core-users.js:9-13` | One `CORE_USER_PIN` is applied to every station account it creates; station accounts are shared logins | Knowing one station's PIN gives all stations; actions are attributed to a station, not a person | Generate per-account random PINs and print them once; plan for personal accounts or a per-shift operator selection |
| AUTH-09 | Info | No route/page for password recovery or self-service PIN change (grep: none) | Recovery is admin-only via `PATCH /api/admin/users/[id]` | Acceptable for a factory; document the procedure | — |
| AUTH-10 | Low | `cron/deadline-alerts/route.ts:44` (GET runs reconcile), `dyeing/*` GET handlers run `syncInboundChallansToDyeingOrders` (writes) | State-changing GETs; with `SameSite=Lax` a top-level cross-site GET navigation carries the cookie | Low-impact CSRF (triggering syncs/recon) | Make writes POST-only; keep GET side-effect free |
| AUTH-11 | Low | `app/login/page.tsx:108-114` | `next` redirect check allows any path starting with `/` but not `//`; `/\host` variants rely on `checkRouteAccess` rejecting them | Possible open redirect edge case | Parse with `new URL(next, location.origin)` and require same origin |
| NEST-01 | **High** (if `apps/api` is deployed) | `apps/api/src/main.ts:22-26` `origin:'*', credentials:true`; `modules/floorboard/floorboard.gateway.ts:13-15` `origin:'*'`; `modules/finalcheck/finalcheck.controller.ts:11-60` no `@UseGuards` on 10 handlers incl. `POST challans/:id/receive`, `jobs/:id/inspect`, `jobs/:id/hold`, `issue-challan` | Unauthenticated writes; wildcard CORS; Swagger exposed at `/api/docs` (`main.ts:44`). Role-only guards elsewhere now unreachable since roles were deleted (commit 1f233c6 note) | Anyone reaching port 3001 can change Final Check state | Confirm whether `apps/api` is deployed (web uses its own `/api`, `lib/api.ts:4`). If yes: add `JwtAuthGuard` globally, restrict CORS origins, disable Swagger in prod. If no: remove it from deploy targets |

## 3. API findings

| ID | Sev | Endpoint | Evidence (file:line) | Problem | Impact | Fix |
|---|---|---|---|---|---|---|
| API-01 | **High** | `PATCH /api/challans/[id]/status`, `PATCH /api/challans/[id]` (duplicates) | `challans/[id]/status/route.ts:26-36,51,68-69,84,127-130,139-146`; `challans/[id]/route.ts:246,259-261,272,314` | `status` taken verbatim from body (column is free `String`, schema `Challan.status`); no allowed-transition table; either sender or receiver may set any non-RECEIVED status (`department-access.ts:127-134`); update `where:{id}` only; numeric fields `Number(x)` without NaN checks. Status change triggers `syncChallanStock` (returns/re-issues stock) | Sender can CANCEL/COMPLETE a challan already received or under inspection, reversing stock; arbitrary status strings break downstream filters; two concurrent calls both apply | Single endpoint with explicit state machine (`ISSUED→IN_TRANSIT→RECEIVED→…`), `updateMany({where:{id,status:from}})` + count check, zod body schema, reject unknown statuses |
| API-02 | **High** | `GET /api/floorboard/state`, `GET /api/challans/[id]`, `GET /api/challans/auto-detect` | `floorboard/state/route.ts:6-17` (no guard, `include:{customer:true, fabrics:true, challans:true}`, full Program incl. `metadataJson`, no `take`); `challans/[id]/route.ts:18-27,78` (`program:true` returned raw); `challans/auto-detect/route.ts:79`; Program has `metadataJson`, `baseDesignPhoto`, `wilcomDesignPhoto` (`schema.prisma:437-463`) and `clientCode` lives in `metadataJson` (`programs/production-sheet/route.ts:283`) | The client-code redaction done in `programs/route.ts:69-117` and `production-sheet/route.ts:564-583` (`canViewClientCode`) is bypassed by these endpoints; any signed-in station (even deactivated, middleware-only) gets every program with client codes, customers and base64 artwork | Confidential client identity leaked to all departments; very large payloads | Add `requireUser` + department scoping; replace `program:true` with an explicit `select` excluding `metadataJson`/photos; apply `canViewClientCode` centrally; paginate floorboard |
| API-03 | Medium | 18 handlers without route-level guard | Appendix A rows with guard `none`: `GET /challans`, `/challans/[id]`, `/challans/auto-detect`, `/defective-shelves`, `/departments/stock`, `/floorboard/state`, `/programs/next-number`, `/programs/production-sheet` (GET), `/programs/[id]/photo`, `/department-nav/background`, `/download-app`, branding ×4, auth ×2, `/health`; plus `GET /programs`, `GET /programs/[id]` use `getSessionUser` only for redaction, not gating (`programs/route.ts:70`, `programs/[id]/route.ts:59`) | Protected only by middleware signature check → no `isActive` re-check, no department scoping | Deactivated users keep read access for token lifetime; every department reads every challan/program | Call `requireUser` (or `requireDepartment`) in every non-public handler; add a lint rule/test that fails when a route lacks a guard |
| API-04 | Medium | `DELETE /api/admin/programs/delete-all` | `admin/programs/delete-all/route.ts:21-27` (only `confirm` phrase); doc claims gate at `lib/auth/require-user.ts:164-167` and `admin/challans/delete-all/route.ts:13-14` | Not behind `ALLOW_DESTRUCTIVE_ADMIN_ACTIONS` (only `clear-all-data` is, `clear-all-data/route.ts:12-13`). `challans/delete-all` intentionally isn't either | One admin click (or stolen admin token) wipes all production sheets and challan links in production | Apply `destructiveAdminActionsDisabled()` to both delete-all routes; write an AuditLog entry before deleting |
| API-05 | Medium | Receive / start-inspection / issue / decision routes | e.g. `qc1/challans/[id]/receive/route.ts:19,39,53-58` (status read at :39, then `tx.challan.update({where:{id}})`); `qc1/challans/[id]/start-inspection/route.ts:51-54`; `fabric-store/grn/[id]/confirm/route.ts:33,41-43`; `programs/[id]/status/route.ts:16-21`; full list = Appendix A rows with `uncond ≥1` (≥44) | Status precondition is checked before/outside the write; update is by `id` only. (The newer work-item code does it right: `work-items-server.ts:440-445` `updateMany({where:{id,updatedAt}})` + count check.) | Double receipt / double inspection / double ledger postings under concurrent clicks or retries | Use `updateMany({ where:{ id, status: expected } })` and require `count===1`, inside the same transaction as side effects |
| API-06 | Medium | 55 route files / 107 handlers | e.g. `floorboard/state/route.ts:35`, `fabric-store/grn/[id]/confirm/route.ts:48`, `admin/users/route.ts:44,130`, `dyeing/sync/route.ts:18`, `health/route.ts:26` (public) | `{error: error.message}` returns Prisma messages (table/column names, constraint names, query fragments). A proper helper exists (`lib/api-errors.ts:45-53`) but is not used everywhere | Information disclosure; inconsistent UX | Replace with `apiErrorResponse`/`errorResponse` everywhere; never echo raw messages |
| API-07 | Medium | `GET /api/defective-shelves` vs `GET /api/defective-shelf` | `defective-shelves/route.ts:55-84` (no guard; `department=ALL` default returns every department) vs `defective-shelf/route.ts:12-20` (requires STORE for ALL, own dept otherwise) | Duplicate endpoint without the scoping rule | Any department sees all defect/rejection data | Remove `defective-shelves` or apply the same rule |
| API-08 | Medium | Validation | 0 route files import zod/`@shubham/validation`; manual checks only. Examples of missing checks: `programs/[id]/status/route.ts:16-20` (any status), `challans/[id]/status/route.ts:84,99,113` (`Number()` → NaN) | Malformed input reaches Prisma; arbitrary statuses persisted (String columns) | Data corruption; 500s with leaked messages | Introduce zod schemas per endpoint (package `@shubham/validation` already exists for Nest) |
| API-09 | Medium | Unbounded reads | 90 handlers have a `findMany` without `take`; e.g. `challans/route.ts:92` (all challans with includes), `floorboard/state/route.ts:8`, `fabric-store/rolls/route.ts:28`, `fabric-store/ledger/route.ts:33`, `lib/work-items-server.ts:323` (`syncWorkItems` on every list call) | Response size and DB load grow with history | Slow pages, timeouts on Vercel (`maxDuration`), memory | Cursor/page pagination with max `take`; date windows on history |
| API-10 | Medium | Sync-on-read / N+1 | `lib/work-items-server.ts:339-351` (per challan: `findFirst` max number + transaction with per-line `create`); `lib/dyeing-sync.ts:56-73` (same) run inside GET list/dashboard handlers (`dyeing/challans|dashboard|floor-board|orders` GET perform creates); 36 loops with awaited queries found across `app/api` + `lib` (e.g. `qc1/challans/[id]/inspect/route.ts:303-386`, `recutting-server.ts:170-188`) | Writes and sequential queries on GET paths; number generation by "max + 1" with retry | Latency; race-driven retries; GET has side effects (AUTH-10) | Create work items when the challan is issued (write path) inside its transaction; batch with `createMany`; use DB sequences for numbers |
| API-11 | Medium | `GET /api/programs/next-number` | `programs/next-number/route.ts:10-14` (`count + 1`), no guard | Number from `count()` repeats after deletions and races between users; on error returns `PRG-YYYY-00001` (`:17`) | Duplicate program numbers proposed | Use a DB sequence / the challan-number reservation pattern |
| API-12 | Low | Idempotency | 19 POST creators lack any idempotency key (list in §3.1); key is optional where it exists (`challans/route.ts:214-216`) | Network retries on tablets create duplicates (GRN, issue, return, QC decisions, shrinkage) | Duplicate stock movements | Require `Idempotency-Key` on all creates; reuse `idempotencyRecord` |
| API-13 | Low | Response format | 177 bare / 65 `{data}` / 23 `{success}`; login uses `{message}` (`auth/login/route.ts:21,51`) while all others use `{error}` | Client code must special-case shapes | Bugs in error handling | Standardise `{data}` / `{error:{code,message}}` |
| API-14 | Low | Duplicate endpoints | `PATCH /challans/[id]` ≡ `PATCH /challans/[id]/status`; `defective-shelf` vs `defective-shelves`; `garment-images`, `finishing/garment-images`, `inventory/garment-images`; `branding/*` (public read) vs `admin/branding/*` (write). No `/api/qc3` exists — QC3 is served only by `/api/qcwashing` with `WORKFLOWS.QC3` (consistent) | Divergent rules between twins (see API-07) | Inconsistent authz | Consolidate |
| API-15 | Low | `POST /api/upload` | `upload/route.ts:32-36` `requireUser()` any user; 10 MB images to Cloudinary or returned as data URL | Any station can fill Cloudinary storage | Cost/abuse | Restrict folders per department, add quota |
| API-16 | Low | `GET /api/health` (public) | `health/route.ts:10-18,26` | Returns `programCount` and raw error message without auth | Minor business-volume and infra disclosure | Return only `ok/degraded` publicly |

**Checked and found OK**
- Department guards match their folders: every department workflow route uses `WORKFLOWS.<KEY>` matching the
  path (`qcwashing`→`QC3`, `final-check`→`FINAL_CHECK`, etc.) and `guarded()` → `requireDepartment(cfg.key)`
  (`lib/work-items-server.ts:415-423`); `inventory-server.ts:24` and `recutting-server.ts:43` likewise.
- Actor never taken from the request body: 0 hits for `body.(actorId|userId|issuedById|receivedById|inspectorId|…)`;
  actors come from `authUser.id` (e.g. `challans/[id]/status/route.ts:72`).
- `requireUser`-only writes do per-record authorization: `challans/route.ts:276`, `challans/[id]/route.ts:246,252`,
  `challan-edit-server.ts:29`, `holds-server.ts:537,586,784`, `fabric-photos-server.ts:140`.
- All `/api/admin/*` handlers call `requireUser({admin:true})` in addition to middleware (16 handlers).
- `getPackingActor` / `getFinalCheckActor` do not exist in the current code (0 hits); packing and final check use `guarded()`.

Note: the script flags `GET /alerts` as writing (`delete`), but that is an in-memory `Map.delete` (`alerts/route.ts:22`), not a DB write.

### 3.1 POST create handlers without idempotency (script, verified by grep for `idempoten`)
`/admin/clear-all-data`, `/admin/users`, `/fabric-photos`, `/fabric-store/batches`, `/fabric-store/grn`,
`/fabric-store/issue`, `/fabric-store/locations`, `/fabric-store/qc`, `/fabric-store/return`,
`/final-check/items/[id]/decision`, `/finishing/garment-images`, `/programs/production-sheet`,
`/qc1/challans/[id]/decision`, `/qc1/challans/[id]/inspect`, `/qc1/challans/[id]/receive`,
`/qc1/challans/[id]/start-inspection`, `/qc2/items/[id]/decision`, `/qcwashing/items/[id]/decision`, `/shrinkage`.

## Appendix A — Endpoint inventory (265 handlers)

Legend: **Middleware** `session` = valid JWT signature required by `middleware.ts`; `session+admin` = admin claim
also required; `PUBLIC` = in `PUBLIC_API_PATHS`. **Route guard** = guard reached from the handler (directly or via a
lib helper): `guarded` = `requireDepartment(cfg.key)` for that workflow; `none` = middleware only. **Validation**:
`manual` = hand-written checks found; `none` = body read with no checks found; `-` = no body. **Status updates**:
count of status writes conditioned on current status/version in `where` vs. by `id` only (heuristic, literal `data:{status}`
only — variable `data` objects are not detected; three such cases corrected manually). **findMany w/o take**: count in
handler + helpers (heuristic). **Delegates to**: first lib helpers followed.

| # | Method | Path (/api…) | Middleware | Route guard | Validation | $tx | Writes | Status updates (cond/uncond) | findMany w/o take | Raw error.message | Delegates to |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DELETE | /admin/challans/delete-all | session+admin | requireUser(admin) | manual | Y | create,deleteMany,updateMany | - | - | Y |  |
| 2 | POST | /admin/clear-all-data | session+admin | requireUser(admin) | - | Y | create,deleteMany,update,updateMany,upsert | - | - | Y | destructiveAdminActionsDisabled@lib/auth/require-user.ts |
| 3 | GET | /admin/fabrics | session+admin | requireUser(admin) | - | N | - | - | 1 | Y |  |
| 4 | POST | /admin/fabrics | session+admin | requireUser(admin) | manual | N | upsert | - | - | Y |  |
| 5 | DELETE | /admin/programs/delete-all | session+admin | requireUser(admin) | manual | Y | create,deleteMany,updateMany | cond 0/uncond 1 | - | Y |  |
| 6 | GET | /admin/quality-monitor/record | session+admin | requireUser(admin) | - | N | - | - | 6 | Y | monitorRecordDetail@lib/quality-monitor-server.ts, apiErrorResponse@lib/api-errors.ts |
| 7 | GET | /admin/quality-monitor | session+admin | requireUser(admin) | - | N | - | - | 8 | N | loadMonitorRecords@lib/quality-monitor-server.ts, filterRecords@lib/quality-monitor-server.ts, summarize@lib/quality-monitor-server.ts |
| 8 | GET | /admin/stocks | session+admin | requireUser(admin) | - | N | - | - | - | Y |  |
| 9 | GET | /admin/suppliers | session+admin | requireUser(admin) | - | N | - | - | 1 | Y |  |
| 10 | POST | /admin/suppliers | session+admin | requireUser(admin) | manual | N | upsert | - | - | Y |  |
| 11 | PATCH | /admin/users/[id] | session+admin | requireUser(admin) | manual | N | update | - | - | Y | validatePin@lib/auth/pin.ts |
| 12 | DELETE | /admin/users/[id] | session+admin | requireUser(admin) | - | N | - | - | - | Y | deleteUserPermanently@lib/auth/delete-user.ts |
| 13 | GET | /admin/users | session+admin | requireUser(admin) | - | N | - | - | 1 | Y |  |
| 14 | POST | /admin/users | session+admin | requireUser(admin) | manual | N | create,upsert | - | - | Y | validatePin@lib/auth/pin.ts |
| 15 | POST | /alerts/[id]/dismiss | session | requireUser | - | Y | create | - | - | N | dismissAlertForUser@lib/deadline-alerts/engine.ts |
| 16 | GET | /alerts | session | requireDepartment[...config.recipients] | - | N | delete | - | - | N | alertConfigFor@lib/deadline-alerts/config.ts, listAlertsForUser@lib/deadline-alerts/engine.ts, apiErrorResponse@lib/api-errors.ts |
| 17 | POST | /auth/login | PUBLIC | none | manual | N | - | - | - | N | isStationUsername@lib/departments.ts, buildSessionUser@lib/auth/session-user.ts, signSessionToken@lib/auth/session-token.ts |
| 18 | POST | /auth/logout | PUBLIC | none | - | N | - | - | - | N | clearSessionCookies@lib/auth/require-user.ts |
| 19 | GET | /auth/me | session | requireUser | - | N | - | - | - | N | buildSessionUser@lib/auth/session-user.ts |
| 20 | GET | /branding/app-background/config | session | none | - | N | - | - | - | N | readBooleanSetting@lib/branding-server.ts, activeBrandingVersion@lib/branding-server.ts |
| 21 | GET | /branding/app-background | session | none | - | N | - | - | - | N | serveBrandingImage@lib/branding-server.ts |
| 22 | GET | /branding/login-background | PUBLIC | none | - | N | - | - | - | N | serveBrandingImage@lib/branding-server.ts |
| 23 | GET | /branding/sidebar-image | session | none | - | N | - | - | - | N | serveBrandingImage@lib/branding-server.ts |
| 24 | GET | /challans/[id]/documents | session | requireUser | - | N | - | - | - | Y | userBelongsToDepartment@lib/auth/department-access.ts, shapeProgramSheet@lib/program-sheet.ts |
| 25 | POST | /challans/[id]/edit | session | requireUser | none | Y | create,update,updateMany | cond 2/uncond 2 | 10 | Y | editChallan@lib/challan-edit-server.ts, fabricStockErrorBody@lib/fabric-stock-ledger.ts, challanNumberErrorResponse@lib/challan-number-server.ts |
| 26 | GET | /challans/[id] | session | none | - | N | - | - | - | Y |  |
| 27 | PATCH | /challans/[id] | session | requireUser | manual | Y | create,update | uncond (manual: updateData.status from body, update by id) | 1 | Y | workflowReceiving@lib/work-items-server.ts, canUpdateChallan@lib/auth/department-access.ts, unitOf@lib/challan-units.mjs |
| 28 | DELETE | /challans/[id] | session | requireUser(admin) | - | Y | create,delete,deleteMany,updateMany | - | 3 | Y | syncChallanStock@lib/fabric-stock-ledger.ts |
| 29 | PATCH | /challans/[id]/status | session | requireUser | manual | Y | create,update | uncond (manual: data.status from body, update by id) | 1 | Y | canUpdateChallan@lib/auth/department-access.ts, workflowReceiving@lib/work-items-server.ts, challanTotalsByUnit@lib/challan-units.mjs |
| 30 | GET | /challans/auto-detect | session | none | - | N | - | - | - | Y |  |
| 31 | GET | /challans/issued/[id] | session | requireUser | - | N | - | - | 7 | Y | issuedChallanDetail@lib/issued-challans-server.ts, apiErrorResponse@lib/api-errors.ts |
| 32 | GET | /challans/issued | session | requireUser | - | N | - | - | 7 | Y | issuingDepartmentFor@lib/issued-challans-server.ts, issuedCount@lib/issued-challans-server.ts, listIssuedChallans@lib/issued-challans-server.ts |
| 33 | GET | /challans | session | none | - | N | - | - | 1 | Y |  |
| 34 | POST | /challans | session | requireUser | manual | Y | create,updateMany,upsert | cond 0/uncond 3 | 3 | Y | requireChallanNumber@lib/challan-number-server.ts, workflowIssuing@lib/work-items-server.ts, userBelongsToDepartment@lib/auth/department-access.ts |
| 35 | GET | /cron/deadline-alerts | PUBLIC | getSessionUser | - | N | - | - | - | Y | reconcileAllDepartments@lib/deadline-alerts/engine.ts |
| 36 | POST | /cron/deadline-alerts | PUBLIC | getSessionUser | - | N | - | - | - | Y | reconcileAllDepartments@lib/deadline-alerts/engine.ts |
| 37 | GET | /defective-shelf | session | requireUser | - | N | - | - | - | Y | userBelongsToDepartment@lib/auth/department-access.ts, departmentKeyFor@lib/auth/department-access.ts, loadRejectRecords@lib/quality-monitor-server.ts |
| 38 | GET | /defective-shelves | session | none | - | N | - | - | 2 | Y | addTotals@lib/challan-units.mjs, unitOf@lib/challan-units.mjs, totalsByUnit@lib/challan-units.mjs |
| 39 | GET | /department-nav/background | session | none | - | N | - | - | - | Y |  |
| 40 | GET | /departments/stock | session | none | - | N | - | - | 1 | Y | addTotals@lib/challan-units.mjs, unitOf@lib/challan-units.mjs, challanTotalsByUnit@lib/challan-units.mjs |
| 41 | GET | /download-app | session | none | - | N | - | - | - | N |  |
| 42 | POST | /dyeing/challans/[id]/receive | session | requireDepartment['DYEING'] | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | Y | secondReceipt@lib/work-items-server.ts, dyeingErrorResponse@lib/dyeing-server.ts |
| 43 | GET | /dyeing/challans | session | requireDepartment['DYEING'] | - | Y | create,updateMany | cond 0/uncond 2 | 2 | Y | syncInboundChallansToDyeingOrders@lib/dyeing-sync.ts, dyeingErrorResponse@lib/dyeing-server.ts |
| 44 | GET | /dyeing/dashboard | session | requireDepartment['DYEING'] | - | Y | create,updateMany | cond 0/uncond 2 | 3 | Y | syncInboundChallansToDyeingOrders@lib/dyeing-sync.ts, availableForQc@lib/dyeing-workflow.mjs, receivedBasis@lib/dyeing-workflow.mjs |
| 45 | GET | /dyeing/floor-board | session | requireDepartment['DYEING'] | - | Y | create,updateMany | cond 0/uncond 2 | 3 | Y | syncInboundChallansToDyeingOrders@lib/dyeing-sync.ts, stageOf@lib/dyeing-workflow.mjs, receivedBasis@lib/dyeing-workflow.mjs |
| 46 | GET | /dyeing/history | session | requireDepartment['DYEING'] | - | N | - | - | - | Y | dyeingErrorResponse@lib/dyeing-server.ts |
| 47 | POST | /dyeing/orders/[id]/issue-qc1-challan | session | requireDepartment['DYEING'] | manual | Y | create,updateMany | cond 0/uncond 2 | 4 | Y | issueDyeingQcChallan@lib/dyeing-qc-issue.ts |
| 48 | GET | /dyeing/orders/[id] | session | requireDepartment['DYEING'] | - | N | - | - | - | Y | dyeingErrorResponse@lib/dyeing-server.ts |
| 49 | PATCH | /dyeing/orders/[id] | session | requireDepartment['DYEING'] | manual | Y | create,updateMany | - | - | Y | validateProcessUpdate@lib/dyeing-workflow.mjs, parseOptionalDate@lib/dyeing-server.ts, receivedBasis@lib/dyeing-workflow.mjs |
| 50 | GET | /dyeing/orders | session | requireDepartment['DYEING'] | - | Y | create,updateMany | cond 0/uncond 2 | 2 | Y | syncInboundChallansToDyeingOrders@lib/dyeing-sync.ts, stageOf@lib/dyeing-workflow.mjs, availableForQc@lib/dyeing-workflow.mjs |
| 51 | GET | /dyeing/qc-challans | session | requireDepartment['DYEING'] | - | N | - | - | - | Y | dyeingErrorResponse@lib/dyeing-server.ts |
| 52 | POST | /dyeing/qc-challans | session | requireDepartment['DYEING'] | manual | Y | create,updateMany | cond 0/uncond 2 | 4 | Y | issueDyeingQcChallan@lib/dyeing-qc-issue.ts |
| 53 | GET | /dyeing/sync | session | requireDepartment['DYEING'] | - | Y | create,updateMany | cond 0/uncond 2 | 2 | Y | syncInboundChallansToDyeingOrders@lib/dyeing-sync.ts |
| 54 | POST | /dyeing/sync | session | requireDepartment['DYEING'] (POST calls GET) | - | N | - | - | - | N |  |
| 55 | POST | /embroidery/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 56 | GET | /embroidery/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 57 | GET | /embroidery/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 58 | GET | /embroidery/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 59 | GET | /embroidery/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 60 | PATCH | /embroidery/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 61 | GET | /embroidery/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 62 | PATCH | /embroidery/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 63 | GET | /embroidery/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 64 | GET | /embroidery/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 65 | POST | /embroidery/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 66 | GET | /fabric-photos/[id] | session | requireUser | - | N | rawExec | - | - | Y | serveFabricPhoto@lib/fabric-photos-server.ts |
| 67 | GET | /fabric-photos | session | requireUser | - | N | rawExec | - | - | Y | listFabricPhotos@lib/fabric-photos-server.ts |
| 68 | POST | /fabric-photos | session | requireUser | manual | N | create,rawExec,update | - | - | Y | uploadFabricPhoto@lib/fabric-photos-server.ts |
| 69 | GET | /fabric-store/batches/[id] | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 70 | PATCH | /fabric-store/batches/[id] | session | requireDepartment['STORE'] | none | N | update | - | - | Y |  |
| 71 | GET | /fabric-store/batches | session | requireDepartment['STORE'] | - | N | - | - | 1 | Y |  |
| 72 | POST | /fabric-store/batches | session | requireDepartment['STORE'] | manual | N | create | - | - | Y |  |
| 73 | GET | /fabric-store/check-availability | session | requireDepartment['STORE','PROGRAMMING'] | - | N | - | - | - | Y | checkFabricStoreAvailability@lib/fabric-availability.ts |
| 74 | POST | /fabric-store/check-availability | session | requireDepartment['STORE'] | manual | N | - | - | - | Y | updateFabricStoreAvailability@lib/fabric-availability.ts |
| 75 | GET | /fabric-store/dashboard | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 76 | PATCH | /fabric-store/grn/[id]/confirm | session | requireDepartment['STORE'] | - | N | update | cond 0/uncond 1 | - | Y |  |
| 77 | GET | /fabric-store/grn/[id] | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 78 | GET | /fabric-store/grn | session | requireDepartment['STORE'] | - | N | - | - | 1 | Y |  |
| 79 | POST | /fabric-store/grn | session | requireDepartment['STORE'] | manual | Y | create,update | cond 0/uncond 1 | - | Y |  |
| 80 | PATCH | /fabric-store/inward/[id] | session | requireDepartment['STORE'] | manual | Y | create,update | - | 1 | Y | inwardLineDetails@lib/stock-import-rules.mjs, syncInwardStock@lib/fabric-stock-ledger.ts, fabricStockErrorBody@lib/fabric-stock-ledger.ts |
| 81 | DELETE | /fabric-store/inward/[id] | session | requireDepartment['STORE'] | - | Y | create,delete | - | 1 | Y | syncInwardStock@lib/fabric-stock-ledger.ts, fabricStockErrorBody@lib/fabric-stock-ledger.ts |
| 82 | GET | /fabric-store/inward/export | session | requireDepartment['STORE'] | - | N | - | - | 1 | N | apiErrorResponse@lib/api-errors.ts |
| 83 | POST | /fabric-store/inward/import | session | requireDepartment['STORE'] | manual | Y | createMany | - | 1 | Y | safeFileName@lib/stock-import-rules.mjs, sniffImportFile@lib/stock-import-rules.mjs, readExcel@lib/stock-import-server.ts |
| 84 | GET | /fabric-store/inward | session | requireDepartment['STORE'] | - | N | - | - | 1 | Y | apiErrorResponse@lib/api-errors.ts |
| 85 | POST | /fabric-store/inward | session | requireDepartment['STORE'] | manual | Y | create | - | 1 | Y | normalizeStockUnit@lib/fabric-stock-rules.mjs, inwardLineDetails@lib/stock-import-rules.mjs, syncInwardStock@lib/fabric-stock-ledger.ts |
| 86 | GET | /fabric-store/issue | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 87 | POST | /fabric-store/issue | session | requireDepartment['STORE'] | manual | Y | create,update | cond 0/uncond 2 | 2 | Y |  |
| 88 | GET | /fabric-store/ledger | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 89 | PATCH | /fabric-store/locations/[id] | session | requireDepartment['STORE'] | manual | N | update | - | - | Y |  |
| 90 | DELETE | /fabric-store/locations/[id] | session | requireDepartment['STORE'] | - | N | update | - | - | Y |  |
| 91 | GET | /fabric-store/locations | session | requireDepartment['STORE'] | - | N | - | - | 1 | Y |  |
| 92 | POST | /fabric-store/locations | session | requireDepartment['STORE'] | manual | N | create | - | - | Y |  |
| 93 | GET | /fabric-store/outward | session | requireDepartment['STORE'] | - | N | - | - | 3 | Y | cleanFabricName@lib/fabric-stock-rules.mjs, normalizeFabricStockType@lib/fabric-stock-rules.mjs, getChallanItemFabricType@lib/fabric-stock-rules.mjs |
| 94 | POST | /fabric-store/outward | session | requireDepartment['STORE'] | manual | Y | create | - | 1 | Y | canWriteColumns@lib/challan-item-average.ts, syncManualOutwardStock@lib/fabric-stock-ledger.ts, fabricStockErrorBody@lib/fabric-stock-ledger.ts |
| 95 | GET | /fabric-store/qc | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 96 | POST | /fabric-store/qc | session | requireDepartment['STORE'] | manual | Y | create,update | cond 0/uncond 1 | - | Y |  |
| 97 | GET | /fabric-store/return | session | requireDepartment['STORE'] | - | N | - | - | 1 | Y |  |
| 98 | POST | /fabric-store/return | session | requireDepartment['STORE'] | manual | Y | create,update | cond 0/uncond 2 | 2 | Y |  |
| 99 | GET | /fabric-store/rolls/[id] | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 100 | PATCH | /fabric-store/rolls/[id] | session | requireDepartment['STORE'] | none | Y | create,update | - | - | Y |  |
| 101 | GET | /fabric-store/rolls | session | requireDepartment['STORE'] | - | N | - | - | - | Y |  |
| 102 | GET | /fabric-store/total-stock | session | requireDepartment['STORE','PROGRAMMING'] | - | N | - | - | 2 | Y | loadStockBook@lib/fabric-stock-ledger.ts, unitOf@lib/challan-units.mjs, addTotals@lib/challan-units.mjs |
| 103 | DELETE | /fabric-store/total-stock | session | requireDepartment['STORE'] | - | Y | create,deleteMany | - | - | Y | removeStockBucket@lib/fabric-stock-ledger.ts, fabricStockErrorBody@lib/fabric-stock-ledger.ts |
| 104 | POST | /final-check/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 105 | GET | /final-check/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 106 | GET | /final-check/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 107 | GET | /final-check/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 108 | GET | /final-check/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 109 | PATCH | /final-check/inspections/[id] | session | guarded | manual | Y | create,update,updateMany | - | - | N | h.editInspection@lib/work-items-server.ts |
| 110 | GET | /final-check/items/[id]/decision | session | guarded | - | N | - | - | 2 | N | decisionHistory@lib/qc-decision-server.ts |
| 111 | POST | /final-check/items/[id]/decision | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 3 | 2 | N | changeDecision@lib/qc-decision-server.ts |
| 112 | PATCH | /final-check/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 113 | POST | /final-check/items/[id]/inspections | session | guarded | manual | Y | create,createMany,updateMany | - | - | N | h.inspectItem@lib/work-items-server.ts |
| 114 | GET | /final-check/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 115 | PATCH | /final-check/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 116 | GET | /final-check/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 117 | GET | /final-check/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 118 | POST | /final-check/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 119 | POST | /finishing/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 120 | GET | /finishing/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 121 | GET | /finishing/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 122 | GET | /finishing/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 123 | POST | /finishing/garment-images | session | requireDepartment['FINISHING'] | - | Y | create,upsert | - | - | Y | uploadFinishingGarmentImage@lib/garment-images-server.ts |
| 124 | GET | /finishing/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 125 | PATCH | /finishing/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 126 | GET | /finishing/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 127 | PATCH | /finishing/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 128 | GET | /finishing/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 129 | GET | /finishing/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 130 | POST | /finishing/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 131 | GET | /floorboard/state | session | none | - | N | - | - | 1 | Y |  |
| 132 | GET | /garment-images/[id] | session | requireUser | - | N | - | - | - | N | serveGarmentImage@lib/garment-images-server.ts |
| 133 | GET | /garment-images | session | requireUser | - | N | - | - | 2 | N | listGarmentImages@lib/garment-images-server.ts |
| 134 | GET | /health | PUBLIC | none | - | N | - | - | - | N | checkDatabaseSchema@lib/schema-check.ts, describeDatabaseError@lib/api-errors.ts |
| 135 | POST | /holds/[id]/release | session | requireUser | none | Y | create,update,updateMany | - | - | Y | releaseHold@lib/holds-server.ts, errorResponse@lib/work-items-server.ts |
| 136 | GET | /holds/[id] | session | requireUser | - | N | - | - | 4 | Y | holdDetail@lib/holds-server.ts, errorResponse@lib/work-items-server.ts |
| 137 | GET | /holds/candidates | session | requireUser | - | N | - | - | 2 | Y | holdDepartmentsFor@lib/holds-server.ts, holdCandidates@lib/holds-server.ts, errorResponse@lib/work-items-server.ts |
| 138 | GET | /holds | session | requireUser | - | N | - | - | - | Y | holdDepartmentsFor@lib/holds-server.ts, listHolds@lib/holds-server.ts, departmentName@lib/workflow-views.ts |
| 139 | POST | /holds | session | requireUser | manual | Y | create,update | cond 0/uncond 1 | - | Y | holdDepartmentsFor@lib/holds-server.ts, placeHold@lib/holds-server.ts, errorResponse@lib/work-items-server.ts |
| 140 | GET | /holds/source | session | requireUser | - | N | - | - | 2 | Y | holdDepartmentsFor@lib/holds-server.ts, holdsOfSource@lib/holds-server.ts, errorResponse@lib/work-items-server.ts |
| 141 | POST | /inventory/challans/[id]/receive | session | guarded[INVENTORY] (via workflowHandlers, manual check) | - | N | - | - | - | N | receiveChallan@lib/inventory-server.ts |
| 142 | GET | /inventory/challans | session | guarded[INVENTORY] (via workflowHandlers, manual check) | - | N | - | - | - | N | listIncoming@lib/inventory-server.ts |
| 143 | GET | /inventory/dashboard | session | guarded | - | Y | create | - | 4 | N | dashboard@lib/inventory-server.ts |
| 144 | GET | /inventory/garment-images/[id] | session | requireUser | - | N | - | - | - | N | serveGarmentImage@lib/garment-images-server.ts |
| 145 | POST | /inventory/garment-images | session | guarded | - | Y | create,upsert | - | - | N | uploadGarmentImage@lib/inventory-server.ts |
| 146 | GET | /inventory/history | session | guarded[INVENTORY] (via workflowHandlers, manual check) | - | N | - | - | 1 | N | challanHistory@lib/inventory-server.ts |
| 147 | GET | /inventory/items/[id] | session | guarded | - | N | - | - | 2 | N | getRecord@lib/inventory-server.ts |
| 148 | GET | /inventory/items | session | guarded | - | Y | create | - | 2 | N | listRecords@lib/inventory-server.ts |
| 149 | POST | /inventory/packing/[id] | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | - | N | updatePacking@lib/inventory-server.ts |
| 150 | GET | /inventory/packing | session | guarded | - | N | - | - | - | N | listPacking@lib/inventory-server.ts |
| 151 | POST | /inventory/packing | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | - | N | sendForPacking@lib/inventory-server.ts |
| 152 | GET | /inventory/transactions | session | guarded | - | N | - | - | 2 | N | transactions@lib/inventory-server.ts |
| 153 | GET | /programs/[id]/photo | session | none | - | N | - | - | - | N | apiErrorResponse@lib/api-errors.ts |
| 154 | GET | /programs/[id] | session | getSessionUser | - | N | - | - | - | Y | shapeProgramSheet@lib/program-sheet.ts |
| 155 | PATCH | /programs/[id] | session | requireDepartment['PROGRAMMING'] | manual | N | update | - | - | Y | wilcomSheetError@lib/wilcom-sheets.ts, wilcomEntriesForSheet@lib/wilcom-sheets.ts |
| 156 | DELETE | /programs/[id] | session | requireDepartment['PROGRAMMING'] | - | Y | create,delete,deleteMany,updateMany | cond 0/uncond 1 | 7 | Y | syncChallanStock@lib/fabric-stock-ledger.ts |
| 157 | PATCH | /programs/[id]/status | session | requireDepartment['PROGRAMMING'] | none | N | update | uncond (manual: status from body, update by id) | - | Y |  |
| 158 | GET | /programs/next-number | session | none | - | N | - | - | - | N |  |
| 159 | GET | /programs/production-sheet | session | none | - | N | - | - | 1 | Y |  |
| 160 | POST | /programs/production-sheet | session | requireDepartment+getSessionUser['PROGRAMMING'] | manual | Y | create,deleteMany,updateMany | cond 1/uncond 0 | - | Y | unitOf@lib/challan-units.mjs, wilcomSheetError@lib/wilcom-sheets.ts, wilcomEntriesForSheet@lib/wilcom-sheets.ts |
| 161 | GET | /programs | session | getSessionUser | - | N | - | - | 1 | Y | canViewClientCode@lib/auth/require-user.ts, productionSheetCategories@lib/download-production-sheet.ts |
| 162 | GET | /qc1/challans/[id]/decision | session | requireDepartment['QC1'] | - | N | - | - | 3 | Y | qc1DecisionState@lib/qc1-decision-server.ts |
| 163 | POST | /qc1/challans/[id]/decision | session | requireDepartment['QC1'] | manual | Y | create,delete,update,updateMany | cond 1/uncond 5 | 5 | Y | changeQc1Decision@lib/qc1-decision-server.ts |
| 164 | POST | /qc1/challans/[id]/inspect | session | requireDepartment['QC1'] | manual | Y | create,createMany,rawExec,update | - | 2 | Y | totalsByUnit@lib/challan-units.mjs, unitOf@lib/challan-units.mjs, qc1LineQuantities@lib/qc1-inspection.mjs |
| 165 | POST | /qc1/challans/[id]/receive | session | requireDepartment['QC1'] | manual | Y | create,update | cond 0/uncond 1 | - | Y | totalsByUnit@lib/challan-units.mjs |
| 166 | GET | /qc1/challans/[id] | session | requireDepartment['QC1'] | - | N | - | - | - | Y |  |
| 167 | POST | /qc1/challans/[id]/start-inspection | session | requireDepartment['QC1'] | manual | Y | create,update | cond 0/uncond 1 | - | Y |  |
| 168 | GET | /qc1/challans | session | requireDepartment['QC1'] | - | N | - | - | 1 | Y | totalsByUnit@lib/challan-units.mjs, unitOf@lib/challan-units.mjs, formatTotals@lib/challan-units.mjs |
| 169 | GET | /qc1/dashboard | session | requireDepartment['QC1'] | - | N | - | - | - | Y | addTotals@lib/challan-units.mjs, totalsByUnit@lib/challan-units.mjs, formatTotals@lib/challan-units.mjs |
| 170 | GET | /qc1/floor-board | session | requireDepartment['QC1'] | - | N | - | - | - | Y | totalsByUnit@lib/challan-units.mjs, unitOf@lib/challan-units.mjs, formatTotals@lib/challan-units.mjs |
| 171 | POST | /qc2/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 172 | GET | /qc2/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 173 | GET | /qc2/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 174 | GET | /qc2/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 175 | GET | /qc2/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 176 | PATCH | /qc2/inspections/[id] | session | guarded | manual | Y | create,update,updateMany | - | - | N | h.editInspection@lib/work-items-server.ts |
| 177 | GET | /qc2/items/[id]/decision | session | guarded | - | N | - | - | 2 | N | decisionHistory@lib/qc-decision-server.ts |
| 178 | POST | /qc2/items/[id]/decision | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 3 | 2 | N | changeDecision@lib/qc-decision-server.ts |
| 179 | PATCH | /qc2/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 180 | POST | /qc2/items/[id]/inspections | session | guarded | manual | Y | create,createMany,updateMany | - | - | N | h.inspectItem@lib/work-items-server.ts |
| 181 | GET | /qc2/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 182 | PATCH | /qc2/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 183 | GET | /qc2/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 184 | GET | /qc2/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 185 | POST | /qc2/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 186 | POST | /qcwashing/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 187 | GET | /qcwashing/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 188 | GET | /qcwashing/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 189 | GET | /qcwashing/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 190 | GET | /qcwashing/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 191 | PATCH | /qcwashing/inspections/[id] | session | guarded | manual | Y | create,update,updateMany | - | - | N | h.editInspection@lib/work-items-server.ts |
| 192 | GET | /qcwashing/items/[id]/decision | session | guarded | - | N | - | - | 2 | N | decisionHistory@lib/qc-decision-server.ts |
| 193 | POST | /qcwashing/items/[id]/decision | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 3 | 2 | N | changeDecision@lib/qc-decision-server.ts |
| 194 | PATCH | /qcwashing/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 195 | POST | /qcwashing/items/[id]/inspections | session | guarded | manual | Y | create,createMany,updateMany | - | - | N | h.inspectItem@lib/work-items-server.ts |
| 196 | GET | /qcwashing/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 197 | PATCH | /qcwashing/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 198 | GET | /qcwashing/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 199 | GET | /qcwashing/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 200 | POST | /qcwashing/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 201 | POST | /recutting/allocations/[id]/cancel | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.cancelAllocation@lib/recutting-server.ts |
| 202 | PATCH | /recutting/allocations/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateAllocation@lib/recutting-server.ts |
| 203 | GET | /recutting/allocations | session | guarded | - | N | - | - | - | N | h.listAllocations@lib/recutting-server.ts |
| 204 | POST | /recutting/challans/[id]/receive | session | guarded[RECUTTING] (via workflowHandlers, manual check) | - | N | - | - | - | N | h.receiveChallan@lib/inventory-server.ts |
| 205 | GET | /recutting/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 206 | GET | /recutting/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/recutting-server.ts |
| 207 | GET | /recutting/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/recutting-server.ts |
| 208 | GET | /recutting/history | session | guarded[RECUTTING] (via workflowHandlers, manual check) | - | N | - | - | - | N | h.history@lib/holds-server.ts |
| 209 | POST | /recutting/items/[id]/allocations | session | guarded | manual | Y | create,updateMany | - | - | N | h.createAllocations@lib/recutting-server.ts |
| 210 | PATCH | /recutting/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 211 | GET | /recutting/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/recutting-server.ts |
| 212 | PATCH | /recutting/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 213 | GET | /recutting/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/recutting-server.ts |
| 214 | GET | /recutting/stitching-challans | session | guarded | - | N | - | - | - | N | h.listStitchingChallans@lib/recutting-server.ts |
| 215 | POST | /recutting/stitching-challans | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 0 | 2 | N | h.issueStitchingChallan@lib/recutting-server.ts |
| 216 | PUT | /shrinkage/[id] | session | requireDepartment['QC1'] | none | N | create,rawExec | - | - | Y | shrinkageTableExists@lib/shrinkage-server.ts, updateShrinkageRecord@lib/shrinkage-server.ts |
| 217 | GET | /shrinkage/candidates | session | requireDepartment['QC1'] | - | N | - | - | - | Y | shrinkageTableExists@lib/shrinkage-server.ts, listShrinkageCandidates@lib/shrinkage-server.ts |
| 218 | GET | /shrinkage | session | requireDepartment['QC1','STORE'] | - | N | - | - | - | Y | shrinkageTableExists@lib/shrinkage-server.ts, listShrinkage@lib/shrinkage-server.ts |
| 219 | POST | /shrinkage | session | requireDepartment['QC1'] | manual | N | create,rawExec | - | - | Y | shrinkageTableExists@lib/shrinkage-server.ts, saveShrinkageForLine@lib/shrinkage-server.ts |
| 220 | POST | /steam-press/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 221 | GET | /steam-press/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 222 | GET | /steam-press/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 223 | GET | /steam-press/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 224 | GET | /steam-press/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 225 | PATCH | /steam-press/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 226 | GET | /steam-press/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 227 | PATCH | /steam-press/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 228 | GET | /steam-press/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 229 | GET | /steam-press/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 230 | POST | /steam-press/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 231 | POST | /stitching/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 232 | GET | /stitching/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 233 | GET | /stitching/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 234 | GET | /stitching/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 235 | GET | /stitching/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 236 | PATCH | /stitching/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 237 | GET | /stitching/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 238 | PATCH | /stitching/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 239 | GET | /stitching/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 240 | GET | /stitching/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 241 | POST | /stitching/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 242 | POST | /thread-cutting/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 243 | GET | /thread-cutting/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 244 | GET | /thread-cutting/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 245 | GET | /thread-cutting/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 246 | GET | /thread-cutting/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 247 | PATCH | /thread-cutting/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 248 | GET | /thread-cutting/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 249 | PATCH | /thread-cutting/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 250 | GET | /thread-cutting/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 251 | GET | /thread-cutting/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 252 | POST | /thread-cutting/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
| 253 | GET | /upload | session | requireUser(admin) | - | N | - | - | - | N | getCloudinaryCredentials@lib/cloudinary.ts |
| 254 | POST | /upload | session | requireUser | manual | N | - | - | - | N | sniffDepartmentImageType@lib/department-images.ts, uploadImageToCloudinary@lib/cloudinary.ts |
| 255 | POST | /washing/challans/[id]/receive | session | guarded | manual | Y | create,update,updateMany | cond 1/uncond 1 | - | N | h.receiveChallan@lib/work-items-server.ts |
| 256 | GET | /washing/challans | session | guarded | - | N | - | - | - | N | h.listChallans@lib/work-items-server.ts |
| 257 | GET | /washing/dashboard | session | guarded | - | N | - | - | 1 | N | h.dashboard@lib/work-items-server.ts |
| 258 | GET | /washing/floor-board | session | guarded | - | N | - | - | 1 | N | h.floorBoard@lib/work-items-server.ts |
| 259 | GET | /washing/history | session | guarded | - | N | - | - | - | N | h.history@lib/work-items-server.ts |
| 260 | PATCH | /washing/items/[id]/fabric-status | session | guarded | manual | Y | create,update | - | - | N | h.correctFabricStatus@lib/work-items-server.ts |
| 261 | GET | /washing/items/[id] | session | guarded | - | N | - | - | - | N | h.getItem@lib/work-items-server.ts |
| 262 | PATCH | /washing/items/[id] | session | guarded | manual | Y | create,updateMany | cond 1/uncond 0 | - | N | h.updateItem@lib/work-items-server.ts |
| 263 | GET | /washing/items | session | guarded | - | N | - | - | - | N | h.listItems@lib/work-items-server.ts |
| 264 | GET | /washing/transfer-challans | session | guarded | - | N | - | - | - | N | h.listTransferChallans@lib/work-items-server.ts |
| 265 | POST | /washing/transfer-challans | session | guarded | manual | Y | create,updateMany | cond 0/uncond 1 | 2 | N | h.issueTransferChallan@lib/work-items-server.ts |
