# Audit 14: Final QC, Inventory/Packing, Finished Goods, Dispatch

Branch audited: `fix/mes-production-readiness` (same as origin/main, HEAD 349af5a). Audit date: 2026-11-02.
Method: I read the code statically and did not trust docs/. I did not run anything, connect to any database or change any source file.
All paths are relative to `apps/web/src/` unless they start with `packages/`.

## 0. Executive summary

| # | Severity | Department | Finding | Where |
|---|---|---|---|---|
| D1 | **Critical** | Dispatch / FG | **There is no dispatch flow.** `DispatchOrder`, `DispatchCarton`, `Carton`, `CartonBundle` and `InventoryStock` are schema-only. Nothing in app code reads or writes them, and there is no `api/dispatch` or `api/packing/cartons` route. Packed goods never leave the system, so FG stock only grows and can never be decremented or shipped. | `packages/database/prisma/schema.prisma:1053-1130, 917-931`; `lib/inventory.mjs:1-15` (no exit state); `lib/work-items-server.ts:201-202` ("nothing is sent onward") |
| D2 | High | Dispatch (client contract) | `lib/api.ts` still exposes `getCartons`, `packCarton`, `getDispatches` and `createDispatch`. They call `/api/packing/cartons` and `/api/dispatch`, and neither route exists, so any caller gets a 404. | `lib/api.ts:429-455` |
| D3 | High | Final QC | **Race: transferred > passed, or REJECT sent twice.** The transfer guard checks only `[counter]`, `processedQuantity` and `heldQuantity`. It does not check `passedQuantity`, `rejectedQuantity`, `reworkQuantity` or `updatedAt`. Suppose a concurrent decision change (REJECT→REWORK) or an inspection edit (PASS→REJECT) commits first. The waiting `updateMany` then still matches, so pieces leave both as PASS to Inventory **and** as REJECT/REWORK. This inflates FG stock. | `lib/work-items-server.ts:1131`; `lib/qc-decision-server.ts:56,167`; `lib/work-items-server.ts:1527-1531` |
| D4 | High | Final QC | **Rework can only go to Steam Press.** Final QC finds stitching faults (open seams, measurement, labels; see the checkpoints in `lib/work-items.mjs:35-41`), but there is no route back to Stitching or Finishing. | `lib/work-items-server.ts:196-197` |
| D5 | High | Final QC / Defective shelf | **Rejected finished garments dead-end.** REJECT goes on a `DEFECT_RETURN` challan to the *Fabric Store raw-fabric quarantine shelf*. Nothing disposes of them: there is no scrap, second-quality, salvage or write-off, and no `defectRecord.update` anywhere in app code. | `lib/work-items-server.ts:195`; `lib/quality-monitor-server.ts:395-446` |
| D6 | High | Inventory / audit | **An admin challan DELETE destroys FG history.** Deleting a Final QC→Inventory challan cascade-deletes the Inventory work items and (via FK cascade) every `PackingAllocation`. It also deletes the challan's `AuditLog` rows. The INVENTORY `StockLedgerEntry` rows are orphaned, and Final QC's `transferredQuantity` is never reversed, so the pieces vanish. | `app/api/challans/[id]/route.ts:114,179-184`; `packages/database/prisma/manual-migrations/20261026_inventory_packing.sql` (`ON DELETE CASCADE`) |
| D7 | High | Final QC / Inventory | **Generic challan PATCH can cancel or re-status a Final QC→Inventory challan without any audit.** It has no status whitelist, and Final QC's counters are not reversed. A challan cancelled before receipt can never be received (409), so its pieces are stranded. | `app/api/challans/[id]/route.ts:209-360`; `lib/auth/department-access.ts:127-134`; `lib/work-items-server.ts:519` |
| D8 | Medium | Inventory receipt | **Receipt shortages vanish.** Final QC sends 100 and Inventory receives 95. The 5 short pieces exist only as a remark ("Short by 5 PCS"). Nothing reconciles them, returns them to Final QC or writes them off, and they appear in neither department's stock. | `lib/work-items-server.ts:536-547, 565-581` |
| D9 | Medium | Final QC | **Fractional pieces and MTR lines dead-end.** Inspection accepts non-integer quantities on PCS lines (no integer check), and so does the PASS transfer. Inventory accepts only whole pieces, so 0.5 PCS can never be received. A Final QC line in MTR can be passed, but the PASS transfer is refused (`passUnit`), so it is stuck forever. | `lib/work-items.mjs:231-256`; `lib/work-items-server.ts:1052-1064`; `lib/work-items-server.ts:539-541` |
| D10 | Medium | Inventory/Packing | **Packing has no cartons, sizes, packing list or barcode.** A "PKG" allocation is only a counter (`packedQuantity`). Work items have no size, so a size-ratio pack cannot be expressed, and nothing can be shipped by carton. | `lib/inventory-server.ts:356-549`; `schema.prisma:1948-1969` |
| D11 | Medium | Inventory / reports | **Totals come from slices capped by `take`.** `listRecords` and `listPacking` fetch `take: 2000`, *then* filter by status and return `total = filtered.length`. Final QC lists cap at 500/300/200/100. Hold lists cap at 500, and the quality monitor's HOLD counts are built on that capped list. | `lib/inventory-server.ts:276-293, 336-343`; `lib/work-items-server.ts:491,645,1008,1397,1418,1466`; `lib/holds-server.ts:166,574`; `lib/quality-monitor-server.ts:449` |
| D12 | Medium | Holds | **Inventory HOLD can only be released.** Held finished goods have no disposition (no reject or rework from Inventory), and packed goods cannot be held at all. Hold candidate lists stop after 400 lines, so older lines cannot be put on HOLD. | `lib/holds-server.ts:98,147-224`; `lib/holds-server.ts:781-813` |
| D13 | Medium | Defective shelf | `/api/defective-shelves` has no department check: any signed-in station sees every shelf, every defect record and every quarantined roll. Its department filter is a substring match (`contains`). | `app/api/defective-shelves/route.ts:55-110` |
| D14 | Medium | Final QC | Inspection edits do not need a reason (`editReason` is optional) and do not re-check the checkpoints. They also leave the `QualityInspection`, `DefectLog` and `ProductionTransaction` written at inspection unchanged, so the Production Sheet quality view goes stale. | `lib/work-items-server.ts:1478-1557` vs `:865-933` |
| D15 | Low | Numbering | Packing, work item and HOLD numbers are made as "highest + 1" with lexicographic `orderBy desc` and a 4-digit pad. After `-9999`, the "latest" stays `…-9999`, so every new number collides. Three P2002 retries then fail. | `lib/inventory-server.ts:153-162,370-430`; `lib/work-items-server.ts:333-339`; `lib/holds-server.ts:707-709` |
| D16 | Low | Generic challans | `INVENTORY→anything` and `FINAL_CHECK→(not Inventory/Store/Steam Press)` generic challans are allowed, and `Department` rows are upserted for unknown codes. These "dispatch-like" documents move no stock. | `app/api/challans/route.ts:256-300`; `lib/work-items-server.ts:247-258` |
| D17 | Low | Ledger semantics | `PACKED` ledger rows are posted as **+qty** with `balanceAfter = available`. Summing the ledger's `quantity` column (the obvious report) double-counts the pieces. Only `balancesFromLedger` knows the rule. | `lib/inventory-server.ts:511-529`; `lib/inventory.mjs:183-191` |
| D18 | Low | Migration | `InventoryStock` rows under `PACKING` that collide with an `INVENTORY` identifier are left under `PACKING` (orphaned). Legacy `FINISHED_GOODS` stock is left as is and shown read-only. | `packages/database/prisma/manual-migrations/20261026_inventory_department.sql` (step 3) |

