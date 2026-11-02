# Stage 2 audit: Dyeing, Dyeing QC (QC1), Cutting, Embroidery

Audit date: 2026-11-02. Branch `fix/mes-production-readiness` (same as origin/main, 349af5a).
Method: I read the code only. I did not run the app, connect to a database or edit any source file. Every finding is cited as file:line from the code, not from `docs/`.
Paths are relative to `apps/web/src/` unless they start with `packages/`.

Severity scale:
- **Critical**: quantity can be created, duplicated or moved past a quality gate.
- **High**: quantity is stranded or lost in normal operation.
- **Medium**: integrity, traceability or segregation-of-duties gap.
- **Low**: hygiene or edge case.

---

## 0. Executive summary

| # | Sev | Dept | Defect | Where |
|---|-----|------|--------|-------|
| Q1 | Critical | QC1 | The inspection is not concurrency-safe. Two submissions both commit, so the passed quantity goes to Embroidery twice. | `app/api/qc1/challans/[id]/inspect/route.ts:45-110, 472-474` |
| X1 | Critical | QC1/EMB/DYE | The generic challan API bypasses the QC gate. A QC1 user can forge a `QC1_TO_EMBROIDERY` challan, and a QC1 user can PATCH a Dyeing→QC1 challan to `QC_APPROVED`. | `app/api/challans/route.ts:263-273, 506, 511`; `app/api/challans/[id]/route.ts:239-262`; `lib/work-items-server.ts:88` |
| Q2 | High | QC1 | With result=REWORK, the passed quantity is recorded but never forwarded, and the challan is closed. | `inspect/route.ts:195, 416, 466-469, 66` |
| Q3 | High | QC1 | Inspected quantity that has no outcome disappears (only outcomes ≤ inspected is enforced). | `lib/qc1-inspection.mjs:83` |
| Q4 | High | QC1 | A partial inspection closes the challan (`QC_APPROVED`). The uninspected remainder is stranded. | `inspect/route.ts:466, 66` |
| D1 | High | Dyeing | There is no way to record process loss or shrinkage in Dyeing. An order with any loss never closes. | `lib/dyeing-workflow.mjs:117-122, 148-214` |
| D2 | High | Dyeing | Receipt quantity has no upper bound, so phantom fabric propagates to QC1 and Embroidery. | `app/api/dyeing/challans/[id]/receive/route.ts:59-62` |
| E2 | High | Embroidery | Receipt quantity has no upper bound (`strictReceipt` is off). | `lib/work-items-server.ts:82-90, 536` |
| E3 | High | Embroidery | There is no defect, rejection or loss path. A line with damage can never reach TRANSFERRED. | `lib/work-items.mjs:261-269, 315-354` |
| C1 | High (process) | Cutting | The CUTTING stage does not exist. The `cutting` login and code alias to Thread Cutting. | `lib/departments.ts:20`; `lib/auth/department-access.ts:28-30` |

---

## 1. CUTTING: existence check

**Finding: there is no Cutting (spreading and cutting) department, module, API, page, work-item workflow or schema entity between Dyeing QC and Embroidery.**

Evidence:
- `packages/config/src/index.ts:14-33` lists `DepartmentCode.CUTTING` in `STANDARD_FACTORY_ROUTE` (between QC1 and EMBROIDERY), with the label "Spreading & Cutting Section" (`:41`).
  - `STANDARD_FACTORY_ROUTE` is not referenced anywhere in `apps/web/src`. It is dead configuration.
- `lib/departments.ts:14-31` is the floor list. It has no CUTTING entry. Line 20 gives Thread Cutting the station alias `cutting`.
- `lib/auth/department-access.ts:28-30` puts code `CUTTING` and role `CUTTING_INCHARGE` under the THREAD_CUTTING key.
  - `lib/rbac.ts:221-226` does the same.
  - `app/api/challans/auto-detect/route.ts:26-31, 53` maps the text "CUTTING" to THREAD_CUTTING.
  - Result: any legacy challan or user marked CUTTING is silently treated as Thread Cutting (a post-embroidery trimming stage).
- `lib/work-items-server.ts:81-90`: Embroidery's inbound routes are QC1 (`QC1_TO_EMBROIDERY`) and STORE. QC1 forwards PASS fabric directly to Embroidery (`inspect/route.ts:420-461`).
- The only "cutting" with quantities is **Recutting** (`WorkItemAllocation.cutQuantity/cutUom`, `packages/database/prisma/schema.prisma:1709-1723`). It runs after Washing QC (`lib/work-items-server.ts:130-140`).

**Process impact.** In the reference flow, fabric in MTR becomes cut panels or bundles in PCS between QC1 and Embroidery. Here, Embroidery receives running fabric in MTR and sends MTR onward. That leaves several gaps:
- No marker, lay or ply record.
- No cut-panel count.
- No conversion from MTR to PCS with consumption or end-bit and cutting waste.
- No bundle or ticket genealogy into Embroidery.

Recutting later "cuts" washed fabric into garment categories. This is either a deliberate factory variant (panel embroidery on running fabric, cutting after wash) or a missing stage. **Management must decide which.** If Cutting is required, it needs:
- a `WORKFLOWS.CUTTING` entry (inbound QC1 PASS, next EMBROIDERY);
- a cut entry that records consumed MTR, cut PCS per size or panel, and end-bit and waste MTR (both units kept, never converted);
- re-pointing of `QC1_TO_EMBROIDERY` to `QC1_TO_CUTTING`;
- removal of the `cutting` alias from Thread Cutting.

