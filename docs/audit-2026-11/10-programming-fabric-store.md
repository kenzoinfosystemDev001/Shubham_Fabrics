# Stage 2 Audit: Program Management (Programming) and Fabric Store

- Audit date: 2026-11-02
- Branch: `fix/mes-production-readiness` (same as origin/main, HEAD `349af5a`)
- Method: static reading of the code only. No server was run, no database was touched, no source file was changed. `docs/` was not used as evidence.
- Paths are relative to `apps/web/src/` unless they start with `packages/`.
- Severity scale: **CRITICAL** = stock or genealogy is silently corrupted in normal use, or data is destroyed with no trail. **HIGH** = wrong quantities or a control can be bypassed through a normal-looking request. **MEDIUM** = wrong in edge cases, under concurrency, or the audit trail is weak. **LOW** = hygiene.

---

## 0. Cross-cutting finding: Fabric Store runs two stock systems that do not know about each other

Most Fabric Store defects come from this one design problem, so it is described first.

| | System A: "Roll / GRN" | System B: "Inward bucket book" |
|---|---|---|
| Tables | `FabricBatch`, `FabricStoreRoll`, `MaterialReceipt(+Item)`, `FabricQCInspection`, `FabricStockLedger` (Decimal) | `FabricInward`, `FabricOutward`, `StockLedgerEntry` (department `STORE`, Float) |
| Receipt | `POST /api/fabric-store/grn` | `POST /api/fabric-store/inward`, `/inward/import` |
| Issue | `POST /api/fabric-store/issue` (roll goes to `ISSUED` against a program, no challan) | Fabric Store challans (`POST /api/challans` → `syncChallanStock`), manual outward |
| Return | `POST /api/fabric-store/return` | none (incoming challans to STORE add no stock) |
| Balance used by | `checkFabricStoreAvailability` (rolls part), roll lists, dashboard KPIs | `loadStockBook` → Total Stock, challan over-issue guard, availability (inward part) |

Evidence:
- `lib/fabric-stock-ledger.ts:96-123`: `loadStockBook` reads only `fabricInward`, `stockLedgerEntry`, `challan` and `fabricOutward`. Rolls are never counted.
- `app/api/fabric-store/issue/route.ts:97-139`: a roll issue writes only `fabricStoreRoll` and `fabricStockLedger`. It never touches `StockLedgerEntry`.
- `lib/fabric-availability.ts:113-147, 234-236`: availability **adds** roll stock and inward stock together.
- `app/api/fabric-store/total-stock/route.ts:27`: Total Stock is built only from `loadStockBook`, so GRN rolls never appear in it.

What goes wrong:
1. Fabric received by GRN can never be issued on a Fabric Store challan. `planIssue` answers "No MTR stock of X has been received" (`lib/fabric-stock-rules.mjs:225-227`). Staff work around it by also keying an Inward entry.
2. Once that happens, the same physical fabric is counted twice in `checkFabricStoreAvailability` (roll metres plus inward metres).
3. A roll issued through `/issue` stays in System B's balance, so the same metres can be issued again on a challan.

**Severity: CRITICAL.** One ledger must be the system of record (see Required corrections, F-C1).

---

# PART 1: PROGRAM MANAGEMENT / PROGRAMMING

## 1. Business purpose
Programming turns a buyer order into the production sheet (`Program`). The sheet records the style, its component sheets (TOP, BOTTOM, DUPATTA), Wilcom designs, fabric, colour, fabric average, the colour/size grid and the target quantity. Programming also issues the first challan (Programming → Fabric Store) that asks the store to prepare fabric. Every later challan, work item, dyeing order and stock movement should trace back to this sheet through `programId`.

## 2. Eligible incoming departments
None. Programming is the root of the flow. A department may "send back" only by cancelling or editing challans. No route accepts challans addressed to PROGRAMMING.

## 3. Incoming challan rules
Not applicable. There is no inbound queue. Note that `POST /api/challans` defaults `fromDepartment` to `PROGRAMMING` and `toDepartment` to `STORE` when they are omitted (`app/api/challans/route.ts:257-258`). Any caller who omits them is treated as a Programming issue, and the `userBelongsToDepartment` check at `:276` then rejects non-Programming users.

## 4. Production-sheet relationships
- `Program.programNumber` is `@unique` (`packages/database/prisma/schema.prisma:404`). `programSerialNo` is **not** unique (`:428`).
- Children: `ProgramFabric`, `ProgramColour` and `ProgramSize` are deleted and recreated on every edit (`app/api/programs/production-sheet/route.ts:465-546`). Their ids therefore change on every save.
- Challans: `Challan.programId`, plus `ChallanItem.programId` per line (one challan can carry several sheets; `app/api/challans/route.ts:225-254`).
- Store: `FabricBatch.programId` and `FabricStoreRoll.programIssuedToId`.
- Sheet resolution in challan creation accepts an id, `programNumber` **or `programSerialNo`** through `findFirst` (`app/api/challans/route.ts:227-233`).

## 5. Material/component inputs
Fabric name, type, width, colour(s), fabric average (metres per piece, or the sum of sub-style averages), special material, and the production grid (colour × pcs). They are stored partly in columns and partly in `metadataJson` (`production-sheet/route.ts:254-285, 368-430`).

## 6. Process-specific fields
`components` (TOP/BOTTOM/DUPATTA, enabled and forwarded flags), `wilcomEntries` linked by `sheetId` (`lib/wilcom-sheets`), `clientCode` (visible only to Programming and Admin), `fabricDyeingRequired`, `fabricColorAvailable`, delivery and production dates, `piecesRejection`.

