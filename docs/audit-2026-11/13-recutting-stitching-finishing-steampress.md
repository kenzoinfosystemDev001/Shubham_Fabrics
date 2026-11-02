# Stage 2 Audit — Recutting, Stitching, Stitching QC, Finishing, Buttons & Attachments, Steam Press

Branch: `fix/mes-production-readiness` (= origin/main at 349af5a). Date: 2026-11-02.
Method: static code review only. No source edits, no dev server, no DB connection. The pure rule modules
(`work-items.mjs`, `recutting.mjs`) were executed in plain Node with hand-made objects to confirm the
quantity defects marked **[verified by execution]**. All paths are relative to the repo root;
`WIS` = `apps/web/src/lib/work-items-server.ts`, `WIM` = `apps/web/src/lib/work-items.mjs`,
`RS` = `apps/web/src/lib/recutting-server.ts`, `RM` = `apps/web/src/lib/recutting.mjs`.

---

## 0. Architecture summary (applies to all five stages)

* Every route under `api/{stitching,finishing,steam-press}/**` is a 4–9 line wrapper around
  `workflowHandlers(WORKFLOWS.X)` (`WIS:457-1575`). Recutting reuses receive/history/fabric-status from the
  same engine and adds allocation + Stitching-challan handlers (`RS:734-750`).
* Configured route (`WIS:130-177`):
  `QC3 →(QC3_TO_RECUTTING)→ RECUTTING →(RECUTTING_TO_STITCHING)→ STITCHING →(STITCHING_TO_FINISHING)→ FINISHING →(FINISHING_TO_STEAM_PRESS)→ STEAM_PRESS →(STEAM_PRESS_TO_FINAL_CHECK)→ FINAL_CHECK`,
  plus `FINAL_CHECK →(REWORK_RETURN)→ STEAM_PRESS`.
* `STANDARD_FACTORY_ROUTE` (`packages/config/src/index.ts:14-33`) lists `BUTTON_ATTACHMENT` between Finishing and
  Steam Press, but **the constant is imported nowhere** (only `packages/config/src` and `dist` reference it). It is
  documentation, not enforcement. The enforced route is the `WORKFLOWS` table.
* Quantity model per line (`DepartmentWorkItem`, schema.prisma:1613-1683): expected → received → (production:
  taken → processed + defect) → transferred; `heldQuantity` blocks movement.
* Concurrency: the write paths use `prisma.$transaction` plus a conditional `updateMany` (optimistic guard on
  counters/`updatedAt`) and idempotency records. **Most of the classic race defects are fixed in current code**
  (see the "checked, not present" list in §7).
* Permissions: `guarded()` → `requireDepartment(request, cfg.key)` (`WIS:415-423`,
  `apps/web/src/lib/auth/department-access.ts:110-115`). Any member of the department (or any admin) may do every
  action. Operator, supervisor and incharge get the same rights.
* **No automated tests exist anywhere in the repository** (no `*.test.*` / `*.spec.*` files, and no `test` script in
  `apps/web/package.json`).

---

## 1. RECUTTING

1. **Purpose.** Receive Washing-QC-passed embroidered fabric. Allocate each line to garment components
   (TOP/BOTTOM/DUPATTA/OTHERS + style), record what was cut, and issue component/style-wise challans to Stitching
   (`RS:39-41`).
2. **Eligible incoming departments.** Only `QC3` with challan type `QC3_TO_RECUTTING` (`WIS:135`). There is no rework
   inbound from Stitching.
3. **Incoming challan rules.** Shared receive (`WIS:501-618`). Every pending line must be in the request
   (`WIS:530-532`). Duplicate lines are refused (`WIS:524`). Each line moves `AWAITING_RECEIPT→RECEIVED` with a
   conditional update (`WIS:553-565`). CANCELLED/REJECTED challans are refused (`WIS:519`). A replay is refused
   once nothing is pending (`WIS:520-521`). **No upper bound on received quantity**, because `strictReceipt` is off
   (`WIS:536`).
4. **Production-sheet relationships.** Each work item keeps its line's sheet (`lineSheetId`, `WIS:356`). Every
   allocation inherits the item's sheet. A Stitching challan may mix sheets, and each line keeps its own `programId`
   (`RS:483,516`; `RM:194`). A challan with no header `programId` is skipped by `syncWorkItems` and never becomes
   work (`WIS:340`).
