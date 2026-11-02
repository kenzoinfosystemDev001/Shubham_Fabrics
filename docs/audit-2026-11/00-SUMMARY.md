# Shubham Fabrics MES: Production-Readiness Audit, November 2026 (Stages 0–2)

**Date:** 2026-11-02 · **Code audited:** `origin/main` @ `349af5a` (what production runs), on branch `fix/mes-production-readiness`
**Method:**
- Static review of every route, library, page and the schema, by 8 parallel reviewers.
- The headline findings were then re-checked by hand against the code; they are marked ✅ below.
- Pure rule modules (`work-items.mjs`, `recutting.mjs`) were executed in plain Node to confirm the quantity defects.
- **Not done:** no dev server was run, no database was touched, and no source file was changed.

| Report | Scope |
|---|---|
| [01-architecture-database.md](01-architecture-database.md) | Architecture diagram, components, schema, migrations, deployment |
| [02-api-auth.md](02-api-auth.md) | All 211 route files / 265 handlers, auth & session, endpoint inventory |
| [03-frontend.md](03-frontend.md) | Pages, forms, state, error/loading handling, contracts |
| [10-programming-fabric-store.md](10-programming-fabric-store.md) | Program management, Fabric Store (17-point specs) |
| [11-dyeing-qc1-embroidery.md](11-dyeing-qc1-embroidery.md) | Dyeing, Dyeing QC, Cutting (missing), Embroidery |
| [12-threadcut-qc2-washing-qc3.md](12-threadcut-qc2-washing-qc3.md) | Thread Cutting, Threadcut QC, Washing, Washing QC |
| [13-recutting-stitching-finishing-steampress.md](13-recutting-stitching-finishing-steampress.md) | Recutting, Stitching, Stitching QC (missing), Finishing, Buttons (missing), Steam Press |
| [14-finalqc-inventory-packing-dispatch.md](14-finalqc-inventory-packing-dispatch.md) | Final QC, Packing, Finished Goods, Dispatch (missing) |

---

## Stage 0: Baseline

| Check | Result |
|---|---|
| Git safety | Uncommitted work (username-per-department) was parked as local commit `dd8a016` on `wip/username-per-department`. The existing stash was untouched. Nothing was pushed or reset. |
| Toolchain | Node 20.18.0, npm 10.8.2, `package-lock.json` (npm workspaces) |
| Package builds (types, config, validation, database) | ✅ pass |
| `tsc --noEmit` web / api / worker | ✅ 0 / 0 / 0 errors |
| `next build` (web) | ✅ exit 0 |
| Lint | ❌ cannot run: no ESLint config in the repo |
| Automated tests | ❌ **none exist**. `.gitignore` blocks `*.test.*`, `test/` and `tests/` |
| CI | ❌ none (`.github/workflows` was removed) |

## Overall verdict

Since the October audit, the code has moved a long way. It now has:
- a shared **department work-item engine** (`lib/work-items-server.ts`, `work-items.mjs`);
- signed sessions, plus department access checks on every write;
- idempotency keys on the newer workflow screens;
- a HOLD system, and a manual migration runner.

The newer screens are solid.

**It is still not safe to run real production on.** One root cause runs through every department: **quantities are not conserved.**
- Material can be received above what was sent, issued twice, converted between units without limit, or cancelled without being given back.
- Defects and losses have no place to go, and the two fabric stock systems disagree.

There is also no dispatch flow, and the system has no tests that could catch any of this.

---

## Cross-cutting root causes (fix once → fixes many departments)