## 7. Quantity & UOM rules
- `targetQuantity` = the grid pcs total, otherwise the sum of legacy items in the program's unit, otherwise the body value, with a floor of 1 (`production-sheet/route.ts:239-243`). Values are rounded with `Math.round`.
- `fabricAverage` silently defaults to **1.25** when it is missing (`:229-231`), except when the status is `READY_FOR_ISSUE` (`:124-131`).
- `ProgramFabric.requiredQuantity = targetQty * avg` with `uom: 'MTR'` hard-coded, even when `quantityMeasurement` is PCS (`:478-489`).
- The availability requirement is `targetPcs * avg` rounded to 2 decimals (`lib/fabric-availability.ts:104-109`). There is no shrinkage or wastage allowance.
- All quantities are `Float` (`schema.prisma:445-455`). There is no Decimal type and no KG conversion.

## 8. Quality checks
None at Programming. The only validation is the `READY_FOR_ISSUE` check that fabric name, average and quantity are present. The stock gate is explicitly switched off: "Store inventory stock check bypass is active per user instruction" (`production-sheet/route.ts:133-135`).

## 9. Rework & rejection behaviour
`piecesRejection` and `rejectionReason` are free fields on the sheet with no workflow. Re-cut and rework are handled downstream. Deleting a sheet hard-deletes its `reworkTransaction` and `recutRequest` rows (`app/api/programs/[id]/route.ts:198-203`).

## 10. Outgoing challan rules
- Programming issues Programming → STORE challans from `app/my-work/issue-challan/page.tsx:249-265` → `POST /api/challans`.
- The challan number is typed by the user and is unique per `(fromDepartment, challanNumber)` (`schema.prisma:779`, `lib/challan-number-server.ts:40-52`). Idempotency is supported (`app/api/challans/route.ts:57-65, 213-217`).
- Header `fabricIn`, `fabricOut` and `status` come from the client (`route.ts:449-465, 506`).
- Programming may also send directly to DYEING or EMBROIDERY ("bypass", `route.ts:321-324`). That path checks availability but **deducts no stock** (see P-H1).

## 11. Next-stage routing
`fabricDyeingRequired` decides the destination: DYEING, otherwise EMBROIDERY (`lib/fabric-availability.ts:100-101`). In practice Programming → STORE → (DYEING | EMBROIDERY). Creating any challan sets **every** linked sheet's status to `ISSUED` (`app/api/challans/route.ts:623-631`).

## 12. Required permissions (server-side)
| Action | Guard |
|---|---|
| Create or edit a sheet | `requireDepartment('PROGRAMMING')` (`production-sheet/route.ts:115`) |
| Delete a sheet (hard) | `requireDepartment('PROGRAMMING')` (`programs/[id]/route.ts:71`). **Admin is not required.** |
| Change status | `requireDepartment('PROGRAMMING')` (`programs/[id]/status/route.ts:7`), any string accepted |
| Photos/Wilcom PATCH | `requireDepartment('PROGRAMMING')` (`programs/[id]/route.ts:302`) |
| List or read a sheet | login only (middleware). `clientCode` is stripped by `shapeProgramSheet` |
| `GET /api/programs/production-sheet`, `/next-number`, `/[id]/photo` | login only |
| `GET /api/challans`, `GET /api/challans/[id]` | login only, no department scoping |
| Delete a challan | `requireUser({admin:true})` (`challans/[id]/route.ts:90`) |

## 13. Audit events written
- `PRODUCTION_SHEET_EDITED` with before/after (status, designNumber, targetQuantity, metadataJson) is written only on an edit (`production-sheet/route.ts:445-464`).
- **Not audited:** sheet creation, status changes (`status/route.ts`), photo and Wilcom changes (`programs/[id]` PATCH), availability override (`check-availability` POST), and sheet deletion.
- Sheet deletion **deletes the audit log** for the sheet (`programs/[id]/route.ts:270-277`). Challan deletion does the same for the challan (`challans/[id]/route.ts:179-186`).

## 14. Existing implementation (key files)
- API: `app/api/programs/route.ts` (list), `programs/production-sheet/route.ts` (create/edit, availability GET), `programs/[id]/route.ts` (GET/DELETE/PATCH), `programs/[id]/status/route.ts`, `programs/next-number/route.ts`, `programs/[id]/photo/route.ts`, `app/api/challans/route.ts`, `challans/[id]/route.ts`, `challans/[id]/status/route.ts`, `challans/[id]/edit/route.ts` → `lib/challan-edit-server.ts`, `challans/[id]/documents/route.ts`, `challans/issued/*`.
- Libraries: `lib/program-sheet.ts`, `lib/program-document.ts`, `lib/wilcom-sheets.ts`, `lib/challan-number*.{ts,mjs}`, `lib/fabric-availability.ts`.
- UI: `app/programming/page.tsx`, `app/programs/[id]/page.tsx`, `app/my-work/create-production-sheet/page.tsx` (2,824 lines), `app/my-work/issue-challan/page.tsx`.

## 15. Identified defects

**P-C1. CRITICAL: Hard delete of a live production sheet, including its audit trail.** `app/api/programs/[id]/route.ts:67-283`
- Any Programming user (no admin check, no status check) can permanently delete a sheet that has challans, work items, dyeing orders, QC inspections, defect records, bundles, cartons and stock ledger rows.
- Lines 206-208 delete `stockLedgerEntry` rows for the program in **every** department. Lines 270-277 delete the `auditLog` rows, including the earlier `PRODUCTION_SHEET_EDITED` history.
- Lines 90-93 move every roll issued to the program back to `IN_STOCK`, with no ledger row, no return QC and no physical return.
- Scenario: a sheet is half-way through embroidery. A Programming user deletes it by mistake or to "clean up". The rolls reappear as issuable stock, downstream WIP disappears, the Fabric Store challan stock is silently credited back (`:103-105`), and nothing records who did it.
- Side effect: `fabricBatch.deleteMany` (`:243-245`) violates the `FabricStoreRoll.batch` foreign key whenever a GRN batch was linked to the program. The delete then fails with a 500, so the behaviour is also inconsistent.