5. **Inputs.** Received quantity per line, and optionally a second unit (`WIS:544`). Allocation rows: category,
   otherName, styleRef, allocatedQuantity, cutUom, cutQuantity (`RM:81-113`). Cut updates (`RS:255-306`).
   Cancel with reason (`RS:309-336`). Stitching challan: challanNumber, sourceChallanIds, and lines
   `{allocationId, quantity, uom?}` (`RS:416-593`).
6. **Process fields.** `processedQuantity` = allocated total, kept by `syncItem` (`RS:93-105`). Allocation fields:
   `allocatedQuantity/Uom`, `cutQuantity/cutUom`, `transferredQuantity`, `status`
   (ALLOCATED/CUT/PARTIALLY_TRANSFERRED/TRANSFERRED/CANCELLED).
7. **Quantity & UOM rules.** The allocation total cannot exceed `received − allocated − held` (`RM:103-111`). The cut
   quantity is bounded by the allocated quantity **only when the cut unit equals the line unit** (`RM:97`, `RM:125`).
   A Stitching line in the cut unit is bounded by `cut − sent` (`RM:183`). A line in the *other* unit is **not bounded
   at all**: it "consumes" the whole remaining cut balance, and the typed quantity is what Stitching receives
   (`RM:148-151`).
8. **Quality checks.** None. Recutting has no inspection, no defect recording (`updateItem` goes to
   `updateQcNotes` for allocation departments, `WIS:676`), and no wastage/remnant recording.
9. **Rework & rejection.** No path. Cut-damage, shortage and end-bits cannot be recorded. A line with an unallocated
   remnant stays `IN_PROGRESS` forever (`RM:70`). If the cut quantity is below the allocated quantity in the same unit
   (for example 60 of 100 MTR), the remaining 40 MTR disappears once the 60 is sent and the allocation reads
   TRANSFERRED (`RM:54`). No repeated-pass double counting is possible, because there is no loop.
10. **Outgoing challan rules.** Only `issueStitchingChallan`. The generic transfer endpoint is refused for allocation
    departments (`WIS:1022`). Idempotency key (`RS:420-428`). The challan number is user-typed and unique per issuing
    department (`schema.prisma:779`, `assertChallanNumbersAvailable` `RS:458`). Each allocation is moved with a
    conditional update on `transferredQuantity` + `cutQuantity` (`RS:501-505`). A duplicate allocation in one request
    is refused (`RM:170`).
11. **Next-stage routing.** Fixed to STITCHING / `RECUTTING_TO_STITCHING` (`RS:482-486`). The generic
    `POST /api/challans` refuses RECUTTING→STITCHING (`workflowIssuing`, `apps/web/src/app/api/challans/route.ts:270`)
    **but allows RECUTTING→any other department** (see X-1).
12. **Server-side permissions.** RECUTTING membership or admin (`RS` via `guarded`). The fabric-status correction is
    admin-only (`WIS:780`). Allocations, cut, cancel and issue have no supervisor/operator split.
13. **Audit events.** `RECUTTING_RECEIVE` (AuditLog + ChallanEvent RECEIVE), `RECUTTING_ALLOCATE`,
    `RECUTTING_ALLOCATION_UPDATE`, `RECUTTING_ALLOCATION_CANCEL`, `RECUTTING_TO_STITCHING` (+ ChallanEvent ISSUE), and
    ProductionTransaction `RECUTTING_ALLOCATION/CUT/TO_STITCHING` (`RS:207-230, 277-301, 323-332, 548-579`).
14. **Implementation files.** `apps/web/src/app/api/recutting/**` (13 wrappers), `RS`, `RM`, `WIS`, `WIM`;
    `apps/web/src/app/recutting/**` (15 pages); schema `WorkItemAllocation` (schema.prisma ~1710-1737); migration
    `manual-migrations/20261025_recutting_allocation.sql`.

15. **Defects (current code).**