| # | Root cause | Severity | Evidence | Departments hit |
|---|---|---|---|---|
| R1 | **Generic challan routes bypass every workflow rule.**<br>• PATCH and status accept any status string, with no transition table, an update by id only, and no event or audit row.<br>• CANCELLED or COMPLETED never gives the sender's quantity back.<br>• POST has no destination allow-list, so a QC1 user can send to Embroidery with no inspection. | **Critical** | `api/challans/[id]/route.ts:209-360`, `[id]/status/route.ts:51-69,127`, `api/challans/route.ts:256-281` | All |
| R2 | **Destructive deletes erase history.**<br>• Challan DELETE hard-deletes production transactions, QC records, events and **audit logs**, and cascades to Inventory work.<br>• Program DELETE does the same for a whole sheet and **any Programming user** can run it.<br>• `programs/delete-all` skips the destructive-actions switch. | **Critical** | `api/challans/[id]/route.ts:86-191` (audit rows :179), `api/programs/[id]/route.ts:67-283`, `admin/programs/delete-all/route.ts:21` ✅ | All |
| R3 | **Defects are subtracted twice** in the shared engine: 100 received with 10 defective caps output at 80, so lines never complete. HOLD quantity is subtracted twice the same way. | **Critical** | `lib/work-items.mjs:388` + `:329` ✅ (executed) | Stitching, Finishing, Steam Press |
| R4 | **No over-receipt limit.** Only Final QC and Inventory have `strictReceipt`, so 120 typed against 100 sent creates 20 phantom pieces that flow downstream. A blank received quantity saves 0 and closes the line. | **High** | `lib/work-items-server.ts:192,215,533-537` ✅ | Embroidery, Thread Cutting, Washing, QC2/QC3, Recutting, Stitching, Finishing, Steam Press, Dyeing (`dyeing/challans/[id]/receive:59-62`) |
| R5 | **No loss, wastage or shrinkage step.** Lines that lose material (dyeing shrinkage, washing shrinkage, cutting remnants, damage) can never close. Defect records are never resolved (no repair or scrap). | **High** | `dyeing-workflow.mjs:122`, `work-items.mjs:267-268, 315-354`, `recutting.mjs:54,63-72` | Dyeing, Embroidery, Thread Cutting, Washing, Recutting, all QCs |
| R6 | **Check-then-act races.** Status or quantity is checked before the transaction and the write is unconditional. Double-clicks, retries or concurrent decisions double-process. At least 47 unconditional status updates. | **Critical/High** | QC1 inspect `qc1/challans/[id]/inspect/route.ts:45-110,472` ✅; roll issue/return `fabric-store/issue/route.ts:59-106` ✅; QC transfer vs decision edit `work-items-server.ts:1129-1137` / `qc-decision-server.ts:97-177` | QC1, Fabric Store, QC2/QC3/Final QC |
| R7 | **Unit conversion is unbounded.** Recutting accepts any cut quantity and any "other unit" figure, e.g. 5 PCS sent out as 50,000 MTR. Stitching output stays in MTR and gets stuck at Final QC. | **Critical** | `lib/recutting.mjs:97,125,148-151,183` (executed) | Recutting → all downstream |
| R8 | **Two Fabric Store stock systems.** The Roll/GRN system and the Inward/StockLedgerEntry system never reconcile. QC PASS writes a second RECEIPT. Roll PATCH sets any status. Availability passes on stock > 0. | **Critical** | `lib/fabric-stock-ledger.ts:96-123`, `fabric-availability.ts:199-275`, `fabric-store/qc/route.ts:160-179`, `rolls/[id]/route.ts:52-80` | Store → Dyeing |
| R9 | **Document numbers come from "highest string + 1"** (SLE, ROLL, GRN, BATCH, QCI, work-item, packing, hold). Concurrent requests collide (P2002), and **numbering breaks after 9999**. | **Critical** (Store) / Low (others) | `fabric-store/grn/route.ts:122-202`, `inventory-server.ts:153-162` | Store, Inventory, all work items |
| R10 | **Missing stages.** No **Cutting**: the `cutting` login is aliased to Thread Cutting. No **Stitching QC**. No **Buttons & Attachments**: challans sent there are orphaned. **No Dispatch**: `DispatchOrder` is unused, finished-goods stock only grows, and `lib/api.ts:429-455` calls routes that don't exist. | **Critical** (Dispatch) / High | `lib/departments.ts:20`, `department-access.ts:29-30`, `schema.prisma:1053-1130` ✅ | Flow integrity |
| R11 | **Rework and reject routing is too narrow.** Final QC rework can only go to Steam Press. QC3 rework can only go to Washing. All rejects go to the raw-fabric Store shelf and are never disposed of. | **High** | `work-items-server.ts:195-197, 230` | QC stages |

## Security & platform