Spec points 1-17 for Cutting are all "not implemented". The required design is given in section 5.

---

## 2. DYEING: 17-point specification

1. **Business purpose.** Receive greige or undyed fabric issued by the Fabric Store, dye each line to its required colour (batch and machine), review colour mismatches, and transfer dyed quantity to Dyeing QC. Also re-dye QC1 rework returns.
2. **Eligible incoming departments.**
   - Intended: STORE (`STORE_TO_DYEING`) and QC1 (`REWORK_RETURN`).
   - Actual: **any challan addressed to DYEING** with status ISSUED, IN_TRANSIT, RECEIVED or QC_APPROVED. `lib/dyeing-sync.ts:6, 30-35` filters on `toDepartment` only, not on `fromDepartment` or `challanType` (see D4).
3. **Incoming challan rules.**
   - Sync creates one `DyeingOrder` per challan line (`dyeing-sync.ts:56-103`), with status `AWAITING_RECEIPT`.
   - Receipt: every pending line must be answered exactly once (`receive/route.ts:53-80`).
   - The update is conditional (`updateMany where status AWAITING_RECEIPT`, `:86-99`), so double receipt is prevented.
   - Cancelled or rejected challans are refused (`:44`).
4. **Production-sheet relationships.** Each order takes its line's sheet (`dyeing-sync.ts:60-61, 76`). A Dyeing→QC1 challan can carry several sheets, and each line keeps `programId` and `sourceChallanItemId` (`lib/dyeing-qc-issue.ts:189-190`). Sync sets every touched sheet to `IN_PRODUCTION` (`dyeing-sync.ts:101`).
5. **Material inputs.** Fabric lines: fabric name and type, base colour and shade, required colour, required quantity, UOM, and an optional second-unit quantity (`receivedUnitQuantity`). There is no dye, chemical, recipe or water consumption.
6. **Process-specific fields.** Present: `batchNumber`, `machineNumber`, `dyedColor`, `colorCode`, colour-mismatch review (note, reviewer, time), expected completion and process remarks (`schema.prisma:1517-1588`). Missing: shade card or lab-dip reference, recipe, lot or shade band, temperature, M:L ratio, re-dye count.
7. **Quantity and UOM rules.**
   - Flow: expected (`requiredQuantity ?? quantity`, `dyeing-sync.ts:71`) → received → dyed (≤ received − held, `dyeing-workflow.mjs:165-172`) → sent to QC1 (≤ `availableForQc`).
   - Values are rounded to 3 dp throughout.
   - MTR and PCS are kept per line, and header totals are null for mixed units (`dyeing-qc-issue.ts:152`).
   - **There is no process-loss or shrinkage field** (D1). Dyeing shrinkage is recorded later by QC1.
8. **Quality checks.** Colour mismatch against the required colour blocks READY_FOR_QC1 and transfer until a review note exists (`dyeing-workflow.mjs:205-210, 238-240`). The QC issue re-checks the actual colour against the recorded one (`dyeing-qc-issue.ts:103-115`).
9. **Rework and rejection.**
   - HOLD exists through `DepartmentHold` (`heldQuantity`, `holds-server.ts:612-621`).
   - There is no reject or defect path in Dyeing.
   - QC1 rework comes back as a new `REWORK_RETURN` challan, which becomes new DyeingOrders (`dyeing-sync.ts:62, 84, 94-96`).
10. **Outgoing challan rules.**
    - Only `issueDyeingQcChallan` may issue a Dyeing→QC1 challan; the generic API blocks it (`app/api/challans/route.ts:261-267`).
    - The issue requires the source incoming challans to be selected (`dyeing-workflow.mjs:223+`, `challan-sheets.mjs:106-117`).
    - It is idempotent through `IdempotencyRecord` (`dyeing-qc-issue.ts:60-72, 247-251`).
    - Optimistic guard on `sentToQc1Quantity`, `dyedQuantity` and `heldQuantity` (`:167-180`).
    - Challan number is unique per issuing department (`challan-number-server.ts:40-52`, `schema.prisma:779`).
11. **Next-stage routing.** QC1 only (`challanType DYEING_TO_QC1`, `dyeing-qc-issue.ts:142-146`).
12. **Permissions (server-side).** Every route calls `requireDepartment(request,'DYEING')`. There is no separation between operator and in-charge: the same user who dyes can write the colour-mismatch review note and approve their own mismatch (`orders/[id]/route.ts:71-72`).
13. **Audit events.**
    - `ChallanEvent RECEIVE` and `AuditLog DYEING_RECEIVE` (`receive/route.ts:109-141`).
    - `AuditLog DYEING_UPDATE` and `ProductionTransaction FABRIC_DYEING` (`orders/[id]/route.ts:91-128`).
    - `ChallanEvent ISSUE`, `AuditLog DYEING_ISSUE_QC1` and `ProductionTransaction QC1_DISPATCH` (`dyeing-qc-issue.ts:212-246`).
    - Sync writes no audit record.
14. **Key files.** `app/api/dyeing/**`, `lib/dyeing-sync.ts`, `lib/dyeing-workflow.mjs`, `lib/dyeing-qc-issue.ts`, `lib/dyeing-server.ts`, `lib/dyeing-instructions.mjs`, `lib/holds-server.ts`, `app/dyeing/**`.

### 15. Dyeing defects

