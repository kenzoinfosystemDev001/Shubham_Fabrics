# Production Readiness Audit — Subham Fabrics MES

**Date:** 2026-10-23  **Branch:** `feature/packing-inventory-department`  **Scope:** all departments + cross-cutting (auth, DB, infra, CI)
**Verdict:** **Not production ready.** The app works on the happy path. It has no real authentication, and quantity accounting can be corrupted by double-clicks, retries, or direct API calls.

Paths below are relative to `apps/web/src/` unless shown otherwise. Items marked ✅ were re-checked by hand against the code.

---

## 0. Stop-ship issues (fix before anything else)

| # | Issue | Where |
|---|---|---|
| S1 ✅ | **Live Neon DB credentials committed to git.** Used as a silent fallback when `DATABASE_URL` is unset. | `packages/database/src/index.ts:13`, `apps/api/src/common/prisma.service.ts:8`, `.github/workflows/ci.yml:40` |
| S2 ✅ | **Master PINs**: `1234`, `1111`, `0000` and `Admin@12345` log in as *any* user, including admin. Login also auto-creates core users with PIN 1234. | `app/api/auth/login/route.ts` (password check, user auto-seed) |
| S3 ✅ | **Forgeable session token**: `mes_jwt_<userId>_<timestamp>` is unsigned. Anyone who knows a user id (exposed by `GET /api/admin/users`, unauthenticated) can impersonate that user. | `api/auth/login/route.ts`, `lib/final-check-auth.ts:27`, `lib/packing-auth.ts` |
| S4 ✅ | **70 of 152 API route files perform writes with no auth at all**, including `admin/clear-all-data` (wipes the whole DB), `admin/*/delete-all`, `admin/users` (create an ADMIN user), and every department job action. There is no `middleware.ts`. | `app/api/**` |
| S5 ✅ | **Auth fallbacks to other users**: `packing-auth` falls back to the `packing` user, or to *any* active user flagged `isAdmin:true`. `/api/auth/me` falls back to "first user in the cookie department". Every department route takes `actorId` from the request body or uses `findFirst()`. **The audit trail cannot be trusted.** | `lib/packing-auth.ts:68-113`, `api/auth/me/route.ts`, all `jobs/[id]/*` routes |
| S6 | **Client-chosen roles**: `x-user-role` / `x-user-department` headers are filled from localStorage and trusted by the server. RBAC is UI-only. | `lib/api.ts:58-70`, `api/programs/route.ts:72`, `lib/rbac.ts:27-46` |
| S7 | NestJS JWT secret has a public default. Its guard accepts `demo_token_<username>` and falls back to the `programmer` user. | `apps/api/src/modules/auth/auth.module.ts:12`, `common/guards/jwt-auth.guard.ts:15-43` |
| S8 | Cookies are not `httpOnly` or `secure`. The token is also stored in localStorage, so any XSS means account takeover. | `api/auth/login/route.ts` cookie block |

---

## 1. Systemic patterns (root causes behind most department bugs)

These repeat in almost every department. Fix them once, centrally, and most per-department bugs go away.

1. **No state machine.** Each route checks status with `findUnique`, then does an unconditional `update({where:{id}})`. This allows double receive, double complete, double inspect, and issue before receive or complete. `PATCH /api/challans/[id]/status` accepts **any** status string.
   → Build `lib/challan-state.ts` with an allowed-transition table. Every transition = `updateMany({where:{id, status:{in:expected}}})` + `count===1` check + `ChallanEvent`, all in one `$transaction`.
2. **Read-then-write races.** Availability and "previously issued" totals are computed *outside* the transaction. Two tablets or a double-click both pass validation, and the goods are issued or packed twice.
3. **Over-issue guard disabled by `totalGoodProduced > 0 &&`.** When good = 0 or the parent was never received, the check is skipped and any quantity can be issued (recutting, stitching, steam-press).
4. **Client-trusted quantities.** `inputQuantity`, `fabricIn`, rework and reject come from the request body and are not bounded by the received quantity. Negative values are accepted (e.g. `rework=-5, reject=5` reconciles). Negative item lines are accepted (`[150, -50]`).
5. **Document numbers from `count()+1`** or `Date.now().slice(-4/-5/-6)` collide under concurrency and after any delete, giving P2002 → 500. The `SLE-…` padded string ordering breaks after 9999.
   → Use Postgres sequences or a counter table.