These were verified safe: concurrent **Send for Packing** cannot over-allocate, because of the optimistic guard on taken/processed/held (`lib/inventory-server.ts:375-379`). Concurrent **PACK/RETURN** cannot over-pack, because of the allocation guard on packed/returned/startedAt (`lib/inventory-server.ts:493-497`). A double **receipt** is blocked by the `AWAITING_RECEIPT` guard plus the ledger `idempotencyKey` (`lib/work-items-server.ts:553-581`). Packing idempotency keys are scoped per user and per endpoint (`lib/inventory-server.ts:135-151`).

There are **no automated tests** in the repository for any of these modules (no `*.test.*` or `*.spec.*` files were found).

---

## 1. FINAL QC (department `FINAL_CHECK`, station `finalqc`)

1. **Purpose:** Final inspection of finished, pressed garments. Each inspected piece gets one outcome: PASS (sent to Inventory), REJECT (sent to the defective shelf) or REWORK (sent back for rework). Defined at `lib/work-items-server.ts:178-200`.
2. **Eligible incoming departments:** Steam Press only. Challan types `STEAM_PRESS_TO_FINAL_CHECK` and legacy `INTER_DEPARTMENT` (`lib/work-items-server.ts:185-188`). Rework comes back on a normal Steam Press challan.
3. **Incoming challan rules:**
   - Work items are created by `syncWorkItems` for challans in ISSUED, IN_TRANSIT or RECEIVED (`:261,322-391`).
   - Receipt is strict: no line may be received above the dispatched quantity (`:536`).
   - Every pending line must be received at once (`:529-533`).
   - CANCELLED and REJECTED challans are refused (`:519`).
   - Generic PATCH to RECEIVED is blocked (`app/api/challans/[id]/route.ts:239-245`).
   - Finished-goods challans carry garments by name and image only; Steam Press sends every available piece (`lib/finished-garments.mjs:1-5`).