**D1 (High): Dyeing process loss cannot be recorded, so orders never close.**
- `statusAfterTransfer` returns `SENT_TO_QC1` only when `dyed >= received` (`lib/dyeing-workflow.mjs:122`).
- `validateProcessUpdate` (`:148-214`) has no loss or wastage field. Dyed quantity is capped at received.
- Scenario:
  1. Receive 500 MTR.
  2. Dye 500; 15 MTR shrink or are cut away. The operator can only send 485.
  3. If they set dyed=485, the order stays `PARTIALLY_SENT_TO_QC1` forever. It sits in `OPEN_DYEING_STATUSES`, shows as overdue, and 15 MTR shows as "undyed".
  4. If they set dyed=500 and send 485, 15 MTR stays "ready for QC" forever.
- Shrinkage is recorded only later by QC1 against the challan it receives. That challan never includes the lost quantity.

**D2 (High): Receipt has no upper bound.**
- `receive/route.ts:59-62` accepts any `qty ≥ 0`, and the second unit is validated with `strict=false` (`:65`).
- Scenario: the operator types 1000 for a 100 MTR line. Dyeing can then dye 1000 and send 1000 to QC1. The extra 900 MTR travels through QC1 into Embroidery. Only a remark records it.

**D3 (Medium): The expected quantity is the dye instruction quantity, not the dispatched quantity.**
- `dyeing-sync.ts:71` sets `requiredQuantity = line.requiredQuantity ?? line.quantity`, and receipt discrepancy is measured against it (`receive/route.ts:62`).
- Scenario: Store dispatches 120 MTR with "dye 100". The receipt shows "Excess of 20" even though everything arrived, and the 20 MTR not to be dyed has no home.

**D4 (High): Any department can create Dyeing work.**
- Sync takes any challan with `toDepartment = DYEING` (`dyeing-sync.ts:30-35`).
- The generic `POST /api/challans` accepts `challanType` and `status` from the body (`app/api/challans/route.ts:506, 511`). It checks only that the user belongs to `fromDepartment` (`:275-280`).
- Scenario: an Embroidery user issues EMBROIDERY→DYEING with 300 MTR, or a QC1 user forges a `REWORK_RETURN` outside an inspection. DyeingOrders are created with no source genealogy.

**D5 (Medium): GET handlers write.**
- These GETs call `syncInboundChallansToDyeingOrders()`, which creates orders and updates `Program.status`:
  - `GET /api/dyeing/challans` (`challans/route.ts:18`)
  - `/orders` (`orders/route.ts:20`)
  - `/dashboard` (`dashboard/route.ts:23`)
  - `/floor-board` (`floor-board/route.ts:22`)
  - `GET /api/dyeing/sync` (`sync/route.ts:7-11`)
- Errors are swallowed and the call returns `[]` (`dyeing-sync.ts:106-109, 118-120`). A challan whose sync fails (for example a null `programId`, skipped at `:58`) silently never appears as Dyeing work.

**D6 (Medium): Admin hard-delete of a Dyeing→QC1 challan strands dyed quantity and destroys audit.**
- `DyeingQcTransfer.challan` uses `onDelete: Cascade` (`schema.prisma:1597`).
- The DELETE only nulls `qc1ChallanId` and `inboundChallanId` (`app/api/challans/[id]/route.ts:117-124`). It never decrements `sentToQc1Quantity` and it deletes the challan's AuditLogs (`:179`).
- Scenario: deleting a 200 MTR QC challan leaves the order showing 200 sent with no transfer rows. That quantity can never be re-sent.

**D7 (Medium): The generic PATCH can cancel a Dyeing→QC1 challan without reversal.**
- `canUpdateChallan` lets sender or receiver set any status (`lib/auth/department-access.ts:127-134`, `app/api/challans/[id]/route.ts:239-262`).
- Scenario: Dyeing sets `CANCELLED`. QC1 inspect refuses it (`inspect/route.ts:76`). `sentToQc1Quantity` keeps the quantity, so the fabric is stranded.

**D8 (Medium): Self-approval of colour mismatch.**
- Any DYEING user can supply `colorReviewNote` together with the mismatching colour in one PATCH (`dyeing-workflow.mjs:180-183`, `orders/[id]/route.ts:71-72`).
- There is no in-charge role check, so the gate is cosmetic.

**D9 (Low): Order numbering.**
- `nextOrderSequence` uses a lexicographic `orderBy orderNumber desc` (`dyeing-sync.ts:12-19`). After `DYE-YYYY-9999`, "DYE-YYYY-10000" sorts lower, so the next number collides.
- After 3 P2002 retries the challan silently gets no orders (`:65-115`).

**D10 (Low): Dead endpoint.**
- `POST /api/dyeing/orders/[id]/issue-qc1-challan` never passes `sourceChallanIds` (`route.ts:17-24`).
- `checkSourceSelection([])` therefore always fails with "Select the incoming challan" (`lib/challan-sheets.mjs:108`).

### 16. Dyeing: required corrections

1. Add `processLossQuantity` (and reason) to DyeingOrder, recorded by an in-charge, in the order's own unit.
   - Close when `sent + loss + held = received`.
   - Change `statusAfterTransfer` to `sent >= dyed && dyed + loss >= received`.
   - Feed the loss into the shrinkage report.