**P-H1. HIGH: Programming → DYEING/EMBROIDERY "bypass" moves fabric without deducting store stock.** `app/api/challans/route.ts:321-353, 489, 617-621`
- `isBypassingToProcessing` only runs the availability check. `isStoreOutward` is false because `fromDept` is PROGRAMMING, so `syncChallanStock` never runs.
- Scenario: Programming issues 500 m straight to Dyeing. Dyeing receives it, but Fabric Store still shows the 500 m and can issue it again.

**P-H2. HIGH: Programming can switch off the Fabric Store availability gate.** `app/api/programs/production-sheet/route.ts:259-265, 407`
- The client-supplied `metadataJson` is merged with `Object.assign`, so a Programming request can set `fabricStoreVerified: true`.
- `fabricColorAvailable` is taken from the body, so it can be set to `IN_STOCK` or `VERIFIED_IN_STORE`.
- `checkFabricStoreAvailability` then returns `isAvailable: true` with zero stock (`lib/fabric-availability.ts:275-285`). Store verification is meant to be a Fabric Store decision (`check-availability` POST requires STORE).

**P-H3. HIGH: Program status is unguarded free text and regresses on every challan.**
- `app/api/programs/[id]/status/route.ts:16-21` writes any `status` with no transition rules and no audit row. `Program.status` is a `String` (`schema.prisma:418`).
- `app/api/challans/route.ts:623-631` sets **all** linked sheets to `ISSUED` on every new challan. A `COMPLETED` or `ON_HOLD` sheet flips back to `ISSUED` when any later challan (for example a re-cut) is raised.
- The `try/catch` around this update inside an interactive transaction does not help. Once a statement fails, PostgreSQL aborts the transaction, so later statements fail anyway. The same mistake appears at `:538-560`.

**P-H4. HIGH: Ambiguous genealogy through the non-unique `programSerialNo`.** `app/api/challans/route.ts:227-233`
- `resolveSheet` runs `findFirst` over `id | programNumber | programSerialNo`. Two sheets can share a serial number (`schema.prisma:428`; `programs/[id]/route.ts:41` admits this).
- Scenario: a challan line typed with serial "1045" attaches to whichever sheet the database returns first. Stock, work items and costing then follow the wrong order.
- `checkFabricStoreAvailability` resolves sheets the same way (`lib/fabric-availability.ts:52-59`).

**P-H5. HIGH: Editing an issued sheet changes quantity and fabric with no effect on challans or stock.** `production-sheet/route.ts:138-163, 368-430`
- After challans exist, `targetQuantity`, `fabricName`, `fabricAverage`, colours and the grid can still change (only `status` is kept).
- `ProgramFabric`, `ProgramColour` and `ProgramSize` are deleted and recreated (`:465-467`), which breaks any reference to their ids.
- Scenario: the sheet goes from 1,000 to 1,500 pcs after 1,250 m has been issued. Availability now shows a shortfall, but nothing re-plans the order and the issued challans still say 1,000.

**P-M1. MEDIUM: Program number generation is count-based and races.**
- `app/api/programs/next-number/route.ts:10-13` returns `count + 1`. After a deletion, the "next" number it shows already belongs to a live sheet.
- `production-sheet/route.ts:193-214` probes forward for a free number outside the transaction. Two concurrent creates pick the same candidate. The unique index then raises P2002, which surfaces as a generic 500 rather than a retry.

**P-M2. MEDIUM: Lost update on sheet edits when `expectedUpdatedAt` is not sent.** `production-sheet/route.ts:157, 437-443`
- The optimistic guard compares against the version the **server** just read, not the one the editor loaded.
- `programs/[id]` PATCH (`:308-406`) rewrites `metadataJson` read-modify-write with no version guard, so a photo save can overwrite a concurrent sheet save.

**P-M3. MEDIUM: Defaults are invented as master data.** `production-sheet/route.ts:229-231, 482-489`
- Average 1.25 m/pc, composition "Cotton Cambric", width 58", GSM 180 and `uom: 'MTR'` are written when nothing was entered.
- Fabric requirement and costing are then based on numbers nobody entered.

**P-M4. MEDIUM: `clientCode` leaks through `GET /api/challans/[id]`.** `app/api/challans/[id]/route.ts:24-28`
- The route includes `program: true`, which returns the raw `metadataJson` including `clientCode`. It bypasses `shapeProgramSheet`, which `programs/[id]` and `challans/[id]/documents` use correctly.
- Any signed-in user of any department can read it. `GET /api/challans` is also unscoped (`challans/route.ts:69-139`).

**P-M5. MEDIUM: Client-trusted header quantities on Programming → STORE challans.** `app/api/challans/route.ts:449-465`
- `fabricIn` and `fabricOut` come from the body (`my-work/issue-challan/page.tsx:260-265`) and are not reconciled with the item lines unless the challan type is `STORE_TO_*`.
- The default item (`:543-555`) gets quantity `body.quantity || 1`, so a challan with no lines records "1".

**P-M6. MEDIUM: Challan create and patch accept any client `status`.**
- `challans/route.ts:506` uses `body.status || 'ISSUED'`.
- `challans/[id]/route.ts:259-267` and `challans/[id]/status/route.ts:67-76` accept any string. Either department on the challan can move ISSUED → DRAFT or CANCELLED after receipt (P-H/F-H5).

**P-L1. LOW: The `defectCode` `DEF-<dept>-<last 4 digits of ms>` repeats every 10 seconds.** `challans/route.ts:572`, `challans/[id]/route.ts:338`, `status/route.ts:180`. It is not unique in the schema, but it is useless as an identifier.

**P-L2. LOW: `programs/[id]` PATCH creates a placeholder Wilcom entry `'WLC-01'` and style "Primary Top Style"** (`:368-376`). Fabricated design data.