| # | Finding | Severity | Evidence |
|---|---|---|---|
| S1 | Login has no rate limit or lockout. PINs can be 4 characters, and station usernames are public on the login screen. | High | `auth/login/route.ts:13-73`, `lib/auth/pin.ts` |
| S2 | `floorboard/state` and challan GET return full programs including `metadataJson`, so the client code leaks to every station. | High | `floorboard/state/route.ts:6-17` ✅, `challans/[id]/route.ts:27` |
| S3 | Logout and PIN reset don't revoke sessions (valid for up to 12 h). Middleware-only routes skip the `isActive` check. | Medium | `auth/logout/route.ts:6-10` |
| S4 | Access is not purely by department: the username `admin`, username guesses, legacy role codes and a FINISHING fallback still grant access. | Medium | `session-user.ts:28-33,322`, `department-access.ts:103-107` |
| S5 | The NestJS `apps/api` is unused but still deployed (Render) with DB write access. 10 Final QC handlers are unguarded, CORS is `*` with credentials, and its role guards depend on a Role table that has now been emptied. nginx routes `/api` to it. | High (if deployed) | `render.yaml:1-24`, `finalcheck.controller.ts:11-60`, `main.ts:22-26`, `nginx.conf:33` |
| S6 | 0 routes validate input with zod. 55 files return raw `error.message` (Prisma internals) to clients. | Medium | [02-api-auth.md](02-api-auth.md) |
| S7 | Deleting a user rewrites every history row, including audit actors, to a shared "Deleted User". | Medium | `lib/auth/delete-user.ts:26-56` |

## Data model & migrations