| # | Sev | Location | Defect & failure scenario |
|---|-----|----------|---------------------------|
| R-1 | **Critical** | `RM:97`, `RM:125` | **Cut quantity is unbounded when the cut unit differs from the line unit.** A 10 MTR line can be allocated as TOP, cutUom=PCS, cutQuantity=999 999. This is accepted [verified by execution]. The phantom pieces then go to Stitching. |
| R-2 | **Critical** | `RM:148-151`, `RM:183` | **"Send as other unit" quantity is client-trusted.** If 5 PCS are cut and a line is sent with `uom:'MTR', quantity:50000`, validation passes and consumes 5 PCS, but the challan line and Stitching's `expectedQuantity` are 50 000 MTR [verified by execution]. This is the only unit conversion in the chain, and it has no ratio or tolerance. |
| R-3 | High | `RM:135-140`, `RS:309-336` | **A cut allocation can be cancelled.** `validateCancel` checks only `transferredQuantity>0`. Fabric already cut into pieces "returns to the line" as uncut fabric and can be re-allocated, so the same fabric is cut twice on paper [verified by execution]. |
| R-4 | High | `RM:54, 63-72` | **No wastage/remnant closure.** The uncut remainder of an allocation vanishes untracked. A line with an unallocated remnant never closes. Fabric reconciliation from QC3 to Stitching is impossible. |
| R-5 | High | `WIS:533-537` | **Over-receipt unbounded** (not strict). Recutting can receive 10 000 MTR against a 100 MTR challan. The excess becomes allocatable fabric. |
| R-6 | Medium | `RS:179-187` | Allocation numbering `RCA-YYYY-NNNN` takes `findFirst orderBy desc` on a string. After `RCA-YYYY-9999`, `…-10000` sorts lower, so the next number collides permanently. The P2002 retry (`RS:240-246`) cannot recover, and allocations fail for the rest of the year. The same pattern applies to work-item numbers (`WIS:343-348`). |
| R-7 | Medium | `RS:255-306` | The cut quantity can be raised after the allocation is TRANSFERRED (`validateCut` only checks CANCELLED). This reopens the allocation and the line after Stitching received it. |
| R-8 | Low | `WIS:340` | A challan without a header `programId` is silently never synced. The material is invisible to Recutting. |

16. **Corrections.**
    (a) Require a per-allocation conversion factor (pieces per metre, from the production sheet/marker) whenever
    cutUom ≠ line uom. Bound cut ≤ allocated × factor × (1 + tolerance).
    (b) Remove the free "send as other unit" quantity, or derive it from the same factor.
    (c) Allow cancelling only when `cutQuantity = 0`. Otherwise require a "cut-loss/return" record.
    (d) Add `wasteQuantity` / "close line short" with a reason. Require allocated + waste = received to close.
    (e) Set `strictReceipt` with a configurable over-receipt tolerance (for example 2 %) for all four production
    departments.
    (f) Use a DB sequence or a numeric max for allocation and work-item numbers.
    (g) Refuse cut changes on TRANSFERRED allocations.
17. **Tests that should exist.**
    * Cross-unit cut cap.
    * Send-as-other-unit cap.
    * Cancel refused when cut>0.
    * Allocation total ≤ received − held, under two concurrent requests.
    * Idempotent replay of allocation and challan issue.
    * Duplicate allocationId in one challan.
    * Over-receipt beyond tolerance refused.
    * Numbering past 9999.
    * Remnant closure.
    * Stitching challan refused for a cancelled allocation.
    * Line from a non-selected source challan refused.

---

## 2. STITCHING

1. **Purpose.** Assemble cut components into garments. Record what is taken into production, completed (good) and
   defective (`production: true`, `WIS:141-151`).
2. **Eligible incoming.** Only `RECUTTING` with `RECUTTING_TO_STITCHING` (`WIS:147`). No rework inbound from
   Finishing or Final QC.
3. **Incoming challan rules.** The shared receive (as R-§3), non-strict (`WIS:536`). Non-integer PCS is accepted,
   because the integer check applies only to `garmentStock` (`WIS:542`).
4. **Production-sheet relationships.** The line keeps its sheet, its category/style, and `sourceAllocationId`
   (`WIS:363-366`), so each garment line traces back to its Recutting allocation.
5. **Inputs.** PATCH `items/:id` `{status, processedQuantity, takenQuantity, defectQuantity, defectReason,
   expectedCompletionDate, remarks}` (`WIS:671-775`). Transfer `{challanNumber, sourceChallanIds, lines[{workItemId,
   quantity}]}` (`WIS:1019-1224`).
6. **Process fields.** `takenQuantity`, `processedQuantity` (good), `defectQuantity`, `status`, `startedAt`, and
   `completedAt` (`WIS:694-706`).
7. **Quantity & UOM.** received ≥ taken ≥ processed + defect (`WIM:372-395`). The defect quantity never decreases
   (`WIM:384`). The output unit is always the input unit: **no MTR→PCS (garment) conversion exists anywhere in
   Stitching**. Components (TOP/BOTTOM/DUPATTA) are never kitted into sets. Each one travels as its own line to
   Inventory.