## 16. Required corrections
1. Replace hard delete with soft cancel (`status=CANCELLED` plus a reason). Allow it only while no non-draft challan exists, otherwise require admin and a reversal workflow. Never delete `AuditLog` or `StockLedgerEntry`. Write a `PRODUCTION_SHEET_CANCELLED` audit row.
2. Add a server-side program status state machine (enum or check table) with allowed transitions, an audit row per change, and no automatic regression from challan creation (only DRAFT/READY → ISSUED).
3. Make `programSerialNo` unique (or resolve sheets only by id) and reject ambiguous references with a 409.
4. Remove `fabricStoreVerified` and `fabricColorAvailable` from the Programming write path (allow-list the metadata keys). Only the STORE availability POST may set them, and it must write an audit row.
5. Either forbid Programming → DYEING/EMBROIDERY or run `syncChallanStock` for it (treat it as a store issue with STORE as the stock source).
6. Lock quantity and fabric fields once a non-draft challan exists, or route changes through an amendment that re-plans demand and records `PRODUCTION_SHEET_AMENDED`.
7. Generate program numbers from a database sequence or counter row with `UPDATE … RETURNING`. Make `next-number` a preview of that sequence.
8. Require `expectedUpdatedAt` on edit and guard the photo PATCH with `updatedAt`.
9. Stop inventing defaults. Store null and require the field when the sheet becomes `READY_FOR_ISSUE`. Use the program's unit for `ProgramFabric.uom`.
10. Shape `program` through `shapeProgramSheet` in `GET /api/challans/[id]`. Scope challan list and read to the departments involved.
11. Ignore client `status`, `fabricIn` and `fabricOut` on create. Derive them from the lines.

## 17. Automated tests that should exist
- Sheet delete: non-admin is refused once a challan exists; cancel keeps the audit and ledger rows; rolls are not released without a RETURN ledger row.
- Status: every disallowed transition is rejected; creating a challan does not regress COMPLETED or ON_HOLD.
- Serial ambiguity: two sheets with the same serial number make challan creation return 409.
- A Programming payload with `metadataJson.fabricStoreVerified=true` or `fabricColorAvailable='VERIFIED_IN_STORE'` does not change availability.
- Programming → DYEING either returns 4xx or deducts STORE stock (assert on `StockLedgerEntry`).
- Concurrent program creation (two parallel POSTs) gives two distinct numbers and no 500.
- An edit with a stale `expectedUpdatedAt` returns 409; PATCH and edit racing do not lose `metadataJson` keys.
- `GET /api/challans/[id]` as a non-Programming user contains no `clientCode`.
- Challan POST with `status:'COMPLETED'` or a `fabricOut` that differs from the line totals is rejected or normalised.

---

# PART 2: FABRIC STORE

## 1. Business purpose
Fabric Store receives grey (undyed/"kora") and dyed fabric against supplier bills or GRNs. It inspects rolls, puts them away by location, verifies availability for production sheets, and issues fabric by challan to Dyeing (undyed) or Embroidery (dyed). It takes back returns and holds defective fabric on the store defective shelf. It is the only point where purchased fabric enters WIP, so its balance must be exact.

## 2. Eligible incoming departments
- Programming (fabric request challans PROGRAMMING → STORE).
- External suppliers (Inward and GRN).
- Production departments returning fabric or defects (any → STORE challans; the dashboard lists `toDepartment: 'STORE'`, `app/api/fabric-store/dashboard/route.ts:83-108`).
- Dyeing returning dyed fabric (no dedicated flow exists).

## 3. Incoming challan rules
- Incoming challans are listed from `GET /api/challans?toDepartment=STORE` and received through `PATCH /api/challans/[id] {status:'RECEIVED'}` (`app/fabric-store/my-work/incoming-challans/page.tsx:41, 101-105`).
- Receiving checks only the department (`lib/auth/department-access.ts:132`). It records no per-line received quantity and **adds no stock**: `isStoreOutwardChallan` excludes `toDepartment = STORE` (`lib/fabric-stock-ledger.ts:60-72`).
- A GRN can be pre-filled from a challan (`material-receipt/create/page.tsx:66-80`), but the challan id is only written as remark text. Nothing stops the same challan being GRN'd twice.

## 4. Production-sheet relationships
- Fabric Store challans carry `programId` and per-line `programId`.
- Stock ledger rows carry `programId` (`fabric-stock-ledger.ts:263`).
- A roll issue sets `FabricStoreRoll.programIssuedToId`, and its ledger `referenceId` is the **program id** even though `referenceType` is `'ISSUE_CHALLAN'` (`issue/route.ts:117-119`). No challan document exists for a roll issue.
- `FabricBatch.programId` is optional.
- `ChallanItem.rollNumber` is free text with no foreign key to `FabricStoreRoll`, so the link roll → challan → sheet cannot be traced.

## 5. Material/component inputs
- Inward: `itemName`, `colour`, `entryType` (UNDYED/KORA/DYED), `billQty`, unit (MTR/PCS), price, boxes/thans, HSN, tax, supplier.
- GRN: batch (fabric type, description, colour), rolls (length in the batch unit, width, weight in kg).
- Challan lines: fabric, colour, Dyed/Undyed status, required colour, quantity and unit.

## 6. Process-specific fields
- Stock bucket key is `fabric|UNDYED/DYED|colour|unit` (`lib/fabric-stock-rules.mjs:59-61`).
- Roll statuses: `RECEIVED, QC_HOLD, QC_PASSED, QC_REJECTED, IN_STOCK, ISSUED, RETURNED, CONSUMED` (`schema.prisma:1347-1356`). `QC_PASSED` and `CONSUMED` are never set by any route.
- Locations, the defective shelf `DEF-SHELF-STORE`, and the availability flags on `Program` (`fabricColorAvailable`, `metadataJson.fabricStoreVerified*`).

## 7. Quantity & UOM rules
- MTR and PCS are kept apart and never converted (`fabric-stock-rules.mjs:1-5, 196-201`). This is correct and consistently enforced in System B, and inward/outward/GRN require an explicit unit.
- KG is never a stock unit (roll `weight` is information only). Lines in any other unit are ignored by `addInward` (`:149-152`). There is no MTR↔KG or PCS↔MTR conversion, which is acceptable only if the store never receives by weight.
- Decimal safety is inconsistent. System A uses `Decimal(10,2)`. System B uses `Float`, rounded to 3 decimals with `roundQty` (`:63-65`) and compared with `EPSILON = 1e-6`. Inward summaries and availability sum `Float` values without rounding (`inward/route.ts:51-68`, `fabric-availability.ts:171-229`).
- Partial roll consumption is impossible in System A. An issue and a return always move the full `roll.length` (`issue/route.ts:117`, `return/route.ts:84`).

