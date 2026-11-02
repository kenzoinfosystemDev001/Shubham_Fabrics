# Audit 12 — Thread Cutting, Threadcut QC (QC2), Washing, Washing QC (QC3)

Branch `fix/mes-production-readiness` (= origin/main @ 349af5a), audited 2026-11-02. Static code review only: no dev server, no DB connection, no source changes. Every claim below was checked in code; `docs/` was not relied on.

Path abbreviations:
- `W` = `apps/web/src/lib/work-items-server.ts`
- `M` = `apps/web/src/lib/work-items.mjs`
- `QD` = `apps/web/src/lib/qc-decision-server.ts`
- `HS` = `apps/web/src/lib/holds-server.ts`
- `CR` = `apps/web/src/app/api/challans/[id]/route.ts`
- `CE` = `apps/web/src/lib/challan-edit-server.ts`
- `DA` = `apps/web/src/lib/auth/department-access.ts`
- `S` = `packages/database/prisma/schema.prisma`

---

## 0. Architecture: one engine behind all four departments

All four departments use the same generic engine. Every API route under `api/thread-cutting/**`, `api/qc2/**`, `api/washing/**` and `api/qcwashing/**` is a 6–10 line wrapper that calls `workflowHandlers(WORKFLOWS.<X>)` (W:457-1575). The only exception is `items/[id]/decision`, which calls `QD`. Every page under `app/<dept>/**` is a 5-line wrapper around a shared component (`components/workflow/Work*.tsx`, `DefectiveShelf`, `DepartmentHold`). As a result:

- A defect in `W`, `M` or `QD` affects all four departments at once, and also Embroidery, Stitching, Finishing, Steam Press, Final QC and Inventory.
- The only differences between departments are the `WorkflowConfig` entries:

| Dept | Config | Prefix | Inbound | PASS -> | REJECT -> | REWORK -> |
|---|---|---|---|---|---|---|
| THREAD_CUTTING | W:91-102 | THC | EMBROIDERY `EMBROIDERY_TO_THREAD_CUTTING`; QC2 `REWORK_RETURN` | QC2 `THREAD_CUTTING_TO_QC2` | — | — |
| QC2 (Threadcut QC) | W:117-129 | TCQ | THREAD_CUTTING `THREAD_CUTTING_TO_QC2` | WASHING `QC2_TO_WASHING` | STORE `DEFECT_RETURN` | THREAD_CUTTING `REWORK_RETURN` |
| WASHING | W:103-115 | WSH | QC2 `QC2_TO_WASHING`; QC3 `REWORK_HANDOFF` | QC3 `WASHING_TO_QC3` | — | — |
| QC3 (Washing QC) | W:219-232 | WQC | WASHING `WASHING_TO_QC3` | RECUTTING `QC3_TO_RECUTTING` | STORE `DEFECT_RETURN` | WASHING `REWORK_HANDOFF` |

None of these four departments sets `strictReceipt`, `production`, `finishedGoods`, `passUnit` or `qc.checkpoints`. Those options are used only by Stitching, Final QC and Inventory.

Alias routes:
- `app/qc3/{page,floor-board,issue-challan,my-work}/page.tsx` and `app/qc-washing/page.tsx` only redirect to `/qcwashing/...`.
- `app/qc2/issue-challan` and `app/qcwashing/issue-challan` redirect to `my-work/issue-challan`.
- There is no `api/qc3/**` directory. The only QC3 API is `/api/qcwashing/**`, so there are no duplicate write routes.

Response shape: every page reads the response through `fetchJson` (`components/workflow/WorkflowUi.tsx:234-239`). It throws on `!res.ok` using `body.error`, and the pages then read `body.data` / `body.message`. Every handler in `W`/`QD` returns `{ data }`, `{ data, message }` or `{ message }`, and errors return `{ error }`. **I found no `data.success` versus bare-object mismatch in this scope.**

Tests: there are no automated tests anywhere in the repository. No `*.test.*` or `*.spec.*` files exist, and there is no `test` script in `apps/web/package.json`. Every test in section 17 below is therefore missing.

---

## 1. Shared defect register (referenced by every department)

Severity scale: **Critical** (stock or quantity silently created or destroyed in normal use), **High** (wrong quantities or routing under realistic conditions), **Medium** (gaps in integrity or audit trail, or process gaps that floor staff will work around), **Low**.