6. **Swallowed errors inside Postgres transactions.** `try/catch` inside `$transaction` cannot recover, because the transaction is already aborted (`api/challans/route.ts:488-560`, `challans/[id]/status/route.ts:119-161, 424-459`).
7. **Dashboards and reports computed from `take: 20/25/30/50/200` slices**, then presented as department totals. They need `aggregate` / `groupBy`. No IST-aware date filtering.
8. **Free-text statuses and department codes** with per-file alias lists (`QC3`/`QCWASHING`/`QC_WASHING`/…, `STITCH`/`ASSEMBLY`). Matching is by substring (`contains 'CUTTING'` also matches RECUTTING).
9. **Every `POST /api/challans` resets the Program to `ISSUED`**, regressing IN_PRODUCTION/COMPLETED programs (`api/challans/route.ts:553-557`).
10. **Department routes never check `toDepartment`.** E.g. Steam Press `/complete` can mutate a Stitching challan; Washing receive accepts any challan id.

---

## 2. Department findings

### 2.1 Programming
- **Critical:** saving a production sheet with a serial number that already exists **overwrites that other program**. Its fabrics, colours and sizes are deleted and recreated, and the status is reset to DRAFT (`api/programs/production-sheet/route.ts:140-148, 379-386`).
- **Critical:** an unknown or missing `programId` on challan create falls back to `prisma.program.findFirst()`, so the challan is attached to a random program (`api/challans/route.ts:206-219`).
- **Critical:** `clientCode` leaks via the raw `metadataJson` spread in the program GETs. Redaction is cosmetic (`api/programs/route.ts:117`, `programs/[id]/route.ts:105`).
- **High:**
  - Program status PATCH accepts any value, and "Mark Ready" skips readiness validation (`programs/[id]/status/route.ts:10-15`).
  - Re-saving a sheet resets status and `createdById`.
  - Program delete hard-deletes challans, stock ledger and **audit logs**, and marks consumed rolls IN_STOCK (`programs/[id]/route.ts:141-327`). Challan delete does the same (`challans/[id]/route.ts:91-176`).
- **High:**
  - Target quantity counts only the primary component, so TOP+BOTTOM+DUPATTA sheets under-count.
  - `Math.max(1, …)` inflates zero colour rows.
  - `ProgramSize.size` stores the fabric width, so there is no real size matrix.
- **Medium:**
  - Challan items are not reconciled with `fabricOut`.
  - The header is in PCS while items are in MTR.
  - `body.status` can be set to RECEIVED at creation.
  - Junk Department rows are upserted from request input.
  - Next-number routes return a fake `00001` on failure.

### 2.2 Fabric Store
- **Critical:**
  - Challan dispatch is gated only on `availableStock > 0`: with 0.5 m in stock, a 5,000 m challan passes (`lib/fabric-availability.ts:299`, `api/challans/route.ts:292`).
  - `check-availability` POST lets anyone force `IN_STOCK`.
- **Critical:** **three stock models that never reconcile** (Rolls+Ledger, FabricInward/Outward, challans). The same fabric shows three different balances. Stock is not reserved per program: ten programs needing "Cotton" each see the full pool.
- **Critical:** a roll can be issued twice (race), and the second request silently reassigns it (`fabric-store/issue/route.ts:59-99`). Return and QC have the same pattern.
- **High:**
  - QC PASS writes a **second RECEIPT** ledger row (double-counts received metres) (`fabric-store/qc/route.ts:159`).
  - GRN posts stock while still DRAFT.
  - Returned rolls are stuck forever: QC only accepts RECEIVED/QC_HOLD.
  - Roll PATCH sets any status: the defected-shelf "Release" puts a written-off roll back IN_STOCK with no ledger reversal.
- **High:**
  - Manual outward has no balance check, and negatives are hidden by `Math.max(0, …)`.
  - Inward `billQty` can be edited after dispatch.
  - There is no unique `(supplier, billNo)`.
  - Admin fabric/supplier codes come from `Date.now().slice(-4)` + `upsert`, which **silently overwrites existing masters**.
- **Medium:**
  - MTR, KG and PCS are summed together.
  - Availability counts rolls that have not passed QC.
  - Fuzzy name matching: "Poly-Cotton" becomes "Poly".
  - Quantities are stored as Float.
  - Department stock is computed from only the last 400 challans.
- **Low:**
  - Moving a roll's location calls a non-existent `/rolls/[id]/location` endpoint (`fabric-store/inventory/rolls/page.tsx:61`).
  - Material issue lists only the oldest 200 rolls.

### 2.3 Dyeing / QC1 / Embroidery
- **Critical:** **two paths from Dyeing to QC1.** "My Work" uses the generic `POST /api/challans` with no `DyeingOrder` accounting, so the same dyed metres can be sent twice (`dyeing/my-work/page.tsx:410`).
- **Critical:**
  - `issue-qc1-challan` writes `sentToQc1Quantity = stale + qty`, so concurrent requests lose an update.
  - `qc1ChallanId` is overwritten on each partial dispatch, so earlier links are lost.
