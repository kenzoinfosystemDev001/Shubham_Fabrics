# Final QC Traceability

## Genealogy chain

`Program` (Production Sheet) → upstream `Challan` → Final QC `QualityInspection` and `QualityInspectionParameter` records → `ProductionTransaction` → `DefectLog` / `DefectRecord` → defective-return or downstream child `Challan` → `ChallanEvent`.

The linked `Program` preserves the production/style reference, including `programSerialNo` where available. Final QC does not introduce a parallel Production Sheet table.

## Recorded evidence

| Event / quantity | Persisted record |
|---|---|
| Inward count and discrepancy | `Challan.fabricIn`, receipt fields, and `ChallanEvent` |
| Inspector checkpoints and decision | `QualityInspection`, `QualityInspectionParameter` |
| Accepted, rework, rejected, pending counts | `ProductionTransaction` |
| Defect categories and affected counts | `DefectLog` |
| Rejected / rework disposition | `DefectRecord` linked to the originating challan and program |
| Rejected pieces placed at Final QC shelf | `DEFECTIVE_RETURN` child `Challan` and `ChallanEvent` |
| Accepted pieces handed to configured next stage | `INTER_DEPARTMENT` child `Challan`, its `ChallanItem` rows, parent link, and event history |
| Hold/resume/start/inspection/handover transitions | `ChallanEvent` with the authenticated actor |

## Reconciliation and transfer trace

Every inspection transaction reconciles input to accepted + rework + rejected + pending. Accepted output accumulates in the parent challan's `fabricOut`. A normal transfer to the configured next department consumes only the remaining accepted balance; defective-return challans are excluded from accepted transfer totals. Parent and child updates are committed in one database transaction.

## Known boundary

There is no configured automatic rework destination or downstream reinspection workflow. Rework remains traceable but is not transferred as accepted stock. The current authentication token's lack of a cryptographic signature is a shared-platform limitation.