| ID | Sev | Where | Defect and concrete failure scenario |
|---|---|---|---|
| D1 | **High** | W:533-534; `components/workflow/WorkIncoming.tsx:368` | **A blank received quantity is accepted as 0.** `Number('')` is `0`, which passes the `qty < 0` check. If the receiver clears a field (or a crafted request sends `""`), the line is saved as RECEIVED with 0. `M:192` then makes it `TRANSFERRED` immediately, and the sender's pieces vanish. Only a "Short by N" remark is left, and the line cannot be received again (W:520-526). |
| D2 | **High** | W:536 (only `strictReceipt` checks over-receipt); `M:114-116` | **Over-receipt creates quantity.** None of the four departments is strict. Example: QC2 dispatches 100 PCS and Washing types 120. `receivedBasis` becomes 120, so Washing can process 120 and forward 120 to QC3. Twenty phantom pieces now flow downstream, and the sender's counters do not change. |
| D3 | Medium | `components/challan/ReceiptLines.tsx:41`; `WorkIncoming.tsx:348` | **Receipt is a rubber stamp.** For non-strict departments the dialog is pre-filled with the dispatched quantity, so the operator clicks Receive without counting. Combined with D1 and D2, the recorded receipt is not a real count. |
| D4 | **High** | W:1129-1137 vs QD:97-108, 167-177 and W:1528-1539 | **QC transfer race that can double-route.** The transfer guard checks only `[counter]`, `processedQuantity` and `heldQuantity`. It does not check `passedQuantity`, `rejectedQuantity`, `reworkQuantity` or `updatedAt`. A decision change (REJECT->REWORK) or an inspection edit that only redistributes PASS/REJECT/REWORK leaves all three guarded fields unchanged. Example: a QC2 line has passed 100 and transferred 0. Operator A posts a PASS challan for 100; W:1042 reads the item. Operator B's batch edit (pass 100->60, reject 40) commits before A reaches W:1129. A's `updateMany` still matches, so transferredQuantity becomes 100 while passed is 60. B's 40 REJECT can also be sent to the shelf: 140 pieces leave from 100 inspected. `lockSource` (HS:627-632) bumps `updatedAt`, but the transfer guard never checks it. |
| D5 | **High** | CR:209-330 (PATCH); `app/api/challans/[id]/status/route.ts:30-120` | **Generic challan routes can cancel or alter workflow challans without reversing work items.** Only `status === 'RECEIVED'` is blocked (CR:239). Any other status string, for example `CANCELLED`, is written unvalidated by sender or receiver (CR:258-266). The sender's `transferredQuantity`, `rejectSentQuantity` or `reworkSentQuantity` is never decremented. The receiver's item stays AWAITING_RECEIPT, and W:519 then refuses to receive it, so the pieces are stranded on both sides. The sender can also overwrite `defectivePieces` and `fabricOut` on a QC `DEFECT_RETURN` (CR:278-303). |
| D6 | Medium | CR:86-130; S:1690-1692 (`onDelete: Cascade`) | **Admin hard-delete of a workflow challan corrupts sender counters.** It deletes the receiver's work items (CR:114) and cascades the sender's `DepartmentWorkTransfer` rows. The sender's `transferredQuantity`, `rejectSentQuantity` and `reworkSentQuantity` keep the deleted quantity, so it can never be re-sent. |
| D7 | **High** (process) | W:676-681 with `M:315-354` | **Thread Cutting and Washing cannot record loss, damage or shrinkage.** Without `production: true` they use `validateWorkUpdate`, which ignores `defectQuantity`. Example: Washing receives 500 MTR and 480 MTR comes out because of shrinkage. Only 480 can be processed or forwarded, and `statusAfterTransfer` (M:261-269) needs `processed + defect >= received`. The line stays `PARTIALLY_TRANSFERRED` forever, inflating WIP, and the 20 MTR loss is never recorded. Holes or tears from thread cutting have the same problem. Shrinkage capture exists only for Dyeing to Dyeing QC (`lib/shrinkage-server.ts:5-8`). |
| D8 | Medium | `M:322-326`, W:697-698; `components/workflow/WorkProcess.tsx:279` | **The processed quantity is an absolute, client-supplied, reversible value.** The UI sends `processedQuantity: processed \|\| '0'`. Clearing the field resets processed work to 0 whenever nothing has been transferred yet, and the server accepts any decrease down to `transferredQuantity`. The `${code}_PROCESS` ProductionTransaction then logs a negative `inputQuantity` (W:754). Output is not recorded as additive, operator-attributed entries. |
| D9 | Medium | W:1477-1558; `components/workflow/WorkInspection.tsx:525` | **An inspection edit is not reflected in the shared quality records.** The edit updates the line and the batch only. `QualityInspection.status/notes`, `DefectLog.count` and the `${code}_INSPECTION` ProductionTransaction written at W:881-935 keep the original figures, so Production Sheet and quality views drift. `editReason` is optional on the server (W:1552), and the UI never sends one. `changeDecision` has the same gap (QD:92-177 never touches QualityInspection or DefectLog). |
| D10 | Medium | `DA:116-121`; W:415-423; QD:33 | **No segregation of duties.** Any member of QC2 or QC3 can inspect, edit any past batch (with no time limit) and change decisions, including their own. There is no supervisor or QC-incharge approval for correcting an inspection or turning a REJECT into a REWORK. |
| D11 | Medium | `CE:220-228`; `app/api/defective-shelves/route.ts:251-255`; `app/api/defective-shelf/route.ts:26-28` | **The two defective-shelf views disagree.** `/api/defective-shelf` reads QC decisions, so rejects that are decided but not yet sent already appear on the Store's central shelf. `/api/defective-shelves` reads `DEFECT_RETURN` challan headers. A challan edit of a REJECT line recomputes `fabricOut/fabricIn` but not `defectivePieces`, so the challan-based shelf keeps the old count. D5 lets either party overwrite `defectivePieces`. |
| D12 | Medium (process) | W:126, W:228 | **Rejected material goes only to the Fabric Store quarantine shelf.** It is not returned to the source department, and nothing triggers a replacement. An embroidered panel rejected at QC2 or QC3 leaves the lot short, with no re-embroider, re-cut or replacement order, no debit to the source, and no reconciliation against Production Sheet quantities. |
| D13 | Medium (process) | W:227-231 | **QC3 rework can only go back to Washing.** A thread defect found after washing (long tails, loose ends) cannot go back to Thread Cutting. The only options are re-wash or reject. Rework cycles are also not counted or limited, so the same lot can loop QC3 <-> Washing indefinitely. |
| D14 | Medium | W:124-128, W:227-231 | **Thread and wash quality checks are not structured.** QC2 and QC3 have no `checkpoints`; only Final QC has them (W:198). REJECT and REWORK reasons are free text (M:255-256), so a defect Pareto by type (thread ends, holes, stains, shade change, shrinkage, hand-feel) is impossible. `sampleSize` is `Math.round(inspected)` even for MTR (W:887). |
| D15 | Medium | `DA:29`; `packages/config/src/index.ts:18,40` | **Permission alias collision.** Thread Cutting accepts department code `CUTTING`, but the factory config defines `CUTTING` as a separate department ("Spreading & Cutting Section"). Any user or station recorded as `CUTTING` gets full Thread Cutting write access. `STANDARD_FACTORY_ROUTE` also lists CUTTING, BUTTON_ATTACHMENT, PACKING, FINISHED_GOODS and DISPATCH, which do not match `WORKFLOWS`. It is unused by the app, but it is a misleading source of truth. |
| D16 | Low/Medium | W:343-354, W:376-383 | **Work-item numbers break after 9999.** `findFirst orderBy itemNumber desc` sorts as a string, so `THC-2026-10000` sorts below `THC-2026-9999`. After 9999 every insert hits P2002. After 3 attempts the loop gives up with only `console.error`, so the incoming challan never gets work items and is invisible to the department. The sequence is also read outside the transaction (the retry only covers concurrent creation). |
| D17 | Low | S:779; `lib/challan-number-server.ts:40-52` | **Challan-number collisions.** Uniqueness on `(fromDepartment, challanNumber)` is case-sensitive, while the pre-check is case-insensitive, so `ab1` and `AB1` issued at the same moment both succeed. Legacy QC3 challans stored as `QCWASHING`/`QC_WASHING` are not checked when QC3 issues as `QC3`. PASS, REJECT and REWORK challans share one number space, which is fine but not documented to operators. |
| D18 | Low | W:463, 623, 1229, 1310 | **Reads have side effects.** `syncWorkItems` (inserts) runs on every GET: list, items, dashboard and floor board. A failure is swallowed (W:378), so missing work items show up only as an empty screen. |
| D19 | Low | W:530-532 | **A challan must be received all at once.** Every pending line must be in the same request, so a challan whose lines arrive on separate trips cannot be received line by line. |
| D20 | Low | W:1070-1074 | **Backdating is not bounded.** `issuedDate` is taken from the client with no range check, so challans can be back- or future-dated freely. |
| D21 | Low | W:823 | **Inspection replay skips the department scope.** The replay lookup is `findUnique({id})` without `departmentCode`, although the key is per user and per endpoint, so the impact is minimal. |
| D22 | Low | `api/qc2/challans/route.ts:6`, `api/washing/challans/route.ts:6`, `api/qcwashing/challans/route.ts:6`, `api/{qc2,washing,qcwashing}/transfer-challans/route.ts:6` | **Copy-pasted route comments are wrong.** They read "Fabric Store and Dyeing QC (PASS) challans to Embroidery" and "Embroidery -> Thread Cutting challans", which misleads maintainers. |
| D23 | Low | `app/qc3/my-work/page.tsx` | **Partial alias redirects.** Only the top-level `/qc3/*` routes redirect. Deep links such as `/qc3/my-work/inspection` return 404. |
| D24 | Low | W:1260-1261, 1233 | **Dashboard labels do not match their counts.** The `held` count is actually "all received open lines" (shown as "Material Received"), not HOLD. `challansIssued` counts PASS challans only, not REJECT or REWORK. |
| D25 | Low | `app/api/challans/route.ts:270` with `workflowIssuing` W:247-259 | **Off-route generic challans bypass the workflow.** A generic challan on a route no workflow owns (for example WASHING -> THREAD_CUTTING, or THREAD_CUTTING -> STORE) is allowed. It creates no work item at the receiver and leaves no record on the sender's lines, so material moves outside the workflow. |