4. **Production-sheet relationships:** Each work item keeps its line's `programId` (`lineSheetId`, `:345`). A transfer may carry several sheets, and each challan line keeps its own (`lib/work-items.mjs:436-438`). The source line is linked through `sourceWorkItemId` and `sourceChallanItemId`.
5. **Inputs:** The received quantity per line. For each inspection batch: inspected, PASS, REJECT and REWORK quantities, the reasons, and five PASS/FAIL checkpoints (`lib/work-items.mjs:35-41`).
6. **Process fields:**
   - `processedQuantity` (inspected), `passedQuantity`, `rejectedQuantity`, `reworkQuantity`.
   - `transferredQuantity`, `rejectSentQuantity`, `reworkSentQuantity`, `heldQuantity`.
   - `WorkItemInspection` rows; `QualityInspection` with `QualityInspectionParameter` and `DefectLog`.
7. **Quantity & UOM rules:**
   - PASS + REJECT + REWORK must equal the inspected quantity (`lib/work-items.mjs:249-252`).
   - A batch cannot inspect more than `availableToProcess`, which already excludes HOLD.
   - **No integer rule for PCS** (D9). PASS must be in PCS (`passUnit`, `:1062`). Finished goods always send the full available quantity, so any client quantity is ignored (`:1052-1058`).
8. **Quality checks:**
   - All five checkpoints are required. A FAIL forces part of the batch to REJECT or REWORK (`lib/work-items.mjs:51-63`).
   - There is no AQL or sampling plan: `sampleSize` = the inspected quantity (`:874`).
   - There is no defect-code master; reasons are free text.
9. **Rework & rejection:**
   - REWORK goes only to Steam Press as `REWORK_RETURN` (`:197`). **There is no path back to Stitching or Finishing (D4).**
   - REJECT goes to Fabric Store `DEF-SHELF-STORE` as `DEFECT_RETURN` (`:195,1109-1111`). **It is never disposed of (D5).**
   - Decision changes REJECT↔REWORK↔HOLD go through `lib/qc-decision-server.ts:32-226`. REJECT/REWORK→PASS is only possible by editing the inspection (`lib/work-items-server.ts:1478`).
   - Quantity already sent cannot be re-decided (`qc-decision-server.ts:80-87`), and there is no "recall challan" feature.
10. **Outgoing documents:** Transfer challans:
    - PASS: `FINAL_CHECK_TO_INVENTORY`.
    - REJECT: `DEFECT_RETURN`, with `defectivePieces`, the shelf and the reason.
    - REWORK: `REWORK_RETURN`.
    Each line carries a `ChallanItem`, a `DepartmentWorkTransfer` and a `ProductionTransaction` (`:1092-1192`).