2. Receipt tolerance: refuse `received > dispatched × (1 + tolerance)` (use `SYSTEM_CONFIG.DEFAULT_FABRIC_TOLERANCE_PERCENT`) unless an in-charge override with a reason is given.
3. Keep `dispatchedQuantity` (the line quantity) separate from `dyeQuantity`. Compare receipt to dispatched.
4. Restrict sync to `{from: STORE, type: STORE_TO_DYEING}` and `{from: QC1, type: REWORK_RETURN, parentChallan → DYEING_TO_QC1}`. In the generic POST, reject `toDepartment=DYEING` and the reserved challan types `QC1_TO_EMBROIDERY` and `REWORK_RETURN`.
5. Move sync out of GET handlers, either to the challan-issue transaction or to an explicit POST. Make the GET `/sync` a 405. Log sync failures to AuditLog.
6. DELETE and CANCEL of a challan with DyeingQcTransfer rows must reverse `sentToQc1Quantity` in the same transaction, or be refused once the challan is received. Never delete AuditLogs; soft-delete instead.
7. Split the colour review into its own endpoint. Require an in-charge user different from the last updater.
8. Use a sequence table or a numeric max (`ORDER BY length(orderNumber) DESC, orderNumber DESC`) for `DYE-` and `EMB-` numbers.
9. Delete or fix the single-line issue endpoint.

### 17. Dyeing: automated tests

- Pure tests on `dyeing-workflow.mjs`:
  - With loss recorded, `statusAfterTransfer` returns `SENT_TO_QC1`.
  - `availableForQc` with hold on undyed and dyed portions.
  - `validateProcessUpdate` rejects dyed > received − held and dyed < sent.
  - A colour mismatch without a review blocks READY_FOR_QC1.
- Receipt:
  - A second POST returns 409 and counters are unchanged.
  - A missing line returns 400.
  - Over-tolerance returns 400.
  - A cancelled challan returns 409.
- QC issue:
  - The same idempotency key twice creates one challan.
  - Two parallel issues for the same order: one wins, the other gets 409, and `sentToQc1Quantity` equals the sum of transfers.
  - Mixed MTR and PCS lines keep their units and `fabricOut` is null.
  - A duplicate challan number per department returns 409, case-insensitive.
- Sync:
  - Running sync twice concurrently creates no duplicate orders (`inboundChallanItemId` unique).
  - A challan from a non-STORE, non-QC1 department creates no orders.
- Invariant over all orders: `sentToQc1Quantity == Σ DyeingQcTransfer.quantity`.

---

## 3. DYEING QC (QC1): 17-point specification

1. **Business purpose.** Gate between Dyeing and the next stage. Inspect dyed fabric per line for shade and quality, then:
   - forward PASS quantity to Embroidery;
   - return REWORK quantity to Dyeing;
   - record shrinkage (loss in dyeing);
   - hold doubtful quantity.
2. **Eligible incoming departments.** DYEING only (`DYEING_TO_QC1`, issued by `lib/dyeing-qc-issue.ts`). The QC1 list shows every challan with `toDepartment='QC1'` (`app/api/qc1/challans/route.ts:19-21`), so any challan addressed to QC1 is inspectable.
3. **Incoming challan rules.**
   - Receive is header-only: ISSUED→RECEIVED (`receive/route.ts:336-368`).
   - It records **no per-line received quantity**.
   - The check is non-conditional (status read at `:336`, plain `update` at `:352`).
4. **Production-sheet relationships.** Each outgoing PASS and REWORK line keeps the inspected line's sheet, `sourceChallanItemId` and width (`inspect/route.ts:221-225`). The header `parentChallanId` points to the Dyeing→QC1 challan (`:369, 425`).
5. **Material inputs.** Dyed fabric lines (MTR or PCS), with colour, required colour, sheet and width.
6. **Process-specific fields.**
   - Observed colour per line or per challan.
   - Defects (type, count, severity) as DefectLog.
   - Parameters (`COLOR_SHADE_MATCH`, which is always written as PASS at `:274`; `QUANTITY_BREAKDOWN`; `LINE_BREAKDOWN`).
   - A mandatory remark (`:168-174`).
   - Missing: GSM, width, shrinkage %, rubbing or wash fastness, shade band against the lab dip, points per 100 m² (4-point system).
7. **Quantity and UOM rules.**
   - Per line: inspected ≤ line qty, and pass + shrinkage + rework + hold ≤ inspected (`lib/qc1-inspection.mjs:80-88`).
   - Per unit: inspected ≤ sent − previously inspected − held (`inspect/route.ts:110-134`).
   - MTR and PCS are never summed. Header quantities are written only when a single unit is used (`:154, 478-484`).
   - Shrinkage goes to the line (`saveShrinkageForLine`, `:404-412`) and to `ProductionTransaction.wasteQuantity` (`:344`).
8. **Quality checks.** Two decisions only: PASS or REWORK (`:159-165`). PASS needs passed > 0, and REWORK needs rework > 0 (`:176-190`).
9. **Rework and rejection.**
   - REWORK creates a `REWORK_RETURN` challan to Dyeing (`:360-400`). It becomes new DyeingOrders and must pass QC1 again.
   - HOLD is a challan+unit `DepartmentHold` (`holds-server.ts:271-340`).
   - REWORK and HOLD can be swapped through `lib/qc1-decision-server.ts`.
   - **There is no reject path.** Unusable fabric can only be booked as shrinkage.