What works correctly (verified):
- Double receive is blocked by conditional `updateMany status='AWAITING_RECEIPT'` (W:553-565).
- Double inspection is blocked by a guard on `processedQuantity` and `updatedAt` (W:853-865), plus an idempotency key (W:818-827, 954-956).
- Double forward is blocked by an idempotency key (W:1025-1034, 1211-1213) and a guard on the counter (W:1129-1138).
- PASS forwards use `passedQuantity`, not the received quantity (M:162-166).
- REJECT and REWORK carry only pending quantities (M:169-181).
- HOLD quantity is excluded from inspection and transfer (M:130-166).
- Duplicate work items are prevented by `@@unique([departmentCode, inboundChallanItemId])` (S:1680).
- Generic issue is blocked on owned routes (`app/api/challans/route.ts:270-273`), and generic receive is blocked on owned routes (CR:239-244).
- Challan-line quantity edits are blocked once the receiver has received the line (CE:125-134).
- MTR and PCS are never added together (M:416-417, headerUnitOf).

---

## 2. THREAD CUTTING (`THREAD_CUTTING`, station `threadcut`, alias `cutting`)

1. **Purpose.** Trim loose threads, jump stitches and backing from embroidered fabric or panels, then pass the lot to Threadcut QC.
2. **Eligible incoming departments.** EMBROIDERY (`EMBROIDERY_TO_THREAD_CUTTING`), and QC2 rework returns (`REWORK_RETURN`) (W:97-100).
3. **Incoming challan rules.**
   - `syncWorkItems` creates one work item per challan line for challans in ISSUED, IN_TRANSIT or RECEIVED (W:261, W:322-386).
   - The receive dialog must cover every pending line (W:530-532).
   - Any quantity ≥0 is accepted, with no upper bound (D1, D2). Discrepancies are stored as a text remark (W:546-547).
   - Cancelled and rejected challans are refused (W:519).
   - Generic receive is blocked (CR:239).
