# Current architecture: challans and Production Sheets

This document describes how challans, Production Sheets and department work were connected before this change, and the problems found. The change itself is described in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Stack

- Next.js 15 app in `apps/web`. The API routes under `apps/web/src/app/api` are the backend.
- Prisma 6 on PostgreSQL (Neon). The schema is `packages/database/prisma/schema.prisma`.
- Schema changes ship as re-runnable SQL in `packages/database/prisma/manual-migrations`. `scripts/apply-appearance-migrations.js` applies them and records each one in `_manual_migrations`. Production builds on Vercel run that script before going live.
- Authentication is a session cookie. `requireDepartment(request, DEPT)` checks that the user belongs to the department.

## Sources of truth

| Entity | Model | Notes |
|---|---|---|
| Production Sheet | `Program` | One sheet per program. Shown as `programSerialNo`, or `programNumber` when there is no serial. |
| Challan | `Challan` | A transfer document between two departments. `programId` is required and single. `parentChallanId` points to one incoming challan. |
| Challan line | `ChallanItem` | Fabric, colour, quantity and unit (MTR or PCS). Before this change a line had no sheet of its own and no link to the incoming line it came from. |
| Dyeing work | `DyeingOrder` | One order per Store → Dyeing (or QC1 rework) challan line. It records `inboundChallanId`, `inboundChallanItemId` and `programId`. |
| Dyeing → Dyeing QC transfer | `DyeingQcTransfer` | One row per outgoing challan line: order, challan line and quantity. |
| Downstream department work | `DepartmentWorkItem` | One per incoming challan line per department, keyed by `(departmentCode, inboundChallanItemId)`. It carries `programId`, `sourceWorkItemId` and quantity counters. |
| Downstream transfer | `DepartmentWorkTransfer` | One row per outgoing challan line: work item, challan line, quantity and kind (PASS, REJECT or REWORK). |
| Recutting allocation | `WorkItemAllocation` | Part of a received line allocated to a garment category and style. Stitching receives allocations. |
| Fabric Store stock | `FabricInward` and `StockLedgerEntry` | Stock is kept per fabric, type, colour and unit. Store issues post to the ledger (`lib/fabric-stock-ledger.ts`). |

Department routes are configured in `WORKFLOWS` in `apps/web/src/lib/work-items-server.ts`. Each entry lists the challans a department accepts (`inbound`) and where its finished work goes (`next`, and `qc.rejectTo` / `qc.reworkTo` for QC departments). Fabric Store, Dyeing, Dyeing QC (QC1) and Recutting have their own services.

## What already worked

- Department work is tracked per line: one `DyeingOrder` or `DepartmentWorkItem` per incoming challan line. Each one has its own fabric, colour, unit and counters, and quantities only move forward.
- Outgoing quantities are checked on the server against what is still available.
- Every issue guards against concurrent issues: it uses `updateMany` conditioned on the counters it read, and returns 409 if another issue changed them first.
- Every issue accepts an idempotency key. A retried or double-clicked submit returns the first challan, through `IdempotencyRecord`.
- MTR and PCS are never added together (`lib/challan-units.mjs`).

## Problems found (root causes)

1. **Fabric Store selected a sheet automatically.**
   - `FabricStoreIssueChallanView.tsx` selected `progList[0]`, the first sheet returned by `/api/programs`, whenever the page was opened without a `programId`.
2. **The challan API assigned an arbitrary sheet.**
   - `POST /api/challans` attached a challan sent without a `programId` to `prisma.program.findFirst()`, whichever sheet the database returned first.
3. **A challan could carry only one sheet.**
   - `Challan.programId` was the only sheet reference, and `ChallanItem` had none.
   - All three issue validators refused lines of different sheets: `validateTransferLines`, `validateQcTransferLines` and `validateStitchingLines`.
   - Material from several sheets sent together had to go on separate challans, or be recorded under one sheet. In the second case the other sheets' identity was lost.
4. **Dyeing QC (QC1) merged the lines after Dyeing.**
   - `api/qc1/challans/[id]/inspect` took inspection quantities per unit only.
   - It then issued its pass, rework and reject challans with one line per unit. Each line copied the fabric and colour of the first source line in that unit.
   - A Dyeing → QC1 challan with three dyed lines (for example 100 m red, 150 m blue and 200 m of another fabric) reached Embroidery as one line of 450 m. That line had one fabric and one colour.
   - This is the "consolidated after Dyeing" problem.
5. **Outgoing lines had no link to their source line.**
   - Line genealogy existed only indirectly, through `DyeingQcTransfer` and `DepartmentWorkTransfer`.
   - Dyeing QC outputs had none at all.
6. **Issue screens chose a sheet, not an incoming challan.**
   - The Dyeing, `WorkIssueChallan` and Recutting issue screens asked for a Production Sheet, then offered lines from any incoming challan of that sheet.
   - They selected the sheet automatically when only one was eligible.
   - The outgoing challan recorded only the first line's incoming challan as `parentChallanId`.