| # | Finding | Severity | Evidence |
|---|---|---|---|
| D1 | 108 `Float` quantity/money fields vs 8 `Decimal`. `ChallanItem.quantity` is Float while the store ledger is Decimal. | High | `schema.prisma:802,1493` |
| D2 | No indexes on hot columns: Challan `toDepartment` / `status` / `programId` / `parentChallanId`, ChallanItem `challanId`. ProductionTransaction has none at all. | High | `schema.prisma:712-781` |
| D3 | No migration history. The base schema came from `db push`. Manual SQL runs only in Vercel **production** `prebuild` (there is no `predev`; the script's own comment is wrong). | High | `apps/web/package.json:8`, `apply-appearance-migrations.js:5` ✅ |
| D4 | `20261026_fabric_stock_import.sql` exists but is **not in the runner's list**, so it never applies automatically. | High | `apply-appearance-migrations.js:27-62` ✅ |

## Frontend

| # | Finding | Severity | Evidence |
|---|---|---|---|
| F1 | No `error.tsx`, `global-error.tsx` or `loading.tsx` anywhere, so a render error blanks the app. | High | `app/layout.tsx` |
| F2 | Dashboards and stock views turn fetch failures into empty arrays or zero stock, so an outage looks like "0 challans / 0 stock". | High | `admin/page.tsx:142-147`, `DepartmentStockView.tsx:46-58,96-108` |
| F3 | Create Production Sheet saves invented defaults to the DB: average 1.25, quantity 1, serial "000". | High | `create-production-sheet/page.tsx:1518-1526` |
| F4 | Receipt forms prefill received = sent, so shortages go unrecorded unless someone changes the number. | Medium | `components/challan/ReceiptLines.tsx:37-43` |
| F5 | Printed challans fill missing data with fake values ("CH-0000", "Standard Client"). | Medium | `lib/download-challan.ts:48-68` |

**What is good:**
- The `components/workflow/*` and dyeing screens use a shared `fetchJson` with `res.ok` checks, disable buttons while submitting, and send idempotency keys.
- No mock or demo data arrays exist.
- No quantity is read from browser storage.
- Packing and receipt were verified safe against double posting.

---

## Department status matrix

| Department | Exists | Worst open defect | Severity |
|---|:-:|---|:-:|
| Program management | ✅ | Programming can hard-delete live sheets and their history (R2); a challan resets completed sheets to ISSUED | Critical |
| Fabric Store | ✅ | Two stock systems (R8); roll double-issue (R6); numbering breaks after 9999 (R9) | Critical |
| Dyeing | ✅ | No process-loss step (R5); no over-receipt limit; GET handlers create orders | High |
| Dyeing QC (QC1) | ✅ | Double inspection (R6); QC gate bypass via generic challan (R1); passed quantity stranded on REWORK | Critical |
| **Cutting** | ❌ | Stage missing; login aliased to Thread Cutting | High |
| Embroidery | ✅ | No over-receipt limit (R4); no defect/loss path (R5) | High |
| Thread Cutting | ✅ | Blank receipt closes the line; no loss path | High |
| Threadcut QC (QC2) | ✅ | Transfer races with decision edits (R6) | High |
| Washing | ✅ | No shrinkage path (R5) | High |
| Washing QC (QC3) | ✅ | Rework only back to Washing; no cycle limit | Medium |
| Recutting | ✅ | Unbounded unit conversion (R7) | Critical |
| Stitching | ✅ | Double defect subtraction (R3); output stuck in MTR | Critical |
| **Stitching QC** | ❌ | Stage missing; stitching faults can't be routed back | High |
| Finishing | ✅ | R3; forwards everything received | Critical |
| **Buttons & Attachments** | ❌ | Challans to it are orphaned | High |
| Steam Press | ✅ | R3; Final QC rework passes re-counted as new output | Critical |
| Final QC | ✅ | Transfer race (R6); narrow rework routing (R11) | High |
| Packing / FG Inventory | ✅ | Admin challan delete cascades and strands stock | High |
| **Dispatch** | ❌ | No flow; finished-goods stock can never ship | Critical |

---

## Recommended remediation order (Stages 3–6)

**Stage 3: Foundation.** These are shared fixes that repair every department.
1. **Lock down the generic challan routes (R1).**
   - Add a transition table per department and a conditional `updateMany` plus ChallanEvent on every change.
   - Cancellation gives quantities back to the sender.
   - Add a destination allow-list.
   - Block statuses that the department engines own.
2. **Make destructive operations non-destructive (R2).**
   - Use soft cancel for challans and programs once any downstream activity exists.
   - Make program delete admin-only and behind the destructive-actions switch.
   - Never delete audit or ledger rows.
3. **Fix the engine maths (R3, R4, R5, R7).**
   - Subtract defects and holds once.
   - Make `strictReceipt` the default.
   - A blank quantity is an error, never 0.
   - Add a loss/wastage/shrinkage outcome that closes lines.
   - Bound unit conversion by the challan's own conversion rate.
   - These rules are pure functions, so this is where the first unit tests go.
4. **Close the race conditions (R6):** status and quantity re-checks inside the transaction using conditional `updateMany` (QC1 inspect, store issue/return, QC transfer vs decision edit).
5. **Database:**
   - Indexes (D2).
   - Register the missing migration (D4) and correct the runner comment (D3).
   - Sequence-based document numbers (R9).
   - Decimal for measured quantities (D1); this is a planned migration with a cutover, not a quick fix.

**Stage 4: Departments.**
- Unify the Fabric Store stock systems (R8).
- Add the missing stages: Cutting, Stitching QC, optional Buttons, and Dispatch with a finished-goods decrement (R10).
- Widen rework and reject routing, and add defect disposition (repair/scrap) (R11).
- Fix the program-level issues (sheet status regression, non-unique serial, invented defaults F3).

**Stage 5: Security & reliability.**
- Login rate limit and lockout, plus a stronger PIN policy (S1).
- Strip `metadataJson` from shared responses (S2).
- Session revocation via a token version (S3).
- Purely department-based access (S4).
- Retire or lock down `apps/api` and fix nginx (S5).
- Zod on write routes, plus a generic error envelope (S6).
- Error and loading boundaries, and visible fetch-failure states (F1, F2).

**Stage 6: Verification.**
- Unblock tests in `.gitignore`.
- Unit tests for `work-items.mjs`, `recutting.mjs` and the rule modules.
- Route integration tests against a disposable Postgres, including concurrency tests.
- One end-to-end program through every department, with conservation checked at each hop.
- Add a CI workflow (typecheck, lint, test, build) and an ESLint config.

## Open items needing a decision

1. **Cutting, Stitching QC, Buttons & Attachments:** are these real stages at this factory, or optional? This decides whether they are built or removed from routing.
2. **Dispatch:** what documents are needed (packing list, delivery challan, invoice reference, e-way bill)?
3. **The parked username-per-department change (`dd8a016`):** it needs rebasing onto `main` (which reworked admin users) and its migration applied before it can ship.
4. **Decimal migration:** schedule a maintenance window. Changing column types on live tables needs a backup and a cutover plan.