- **Critical:**
  - QC1 inspect can run twice and create duplicate Embroidery challans.
  - It allows inspection from `ISSUED`, i.e. before the material is received (`api/qc1/challans/[id]/inspect/route.ts:52-69, 441`).
- **Critical:** QC1 loses quantities:
  - Passed metres are forwarded only when the overall result is PASS, so they are stranded on REWORK or REJECT.
  - Hold quantity goes nowhere.
  - Partial inspection still closes the challan.
- **High:** **Embroidery has no issue-challan API.** It forwards via the generic route with client-supplied `fabricIn/Out`. The same lot can be issued repeatedly. The unit defaults to PCS while QC1 sends MTR.
- **High:** Embroidery's "reject to defective shelf" only changes the status, so the fabric vanishes from accounting.
- **High:** `dyeing-sync` **writes on every GET**, creating duplicate DyeingOrders on concurrent page loads:
  - There is no unique constraint on `inboundChallanId`.
  - It includes DRAFT challans and defaults the quantity to 100.
  - It overwrites `program.fabricSentToDyeing` instead of incrementing it.
- **High:** Dyeing PATCH has no bounds (`dyed` can be > `required` or < `sent`). There is no shrinkage or process-loss field, so MTR orders never close.
- **Medium:** a partial dispatch marks the whole order SENT_TO_QC1. QC1 and Embroidery dashboards use `take:20`.

### 2.4 Thread Cutting / QC2 / Washing / QC Washing
- **Critical ✅:** `POST /api/challans` returns the bare challan, but the QC2, Washing and QC Washing pages check `data.success`. The **user always sees "Failed"** even though the challan was created. The source is never closed, and retries **duplicate pieces downstream** (`qc2/my-work/page.tsx:211`, `washing/my-work/page.tsx:355`, `qcwashing/my-work/page.tsx:490`).
- **Critical:** QC2 and QC Washing forward the **received** quantity, not the **passed** quantity, while rejects and rework were already sent elsewhere. 100 in becomes 120 in existence.
- **Critical:** Washing receive has no department or status check. Any challan in any state is reset to RECEIVED and forced to PCS (`api/washing/challans/[id]/receive/route.ts`).
- **Critical:** the Wash process can be run repeatedly:
  - It has no status check, and no check that `pieceIn ≤ received`.
  - It sets every item's quantity to `pOut` (2×50 washed to 95 becomes 190).
  - It writes the QC status `QC_APPROVED` from a production department.
- **High:**
  - Double-inspect race in QC2 and QC Washing.
  - ON_HOLD re-inspected against the full quantity.
  - Partial inspection loses pieces.
- **High:** Thread Cutting has no API of its own and never closes its incoming challan, so the same lot can go to QC2 repeatedly. The `readyForQc2` KPI is always 0.
- **Medium:**
  - QC2 writes no DefectRecord, so the defective shelf under-reports.
  - ON_HOLD is missing from dashboards.
  - `qc3` and `qc-washing` are dead alias routes and pages.
- **Low:** QC Washing handlers and toasts say "Finishing" but send to RECUTTING. Confirm the intended route.

### 2.5 Recutting / Stitching
- **Critical ✅:** recutting verify reads `body.passed`, but the UI sends `outcome: 'HOLD'`, so **HOLD is saved as a pass**. Verify also has no status guard (`api/recutting/jobs/[id]/verify/route.ts:22`).
- **Critical:** issue-challan has no parent status or department check, and the guard is bypassed when good = 0 or the parent was never received. Client `fabricIn` is trusted, so any quantity can be issued from any challan.
- **Critical:** a partial recutting handover reverts the parent to IN_PROCESS. It can then be **completed again**, which double-counts the input or loses the remaining pieces.
- **High:**
  - In the rework loop, each pass adds a full-input ProductionTransaction, so reports double-count.
  - If the operator enters only the rework quantity, `fabricOut` is overwritten instead.
- **High:**
  - Complete does not bind the input to `fabricIn`: the UI pre-fills the issued quantity, not the received quantity.
  - Complete accepts RECEIVED, skipping start.
- **High:**
  - Receive can re-open HANDED_OVER or ON_HOLD jobs.
  - Stitching QC is bypassed (`autoInspect: true` is always sent).
  - Stitching can route straight to FINAL_CHECK, PACKING or FINISHED_GOODS, skipping Finishing.