## 8. Quality checks
- Receipt QC on rolls: `POST /api/fabric-store/qc` with PASS/HOLD/REJECT (`qc/route.ts:67-182`). It is allowed only from `RECEIVED` or `QC_HOLD`.
- Issue requires `IN_STOCK` and `qcStatus=PASSED` (`issue/route.ts:68-81`).
- System B (inward and challan) has **no QC gate at all**. Inward fabric can be issued as soon as it is keyed in.
- Shrinkage is read-only for the store (`app/fabric-store/shrinkage/page.tsx`).

## 9. Rework & rejection behaviour
- QC REJECT → roll `QC_REJECTED` plus a `WRITE_OFF` ledger row.
- Returned rolls go to `RETURNED / qcStatus PENDING` "for return QC" (`return/route.ts:62-73`). The QC endpoint refuses `RETURNED` (`qc/route.ts:91`) and the QC queue lists only `status: 'RECEIVED'` (`:36`). **Returned rolls are stranded** (F-H3).
- Defects on store challans create `DefectRecord(departmentCode=STORE, OPEN)`. Total Stock reports them as defective stock (`total-stock/route.ts` defective section).

## 10. Outgoing challan rules
- Store → Dyeing/Embroidery challans go through `POST /api/challans` with `challanType STORE_TO_DYEING|STORE_TO_EMBROIDERY`, from `components/fabric-store/FabricStoreIssueChallanView.tsx:429-452` (sends an idempotency key).
- Inside the creating transaction, `syncChallanStock` takes `pg_advisory_xact_lock`, rebuilds the book, runs `planIssue`, refuses a negative balance and posts only the difference with an idempotency key (`fabric-stock-ledger.ts:281-318, 198-275`). This is the strongest part of the module.
- Header in/out quantities are derived from the lines only for `STORE_TO_*` types (`challans/route.ts:425-465`).
- Before that, a coarse availability gate runs outside the transaction (`:317-353`).
- Manual outward (`POST /api/fabric-store/outward`) uses the same reconciliation (`outward/route.ts:367-392`).

## 11. Next-stage routing
`fabricDyeingRequired` → DYEING (undyed lines), otherwise EMBROIDERY (dyed lines). Line type comes from the `Status:` remark, the colour, or the destination (`fabric-stock-rules.mjs:25-34`). Challans to DYEING trigger `syncInboundChallansToDyeingOrders` (`challans/route.ts:648-654`).

## 12. Required permissions (server-side)
- Every `/api/fabric-store/*` route uses `requireDepartment('STORE')`. `total-stock` GET and `check-availability` GET also allow PROGRAMMING. Admins pass every department check (`department-access.ts:97`).
- There is no separation of duties within the store. The same user can GRN, QC-pass, change status freely (`rolls/[id]` PATCH), issue, write off, delete inward bills and delete stock buckets.
- Challan cancel/status: either the sending **or receiving** department (`department-access.ts:127-134`).

## 13. Audit events written
- System A: a `FabricStockLedger` row for GRN, QC, issue, return, write-off, transfer and release (with `transactedById`).
- System B: `StockLedgerEntry` with actor, `balanceAfter` and an idempotency key.
- `ChallanEvent` is written only by `challans/[id]/status`, not by `challans/[id]` PATCH.
- **No `AuditLog` row** for: inward edit/delete, bucket removal, batch PATCH, roll PATCH (status/qcStatus), GRN confirm, location changes, or the availability override. A grep of `app/api/fabric-store` finds no `auditLog` usage.
- Inward delete and bucket delete hard-delete `FabricInward` bill rows (`inward/[id]/route.ts:107`, `fabric-stock-ledger.ts:433`). Only an unexplained ledger reversal remains.

## 14. Existing implementation (key files)
- System A: `app/api/fabric-store/{grn, grn/[id], grn/[id]/confirm, batches, batches/[id], rolls, rolls/[id], qc, issue, return, ledger, locations, dashboard}/route.ts`.
- System B: `app/api/fabric-store/{inward, inward/[id], inward/import, inward/export, outward, total-stock}/route.ts`, `lib/fabric-stock-ledger.ts`, `lib/fabric-stock-rules.mjs`, `lib/fabric-stock.ts`, `lib/stock-import-{rules.mjs,server.ts}`.
- Gate: `lib/fabric-availability.ts`, `app/api/fabric-store/check-availability/route.ts`.
- UI: `app/fabric-store/**` (inventory/inward 1,046 lines, outward 798, total-stock 564; my-work material-receipt, material-issue, qc-inspections, incoming-challans, issue-challan).

## 15. Identified defects

**F-C1. CRITICAL: The two disconnected stock ledgers double count or block stock.** See section 0. Files: `lib/fabric-stock-ledger.ts:96-123`, `app/api/fabric-store/issue/route.ts:97-139`, `lib/fabric-availability.ts:113-147, 234-236`, `total-stock/route.ts:27`.

**F-C2. CRITICAL: Roll issue and return race, so the same roll can be issued twice or returned twice.**
- `issue/route.ts:59-81` checks the status **outside** the transaction. The update at `:99-106` is unconditional (`where: { id }`).
- Two concurrent issues of roll R to programs P1 and P2 both pass the check. Both write an `ISSUE` ledger row, and the last writer wins on `programIssuedToId`.
- `return/route.ts:22-44, 62-73` has the same flaw, which produces two `RETURN` rows.
- Fix with `updateMany({ where: { id, status: 'IN_STOCK', qcStatus: 'PASSED' } })` and require `count === 1`.