8. **Quality checks.** Only a defect quantity + reason, which creates a `DefectRecord` (severity hard-coded MAJOR,
   `WIS:711-726`). **There is no Stitching QC stage** (see §3).
9. **Rework & rejection.** Defective pieces become a `DefectRecord` with status `OPEN`. **Nothing ever updates a
   DefectRecord**: grep finds no `defectRecord.update*` outside generated code. The Stitching defective shelf
   (`app/stitching/defective-shelf/page.tsx`) is read-only. There is no repair-and-return-to-good, scrap, or
   return-to-Recutting path, so defects are a permanent write-off. Defects cannot be corrected downward, even
   when typed by mistake (`WIM:384`).
10. **Outgoing challan rules.** `issueTransferChallan` (`WIS:1019-1224`). The idempotency key is per user. The line
    quantity must be >0 and ≤ `readyToTransfer` cumulatively per work item (`WIM:406-433`). The status must be
    COMPLETED, READY_FOR_TRANSFER or PARTIALLY_TRANSFERRED (`WIM:420`). The conditional update is guarded on the
    counter, `processedQuantity` and `heldQuantity` (`WIS:1129-1138`). Source-challan selection is mandatory
    (`WIS:1060`).
11. **Next-stage routing.** Fixed to FINISHING (`WIS:149`, `destinationOf` `WIS:74-79`). The generic API blocks
    STITCHING→FINISHING but **allows STITCHING→STEAM_PRESS, FINAL_CHECK, INVENTORY, BUTTON_ATTACHMENT or anything
    else** (X-1).
12. **Permissions.** STITCHING membership/admin (`department-access.ts:47-50`).
13. **Audit.** `STITCHING_RECEIVE`, `STITCHING_UPDATE` (before/after quantities), `STITCHING_TRANSFER`,
    `STITCHING_FABRIC_STATUS_CORRECTED`; ProductionTransaction `STITCHING_TAKE_IN` / `_PROCESS` / `_TRANSFER`;
    ChallanEvent ISSUE/RECEIVE.
14. **Files.** `apps/web/src/app/api/stitching/**` (9 wrappers), `WIS`, `WIM`, `apps/web/src/components/workflow/WorkProcess.tsx`
    (`WorkProgress`, `WorkIssueChallan`), `apps/web/src/lib/workflow-views.ts:138`, pages
    `apps/web/src/app/stitching/**`, migration `20261025_stitching_production.sql`.

15. **Defects.**

| # | Sev | Location | Defect & failure scenario |
|---|-----|----------|---------------------------|
| S-1 | **Critical** | `WIM:388` + `WIM:329` | **Defect quantity is subtracted twice.** `validateProductionUpdate` passes `receivedQuantity = taken − defect` into `validateWorkUpdate`, which subtracts `item.defectQuantity` again for `processLimit`. Example: received/taken 100, then defect 10 recorded, then the operator completes 90. The server returns "Processed quantity can be at most 80 PCS" [verified by execution]. The last 10 good pieces can never be completed. `statusAfterTransfer` needs processed + defect ≥ received (`WIM:267-268`), so the line can never reach TRANSFERRED and stays open on dashboards for ever [verified]. This affects Finishing and Steam Press identically. |
| S-2 | High | `WIM:380-381` + `WIM:329` | **HOLD is subtracted twice.** Received 100 with 10 on HOLD: the operator takes in 90 (allowed), then tries to complete 90 and is capped at 80 [verified by execution]. |
| S-3 | High | `WIS:533-537` | **Over-receipt is unbounded and becomes real stock.** A received figure above the challan quantity flows to Finishing as genuine pieces. |
| S-4 | High | `WIS:708-727`; no updater anywhere | **DefectRecord has no disposition.** Defective garments cannot be repaired back into good stock or scrapped with approval. Shelves only grow. |
| S-5 | High | `WIS:141-151` | **No unit conversion and no assembly/kitting.** Lines received in MTR (allowed by R-2 / cutUom=MTR) remain MTR through Finishing and Steam Press, and are refused only at Final QC → Inventory (`passUnit: 'PCS'`, `WIS:191`, check `WIS:1062`). By then they are stuck with no path back. |
| S-6 | Medium | `WIM:384` | A wrongly entered defect quantity can never be reduced, even by an admin. Good pieces are lost. |
| S-7 | Medium | `WIS:713` | `DefectRecord.severity` is always `MAJOR`. The operator cannot record CRITICAL/MINOR. |
| S-8 | Low | `WIS:534-547` | Zero receipt is accepted. The line sits RECEIVED with 0 forever (an open item with nothing to do). |