10. **Outgoing challan rules.** Numbers are typed manually and unique per department, checked before the transaction (`:193-202`) and protected by the DB unique index. Both outgoing challans are created inside the inspection transaction (`:243-551`). There is **no idempotency key**.
11. **Next-stage routing.** PASS → EMBROIDERY (`QC1_TO_EMBROIDERY`, `fabricProcessingStatus DYED`). REWORK → DYEING. (The reference flow expects PASS → CUTTING.)
12. **Permissions.** `requireDepartment(request,'QC1')` on every route. The shrinkage API allows QC1 to write and QC1 or STORE to read (`app/api/shrinkage/route.ts:17, 37`). There is no inspector versus in-charge split. `inspectorId` in the body is ignored (good).
13. **Audit events.**
    - `ChallanEvent RECEIVE` and `AuditLog QC1_CHALLAN_RECEIVED`.
    - `ChallanEvent START_INSPECTION`, with no AuditLog (`start-inspection/route.ts:479-488`).
    - `QualityInspection`, its parameters, `ProductionTransaction QC1_FABRIC_INSPECTION`, `ChallanEvent QC_INSPECTION_COMPLETED` and `AuditLog QC1_INSPECTION_COMPLETED`.
    - `AuditLog QC1_DECISION_CHANGED`.
14. **Key files.**
    - `app/api/qc1/challans/**`: `inspect/route.ts`, `receive`, `start-inspection`, `decision`.
    - `lib/qc1-inspection.mjs`, `lib/qc1-decision-server.ts`, `lib/shrinkage-server.ts`, `lib/holds-server.ts`.
    - `app/qc1/my-work/page.tsx`, `app/qc1/shrinkage`, `app/qc1/hold`.

### 15. QC1 defects

**Q1 (Critical): Double inspection and double forward.**
- The route reads the challan status, prior inspections and holds **outside** the transaction (`inspect/route.ts:45-110`).
- Inside the transaction the final write is an unconditional `tx.challan.update({ where: { id } })` (`:472-474`). There is no `updateMany where status in (...)`, no `lockSource` (compare `qc1-decision-server.ts:143`, `holds-server.ts:645`), and no idempotency key.
- Scenario:
  1. The inspector double-clicks, or two terminals submit a PASS of 500 MTR with challan numbers EMB-101 and EMB-102.
  2. Both requests pass the checks and both commit.
  3. Two QC1→Embroidery challans totalling 1000 MTR exist. Embroidery creates work for both. 500 MTR of phantom fabric enters production.
- The same window lets an inspection consume quantity that a concurrent `placeHold` has just put on HOLD.

**X1 (Critical): The QC gate can be bypassed through the generic challan API.**
- `POST /api/challans` blocks only DYEING→QC1 and workflow-owned routes (`app/api/challans/route.ts:261-273`). QC1 is not in `WORKFLOWS`, so `workflowIssuing('QC1','EMBROIDERY')` returns null.
- `challanType` and `status` come from the body (`:506, 511`).
- Scenario A: a QC1 user posts `{fromDepartment:'QC1', toDepartment:'EMBROIDERY', challanType:'QC1_TO_EMBROIDERY', items:[…900 MTR]}`. Embroidery accepts it (`lib/work-items-server.ts:88`) and nothing has been inspected.
- Scenario B: through `PATCH /api/challans/[id]` a QC1 user sets a Dyeing→QC1 challan to `QC_APPROVED` or `RECEIVED` directly (`app/api/challans/[id]/route.ts:239-262`; `workflowReceiving` returns null for QC1).

**Q2 (High): The passed quantity is lost when the decision is REWORK.**
- The PASS challan number is requested and the forward challan created only when `result === 'PASS'` (`:195, 416`).
- With `result='REWORK'`, passed=300 and rework=200:
  - 300 is logged as `goodQuantity` (`:341`) but no Embroidery challan is created;
  - the status becomes `REWORK_REQUESTED` (`:467-468`);
  - further inspection is refused (`:66`).
- The 300 MTR is stranded. The UI resets the quantities by decision (`app/qc1/my-work/page.tsx:214`), but the API accepts the combination.

**Q3 (High): Inspected quantity without an outcome vanishes.**
- Only `outcomes > inspected` is rejected (`lib/qc1-inspection.mjs:83`). Inspected 100 with passed 60 is accepted.
- The remaining 40 counts as inspected (`ProductionTransaction.inputQuantity`, `:340`), so `openOf` excludes it from any later inspection, and it is never forwarded or returned.

**Q4 (High): A partial inspection closes the challan.**
- `openOf` allows inspecting less than was sent (`:110-134`), but without an open HOLD the status becomes `QC_APPROVED` or `REWORK_REQUESTED` (`:466-470`), and `:66` then blocks any further inspection.
- Scenario: inspect 300 of 500 today, and the remaining 200 can never be inspected.
- The same happens when a HOLD placed after QC_APPROVED is later released: the challan stays `QC_APPROVED`.

**Q5 (Medium): The `hold` outcome is accepted but goes nowhere.**
- `quantityHold` is parsed (`qc1-inspection.mjs:71`) and counted inside inspected.
- No `DepartmentHold` is created and `balanceQuantity` is 0 (`inspect/route.ts:346`). Through the API, held quantity disappears.

**Q6 (Medium): Per-line over-inspection on re-inspection.**
- The per-line cap compares to the full line quantity (`qc1-inspection.mjs:80`). Only the per-unit aggregate subtracts earlier inspections (`route:110`).
- Scenario: a challan has two MTR lines, Red 100 and Blue 100. Inspection 1 inspects Red 100 while Blue is partly held. After release, inspection 2 can inspect Red again for 100.
- Red is forwarded twice (200 MTR of Red to Embroidery), Blue never is, and colour genealogy is wrong.