11. **Routing:**
    - Steam Press → Final QC.
    - Final QC → Inventory, or → Store defective shelf, or → Steam Press for rework.
    - Generic challans to those three destinations are blocked (`workflowIssuing`, `:247-258`). Generic challans to any *other* department are allowed (D16).
12. **Permissions (server-side):**
    - `guarded` → `requireDepartment(cfg.key)` on every handler (`:415-423`). This is department-level only: roles were removed in 1f233c6. Every Final QC user can inspect, edit an inspection, change a decision and issue any challan.
    - Fabric-status correction is admin-only (`:719`).
    - Holds use `userBelongsToDepartment` (`lib/holds-server.ts:530-539`).
13. **Audit events:** `FINAL_CHECK_RECEIVE`, `_INSPECTION`, `_INSPECTION_EDITED`, `_DECISION_CHANGED`, `_TRANSFER`, `_REJECT_TRANSFER`, `_REWORK_TRANSFER`, `QC_NOTES_UPDATE`, `HOLD` and `HOLD_RELEASE`, plus `ChallanEvent` ISSUE/RECEIVE. **Gaps:**
    - The generic challan PATCH writes no audit (D7).
    - The admin DELETE erases audit rows (D6).
    - An inspection edit does not require a reason (D14).
14. **Implementation files:**
    - API routes: `app/api/final-check/**` (thin wrappers).
    - Logic: `lib/work-items-server.ts`, `lib/work-items.mjs`, `lib/qc-decision-server.ts`, `lib/holds-server.ts`, `lib/holds.mjs`, `lib/finished-garments.mjs`.
    - UI: `components/workflow/*` and `app/final-check/**` (reports and queue redirect).
15. **Defects:**
    - **D3 (High).** Scenario: line has 10 REJECT pending. Supervisor A opens the Rejected page while B changes 10 REJECT→REWORK. B's transaction commits first. A's `updateMany` (`:1131`) re-checks `rejectSentQuantity`, `processedQuantity` and `heldQuantity`, which are all unchanged, so it succeeds. Result: `rejectSentQuantity=10 > rejectedQuantity=0` while `pendingRework=10`, so 10 more can leave as REWORK, and 20 pieces leave out of 10. The PASS variant (`editInspection` PASS→REJECT racing a PASS transfer) puts phantom pieces into Inventory.
    - **D4 (High).** Fails a garment for an open seam; the only rework path is pressing it again.
    - **D5 (High).** Rejected kurtas sit on the raw fabric shelf with status `ON_SHELF` forever. The quality monitor shows them as inactive (`quality-monitor-server.ts:225`), but they are never closed.
    - **D9 (Med).** A 12.5 PCS PASS goes on a challan, Inventory can receive at most 12, and 0.5 is lost silently with only a "Short by 0.5" remark.
    - **D14 (Med).** Inspection edit is unaudited for reason and leaves the quality records stale.
    - **D11 (Med).** `listItems` uses `take: 500` *before* stage, ready and outcome filtering (`:645-660`). Once the department has more than 500 lines, older lines that are passed but not sent disappear from the Issue Challan screen.
    - **D7 (High).** Final QC (as the sending department) can PATCH its own Inventory challan to CANCELLED. Inventory then gets 409 on receive, and Final QC's `transferredQuantity` stays consumed, so the goods are stranded.
16. **Corrections:**
    - Add `updatedAt` (or `passedQuantity`, `rejectedQuantity`, `reworkQuantity`) to the transfer guard at `:1131`, or call `lockSource` first and re-read the line inside the transaction.
    - Make `reworkTo` selectable per defect type: STITCHING (`REWORK_RETURN`), FINISHING, or STEAM_PRESS. Add matching inbound routes.
    - Send FG rejects to a Final QC / FG defective location. Add disposition actions (SCRAP, SECOND_QUALITY, SALVAGE, RE-INSPECT) that close the `DefectRecord`, with audit.
    - Enforce `Number.isInteger` on PCS inspection and PASS quantities. Block or convert MTR lines at Final QC receipt.
    - Require `editReason`, re-validate the checkpoints, and write a correcting `QualityInspection`.
    - Refuse a generic PATCH of status or departments on workflow-owned challans. Add a proper "recall challan" endpoint that reverses the counters.
    - Paginate in the database, not after `take`.