16. **Corrections.**
    (a) In `validateProductionUpdate`, pass `{...item, receivedQuantity: taken − defect, defectQuantity: 0,
    heldQuantity: 0}` (the hold and defect are already removed from `taken`). Alternatively compute the limit
    directly as `taken − defect`.
    (b) Add a defect-disposition API (REPAIRED → adds back to processed; SCRAPPED → closes with approver;
    RETURN_TO_RECUTTING for re-cut parts) that updates `DefectRecord.status`.
    (c) Allow an admin defect correction with an audit reason.
    (d) Require PCS output at Stitching, with a garment/set definition per style.
    (e) Apply the receipt tolerance and integer PCS rule from R-16(e).
17. **Tests.**
    * defect-then-complete reaches TRANSFERRED.
    * HOLD + take-in + complete.
    * taken ≤ received − held.
    * defect never exceeds taken − processed.
    * Transfer ≤ ready, across two lines for the same work item.
    * Concurrent double transfer (one 409).
    * Idempotent replay.
    * Receive twice (409).
    * Receive on a CANCELLED challan.
    * Transfer refused from IN_PROGRESS.
    * MTR line refused or converted before leaving Stitching.

---

## 3. STITCHING QC (existence)

* **Does not exist.** There is no `STITCHING_QC` department code, workflow, route or page (grep of
  `apps/web/src`, `packages/types/src`, `packages/config/src` and `schema.prisma` returns nothing). `QC_DEPARTMENTS`
  is `['QC2','QC3','FINAL_CHECK']` (`WIM:31`).
* The only stitching-quality control is the Final QC checkpoint `STITCHING_QUALITY` (`WIM:36`). It comes after
  Finishing and Steam Press have already spent labour on the garment.
* Final QC REWORK can only go to Steam Press (`WIS:197`). **A stitching defect (open seam, wrong attachment) found at
  Final QC cannot be routed back to Stitching.** It must be either "reworked" by Steam Press, which cannot fix it, or
  rejected to the **Fabric Store** defective shelf (`WIS:195`), which is the wrong destination for a sewn garment.
* **Severity: High (process gap).** Recommendation:
  * Add an end-of-line Stitching QC (a QC workflow entry with inbound `STITCHING_TO_STITCHING_QC`, PASS →
    FINISHING, REWORK → STITCHING, REJECT → a garment defect shelf), or at minimum inline AQL checkpoints in Stitching.
  * Give Final QC a per-defect rework destination (STITCHING / FINISHING / STEAM_PRESS) through a destination
    allow-list.
  * Tests: rework to Stitching re-enters as a new work item flagged as rework, and is not counted as fresh output.

---

## 4. FINISHING

1. **Purpose.** Thread trimming, checking and finishing of sewn garments (`WIS:152-163`; `production`, `finishedGoods`).
2. **Eligible incoming.** Only `STITCHING` / `STITCHING_TO_FINISHING` (`WIS:158`).
3. **Incoming rules.** The shared receive, non-strict. Fractional PCS is accepted (`WIS:542` applies to Inventory only).
4. **Production-sheet relationships.** As in Stitching. Garment images per sheet/category
   (`api/finishing/garment-images` → `apps/web/src/lib/garment-images-server.ts`).
5. **Inputs.** The same PATCH as Stitching. Transfer lines are `{workItemId}`; **the request quantity is ignored**. The
   server sends everything available (`WIS:1052-1058`).
6. **Process fields.** taken / processed / defect / status.
7. **Quantity & UOM.** As in Stitching. Finished goods are named via `garmentName` (`WIS:1143-1144`). There is no
   PCS-only rule.
8. **Quality checks.** Defect quantity only. No checkpoints (trims, measurement, stains).
9. **Rework & rejection.** As in Stitching: a write-off DefectRecord with no disposition, and no return to Stitching.
   Read-only shelf `app/finishing/defective-shelf/page.tsx`.
10. **Outgoing.** Whole-available transfer (the client-trusted quantity is fixed here). An item with nothing
    available is refused (`WIS:1055`). Conditional update guard as in Stitching.
