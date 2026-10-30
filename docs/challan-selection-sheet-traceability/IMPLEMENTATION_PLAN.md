# Implementation: incoming challan selection and sheet-wise traceability

This change corrects the existing challan model with as little new structure as possible. It adds no new challan engine and no new tables. Every issue still goes through the service it used before.

## Database

There are two nullable columns on `ChallanItem`, added by `packages/database/prisma/manual-migrations/20261030_challan_item_sheet_source.sql`:

| Column | Meaning |
|---|---|
| `programId` | The Production Sheet the line belongs to. A challan can carry lines of several sheets. `Challan.programId` stays required and holds the challan's first sheet. |
| `sourceChallanItemId` | The incoming challan line this line was issued from. It is null on Fabric Store issues from stock. |

Details of the migration:
- **Additive only:** no existing value changes, and the migration is re-runnable.
- **Backfill:** only where existing records already state the mapping exactly. See [DATA_MODEL.md](DATA_MODEL.md).
- **Code fallback:** code reads `item.programId ?? challan.programId`, so a database without the backfill still behaves the same way.
- **Rollback:** drop the two columns and their constraints. No other data depends on them.

## Backend

| File | Change |
|---|---|
| `lib/challan-sheets.mjs` (new) | Pure helpers: the sheet of a line, per-sheet breakdown and totals by unit, the incoming-challan options, the selection check, and Prisma include shapes. |
| `lib/qc1-inspection.mjs` (new) | Pure rules for Dyeing QC quantities per line. A unit total is never split across lines. |
| `lib/work-items.mjs`, `lib/dyeing-workflow.mjs`, `lib/recutting.mjs` | The validators accept the selected `sourceChallanIds` and refuse any line from another challan. They no longer require one sheet per challan, and they return every sheet on the challan. |
| `lib/work-items-server.ts` | `issueTransferChallan` requires `sourceChallanIds`. Each outgoing line records `programId` and `sourceChallanItemId`. `syncWorkItems` gives each work item its line's own sheet. |
| `lib/dyeing-qc-issue.ts`, `api/dyeing/qc-challans` | The same changes for Dyeing → Dyeing QC. |
| `lib/recutting-server.ts` | The same changes for Recutting → Stitching. |
| `lib/dyeing-sync.ts` | Each `DyeingOrder` takes its line's sheet. |
| `api/challans` (POST) | Fabric Store challan creation, described below this table. |
| `api/qc1/challans/[id]/inspect` | Inspection per line (`byLine`: pass, shrinkage, rework, hold). The pass and rework challans carry one line per inspected line, each with its own fabric, colour and sheet. Shrinkage is saved on the line it was measured on, never spread across lines. `LINE_BREAKDOWN` parameters are recorded. |
| `api/challans/[id]`, `api/challans`, `api/qc1/challans`, issue-screen lists | Challan lines are returned with their sheet (and on the detail page, their source challan). |

`api/challans` (POST) changes:
- It requires a sheet; the `findFirst()` fallback is removed.
- Each line may name its own sheet. Every sheet is resolved and checked: unknown or cancelled sheets are refused.
- Fabric availability is checked per sheet and per unit.
- Each line stores its own sheet.

Unchanged:
- Quantity checks and optimistic concurrency guards.
- Idempotency keys.
- Department authorization.
- The ledger and stock posting.

## Frontend

| Screen | Change |
|---|---|
| `components/challan/IncomingChallanPicker.tsx` (new) | Step 1, the incoming-challan picker. A searchable table of eligible incoming challans shows number, date, source, sheets, lines, available quantity per unit and status. The user selects one or more; nothing is selected automatically. It also contains `SheetBreakdown`, a per-sheet summary with totals per unit. |
| Dyeing > Issue Challan to Dyeing QC | Select the incoming challan, then the dyed lines from it, each showing its sheet and incoming challan. An "Add all lines" button and a per-sheet review complete the flow. |
| `WorkIssueChallan`: Embroidery, Thread Cutting, Threadcut QC, Washing, Washing QC, Stitching, Finishing, Steam Press, Final QC (PASS, Rejected and Rework screens) | The same flow. Finished garments are grouped per sheet, and each garment image upload uses the garment's own sheet. |
| Recutting > Generate Stitching Challan | The same flow, offering allocations of the selected challans' lines. |
| Fabric Store > Challan to Dyeing / Embroidery | Sheets are added explicitly; the first is no longer selected automatically. Several sheets can be added, each with its own lines and stock check, and a per-sheet summary appears when there is more than one. |
| Dyeing QC > Inspect | The line selector replaces the unit selector. Every line is inspected in its own unit and labelled with its sheet, fabric and colour. |
| Challan detail (`/challans/[id]`) | Production Sheet and Source Challan columns, with per-sheet subtotals when a challan carries several sheets. |
| Challan print and download | When a challan carries several sheets, each line shows its sheet and each sheet gets a subtotal. |

Every other screen is unchanged. Incoming, received and process screens already show work per line; they now show each line's own sheet.