17. **Tests that should exist:**
    - Concurrent decision change vs REJECT transfer, and concurrent inspection edit vs PASS transfer. Both must give 409.
    - Rejection of non-integer PCS inspection.
    - MTR line at Final QC cannot be stranded.
    - Checkpoint FAIL with all PASS must be refused.
    - Cancelling an issued Final QC→Inventory challan must be refused, or must reverse `transferredQuantity`.
    - `listItems` with more than 500 lines still returns old passed lines.

---

## 2. INVENTORY / PACKING (department `INVENTORY`, station `inventory`, alias `packing`)

1. **Purpose:** Receive passed finished garments from Final QC, hold them as stock in pieces, and pack them in "packing allocations" (`lib/inventory.mjs:1-15`, `lib/inventory-server.ts:20-22`). It is the last department.
2. **Eligible incoming departments:** Final QC only. Challan types `FINAL_CHECK_TO_INVENTORY`, plus legacy `FINAL_CHECK_TO_PACKING` and `INTER_DEPARTMENT` (`lib/work-items-server.ts:210-214`).
3. **Incoming challan rules:**
   - Shared strict receipt with `garmentStock`: PCS only, whole pieces, never above dispatched (`lib/work-items-server.ts:536-542`).
   - One `RECEIPT` ledger row per line, with `idempotencyKey` `INVENTORY_RECEIPT:<workItemId>` (`:565-581`).
   - Shortages are recorded only as remarks (D8).
4. **Production-sheet relationships:**
   - A record is one received challan line (`DepartmentWorkItem`) with its `programId`.
   - Garment images are keyed by (program, category, style), with a category fallback (`inventory-server.ts:57-77`). Program-scoped: correct.
   - Ledger `itemCode = itemNumber` (unique per line), so it is program-scoped but **not SKU-aggregated**. There is no stock view per design × style × colour × size.
5. **Inputs:**
   - Receipt: received pieces and remarks.
   - Send for Packing: `workItemId`, quantity, packing date, priority, remarks, idempotency key.
   - Packing action: START, PACK with a quantity, or RETURN with a quantity and a mandatory reason.
6. **Process fields:**
   - Work item: `receivedQuantity`, `takenQuantity` (sent net of returns), `processedQuantity` (packed), `heldQuantity`.
   - `PackingAllocation`: `quantity`, `packedQuantity`, `returnedQuantity`, `status`, `startedAt`, `completedAt`.
7. **Quantity & UOM rules:**
   - available = received − sent − held
   - inPacking = sent − packed
   - remaining = received − packed
   (`lib/inventory.mjs:61-75`)
   - Whole pieces only (`wholePieces`, `:52-58`).
   - PACK and RETURN may not exceed the allocation's open quantity (`:159-180`).
   - There are no DB CHECK constraints (`20261026_inventory_packing.sql`).
8. **Quality checks:** None at Inventory, and there is no packing audit (no AQL on packed cartons). A defect found during packing can only be RETURNed to stock (unpacked) or put on HOLD. It cannot be rejected or reworked.
9. **Rework & rejection:** There is no path. Inventory has no `qc` config and no `next` (`lib/work-items-server.ts:203-216`), and `destinationOf` throws "sends nothing onward" (`:77`).
10. **Outgoing documents:** None. `PKG-YYYY-NNNN` allocations are internal; there is no carton label, packing list, delivery challan or invoice.
11. **Routing:** Final QC → Inventory → (end). The only possible "exit" is a generic `INVENTORY→X` challan, which does not decrement stock (D16).
12. **Permissions:** Every endpoint uses `guarded(request, WORKFLOWS.INVENTORY)` (`inventory-server.ts:254,298,317,357,443,553,613,656`). Access is by department only; there is no supervisor approval for RETURN or for a large PACK.
13. **Audit events:**
    - `INVENTORY_RECEIVE`, `INVENTORY_SEND_FOR_PACKING`, `INVENTORY_PACKING_UPDATE_{START,PACK,RETURN}`, `INVENTORY_GARMENT_IMAGE`.
    - Ledger rows: `RECEIPT`, `SENT_FOR_PACKING`, `PACKING_STARTED`, `PACKED`, `RETURNED_FROM_PACKING`, `IMAGE_UPLOADED`.