11. **Routing.** Fixed to STEAM_PRESS (`WIS:160`). **BUTTON_ATTACHMENT is skipped by design** (see §5). The generic
    API allows FINISHING→anything except STEAM_PRESS (X-1).
12. **Permissions.** FINISHING membership/admin.
13. **Audit.** `FINISHING_RECEIVE/UPDATE/TRANSFER/FABRIC_STATUS_CORRECTED`, ProductionTransactions, and ChallanEvents.
14. **Files.** `apps/web/src/app/api/finishing/**` (10 wrappers), `WIS`, `WIM`, `apps/web/src/lib/finished-garments.mjs`,
    `apps/web/src/lib/garment-images-server.ts`, `apps/web/src/lib/workflow-views.ts:150`, `apps/web/src/app/finishing/**`.

15. **Defects.**

| # | Sev | Location | Defect & failure scenario |
|---|-----|----------|---------------------------|
| F-1 | **Critical** | `WIM:388`/`WIM:329` | Same as S-1/S-2. After any defect or HOLD, Finishing lines cannot complete and never close. |
| F-2 | High | `WIS:533-537` + `WIS:1052-1058` | **Over-receipt is amplified by the whole-available transfer.** Finishing receives 1 000 on a 100-pc challan, processes 1 000, and the transfer automatically sends 1 000 to Steam Press. Final QC receipt is strict only against the Steam Press challan (1 000), so 900 phantom garments reach Inventory. |
| F-3 | High | §3 | No return path to Stitching for stitching faults found in Finishing. They can only be written off. |
| F-4 | Medium | `WIS:1052-1058` | Partial dispatch of a ready line is impossible (for example a priority sub-lot). Each challan takes everything. A later challan edit can reduce the quantity (`apps/web/src/lib/challan-edit-server.ts:150-180`), which contradicts the "whole" rule. |
| F-5 | Medium | `WIS:542` | Fractional garments (for example 10.5 PCS) are accepted. They pass Final QC (unit check only) and then block at Inventory (integer check). |

16. **Corrections.** Apply S-16(a–c,e). Add Finishing→Stitching rework through an allow-list. Add finishing
    checkpoints (trim, stain, measurement). Enforce integer PCS from Stitching onward. Allow a partial quantity with
    an explicit flag.
17. **Tests.**
    * Whole-available transfer equals ready minus HOLD.
    * Over-receipt beyond tolerance refused.
    * Fractional PCS refused.
    * Transfer replay.
    * Complete after defect.
    * Generic challan FINISHING→STEAM_PRESS refused.
    * FINISHING→BUTTON_ATTACHMENT refused (after X-1 is fixed).

---

## 5. BUTTONS & ATTACHMENTS (existence)

* **No module exists.** `BUTTON_ATTACHMENT` appears only in the type enum (`packages/types/src/index.ts:52`),
  `DEPARTMENT_LABELS` and the unused `STANDARD_FACTORY_ROUTE` (`packages/config/src/index.ts:27,52`). It has no
  `WORKFLOWS` entry, no `DEPARTMENT_ACCESS` entry (`department-access.ts:7-79`), no station in `MES_DEPARTMENTS`
  (`apps/web/src/lib/departments.ts:14-31`), and no API or pages.
* **What happens to challans routed there:**
  * The workflow engine never routes there: Finishing `next` = STEAM_PRESS (`WIS:160`).
  * The generic `POST /api/challans` **accepts** e.g. `fromDepartment: FINISHING, toDepartment: BUTTON_ATTACHMENT`.
    `workflowIssuing` returns null for that pair (`WIS:247-259`), only the sender's membership is checked
    (`route.ts:276`), and a `BUTTON_ATTACHMENT` Department row is auto-created (upsert ~`route.ts:283-310`).
  * Nobody but an admin can receive or update it afterwards: `canUpdateChallan` → `userBelongsToDepartment` →
    `departmentKeyFor('BUTTON_ATTACHMENT')` = null (`department-access.ts:92-108,127-134`).
  * The challan becomes a **permanent orphan**. Its quantity is *not* deducted from the sender's work item, so the
    same garments are still sendable to Steam Press: a paper **over-issue across destinations**.
* **Severity: High (routing integrity).** Decide whether button/trim attachment is a real stage:
  * If **yes**: add a `WORKFLOWS.BUTTON_ATTACHMENT` entry (production + finishedGoods, inbound FINISHING, next
    STEAM_PRESS), access codes, a station, and pages, and change Finishing `next`.
  * If **no**: remove it from `STANDARD_FACTORY_ROUTE` and reject unknown or unconfigured destinations in the generic
    API (X-1).