**Q7 (Medium): Receipt is not checked.**
- Inspection is allowed from `ISSUED` (`:76`), so receipt can be skipped.
- Receipt records no per-line received quantity (`receive/route.ts:350-368`). Short deliveries from Dyeing are invisible, and inspection is capped at the sent quantity, not the received quantity.

**Q8 (Medium): Shrinkage ledger.**
- `saveShrinkageForLine` upserts with `shrinkageQty = EXCLUDED` (`lib/shrinkage-server.ts:172-177`). A second inspection of the same line **overwrites** the earlier shrinkage instead of adding to it, so `ShrinkageRecord` disagrees with `Σ ProductionTransaction.wasteQuantity`.
- Manual shrinkage (`app/api/shrinkage/route.ts:37-51`, `[id]/route.ts:10-16`) is independent of inspection outcomes. It is validated only against the line quantity (`shrinkage-server.ts:115`). QC1 can therefore book 50 MTR shrinkage on fabric already passed to Embroidery (pass + shrinkage > sent).

**Q9 (Medium): HOLD→REWORK return line loses its genealogy.**
- When there is no open return challan, the new line copies fabric and colour from the *first line of that unit* and sets no `programId` or `sourceChallanItemId` (`lib/qc1-decision-server.ts:221, 240-252`).
- On a multi-colour or multi-sheet challan, Dyeing receives the wrong colour and sheet (sync falls back to the challan sheet, `dyeing-sync.ts:61`).

**Q10 (Medium): No reject route.**
- The decisions are PASS and REWORK only (`inspect/route.ts:159`). Fabric that cannot be recovered (holes, dye patches, tender fabric) must be mislabelled as shrinkage. There is no defective-shelf or Store-return path, unlike QC2, QC3 and Final QC (`work-items-server.ts:124-128`).

**Q11 (Low): Status after HOLD→REWORK.**
- `stillHeld` sums holds of all units (`qc1-decision-server.ts:283`). On mixed-unit challans the status can be wrong.

**Q12 (Low): Decimal truncation.**
- `sampleSize: Math.round(...)` (`:252`) is used as the "inspected" fallback in the list (`challans/route.ts:136`).
- `defectLog.count: Math.round(rework MTR)` (`:322`). 0.4 MTR of rework logs 0 defects.

**Q13 (Low): Receive and start-inspection races.**
- Both use check-then-unconditional-update (`receive/route.ts:336-352`, `start-inspection/route.ts:454-477`), which produces duplicate events.
- `GET /api/qc1/challans` has no `take` limit (`challans/route.ts:65-121`).

### 16. QC1: required corrections

1. Make the inspection atomic:
   - Inside the transaction, `lockSource(tx,'QC1_CHALLAN',id)`.
   - Re-read holds and prior inspections after the lock.
   - Finish with `updateMany({ where:{ id, status:{ in: [...] }, updatedAt: read.updatedAt } })` and require count=1.
   - Add an idempotency key, as in `dyeing-qc-issue.ts`.
2. Require `pass + shrinkage + rework + hold == inspected` (exact to 0.001).
   - Create a `DepartmentHold` for a `hold` outcome inside the transaction, or reject `quantityHold > 0`.
   - Always forward a PASS quantity greater than 0 regardless of the "result" label. Derive the decision from the quantities.
3. Keep the challan open (`PARTIALLY_INSPECTED`) while `sent − inspected − shrinkage > 0`. Reopen on HOLD release. Close only when fully accounted.
4. Track inspected quantity per line (sum the LINE_BREAKDOWN, or better a `WorkItemInspection`-style row per line) and cap per line.
5. Per-line receipt with received quantity (reuse `receiveChallan` from work-items). Refuse inspection before receipt.
6. Make shrinkage additive per inspection (one row per inspection, or `shrinkageQty = shrinkageQty + EXCLUDED`). Block manual shrinkage beyond `sent − passed − rework − held`. Audit inside the lib.
7. HOLD→REWORK must take the line from the HOLD record or a chosen line, and carry `programId` and `sourceChallanItemId`.
8. Add a REJECT outcome to a defective shelf or Store return (as in the QC2 config).
9. Generic API:
   - Forbid `fromDepartment` QC1 creation and reserved `challanType` values in `POST /api/challans`.
   - Forbid generic PATCH status changes on challans owned by Dyeing or QC1 workflows. Whitelist the transitions.

### 17. QC1: automated tests

- `qc1LineQuantities`: rejects unallocated remainder, negative values and over-line values; multi-line by-unit entry is refused.
- Inspect:
  - Two concurrent identical PASS requests produce exactly one forward challan. The second gets 409 or an idempotent replay.
  - PASS 300 + REWORK 200 forwards 300 and returns 200.
  - Partial inspection then a second inspection of the remainder succeeds. Total forwarded ≤ sent.
  - An inspection while a HOLD is placed concurrently never inspects the held quantity.
  - Mixed MTR and PCS: no header sums, and the per-unit logs are correct.
  - Duplicate pass or rework numbers return 409 before anything is written.
- Decision change: REWORK→HOLD moves the quantity off the unreceived return line. HOLD→REWORK keeps the sheet and source line.
- Shrinkage: two inspections of the same line add up. Manual shrinkage beyond the open quantity returns 400.
- Generic API: a QC1 user POSTing `QC1_TO_EMBROIDERY` gets 400. A PATCH setting `QC_APPROVED` gets 403.
- Invariant: for every QC1 challan and unit, `Σ forwarded PASS + Σ rework + Σ shrinkage + held ≤ sent`.

