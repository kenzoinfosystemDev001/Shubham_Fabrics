# Data model: challans, sheets and quantities

## Relationships

```
Program (Production Sheet)
  └─ ChallanItem.programId ............ each line's own sheet (any number of sheets per challan)
Challan ── items ── ChallanItem
  ├─ programId ........................ the challan's first sheet (required, unchanged)
  └─ parentChallanId .................. the first selected incoming challan (header reference)
ChallanItem.sourceChallanItemId ─────── the incoming line it was issued from
DyeingOrder / DepartmentWorkItem ────── one per incoming line; programId = that line's sheet
DyeingQcTransfer / DepartmentWorkTransfer ── one per outgoing line (quantity moved from which work)
```

The line, not the challan header, is authoritative for sheet and genealogy. To trace a line backwards, follow `sourceChallanItemId` (or the transfer tables) from department to department:

**Store line → Dyeing order → Dyeing QC line → Embroidery work item → … → Final QC line → Inventory**

At each step the line keeps its sheet, fabric, colour and unit.

## Which sheet a line belongs to

`lineSheetId(item, challan) = item.programId ?? challan.programId`

- **New lines** always store `programId`.
- **Older lines** have `programId` filled from their challan by the migration. Every challan before this change had exactly one sheet, so this states what was recorded and invents nothing.

## Quantities per line

| Department kind | Counters (per line) | Available to send |
|---|---|---|
| Dyeing (`DyeingOrder`) | required → received → dyed → sent to QC | dyed − sent |
| Production departments (`DepartmentWorkItem`) | expected → received → processed → transferred | processed − transferred |
| QC departments | inspected = passed + rejected + rework; sent per outcome | passed − sent, rejected − sent, rework − sent |
| Recutting allocations | allocated (line unit) → cut (cut unit) → transferred | cut − transferred |
| Dyeing QC (QC1) | per line: inspected ≤ line quantity; pass + fail + rework + hold ≤ inspected | Outgoing challans carry one line per inspected line with that outcome. |

Partial processing is supported wherever these counters exist. A line can be sent in several challans, and each one moves only what is still available.

## Totals

- **How they are computed:** challan totals come from the lines (`totalsByUnit`), never from the header. `sheetBreakdown(challan)` groups lines by sheet and gives totals per unit for each sheet and for the whole challan.
- **Per-sheet example:** a challan carrying PS-001 100 m, PS-002 150 m and PS-003 200 m totals 450 MTR, and each sheet keeps its own figure.
- **Units:** MTR and PCS are always totalled separately. With 450 MTR and 320 PCS, the challan shows "450 MTR · 320 PCS", never 770.
- **Header fields:** `fabricIn`, `fabricOut` and `fabricUnit` stay single-unit, as before. A challan with lines in both units is `MIXED` and has no header quantity.

## Backfill rules

| Column | Filled from | Left null |
|---|---|---|
| `programId` | the line's challan `programId` | never |
| `sourceChallanItemId` | for Dyeing → Dyeing QC lines, `DyeingQcTransfer` → `DyeingOrder.inboundChallanItemId` | Fabric Store lines, because they come from stock |
| `sourceChallanItemId` | for work-item department lines, including Recutting → Stitching, `DepartmentWorkTransfer` → `DepartmentWorkItem.inboundChallanItemId` | Dyeing QC output lines issued before this change, because they were merged per unit and have no single source line; they are not guessed |