- **Medium:**
  - Defects are recorded twice (on complete and again on issue).
  - Receive shortages are not recorded.
  - Recutting reports include defects from all departments.
  - The "Save progress" button actually completes the job.

### 2.6 Finishing / Steam Press  *(Steam Press routes are a near-verbatim clone, so the same bugs apply)*
- **Critical ✅:** the recent "routing fix" **re-enabled over-issue**. "Previously handed over" only sums children with the *same* destination. 100 good pieces → 60 to STEAM_PRESS + 100 to FINAL_CHECK = 160 shipped (`api/finishing/issue-challan/route.ts:144-148`).
- **Critical:**
  - The routing fix allows `slice(finishingIndex+1)`, so Finishing can skip Steam Press and Final Check and go straight to PACKING or DISPATCH.
  - The default is still `BUTTON_ATTACHMENT`, which has no module, so those challans are stranded.
- **Critical ✅:** Steam Press issue-challan has no guards at all:
  - no parent status or department check;
  - free-text destination;
  - the guard is disabled when good = 0;
  - negative item lines are accepted.
- **Critical:** receive can be replayed on HANDED_OVER, which resets the job so it can be completed and shipped again.
- **Critical:** complete trusts the client `inputQuantity` (received 50, posted 1000) and accepts negative rework/reject.
- **High:**
  - Complete accepts RECEIVED.
  - Inspect accepts IN_PROCESS, which sets `fabricOut=null`, so rejects are not deducted.
  - A failed re-inspect followed by start → complete runs a second time.
  - Job routes never check the department.
- **Medium:**
  - The shortage hold is optional.
  - Rework and balance pieces have no onward path.
  - A float reject in an Int column gives a 500.
  - The dashboard reports 100% efficiency when there is no data.
- **Tests:** `scripts/test-finishing-workflow.js` and `test-steam-press-workflow.js` write directly with Prisma and assert tautologies. They test none of the above.

### 2.7 Final Check
- **High:** rework only creates a DefectRecord ("routing pending"): there is no challan back to stitching or finishing. The parent is closed as HANDED_OVER while rework is still outstanding.
- **High:** rejected pieces go to a `DEFECTIVE_RETURN → STORE` challan that nothing consumes. No recut or replacement is raised, so the order quantity silently shrinks.
- **Medium:**
  - Yield sums input across inspection rounds (a 71% vs 100% error).
  - QC_APPROVED is counted twice on the dashboard.
  - Hold is allowed from RECEIVED, and resume skips start.
  - Rework hidden by an all-PASS checklist.
- **Low:** the auth list omits `FINAL_CHECK_SUPERVISOR` (`lib/final-check-auth.ts:52`).

### 2.8 Packing / Finished Goods Inventory
- **Critical ✅:** **packing cannot work.**
  - The client sends `quantity`/`remarks`, but the server reads `packingQuantity`/`notes`, so every pack returns 400 (`packing/workspace/[id]/page.tsx:166` vs `api/packing/jobs/[id]/pack/route.ts:70`).
  - The GET returns `totalReceived/alreadyPacked/remainingToPack`, but the page reads `totalPackedPieces/remainingPieces`, so the **page throws on render** (`:323`).
  - The queue pages have the same mismatch.
- **Critical:** packing APIs are effectively unauthenticated (S5). A stitching user with a valid token falls through to the fallback, and `jobs/[id]` GET returns any challan.
- **Critical:** a concurrent pack can over-pack and inflate FG stock. The claim `where status = IN_PROCESS` doesn't change, so it guards nothing, and there is no idempotency key.
- **High:**
  - Packing ON_HOLD is a dead end (there is no hold/resume route).
  - FG inventory is write-only: there is no dispatch flow, and `DispatchOrder` is unused.
  - FG can be inflated via the unauthenticated generic challan PATCH (reset to RECEIVED + larger `fabricIn`).
  - Challan DELETE leaves Cartons and FG stock unreversed.
- **Medium:**
  - Carton numbers are `Date.now().slice(-4)`, so they collide.
  - The SKU key is not program-scoped (`styleCode-size-colour`), and "L" ≠ "l".
  - No CartonBundle rows, so there is no bundle-to-carton traceability.
  - Report and inventory totals come from `take` slices.
  - `days=NaN` gives a 500.

---