* Tests: generic challan to an unknown or unconfigured department returns 400.

---

## 6. STEAM PRESS

1. **Purpose.** Press finished garments before Final QC (`WIS:164-177`; `production`, `finishedGoods`).
2. **Eligible incoming.** `FINISHING`/`FINISHING_TO_STEAM_PRESS`, and `FINAL_CHECK`/`REWORK_RETURN` (`WIS:170-173`).
3. **Incoming rules.** Shared receive, non-strict, fractional PCS allowed.
4. **Production-sheet relationships.** As above. Rework lines carry `sourceDepartment='FINAL_CHECK'` and
   `sourceWorkItemId` (`WIS:359,366`).
5. **Inputs / 6. Process fields / 7. Quantity.** Identical to Finishing (whole-available transfer).
8. **Quality checks.** Defect quantity only. Pages `steam-press/my-work/defective` use the read-only `DefectiveShelf`.
9. **Rework & rejection.** Final QC REWORK → Steam Press → a new STEAM_PRESS work item → re-pressed → a new
   `STEAM_PRESS_TO_FINAL_CHECK` challan → a new FINAL_CHECK work item, re-inspected. **Repeated passes double-count
   output.**
   * Each pass creates a new work item and a new `STEAM_PRESS_PROCESS` / `_TRANSFER` ProductionTransaction with no
     rework flag (`WIS:746-760`, `1173-1190`).
   * Steam Press "completed" / "challansIssued" (`WIS:1233,1284`) and any sheet-level production sum count a garment
     once per pass.
   * Final QC inspected totals count it again.
   * Rework is distinguishable only by joining `sourceDepartment = FINAL_CHECK`.
10. **Outgoing.** Whole-available transfer to FINAL_CHECK (`WIS:174`). Final QC receipt is strict (`WIS:192`).
11. **Routing.** Fixed. The generic API blocks STEAM_PRESS→FINAL_CHECK but allows STEAM_PRESS→INVENTORY and others
    (X-1). Final QC's REWORK destination is hard-wired to Steam Press, which is wrong for stitching or finishing
    faults (§3).
12. **Permissions.** STEAM_PRESS membership/admin.
13. **Audit.** `STEAM_PRESS_RECEIVE/UPDATE/TRANSFER`, ProductionTransactions, and ChallanEvents.
14. **Files.** `apps/web/src/app/api/steam-press/**` (9 wrappers), `WIS`, `WIM`, `apps/web/src/lib/workflow-views.ts:165`,
    `apps/web/src/app/steam-press/**` (16 pages).

15. **Defects.**

| # | Sev | Location | Defect & failure scenario |
|---|-----|----------|---------------------------|
| P-1 | **Critical** | `WIM:388`/`WIM:329` | Same as S-1/S-2 (defect and HOLD subtracted twice). |
| P-2 | High | `WIS:533-537`, `WIS:1052-1058` | Over-receipt is amplified into Final QC (as F-2). |
| P-3 | Medium | `WIS:746-760, 1173-1190` | Rework passes counted as fresh production. There is no `isRework` flag on the work item or transaction, so efficiency, OEE and output reports overstate. |
| P-4 | Medium | `WIS:197` | Rework loop limited to Steam Press: a garment failing STITCHING_QUALITY is "reworked" by pressing, or rejected to the Fabric Store. |

16. **Corrections.**
    * Add `isRework` (or `reworkOfWorkItemId`) to work items and transactions, and exclude rework from output KPIs.
    * Make Final QC rework destination-selectable from an allow-list.
    * Apply S-16(a) and R-16(e).
17. **Tests.**
    * Rework round trip: Final QC REWORK 5 → Steam Press receives 5 → transfer 5 → Final QC new item. Totals of fresh
      output unchanged.
    * Strict Final QC receipt.
    * Defect/HOLD completion.
    * Replayed rework challan creates no second work item (`@@unique([departmentCode, inboundChallanItemId])`,
      schema.prisma:1680).

---

## 7. Cross-cutting defects (affect every stage above)