4. **Production-sheet relationships.** Each line keeps its own `programId` (`lineSheetId`, W:356). Lines from several sheets may travel on one outgoing challan, and each line keeps its sheet (M:443).
5. **Inputs.** Line: fabric/garment, colour, Dyed/Undyed status (route-derived, M:299-307), UOM, expected quantity, second-unit quantity (W:544), category/style, source work item (W:366).
6. **Process fields.**
   - `status` (RECEIVED, IN_PROGRESS, COMPLETED, READY_FOR_TRANSFER), absolute `processedQuantity`, `expectedCompletionDate`, `remarks` (W:671-775).
   - There is no operator, machine or helper, no piece-rate output, no trimming-waste record, and no start/stop per batch (D7, D8).
7. **Quantity and UOM rules.**
   - processed ≤ received − HOLD (M:327-332).
   - processed ≥ transferred (M:333).
   - Transfer is allowed only from COMPLETED, READY_FOR_TRANSFER or PARTIALLY_TRANSFERRED (M:23, M:420), and at most processed − transferred − HOLD.
   - Units are never converted.
8. **Quality checks.** None in this department. Quality is checked at QC2.
9. **Rework and rejection.**
   - Damaged pieces cannot be recorded, because there is no defect path (D7). Damaged quantity stays as unprocessed balance indefinitely.
   - Rework from QC2 arrives as a new work item on a `REWORK_RETURN` challan. It is processed like normal work and goes back to QC2 on `THREAD_CUTTING_TO_QC2`.
10. **Outgoing challan rules.**
    - `POST /api/thread-cutting/transfer-challans` (W:1019-1224) accepts a manual challan number (unique per department, D17), an idempotency key and the selected source challans (M:437-441). Line quantities are ≤ available.
    - It writes the Challan, ChallanItem, DepartmentWorkTransfer, ProductionTransaction, a ChallanEvent ISSUE and an AuditLog entry in one `$transaction`.
