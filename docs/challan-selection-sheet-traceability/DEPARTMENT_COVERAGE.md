# Department coverage

Every department that issues an outgoing challan was audited. The route is configured in code, so this table follows `WORKFLOWS` in `lib/work-items-server.ts` and the dedicated services.

| Department | Issues to | Issued from | Screen | Backend | Before | Now |
|---|---|---|---|---|---|---|
| Fabric Store | Dyeing, Embroidery | Stock (no incoming challan) | Fabric Store > Challan to Dyeing / Embroidery | `POST /api/challans` | First sheet auto-selected; API fallback to any sheet; one sheet per challan | Sheets added explicitly; several per challan; each line stores its sheet; availability checked per sheet |
| Dyeing | Dyeing QC (QC1) | Store → Dyeing challans, QC1 rework returns | Dyeing > Issue Challan to Dyeing QC | `lib/dyeing-qc-issue.ts` | Sheet picked (auto when only one); one sheet; parent = first line's challan | Incoming challan selected; lines of several sheets allowed; per-line sheet and source line |
| Dyeing QC (QC1) | Embroidery (pass), Dyeing (rework); shrinkage recorded on the line | The selected Dyeing → QC1 challan (Inspect) | Dyeing QC > My Work > Inspect | `api/qc1/challans/[id]/inspect` | Per-unit inspection; outgoing challans merged into one line per unit; a unit's shrinkage split across its lines by quantity | Per-line inspection; one outgoing line per inspected line, each with its sheet, fabric, colour and source line; shrinkage saved on the line it was measured on |
| Embroidery | Thread Cutting | QC1 pass challans, Store direct | Issue Challan to Thread Cutting | `WorkIssueChallan`, `issueTransferChallan` | Sheet picked (auto when only one); one sheet | Incoming challan selected; per-line sheet and source line |
| Thread Cutting | Threadcut QC (QC2) | Embroidery challans, QC2 rework returns | Issue Challan to Threadcut QC | same | same | same |
| Threadcut QC (QC2) | Washing / Store shelf / Thread Cutting | Thread Cutting challans | Issue Challan, Rejected Material, Rework Material | same (kind PASS / REJECT / REWORK) | same | same |
| Washing | Washing QC (QC3) | QC2 pass, QC3 re-wash returns | Issue Challan to Washing QC | same | same | same |
| Washing QC (QC3) | Recutting / Store shelf / Washing | Washing challans | Issue, Rejected, Rework | same | same | same |
| Recutting | Stitching | Washing QC challans (allocated, then cut) | Generate Stitching Challan | `lib/recutting-server.ts` | Sheet picked (auto when only one); one sheet | Incoming challan selected; allocations of its lines; per-line sheet and source line |
| Stitching | Finishing | Recutting challans | Issue Challan to Finishing | `WorkIssueChallan` | Sheet picked; one sheet | Incoming challan selected |
| Finishing | Steam Press | Stitching challans | Issue Challan to Steam Press (finished garments) | same | Garments of one sheet | Incoming challan selected; garments grouped per sheet; image per garment's sheet |
| Steam Press | Final QC | Finishing challans, Final QC rework | Issue Challan to Final QC | same | same | same |
| Final QC | Inventory / Store shelf / Steam Press | Steam Press challans | Issue, Rejected, Rework | same (PCS only to Inventory) | same | same |
| Inventory (Packing) | nothing onward | Final QC challans | n/a | n/a | n/a | Receives work items that each carry their line's own sheet |

## Sheet-level visibility per screen

| Screen | What it shows |
|---|---|
| Incoming, Received and Process screens (all work-item departments, Dyeing) | One row per incoming line, with that line's own sheet. This uses the work item's or order's `programId`, which is now taken from the line. |
| Issue screens | Incoming challans with their sheets; each line with its sheet and incoming challan; a per-sheet review before issuing. |
| Challan detail | Production Sheet and source challan per line, and per-sheet subtotals. |
| Prints | Each line's sheet and a subtotal per sheet, when a challan carries several sheets. |

## Outstanding

- Fabric Store fabric availability is shown for the sheet being edited. The server checks every sheet on the challan before creating it.
- Dashboards and lists that show `challan.program` (the challan's first sheet) were not all changed. The issue screens, the challan detail page and prints show every sheet.