14. **Implementation files:**
    - API routes: `app/api/inventory/**`.
    - Logic: `lib/inventory-server.ts`, `lib/inventory.mjs`, `lib/garment-images-server.ts`.
    - UI: `components/inventory/{InventoryScreens,InventoryUi,InventoryRecords}.tsx`, `app/inventory/**`. `app/packing/**` are redirects only.
15. **Defects:**
    - **D1 (Critical).** Packed pieces have no terminal state. `inventoryStatus` ends at `PACKED` (`inventory.mjs:91`), and nothing ever reduces `processedQuantity` or posts a negative movement after PACKED. FG is therefore permanently inflated, and the stock and dashboard "packed" totals (`inventory-server.ts:583`) grow forever.
    - **D6 (High).** Scenario: an admin deletes challan FQC-123 to "fix a typo". The cascade removes 3 INV records and 7 PKG allocations. The 14 INVENTORY ledger rows remain and point at deleted ids. Final QC still shows those pieces as transferred, and the audit trail for the challan is deleted.
    - **D8 (Med).** Short receipt leaves pieces unaccounted for; there is no discrepancy document.
    - **D10 (Med).** No carton, size, ratio, weight or barcode, so a buyer packing list cannot be produced. The `Carton` model exists but is unused.
    - **D11 (Med).** `listRecords` fetches 2000 rows, *then* filters `status=OPEN|AVAILABLE` and reports `total` from the filtered slice (`inventory-server.ts:276-293`). With more than 2000 records, older available stock is invisible and "total" is wrong. `listPacking` has the same problem (`:336-343`). The dashboard has no limit at all (`:556-557`), so it slows down as data grows.
    - **D15 (Low).** After PKG-2026-9999, Send for Packing fails permanently for the year (`:153-162`). INV-, FQC- and HLD- numbers have the same problem.
    - **D17 (Low).** Ledger sign convention (see the summary table).
    - Not exploitable but fragile: the PACK/RETURN item guard (`:501`) omits `heldQuantity`. This is harmless today because PACK and RETURN do not reduce available, but it differs from the Send guard.
16. **Corrections:**
    - Build cartons. A Carton has program, style, colour, size and qty, a `CTN-` sequence from a DB sequence, and a barcode. PACK must create or append to cartons and post `CARTON_PACKED`.
    - Build dispatch. `DispatchOrder` goes DRAFT→APPROVED→DISPATCHED. It posts negative `DISPATCHED` ledger rows, moves cartons to DISPATCHED and decrements FG.
    - Add a receipt-discrepancy flow: short pieces go back to Final QC as "missing" or are written off with approval.
    - Replace the cascade delete with a reversing "void" that keeps the audit log and the ledger.
    - Use DB-side pagination and counts.
    - Generate document numbers from Postgres sequences (or `LPAD` with numeric `ORDER BY`).
    - Post PACKED as a 0-qty memo, or as a separate packed-balance ledger.
17. **Tests that should exist:**
    - Concurrent Send for Packing on the same record, so the total never exceeds available.
    - Concurrent PACK on the same allocation.
    - Idempotent replay returns the same PKG.
    - RETURN without a reason is refused.
    - The ledger rebuild (`balancesFromLedger`) equals `stockOf` after a random sequence of actions.
    - Packing numbers past 9999.
    - `listRecords` total with more than 2000 records.
    - Admin challan delete leaves no orphan ledger rows.

---

## 3. FINISHED GOODS INVENTORY