## 3. Data model / DB (`packages/database/prisma/schema.prisma`)
- `Challan` has **no indexes** but is filtered by `programId`, `toDepartment`, `fromDepartment` and `status` everywhere. Add `@@index([programId])`, `@@index([toDepartment, status])` and `@@index([fromDepartment, status])`.
- 63 `Float` columns hold quantities and money. Use `Decimal` for metres and money, and `Int` for pieces.
- All statuses and department codes are free-text `String`. Use enums.
- No unique constraint on `DyeingOrder.inboundChallanId`, `(supplier, billNo)`, or a forward-idempotency key `(parentChallanId, toDepartment, type)`.
- `FabricOutward.challanId` and `Carton.packingChallanId` are loose FKs. Program cascades delete production history. There is no soft-delete.
- **No migrations**: it uses `prisma db push`. The `generate` script swallows errors.
- Two copies of the generated Prisma client (~47 MB each, with native `.so`/`.dll` binaries) are committed.

## 4. Infrastructure / CI
- **The NestJS `apps/api` is dead code.** The web app uses the Next.js route handlers.
  - Render still deploys it on the **free** plan.
  - Its health check path is wrong (`/health` vs `/api/health`).
  - CORS is `*` with credentials.
  - It has 1 tsc error (`formatDatabaseUrl` export).
  - Its idempotency interceptor is racy and not user-scoped.
  - → Delete it, or make it the only backend.
- Docker/nginx:
  - nginx routes `/api/` to NestJS, so every web call would hit the wrong backend.
  - The web container has no `DATABASE_URL`, so it falls back to the production Neon DB.
  - No TLS.
  - Postgres and Redis ports are exposed, and Redis has no password.
  - Containers run as root.
- CI:
  - No lint and no typecheck.
  - The API `test` script just prints "passed".
  - `.gitignore` **bans** `*.test.*`, `*.spec.*` and `test/`, so no automated tests can be committed.
- Upload:
  - No auth, no size or MIME limit, and the client picks the folder.
  - A base64 fallback is stored in DB text columns.
  - GET exposes the Cloudinary configuration.
- `scripts/setup-core-users.js` resets core users to known PINs. `scripts/patch-rbac.ps1` hardcodes another developer's path.
- `public/sw.js` caches authenticated HTML: clear it on logout for shared floor devices. There are no security headers (CSP/HSTS).
- `apps/web` typechecks clean (0 errors).

---

## 5. Recommended fix order

**Phase 0 — Security (days, blocking)**
1. Rotate both Neon passwords and the JWT secret. Remove all hardcoded fallbacks and fail fast when an env var is missing. Purge git history and add gitleaks to CI.
2. Remove the master PINs and the auto-seed in login. Force PIN reset for all users.
3. Issue signed JWTs (`jose`) in httpOnly + secure cookies.
4. Add one `requireUser({ dept, roles })` helper and `middleware.ts` on `/api/:path*`. Derive `actorId` only from the session. Delete every `findFirst()` actor fallback and the packing-auth fallbacks.
5. Remove or guard `admin/clear-all-data` and `delete-all` (ADMIN + re-auth, disabled in production).

**Phase 1 — Make the flows correct (1–2 weeks)**
6. Fix the Packing client/server contract, and the `data.success` mismatch on `/api/challans`.
7. Shared `challan-state.ts` transition service. Port all department job routes to it, with conditional `updateMany` claims.
8. Shared `forwardChallan(parentId, toDept)`:
   - The quantity comes from the server-side passed/good count.
   - Sum **all** children whatever their destination.
   - Destination allow-list per department, from config.
   - Recompute inside the transaction.
9. Embroidery and Thread Cutting issue APIs. Remove the generic `/api/challans` path for departments that have their own.
10. zod validation on every write: non-negative integers for PCS, enums for status, unit and department.
11. DB sequences for all document numbers.

**Phase 2 — Data integrity (2–4 weeks)**
12. Prisma migrations, Challan indexes, Decimal/Int quantities, status enums, unique constraints, soft-delete. Append-only audit and ledger.
13. One fabric stock ledger with per-program reservation and `CHECK (balance >= 0)`.
14. Rework, reject and hold disposition flows (Final QC → Stitching/Finishing, rejects → recut or scrap). Dyeing shrinkage/process-loss. FG dispatch flow.
15. Dashboards and reports via `aggregate` / `groupBy`, with IST date ranges.

**Phase 3 — Operability**
16. Decide on NestJS (delete it, most likely). Fix Docker/nginx, TLS, a paid hosting plan, security headers, an upload policy, and Sentry/logging.
17. Unban tests in `.gitignore`. Write HTTP integration tests for the negative cases above (double receive, double complete, over-issue across destinations, concurrent pack, HOLD verify). Add lint, `tsc` and `prisma validate` to CI.
18. Deduplicate the cloned routes (Finishing/Steam Press, QC2/QC Washing inspect), and remove the `qc3` and `qc-washing` aliases.