| # | Sev | Location | Defect & failure scenario |
|---|-----|----------|---------------------------|
| X-1 | **High** | `apps/web/src/app/api/challans/route.ts:256-281` | **No destination allow-list in the generic challan API.** The only checks are "the pair is not owned by a workflow" (`workflowIssuing`) and "the sender is your department". A Stitching user can POST STITCHING→STEAM_PRESS / FINAL_CHECK / INVENTORY / BUTTON_ATTACHMENT with any quantity and a free-text `challanType` (`route.ts:506`). The quantity is not deducted from the work item, so the stage is skipped on paper and over-issued across destinations. Such challans are then receivable through the generic status route by the destination (`[id]/status/route.ts:59` only blocks workflow-owned pairs). |
| X-2 | **High** | `apps/web/src/app/api/challans/[id]/status/route.ts:51-69`, `department-access.ts:127-134` | **Sender or receiver can set any status on a workflow challan** (CANCELLED, REJECTED, COMPLETED, DRAFT). Only RECEIVED is diverted. Example: Finishing marks an unreceived STITCHING_TO_FINISHING challan CANCELLED. Finishing receive then refuses it (`WIS:519`), Stitching's `transferredQuantity` is never restored, and the garments vanish. Setting COMPLETED before the first sync means `syncWorkItems` (`INBOUND_STATUSES`, `WIS:261,324`) never creates the work items. No status allow-list or transition table exists. |
| X-3 | High | `apps/web/src/app/api/challans/[id]/route.ts:114,179` | Admin hard-delete of a workflow challan deletes downstream work items (even ones already processed and transferred onward), does not restore the sender's `transferredQuantity` or allocation `transferredQuantity`, and **deletes the challan's AuditLog rows**, destroying the audit trail. |
| X-4 | Medium | `WIS:343-348`, `RS:179-184` | String-ordered "max + 1" numbering breaks past 9999 per year/prefix (see R-6). |
| X-5 | Medium | `department-access.ts:110-115` | No segregation of duties. Any operator can correct quantities, cancel allocations or issue challans. Supervisor and incharge roles are not distinguished. |
| X-6 | Low | `WIS:261, 324-327` | `syncWorkItems` runs on GET (list/dashboard/floor-board), so reads perform writes. A failure after 3 P2002 retries is only logged (`WIS:376-383`). |

**Checked and NOT present in current code (previously reported classes):**
* Over-issue within a workflow transfer is prevented by cumulative per-item checks (`WIM:410-432`) and a conditional
  `updateMany` on counter, `processedQuantity` and `heldQuantity` (`WIS:1129-1138`; Recutting `RS:501-505`).
* "Guards disabled when good=0": transfer requires quantity > 0 and `TRANSFERABLE_STATUSES`. Completion requires
  processed > 0 (`WIM:349`).
* Receive replay on finished jobs: refused when no line is AWAITING_RECEIPT (`WIS:520-521`) and per line by
  conditional update (`WIS:553-565`).
* Complete-twice: optimistic `updatedAt` guard (`WIS:694-707`). A TRANSFERRED line is immutable (`WIM:317`).
* Client-trusted transfer quantity in Finishing and Steam Press: fixed, because the server computes it
  (`WIS:1052-1058`). It is still client-trusted in Recutting's cross-unit line (R-2).
* Negative or zero item lines are refused (`WIM:422`, `RM:92,180`, `apps/web/src/lib/challan-edit-server.ts:96`).
* Challan-number collisions: unique `(fromDepartment, challanNumber)` (schema.prisma:779) plus pre-check plus P2002 mapping.
* Inspect accepted from the wrong status, and HOLD saved as pass: not applicable to these production stages. QC
  inspection requires receipt (`WIM:232`), and held quantity is excluded from inspectable quantity (`WIM:156-159`).

---

## 8. Priority fix list

1. **S-1/S-2** double subtraction of defect/HOLD (`WIM:388`). This is a one-line fix and unblocks line closure in
   Stitching, Finishing and Steam Press.
2. **R-1/R-2** unbounded cross-unit cut and send quantities. Introduce a conversion factor.
3. **X-1/X-2** destination allow-list and challan status-transition table for workflow challans.
4. Receipt tolerance (`strictReceipt` + %), plus integer PCS from Stitching onward (R-5, S-3, F-2, F-5).
5. DefectRecord disposition plus rework destinations (Stitching QC / Final QC → Stitching) (S-4, §3).
6. Decide BUTTON_ATTACHMENT: implement it or remove it (§5).
7. Rework flagging so output is not double-counted (P-3), and remnant/wastage closure in Recutting (R-4).
8. Build a test harness. The pure modules `work-items.mjs` / `recutting.mjs` are directly unit-testable with
   `node --test` today.