1. **Purpose:** FG stock per received line, in pieces. It is the same entity as section 2. There is no separate FG store: `InventoryStock` is unused by app code, and the legacy `FINISHED_GOODS` ledger is shown as history only (`inventory-server.ts:26-27,616`).
2. **Eligible incoming departments:** Final QC PASS only (see 2.2).
3. **Incoming challan rules:** As 2.3.
4. **Production-sheet relationships:** Per line, not per SKU. Two Final QC challans of the same design, style and colour become two records, and **no screen shows the stock of one SKU**. Size is not tracked anywhere downstream of cutting.
5. **Inputs:** Receipt only.
6. **Process fields:** `stockOf()` buckets (received, sent, packed, held, available, inPacking, remaining).
7. **Quantity & UOM rules:** PCS integers. Meters are refused at receipt (`work-items-server.ts:539-541`).
8. **Quality checks:** None. A HOLD with reason QUALITY_ISSUE is the only mechanism.
9. **Rework & rejection:** None (D12).
10. **Outgoing documents:** None (D1).
11. **Routing:** Terminal.
12. **Permissions:** Inventory department, plus admin.
13. **Audit events:** Ledger rows and `AuditLog` (see 2.13). The ledger is append-only in code, but deletes cascade (D6).
14. **Implementation files:** As section 2; `lib/holds-server.ts:177-181` for Inventory HOLD lines.
15. **Defects:**
    - D1: FG can never be decremented.
    - D8: Shortage leakage.
    - D11: Totals capped by `take`.
    - D12: HOLD dead-ends.
    - D18: Orphaned legacy stock.
    - SKU keys are program-scoped but per *line*, so a buyer-level availability query is impossible without client-side summing over 2000-row slices.
16. **Corrections:**
    - Introduce an FG SKU key (program, category, style, colour, size) and either a materialized `InventoryStock` row per SKU, updated in the same transaction as each ledger post, or a SQL view.
    - Reconcile legacy `FINISHED_GOODS` and `PACKING` `InventoryStock` rows.
17. **Tests:**
    - Per-SKU balance equals the sum of the line balances.
    - The ledger never goes below zero.
    - Legacy rows are reconciled.

---

## 4. DISPATCH

1. **Purpose:** Ship packed cartons to the customer. **This is not implemented.**
2–11. Schema only. `DispatchOrder` has status DRAFT/APPROVED/DISPATCHED/DELIVERED/CANCELLED, a transporter, a vehicle and an LR, and links to cartons through `DispatchCarton` (`schema.prisma:1091-1130`). There is no route, no page, no ledger entry type and no permission entry. A search of all `.ts`, `.tsx` and `.mjs` files under `apps/web/src` (excluding `generated/`) found no reference to `dispatchOrder` or `carton`, except the client stubs and the cascade cleanup in the admin delete routes.
12. **Permissions:** None. The `DEPARTMENT_ACCESS` map has no DISPATCH key.
13. **Audit events:** None.
14. **Implementation files:** `packages/database/prisma/schema.prisma:1053-1130`; dead client code at `lib/api.ts:429-455`; cascade cleanup in `app/api/challans/[id]/route.ts:154-168`.
15. **Defects:**
    - D1 (Critical): no dispatch.
    - D2 (High): the client calls endpoints that return 404.
    - "Dispatched" is also used in the Inventory UI to mean the quantity *Final QC sent* (`InventoryScreens.tsx:274-305`, `inventory-server.ts:94,203`). Once real dispatch exists this will confuse users.
    - A generic `INVENTORY→<anything>` challan is the only way to produce a shipping document. It upserts arbitrary `Department` rows and decrements no stock (D16).
16. **Corrections:** Implement the following:
    - Carton build.
    - Dispatch order with approval by a separate user (segregation of duties).
    - Gate pass/delivery challan print.
    - A `DISPATCHED` ledger post decrementing FG.
    - Carton status moves.
    - Cancellation that reverses everything.
    - A dispatch register report.
    - Delete the dead `lib/api.ts` methods until then.
    - Rename "Dispatched" in Inventory to "Sent by Final QC".
17. **Tests:**
    - A dispatch cannot include unpacked or held cartons, or cartons from another program.
    - Double dispatch of the same carton is refused (unique constraint plus guard).
    - FG decrements once; cancel restores.
    - Approval by the creator is refused.