11. **Next-stage routing.** PASS goes only to QC2 (`THREAD_CUTTING_TO_QC2`). Generic challans to QC2 are blocked (`workflowIssuing`).
12. **Permissions (server-side).**
    - `requireDepartment('THREAD_CUTTING')` applies to every handler (W:415-416). It accepts codes THREAD_CUTTING, "THREAD CUTTING", THREAD-CUTTING and **CUTTING** (D15), and legacy roles.
    - Correcting the fabric status is admin only (W:780).
    - There is no operator versus in-charge split, so any member can issue challans.
13. **Audit events.**
    - Receive: ChallanEvent RECEIVE and AuditLog `THREAD_CUTTING_RECEIVE`.
    - Update: AuditLog `THREAD_CUTTING_UPDATE` and ProductionTransaction `THREAD_CUTTING_PROCESS`.
    - Transfer: ChallanEvent ISSUE, AuditLog `THREAD_CUTTING_TRANSFER` and ProductionTransaction.
    - Fabric status: AuditLog `THREAD_CUTTING_FABRIC_STATUS_CORRECTED`.
    - HOLD / HOLD_RELEASE, with DepartmentHoldEvent (HS:713-728, 798-806).
14. **Implementation files.** `api/thread-cutting/**` (9 wrappers), `app/thread-cutting/**` (11 wrappers + layout), `components/ThreadCuttingNavigation.tsx`, `components/workflow/{WorkDashboard,WorkIncoming,WorkReceived,WorkProcess,WorkIssueChallan,WorkFloorBoard,WorkHistory}.tsx`, `lib/workflow-views.ts:99-106`, W, M, HS:80.
15. **Defects.**
    - **High:** D1, D2, D5, D7.
    - **Medium:** D3, D6, D8, D15.
    - **Low:** D16, D18, D19, D20, D24, D25.
    - Thread-Cutting-specific (Medium): rework returns from QC2 look the same as first-pass work on Thread Cutting's screens. Only the challan type and the "Rework return" remark (W:1114) tell them apart, so rework load and turnaround cannot be measured.
16. **Corrections.**
    - Require an explicit receipt value (reject `''`/null with 400) and set `strictReceipt: true`, or cap excess at a configured tolerance.
    - Use blind counting (no pre-fill).
    - Add a defect or wastage quantity, and treat it as done in `statusAfterTransfer`. For example, enable a light version of `production` that has no take-in step.
    - Record output as additive per-operator entries instead of an absolute total.
    - Tag rework items (`isRework`, `reworkCycle`) from the inbound challan type.
    - Remove the `CUTTING` alias.
17. **Tests that should exist.**
    - Receive with a blank, negative or excess quantity is rejected.
    - Two receives at the same time: exactly one succeeds.
    - Processed above received − HOLD is rejected.
    - Processed below transferred is rejected.
    - Transfer above processed − transferred is rejected.
    - The same idempotency key replays the same challan.
    - A duplicate challan number (including a case variant) is rejected.
    - A QC2 rework return creates a new THC item linked by `sourceWorkItemId`.
    - Cancelling an outgoing challan reverses `transferredQuantity` (after D5 is fixed).
    - A line with a defect reaches TRANSFERRED (after D7 is fixed).

---

## 3. THREADCUT QC — QC2 (station `threadcutqc`, alias `qc2`)

1. **Purpose.** Inspect thread-cut material. Each inspected unit gets exactly one outcome: PASS (goes on to Washing), REJECT (Fabric Store defective shelf) or REWORK (back to Thread Cutting).
2. **Eligible incoming departments.** THREAD_CUTTING (`THREAD_CUTTING_TO_QC2`) only (W:122).
3. **Incoming challan rules.** The same as Thread Cutting: all lines at once, non-strict receipt (D1, D2, D3).
4. **Production-sheet relationships.** Per-line `programId`. Each inspection writes a `QualityInspection` with `challanId = inboundChallanId` and the `programId`, which Production Sheet views read (W:881-898).
5. **Inputs.** The received line, plus HOLD state (`heldQuantity`).
6. **Process fields.**
   - Inspection batch: `inspectedQuantity`, `passQuantity`, `rejectQuantity`, `reworkQuantity`, `rejectReason`, `reworkReason`, `remarks`, `idempotencyKey` (W:813-965).
   - The plain PATCH updates only notes and date (W:438-454, 676).
   - There are no checkpoints and no defect-code master (D14).
7. **Quantity and UOM rules.**
   - inspected ≤ received − processed − HOLD (M:242-249).
   - pass + reject + rework = inspected (M:251-254).
   - PASS forward ≤ passed − transferred − HOLD (M:162-166).
   - REJECT and REWORK forwards ≤ the pending quantity (M:169-176).
   - Status is derived from quantities (M:187-196).
   - Edits cannot go below quantities already sent (W:1516-1524).