---

## 4. EMBROIDERY: 17-point specification

1. **Business purpose.** Receive dyed and QC-passed fabric (Route A) or undyed fabric directly from the Store (Route B). Embroider it, then transfer it to Thread Cutting.
2. **Eligible incoming departments.** QC1 with `QC1_TO_EMBROIDERY`, and STORE with *any* challan type (`lib/work-items-server.ts:88`).
3. **Incoming challan rules.**
   - `syncWorkItems` creates one `DepartmentWorkItem` per line (`:322-386`), unique on `(departmentCode, inboundChallanItemId)` (`schema.prisma:1680`).
   - Receipt is per line with a conditional update (`:553-565`).
   - Cancelled or rejected challans are refused (`:519`).
   - `strictReceipt` is not set, so over-receipt is allowed (E2).
4. **Production-sheet relationships.** Each item takes `lineSheetId` (`:356`). The outgoing line keeps `programId` and `sourceChallanItemId` (`:1151-1152`). The next department links back through `sourceWorkItemId` (`:366`).
5. **Material inputs.** Fabric line: name, colour, Dyed/Undyed status (`fabricStatusForInboundLine`, `work-items.mjs:299-307`), UOM and second-unit quantity. Thread, backing and stabiliser consumption are not modelled.
6. **Process-specific fields.**
   - Only `processedQuantity`, `status`, `expectedCompletionDate` and `remarks` (`validateWorkUpdate`, `work-items.mjs:315-354`).
   - Missing: design or Wilcom file reference per run (only on the Program), machine, heads, stitch count, thread colours, frame or hoop, operator or shift, needle breaks.
7. **Quantity and UOM rules.**
   - received → processed (≤ received − defect − held) → transferred (≤ processed − held).
   - Per-line units are kept. Mixed-unit challans have a null `fabricOut` (`:1106`).
   - Values are rounded to 3 dp.
   - Embroidery processes fabric in MTR (there is no PCS panel conversion, because Cutting is absent).
8. **Quality checks.** None in Embroidery. The first QC after Embroidery is QC2, after Thread Cutting (`work-items-server.ts:117-129`).
9. **Rework and rejection.** HOLD only (WORK_ITEM holds). There is no defect, reject or loss path (`production` is not set, so `defectQuantity` stays 0) (E3).
10. **Outgoing challan rules.**
    - `issueTransferChallan` (`:1019-1224`): idempotency key, manual number unique per department, source challans required, optimistic `updateMany` guard on the counter, `processedQuantity` and `heldQuantity` (`:1129-1138`).
    - The generic API is blocked for EMBROIDERY→THREAD_CUTTING (`workflowIssuing`, `app/api/challans/route.ts:270-273`).
11. **Next-stage routing.** THREAD_CUTTING (`EMBROIDERY_TO_THREAD_CUTTING`).
12. **Permissions.** `guarded` uses `requireDepartment(cfg.key)` (`:415-423`). Fabric-status correction is admin-only and audited (`:778-805`).
13. **Audit events.**
    - `ChallanEvent RECEIVE` and `AuditLog EMBROIDERY_RECEIVE`.
    - `AuditLog EMBROIDERY_UPDATE` and `ProductionTransaction EMBROIDERY_PROCESS`.
    - `ChallanEvent ISSUE`, `AuditLog EMBROIDERY_TRANSFER` and `ProductionTransaction EMBROIDERY_TRANSFER`.
    - `AuditLog EMBROIDERY_FABRIC_STATUS_CORRECTED`.
14. **Key files.** `app/api/embroidery/**` (thin wrappers), `lib/work-items-server.ts`, `lib/work-items.mjs`, `lib/holds-server.ts`, `app/embroidery/**`, `app/fabric-store/my-work/challan-to-embroidery`.

### 15. Embroidery defects

**E1 (Critical): Forged inbound work (same root cause as X1).**
- A QC1 user can create `QC1_TO_EMBROIDERY` challans through the generic API without an inspection. The STORE route accepts any `challanType` (`work-items-server.ts:88`).
- Embroidery creates work items for both.

**E2 (High): Over-receipt is unbounded.**
- `strictReceipt` is not configured for EMBROIDERY (`:82-90`), so the check at `:536` is skipped.
- Scenario: 500 MTR is dispatched and 5000 is typed. Embroidery can process and transfer 5000 MTR to Thread Cutting.

**E3 (High): No embroidery defect or loss path, so lines never close.**
- `statusAfterTransfer` needs `processed + defect ≥ received` (`work-items.mjs:267-268`), and for non-production departments `defectQuantity` is always 0 (`work-items-server.ts:678-683`).
- Scenario: 1000 MTR received, 20 MTR spoiled by needle holes, 980 transferred. The line stays `PARTIALLY_TRANSFERRED` for good.
- There is no way to send the damaged 20 MTR to a defective shelf.

**E4 (Medium): Route B ignores the sheet's route.**
- A Store→Embroidery challan for a sheet whose route requires dyeing is accepted. The Dyed/Undyed status is inferred from remark text (`work-items.mjs:302-306`). The generic POST checks only Store fabric availability (`app/api/challans/route.ts:316-345`).

**E5 (Medium): GET handlers write.**
- `syncWorkItems` runs in GET `listChallans` (`:463`), `listItems` (`:623`), `dashboard` (`:1229`) and `floorBoard` (`:1310`).
- Errors are only logged to the console (`:377-379`).