---

## 5. Cross-department features

### 5a. HOLDS (`app/api/holds/**`, `lib/holds-server.ts`, `lib/holds.mjs`)
- **Purpose:** Block part of a line in any department from Dyeing to Inventory (`holds-server.ts:76-90`).
- **Server enforcement:**
  - `requireUser` plus `userBelongsToDepartment` (`holds-server.ts:530-539,587,785`).
  - Placing a HOLD calls `lockSource` and reads after the lock (`:638-663`).
  - `heldQuantity` is kept in sync in the same transaction (`syncHeld`, `:612-622`).
  - Release uses an `updatedAt` guard (`:796-806`).
- **Defects:**
  - D12: Inventory HOLD has no disposition, and packed goods cannot be held.
  - Candidates are limited to 400 lines (`:98,166`).
  - `listHolds` is limited to 500 (`:574`), and the quality monitor builds on it (`quality-monitor-server.ts:449`), so factory-wide HOLD counts are wrong past 500.
  - `releaseHold` computes `remaining` from a `refreshHold` read *outside* the transaction (`:785-790`); the `updatedAt` guard mitigates this.
- **Tests:**
  - Place HOLD vs Send for Packing at the same time.
  - Release past the remaining quantity.
  - Hold candidates beyond 400 lines.
  - HOLD→REJECT through a decision change keeps `heldQuantity` correct.

### 5b. DEFECTIVE SHELF
- `/api/defective-shelf` is properly scoped: own department, or STORE/admin for ALL (`app/api/defective-shelf/route.ts:12-31`). It reads `loadRejectRecords()`, which has no `take` and is unbounded.
- `/api/defective-shelves` (legacy) has **no department authorization** (D13). It does substring department matching, and `normalizeDeptKey` maps RECUTTING→THREAD_CUTTING (contains "CUTTING") and STITCHING, FINISHING and STEAM_PRESS→STORE (`:206-217`), which misattributes their defects. It also returns `take: 200` lists while computing totals over all rows, so the lists and totals disagree.
- There is no disposition endpoint, so defect records stay OPEN forever (D5).
- Generic challan PATCH creates a `DefectRecord` inside a transaction with a swallowed try/catch. On Postgres a failed insert aborts the whole transaction, so the "warn and continue" intent does not work (`app/api/challans/[id]/route.ts:331-352`).

### 5c. ADMIN QUALITY MONITOR (`app/api/admin/quality-monitor/**`, `lib/quality-monitor-server.ts`)
- Admin-only, through middleware (`middleware.ts`, `/api/admin/`) and `requireUser({admin:true})`. It is read-only.
- Reject and rework records are allocated to inspection batches FIFO (`:127-142`). After a REJECT↔REWORK decision change on an older batch, already-sent challans are attributed to the wrong batch, so ON_SHELF/IN_TRANSIT labels can be wrong per batch (low).
- HOLD figures are capped at 500 (D11).
- "COMPLETED" rework only means the downstream work item was transferred. It does not check that the garment was re-inspected and passed at Final QC.
- **Tests:** Monitor counts equal the database aggregates with more than 500 HOLDs; FIFO attribution after a decision change.

---

## 6. Priority corrections (ordered)
1. Build carton plus dispatch, with FG ledger decrement and an approval step (D1, D2, D10).
2. Fix the Final QC transfer guard race (D3).
3. Forbid generic PATCH and DELETE of workflow challans. Replace them with an audited void/recall that reverses counters, packing and the ledger (D6, D7).
4. Add Final QC rework routing to Stitching and Finishing, and an FG reject disposition workflow (D4, D5).
5. Receipt-shortage reconciliation and integer-PCS enforcement at Final QC (D8, D9).
6. DB-side pagination and aggregate totals everywhere `take` precedes filtering (D11).
7. Authorization on `/api/defective-shelves`; mandatory edit reasons; sequence-based numbering (D13–D15).
8. Create a test suite (none exists). Start with the pure modules (`lib/inventory.mjs`, `lib/work-items.mjs`, `lib/holds.mjs`) using `node:test`, then the transactional race tests against a disposable database.