8. **Quality checks.**
   - A reason is required for REJECT and REWORK (M:255-256).
   - There is no AQL sampling plan, no checkpoint list and no defect classification (D14).
   - Batch edit (W:1477) and decision change (QD:32) exist, with no approval step (D10).
9. **Rework and rejection.**
   - REJECT goes to STORE on `DEFECT_RETURN`, with header `defectivePieces` and the shelf `DEF-SHELF-STORE` (W:1106-1111). It is not returned to the source department, and no replacement is triggered (D12).
   - REWORK goes to THREAD_CUTTING on `REWORK_RETURN`, with the remark "Must be inspected by Threadcut QC again" (W:1114). It comes back as a new QC2 work item.
   - HOLD keeps quantity blocked on the line (HS:638-660). A held quantity can later be given a REJECT or REWORK decision through QD:123-164.
   - `app/qc2/defective-shelf` shows the decision-based shelf (D11).
10. **Outgoing challan rules.**
    - One endpoint serves all outcomes: `POST /api/qc2/transfer-challans` with `kind` PASS, REJECT or REWORK (W:980-985, 1038-1039).
    - REJECT challans have `fabricOut = 0` (W:1106).
    - Reasons from the inspection batches travel with the challan (W:1066-1067, 1162-1163).
11. **Next-stage routing.**
    - PASS goes to WASHING (`QC2_TO_WASHING`).
    - Generic QC2 -> WASHING, STORE or THREAD_CUTTING challans are blocked by `workflowIssuing` (W:254-256).
12. **Permissions.**
    - `requireDepartment('QC2')`: code QC2 or role `QC2_INSPECTOR` (DA:32-35).
    - The defective-shelf read is limited to the department's own shelf (`api/defective-shelf/route.ts:22-25`).
    - No maker-checker (D10).
13. **Audit events.**
    - Inspection: `WorkItemInspection`, `QualityInspection`, `QualityInspectionParameter` (not used here), `DefectLog` (REJECT=CRITICAL, REWORK=MAJOR), ProductionTransaction `QC2_INSPECTION` and AuditLog `QC2_INSPECTION`.
    - AuditLog `QC2_INSPECTION_EDITED` (with no reason, D9) and `QC2_DECISION_CHANGED` (QD:195-219).
    - AuditLog `QC2_TRANSFER`, `QC2_REJECT_TRANSFER` and `QC2_REWORK_TRANSFER`, plus `QC_NOTES_UPDATE`.
    - Receive and HOLD events, as for Thread Cutting.
14. **Implementation files.** `api/qc2/**` (12 wrappers, including `items/[id]/decision` -> QD and `inspections/[id]` -> `editInspection`), `app/qc2/**` (16 pages: inspection, rejected, rework, defective-shelf, hold, etc.), `components/QC2Navigation.tsx`, `components/workflow/{WorkInspection,QcDecisionEditor,WorkIssueChallan(kind)}.tsx`, `components/defective/DefectiveShelf.tsx`, `lib/workflow-views.ts:119-126`, `lib/quality-monitor-server.ts:146-`, W, M, QD, HS.
15. **Defects.**
    - **High:** D1, D2, **D4** (the double-routing race applies only to QC), D5.
    - **Medium:** D3, D6, D9, D10, D11, D12, D14.
    - **Low:** D16, D17, D18, D21, D22, D24.
    - QC2-specific (Medium): a REWORK return to Thread Cutting is not tied to the original QC2 line for closure. When the reworked lot comes back, it is a new QC2 item, so first-pass yield and rework yield per line cannot be computed without walking `sourceWorkItemId` chains.
16. **Corrections.**
    - Add `passedQuantity`, `rejectedQuantity`, `reworkQuantity` (or simply `updatedAt`) to the transfer guard at W:1131. Better, call `lockSource` at the start of the transfer transaction and re-read the item inside it.
    - In `editInspection` and `changeDecision`, also update the linked QualityInspection, DefectLog and ProductionTransaction, or append reversing entries.
    - Make `editReason` mandatory, and send it from the UI.
    - Require QC-incharge approval for edits and decision changes on someone else's batch, or after N hours.
    - Add a configurable QC2 checkpoint list (thread ends, jump stitches, backing removed, cut damage) and a defect-code master.
    - Store REJECT quantities in a dedicated shelf table and stop reading two different sources.