**F-C3. CRITICAL: `rolls/[id]` PATCH sets any status or qcStatus from the client.** `rolls/[id]/route.ts:52-80` (`updateData.status = status`, `updateData.qcStatus = qcStatus`)
- A STORE user can move `ISSUED → IN_STOCK`, `QC_REJECTED → IN_STOCK + PASSED`, or `RECEIVED → IN_STOCK + PASSED` (skipping QC).
- A ledger row is written only for write-off, transfer or HOLD release (`:94-115`). Most of these changes therefore leave **no trace**, and the roll becomes issuable again.
- This is also the only escape for stranded `RETURNED` rolls (F-H3), so it will be used in practice.

**F-C4. CRITICAL: Document number generation collides and fails permanently at 10,000.**
- Batch, roll, GRN, QCI and SLE numbers are "latest by string `orderBy desc`, then +1, padded to 4 digits": `grn/route.ts:122-131` (batch, computed **outside** the transaction), `:158-168` (GRN), `:187-193` (roll), `:196-202` (SLE); `issue/route.ts:87-94`; `return/route.ts:50-57`; `qc/route.ts:114-122, 151-158`; `rolls/[id]/route.ts:76-84`; `batches/route.ts:8-18, 76`.
- (a) Concurrent requests read the same maximum, so one fails with P2002 → 500 (`entryNumber`, `rollNumber`, `batchNumber`, `grnNumber` and `inspectionNumber` are all `@unique`; `schema.prisma:1320, 1367, 1407, 1459, 1487`). Every GRN, QC, issue and return writes an SLE row, so concurrent store activity fails at random.
- (b) Lexicographic ordering: once `SLE-2026-10000` exists, `orderBy desc` still returns `SLE-2026-9999` (because "9" > "1"). The next number is 10000 again and every later GRN, QC, issue and return fails until year end. Each GRN writes one SLE per roll, so 10,000 entries a year is realistic.

**F-H1. HIGH: The availability gate passes with any stock above zero, and its maths is wrong.** `lib/fabric-availability.ts`
- `:271`: `availableStock > 0` makes the sheet AVAILABLE. 1 m on hand clears a 5,000 m sheet. `requiredQuantity` is computed (`:109`) but never compared.
- `:199-210`: subtracts only **this program's** store challans from the global inward total. Other programs' issues are ignored, so the balance is overstated.
- `:157-165, 181-185`: fabric is matched with `contains` (for example "Cotton" matches "Cotton Lycra"), and colour is ignored.
- `:230-232`: any error is swallowed and treated as zero inward stock.
- `:275-285`: a manual "verified" flag clears the gate with no stock and no audit (`updateFabricStoreAvailability`, `:362-375`, overwrites the previous verifier).
- Outcome: the "fabric must be in store before the sheet moves" rule (`challans/route.ts:311-353`) is not enforced. The real guard is `planIssue` for store challans only.

**F-H2. HIGH: QC PASS posts a second `RECEIPT` for the same roll.** `qc/route.ts:160-179` (PASS → `transactionType 'RECEIPT'`, quantity `roll.length`) on top of the GRN `RECEIPT` (`grn/route.ts:235-248`).
- Any report that sums ledger receipts (the stock-ledger page filter `RECEIPT (+)`, `app/fabric-store/inventory/stock-ledger/page.tsx:107`) shows double receipts.
- HOLD is posted as `ADJUSTMENT` with a positive quantity and no sign convention.
- A HOLD→PASS re-inspection adds a third receipt.

**F-H3. HIGH: Returned rolls can never be re-inspected or re-issued.** `return/route.ts:62-73` sets `RETURNED/PENDING`. `qc/route.ts:36` queues only `status: 'RECEIVED'` and `:91` refuses `RETURNED`. `issue/route.ts:69` requires `IN_STOCK`. The only way out is the uncontrolled PATCH (F-C3).

**F-H4. HIGH: Return accepts any issued roll with no link to the program or challan, and no partial quantity.** `return/route.ts:13-44, 84-86`
- There is no check that the roll comes back from the department or program it went to.
- The full `roll.length` is credited, even if 70% was consumed. `CONSUMED` is never set (no code path).
- `referenceId` is the roll id, not a return challan.

**F-H5. HIGH: The receiving department can cancel a Store challan after receipt and put the stock back.**
- `challans/[id]/route.ts:246-251` and `challans/[id]/status/route.ts:51-56` allow either department. Any `status` is accepted (`:260-261`, `:68-69`).
- `syncChallanStock` treats `CANCELLED/DRAFT` as "give everything back" (`fabric-stock-ledger.ts:290`).
- Scenario: Dyeing has received and dyed 800 m. A Dyeing user sets the challan to `CANCELLED` (or `DRAFT`). Store stock rises by 800 m that is physically in Dyeing.
- `challans/[id]` PATCH writes no `ChallanEvent`.

**F-H6. HIGH: Editing a Store challan's fabric or colour without changing quantity leaves stock deducted from the old bucket.** `lib/challan-edit-server.ts:71-75, 236` (`if (changingQuantity.length) await syncChallanStock(...)`).
- After the issue posts to bucket `cotton|DYED|red|MTR`, changing the line to "blue" changes the document but not the ledger. Red is under-stated and blue over-stated.
- Descriptive edits are also allowed after receipt (`:15-22`).

**F-H7. HIGH: Incoming fabric to STORE (returns from Dyeing or production, Programming requests) never enters System B stock.** `fabric-stock-ledger.ts:60-72` (outward only), `challans/[id]/status/route.ts:126-141`.
- Dyed fabric coming back from Dyeing must be keyed in again as a manual Inward. That entry is not linked to the challan, so it can be keyed twice, or forgotten, which leaves stock under-stated.

**F-H8. HIGH: Duplicate `DefectRecord` rows inflate defective-shelf stock.**
- `challans/[id]/route.ts:332-356` and `challans/[id]/status/route.ts:174-198` create a **new** OPEN `DefectRecord` every time a PATCH includes `defectivePieces > 0`, even if the value is unchanged.
- Total Stock sums all OPEN STORE defect records (`total-stock/route.ts` defective section), so the defective quantity multiplies on every edit.