**E6 (Medium): Cancelling or deleting an inbound challan strands or orphans work.**
- QC1 or Embroidery can set a QC1→EMB challan to `CANCELLED` through the generic PATCH (`department-access.ts:132-133`). The receive is then refused (`:519`) and the passed fabric has no path back.
- Admin DELETE removes Embroidery work items (`app/api/challans/[id]/route.ts:114`) and cascades their transfers (`schema.prisma:1690`), while the downstream Thread Cutting challans and items survive. Genealogy breaks.

**E7 (Medium): No embroidery process traceability.**
- There is no machine, design-run, stitch-count or operator data (point 6), so shade or design errors found at QC2 cannot be traced to a machine or head.

**E8 (Low): `EMB-` item numbering.**
- It uses the same lexicographic max as D9 (`work-items-server.ts:343-348`).

### 16. Embroidery: required corrections

1. Set `strictReceipt: true` (or a tolerance) for EMBROIDERY.
2. Enable a defect path: `production: true`, or a dedicated `defectQuantity` and `DefectRecord` with a DEF-SHELF-EMBROIDERY shelf (already listed in `app/api/defective-shelves/route.ts`). Count it in `statusAfterTransfer`.
3. Restrict the STORE inbound route to `challanType: 'STORE_TO_EMBROIDERY'`. Validate it against the sheet's route (refuse when the route includes DYEING and the line is UNDYED, unless an in-charge overrides).
4. Add embroidery run fields (machine, heads, design reference, stitch count, operator, shift) on a per-update production transaction.
5. Move sync out of GET handlers. Block CANCEL or DELETE of inbound challans once any line is received or transferred, or reverse correctly.
6. Once Cutting is built, change the inbound route to `CUTTING_TO_EMBROIDERY` in PCS.

### 17. Embroidery: automated tests

- `validateWorkUpdate` and `statusAfterTransfer`: with a defect recorded the line reaches TRANSFERRED; processed is capped at received − held.
- Receive: over-dispatch returns 400; a duplicate receipt returns 409; a cancelled challan returns 409.
- Transfer:
  - The same idempotency key creates one challan.
  - Parallel transfers of the same item: one gets 409, and `transferredQuantity == Σ DepartmentWorkTransfer(PASS)`.
  - A held quantity cannot be transferred.
  - Mixed units keep per-line units.
- Inbound filter: a STORE challan with a non-`STORE_TO_EMBROIDERY` type creates no work. A forged QC1 challan is rejected at creation.
- Genealogy: an EMB→THC line has `sourceChallanItemId` equal to the EMB inbound line, and the THC work item has `sourceWorkItemId` equal to the EMB item.

---

## 5. CUTTING: required specification (not implemented)

| Point | Required behaviour |
|---|---|
| 1 Purpose | Spread and cut dyed, QC-passed fabric into panels or bundles per marker. |
| 2 Incoming | QC1 PASS only (`QC1_TO_CUTTING`); Store direct only for undyed routes. |
| 3 Incoming challan | Per-line receipt in MTR with tolerance; conditional receive. |
| 4 Sheet | Each cut lot belongs to a line sheet; bundles reference the source challan line. |
| 5 Inputs | Fabric MTR per colour or shade lot; marker reference and length; plies. |
| 6 Fields | Lay number, marker efficiency, ply count, size ratio, cutter, table, end-bits. |
| 7 Quantity/UOM | Consumed MTR = cut panels' marker consumption + end-bits + waste. Output in PCS per size and panel. Both units are stored and never converted implicitly. |
| 8 QC | Cut-panel audit (shade within lot, notch accuracy). |
| 9 Rework/reject | Mis-cut panels go to recut or to the defective shelf; shade-mismatch fabric is held. |
| 10 Outgoing | Bundle-wise challan to Embroidery in PCS; idempotent; unique number. |
| 11 Next | EMBROIDERY. |
| 12 Permissions | `requireDepartment('CUTTING')`; a separate code from THREAD_CUTTING. |
| 13 Audit | Receipt, lay, cut, waste and transfer events. |
| 14 Implementation | None. Remove the `cutting` alias from THREAD_CUTTING (`lib/departments.ts:20`, `lib/auth/department-access.ts:29-30`, `lib/rbac.ts:221-226`, `app/api/challans/auto-detect/route.ts:31,53`). |
| 15 Defects | C1: the stage is missing; legacy CUTTING data is silently routed to Thread Cutting. |
| 16 Corrections | New `WORKFLOWS.CUTTING` entry plus a cut-entry model (see section 1). |
| 17 Tests | Consumed MTR ≥ marker consumption × plies; PCS out = plies × ratio; waste ≥ 0; no transfer of uncut quantity. |

---

## 6. Cross-cutting notes

- **There are no automated tests in the repository.** No `*.test.*` or `*.spec.*` files exist, and there is no `test` script in `apps/web/package.json`. Every test listed above is new work. The pure modules (`dyeing-workflow.mjs`, `qc1-inspection.mjs`, `work-items.mjs`, `challan-sheets.mjs`) can be tested with `node --test` without a database.
- **Patterns done well:**
  - Dyeing receive, the Dyeing QC issue and the work-items issue use conditional `updateMany` guards, idempotency keys and per-department unique challan numbers.
  - The QC1 decision-change server locks the source row.
  - These patterns should be copied into the QC1 inspect route.