17. **Tests that should exist.**
    - Inspection with pass+reject+rework ≠ inspected is rejected.
    - Inspection beyond the uninspected quantity, or into HOLD, is rejected.
    - REJECT or REWORK without a reason is rejected.
    - Concurrent inspections: only one succeeds.
    - The same idempotency key replays.
    - A PASS transfer cannot exceed passed − transferred − held.
    - **A race test: an inspection edit (pass->reject) committed between transfer read and write must make the transfer fail (D4).**
    - A decision change REJECT->REWORK after part has been sent is limited to the not-sent quantity.
    - HOLD -> REJECT for uninspected held quantity creates a batch.
    - An edit below the sent quantity is rejected.
    - The REJECT challan header `defectivePieces` equals the sum of its lines after a challan edit.
    - The REWORK challan creates a Thread Cutting item.

---

## 4. WASHING (`WASHING`, station `washing`)

1. **Purpose.** Wash the embroidered, thread-cut lot (softening, removing marking and stains) before it goes to Washing QC and then Recutting.
2. **Eligible incoming departments.** QC2 PASS (`QC2_TO_WASHING`), and QC3 re-wash returns (`REWORK_HANDOFF`) (W:109-112).
3. **Incoming challan rules.** The same engine. Non-strict receipt, pre-filled, blank accepted as 0 (D1, D2, D3). This is especially risky here because a wash lot is usually weighed or measured on receipt.
4. **Production-sheet relationships.** Per-line `programId`, as above.
5. **Inputs.** Received line (MTR or PCS), Dyed/Undyed status, colour.
6. **Process fields.**
   - Only status, processed quantity, expected date and remarks.
   - **None of the following is recorded:** wash type or recipe (enzyme, silicone, softener, stone), batch or machine number, load weight, temperature or time, chemicals and lot, water ratio, pre- and post-wash measurement, or shrinkage percentage (D7).
7. **Quantity and UOM rules.**
   - The same as Thread Cutting.
   - Shrinkage in MTR cannot be expressed, so lines with shrinkage never close (D7).
   - The second-unit quantity on the outgoing challan is typed by the operator and is not checked against what was received (W:1081, `lineExtrasOf`). This is client-trusted (Low).
8. **Quality checks.** None in this department. Quality is checked at QC3.
9. **Rework and rejection.**
   - Washing damage (holes, colour bleed, shade change) cannot be recorded (D7).
   - Re-wash returns from QC3 arrive as new items on `REWORK_HANDOFF`. Rework load is not tagged.
10. **Outgoing challan rules.** `POST /api/washing/transfer-challans`, with the same rules as Thread Cutting.
11. **Next-stage routing.**
    - PASS goes to QC3 (`WASHING_TO_QC3`).
    - QC3 receives only `WASHING_TO_QC3` from WASHING (W:224).
    - Generic WASHING -> QC3 is blocked. Generic WASHING -> other departments is not (D25).
12. **Permissions.**
    - `requireDepartment('WASHING')`: code WASHING, roles WASHING_INCHARGE and WASHING_OPERATOR (DA:36-39).
    - The fabric-status correction is admin only.
13. **Audit events.** The same as Thread Cutting, with the `WASHING_` prefix.
14. **Implementation files.** `api/washing/**` (9 wrappers), `app/washing/**` (11 wrappers + layout), `components/WashingNavigation.tsx`, shared `Work*` components, `lib/workflow-views.ts:108-117`, W, M, HS:82.
15. **Defects.**
    - **High:** D1, D2, D5, **D7** (most severe here, because every wash lot loses length or weight).
    - **Medium:** D3, D6, D8, D13 (no shared re-wash counter).
    - **Low:** D16, D18, D19, D20, D22, D24, D25.
16. **Corrections.**
    - Add a wash process record per batch: recipe, machine, load, temperature, time, chemical lots, pre- and post-measurement.
    - Add `shrinkageQuantity` and `damageQuantity`, with a required reason, counted as done when the line closes.
    - Reuse the ShrinkageRecord pattern for the wash stage.
    - Use strict, blind receipt.
    - Tag re-wash items and cap re-wash cycles, escalating to a QC3 decision after N cycles.
17. **Tests that should exist.**
    - The Thread Cutting receive, process and transfer tests, repeated for Washing.
    - A shrinkage entry closes the line, and the forwarded quantity equals received − shrinkage − damage.
    - A re-wash return from QC3 creates a Washing item linked to the QC3 line.
    - A generic challan from WASHING to QC3 is refused (400).

---

## 5. WASHING QC — QC3 (station `washingqc`, aliases `qc3`, `qcwashing`, `qc_washing`)