**F-M1. MEDIUM: `rolls/[id]` and `batches/[id]` PATCH, and GRN confirm, have no conditional update or audit.**
- `batches/[id]/route.ts:62-72` lets a client set `status` (for example `FULLY_ISSUED` while rolls are in stock) and change `fabricDescription` or colour after issue. Availability matches rolls by batch `fabricDescription`, so this rewrites history.
- `grn/[id]/confirm/route.ts:16-50` checks `status !== 'DRAFT'` outside any guard, so a double confirm is possible. Confirm also has no effect on the rolls (QC does not require a confirmed GRN; the QC queue ignores GRN status).

**F-M2. MEDIUM: Batch status recomputation ignores other states.** `issue/route.ts:128-139`, `return/route.ts:94-105`. `allIssued` requires every roll in the batch to be `ISSUED`. A batch with one rejected roll can never be `FULLY_ISSUED`. After a return, a batch with QC-hold rolls is labelled `IN_STOCK`.

**F-M3. MEDIUM: Hard deletion of bill (Inward) records.**
- `inward/[id]/route.ts:98-107` and `fabric-stock-ledger.ts:426-435` (Total Stock DELETE, `total-stock/route.ts:177-184`) permanently delete supplier bill rows.
- The `StockLedgerEntry` reversal remains, but the bill number, supplier, rate and tax are lost. There is no `AuditLog` row and no reason captured.

**F-M4. MEDIUM: A manual outward that names a Store challan number posts no stock.** `fabric-stock-ledger.ts:166-173, 397`
- `isChallanMirror` treats any manual outward whose `challanNumber` matches a Store challan (case-insensitive, any year) as a mirror and posts nothing.
- A typo or reuse of a number records an issue in the outward register while stock is unchanged.
- Manual outward has no edit or delete route, so it cannot be corrected.

**F-M5. MEDIUM: Inward edits can re-bucket stock and pass the check only by netting.** `inward/[id]/route.ts:63-80`
- Changing `itemName`, `entryType` or `colour` moves the whole bill to a new bucket. The negative check protects the old bucket, which is good.
- The edit is not audited and has no reason field. `entryType KORA` is silently stored as `UNDYED`.

**F-M6. MEDIUM: The availability check and the stock post use different stock rules.** `challans/route.ts:317-353` runs `checkFabricStoreAvailability` (rolls + inward, `>0`, fuzzy name) outside the transaction. Inside it, `syncChallanStock` uses the bucket book. The gate can block a challan the book would allow (no inward but rolls exist), or the other way round, which confuses users.

**F-M7. MEDIUM: Rounding and type inconsistency.** System B uses `Float` (`schema.prisma:968, 977, 1772, 1812`) with 3-decimal rounding. System A uses `Decimal(10,2)`. Availability rounds to 2 decimals (`fabric-availability.ts:106, 234-235`). The same fabric can show 0.001 m differences between screens, and a `Float` balance of 1e-7 below zero passes the `-EPSILON` check.

**F-M8. MEDIUM: `syncChallanStock` reads the challan before taking the advisory lock.** `fabric-stock-ledger.ts:282-287`. Under READ COMMITTED, a concurrent edit of the same challan can commit between the read and the lock. The repost then uses stale lines. The next sync corrects it, but the `balanceAfter` written can be wrong.

**F-M9. MEDIUM: GRN is not linked to its source challan or purchase order.** `grn/route.ts:84-95` stores no `challanId`. `material-receipt/create/page.tsx:77` puts the challan number in remarks. The same incoming challan can be received into rolls many times.

**F-L1. LOW: Unbounded `limit` on list endpoints.** `ledger/route.ts:18-20`, `rolls/route.ts:18-19` (`parseInt(limit)` with no maximum). The `GET /api/fabric-store/qc?result=` value is passed through `as any`.

**F-L2. LOW: `outward` GET resolves the store incharge as the user named `store`** (`outward/route.ts:32-36`). Manual outwards record no actor at all (the model has no `createdById`), even though the `StockLedgerEntry` does have one.

## 16. Required corrections
1. **Choose one stock ledger** (recommended: System B `StockLedgerEntry` with the bucket rules, plus an optional `rollId` and `batchId` on each row).
   - A GRN posts receipts to the bucket ledger (one row per roll, or one per GRN line).
   - A roll issue becomes a Store challan line with a real `rollId` foreign key.
   - A return posts a positive `RETURN` movement with its quantity, linked to the original challan line.
   - Availability and Total Stock read only this ledger.
   - Migrate existing rolls by posting opening balances once.
2. Guard every status change with a conditional update (`updateMany where status = expected`, `count === 1`) inside the transaction. Do this for issue, return, QC, GRN confirm and batch.
3. Remove the free `status` and `qcStatus` from `rolls/[id]` PATCH. Expose explicit actions (move location, release hold, write off with reason) that each write a ledger row and an `AuditLog` row.
4. Add a return-QC path: let `qc` accept `RETURNED` (inspection type `RETURN_QC`) and let PASS move the roll to `IN_STOCK`. Support partial returns (remaining length) and `CONSUMED`.
5. Generate numbers from a database sequence or counter table (`UPDATE … SET seq = seq + 1 RETURNING`) inside the transaction, or order by a numeric suffix. Never sort strings to find the maximum. Pad to at least 6 digits.
6. QC PASS must not write a `RECEIPT`. Use a quantity-neutral `QC_RELEASE` status event, or a QC-hold sub-bucket.
7. Availability: compare `available >= required` per fabric, colour and unit using the same bucket book as `planIssue`, net of **all** issues and reservations. Remove the `>0` and verified-flag bypasses, or turn the verified flag into an audited, time-limited override held by the Store incharge.
8. Restrict the cancel/DRAFT transition on a Store challan to the Store (sender), and only before receipt. After receipt, require a return challan. Add a status state machine to `challans/[id]` and `/status` and always write a `ChallanEvent`.
9. In `editChallan`, re-run `syncChallanStock` whenever `fabricCode`, `itemDescription`, `colour`, `fabricProcessingStatus` or `uom` change on a Store challan, and block such edits after receipt.
10. Receiving a challan addressed to STORE must post a receipt (or explicitly require a linked Inward or GRN carrying `challanId`). Store `challanId` on `MaterialReceipt` and `FabricInward` with a uniqueness rule.
11. Upsert `DefectRecord` by `(challanId, departmentCode)` instead of inserting one per PATCH.
12. Replace hard deletes of `FabricInward` with a void flag plus a reason. Write `AuditLog` rows for inward edit/void, bucket removal, batch and roll changes, GRN confirm and the availability override.
13. Make manual-outward mirroring explicit (`challanId` foreign key only, never a typed number) and add an audited edit/void route.
14. Move all quantities to `Decimal(12,3)` in one unit policy, and use the same rounding everywhere.
15. Take the advisory lock before reading the challan in `syncChallanStock`.