1. **Purpose.** Inspect washed lots: PASS goes to Recutting, REJECT to the Fabric Store defective shelf, REWORK back to Washing for a re-wash.
2. **Eligible incoming departments.** WASHING (`WASHING_TO_QC3`) only (W:224).
3. **Incoming challan rules.** The same engine. D1, D2 and D3 apply. `inboundWhere` matches `toDepartment` case-insensitively with `equals: 'QC3'` (W:312). Legacy challans addressed to `QCWASHING` or `QC_WASHING` in `toDepartment` are therefore **not** picked up by `syncWorkItems` (Low/Medium; verify against production data).
4. **Production-sheet relationships.** Per-line `programId`. A QualityInspection is written per batch.
5. **Inputs.** The received line plus HOLD state.
6. **Process fields.** Inspection batches as in QC2. There are no wash-specific checkpoints (shade against standard, hand-feel, residual marking, shrinkage measurement, pH or odour) (D14).
7. **Quantity and UOM rules.** The same as QC2 (M:231-258, 162-181). PASS to Recutting can be in MTR; Recutting then allocates (`allocation: true`, W:138).
8. **Quality checks.** Reasons are required. No checkpoints, no sampling plan, no edit approval (D10, D14).
9. **Rework and rejection.**
   - REJECT goes to STORE on `DEFECT_RETURN`, to the shelf DEF-SHELF-STORE (W:228). It is not returned to the source, and no replacement is triggered (D12).
   - REWORK goes to WASHING on `REWORK_HANDOFF` (W:230). It cannot go to Thread Cutting, and there is no cycle limit (D13).
   - HOLD and decision changes work as for QC2.
   - `app/qcwashing/defective-shelf` shows the decision-based shelf (D11).
10. **Outgoing challan rules.** `POST /api/qcwashing/transfer-challans` with `kind`, using the same engine as QC2.
11. **Next-stage routing.**
    - PASS goes to RECUTTING (`QC3_TO_RECUTTING`).
    - Recutting accepts only that challan type from QC3 (W:135).
12. **Permissions.**
    - `requireDepartment('QC3')`: codes QC3, QCWASHING, QC_WASHING, WASHING_QC and "QC WASHING"; roles QC3_INSPECTOR and QCWASHING_INSPECTOR (DA:40-43).
    - No maker-checker (D10).
13. **Audit events.** The same as QC2, with the `QC3_` prefix.
14. **Implementation files.** `api/qcwashing/**` (12 wrappers), `app/qcwashing/**` (16 pages), redirects at `app/qc3/{page,floor-board,issue-challan,my-work}` and `app/qc-washing/page.tsx`, `components/QCWashingNavigation.tsx`, `lib/workflow-views.ts:206-215`, W, M, QD, HS:83. There is no `api/qc3` directory.
15. **Defects.**
    - **High:** D1, D2, **D4**, D5.
    - **Medium:** D3, D6, D9, D10, D11, D12, **D13**, D14.
    - **Low:** D16, D17 (legacy alias numbers), D18, D21, D22, **D23**, D24.
    - QC3-specific (Low/Medium): `toDepartment` aliases are excluded by `inboundWhere`, as described in item 3.
16. **Corrections.**
    - The QC2 corrections (D4, D9, D10, D11, D14).
    - Add a REWORK destination choice (Washing or Thread Cutting) with separate challan types, and add a rework-cycle counter.
    - Normalise legacy `QCWASHING`/`QC_WASHING` department strings, either with a one-off migration or by matching `{ in: aliases }` in `inboundWhere`.
    - Redirect `/qc3/:path*` with a catch-all (or in `next.config`).
17. **Tests that should exist.**
    - All QC2 tests, repeated for QC3.
    - A REWORK challan creates a Washing item, and the reworked lot returns as a new QC3 item.
    - A PASS challan creates a Recutting item.
    - A legacy challan with `toDepartment='QCWASHING'` is picked up (after the fix).
    - `/qc3/my-work/inspection` redirects.

---

## 6. Priority order for remediation

1. **D1 + D2 + D3**: make receipt strict and blind, and reject blank values (a single change at W:533-537 and the `strictReceipt` config for the four departments).
2. **D4**: tighten the transfer guard. Add `updatedAt`, or `lockSource` plus a re-read, at W:1129-1137.
3. **D5 / D6**: whitelist the statuses allowed by generic PATCH and status routes, refuse them on workflow-owned routes, and add a reversal path (cancel challan -> decrement sender counters, void receiver items) inside one `$transaction`.
4. **D7**: add loss, shrinkage and damage recording for Thread Cutting and Washing.
5. **D9 / D10 / D11**: keep the quality records consistent, enforce QC maker-checker, and use one source for the defective shelf.
6. **D12–D14**: process design. Replacement triggers for rejects, rework destinations and cycle counts, and structured QC checkpoints.
7. Add an automated test suite. None exists today. Start with the pure rules in `work-items.mjs`, which have no database dependency and can be tested immediately with `node --test`.