## 17. Automated tests that should exist
Pure unit tests (`node:test` on `fabric-stock-rules.mjs`; the repository currently has **no test files and no test script**):
- `planIssue`: MTR never satisfies PCS; same bucket summed across lines; ambiguous partial name rejected; colour fallback rules; insufficient-balance message.
- `planLedgerAdjustments`: re-running is idempotent; cancel gives back exactly the posted amount; an edit posts only the delta.
- `checkDocumentBalances`: a reduction below zero is refused and an increase is always allowed.
- `normalizeStockUnit` and `getChallanItemFabricType` tables.

Integration tests (test database, transactional):
- Two concurrent `POST /issue` for the same roll: exactly one succeeds, with one ISSUE ledger row. The same for `/return`.
- Two concurrent Store challans that each want 60% of a bucket: one is refused with `INSUFFICIENT_STOCK` (advisory lock).
- Number generation: 10,001st SLE/ROLL/GRN number is created correctly; 20 parallel GRNs give no P2002.
- A GRN'd roll and an Inward for the same fabric: Total Stock, availability and the challan guard agree (after the single-ledger fix).
- QC PASS does not change the receipt total; HOLD→PASS does not either.
- Return → return-QC PASS → re-issue works; a partial return credits only the returned length.
- The receiving department cannot cancel a received Store challan; the sender cancelling before receipt gives back exactly the issued quantity once.
- Editing a Store challan line's colour moves the deduction to the new bucket.
- PATCH with an unchanged `defectivePieces` creates no new `DefectRecord`.
- Inward delete is refused after issue, and the void keeps the bill row and writes an `AuditLog` row.
- Manual outward with a typed challan number that matches no `challanId` still deducts.
- Availability: 1 m on hand against 5,000 m required returns `isAvailable=false`; issues on other programs reduce availability.
- `rolls/[id]` PATCH cannot set `status` or `qcStatus` directly.

---

## Severity summary

| ID | Severity | Location | One line |
|---|---|---|---|
| F-C1 | CRITICAL | `lib/fabric-stock-ledger.ts:96-123`; `issue/route.ts:97-139`; `fabric-availability.ts:234` | Two disconnected stock ledgers: double counting, or GRN stock unissuable |
| F-C2 | CRITICAL | `fabric-store/issue/route.ts:59-106`; `return/route.ts:22-73` | Check outside the transaction plus unconditional update: double issue or return |
| F-C3 | CRITICAL | `fabric-store/rolls/[id]/route.ts:52-80` | Client sets any roll status or qcStatus, usually without a ledger row |
| F-C4 | CRITICAL | `grn/route.ts:122-202`; `issue:87-94`; `qc:114-158`; others | String-max +1 numbering: P2002 under concurrency, permanent failure after #9999 |
| P-C1 | CRITICAL | `api/programs/[id]/route.ts:67-283` | Programming hard-deletes a live sheet, its ledger rows and audit logs, and releases rolls |
| F-H1 | HIGH | `lib/fabric-availability.ts:199-210, 271, 275` | Gate passes at >0, ignores other programs' issues, verified-flag bypass |
| F-H2 | HIGH | `fabric-store/qc/route.ts:160-179` | QC PASS writes a second RECEIPT |
| F-H3 | HIGH | `return/route.ts:62-73`; `qc/route.ts:36,91` | Returned rolls are stranded |
| F-H4 | HIGH | `return/route.ts:13-86` | Full-length return, no source check, no partial or consumed path |
| F-H5 | HIGH | `challans/[id]/route.ts:246-261`; `status/route.ts:51-69` | Receiver can cancel a received Store challan and put stock back |
| F-H6 | HIGH | `lib/challan-edit-server.ts:71-75, 236` | Fabric or colour edit does not re-post stock |
| F-H7 | HIGH | `lib/fabric-stock-ledger.ts:60-72` | Fabric received into STORE by challan never enters stock |
| F-H8 | HIGH | `challans/[id]/route.ts:332-356`; `status/route.ts:174-198` | New DefectRecord on every PATCH inflates defective stock |
| P-H1 | HIGH | `api/challans/route.ts:321-353, 489` | Programming → Dyeing/Embroidery moves fabric with no stock deduction |
| P-H2 | HIGH | `programs/production-sheet/route.ts:259-265, 407` | Programming can set the store-verified or in-stock flags |
| P-H3 | HIGH | `programs/[id]/status/route.ts:16-21`; `challans/route.ts:623-631` | Free-text status, no audit, automatic regression to ISSUED |
| P-H4 | HIGH | `api/challans/route.ts:227-233` | Non-unique serial number resolves to an arbitrary sheet |
| P-H5 | HIGH | `programs/production-sheet/route.ts:138-163, 465-467` | Issued sheet's quantity and fabric editable; child rows recreated |
| (MEDIUM/LOW) | | see sections 15 | P-M1..M6, P-L1..L2, F-M1..M9, F-L1..L2 |
