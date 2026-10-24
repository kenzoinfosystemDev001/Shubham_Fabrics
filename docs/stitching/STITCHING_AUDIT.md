# Comprehensive MES System & Domain Audit: Stitching Department

**Document Version:** 1.0.0  
**Department Under Audit:** Garment Assembly & Stitching Section (`STITCHING`)  
**Upstream Supplier:** Embroidery Recutting Department (`RECUTTING`)  
**Downstream Consumer:** Next Configured Route (Standard: Finishing & Thread Trimming `FINISHING` / `FINAL_QC`)  
**MES Database:** PostgreSQL via Prisma ORM  

---

## 1. Executive Summary

This audit assesses the integration architecture, current schema capabilities, data flows, and constraints necessary to build a production-grade **Stitching Department** within the Shubham Fabrics Manufacturing Execution System (MES).

The manufacturing pipeline follows the established physical sequence:
$$\text{Washing QC} \longrightarrow \text{Recutting (RECUTTING)} \longrightarrow \text{Stitching (STITCHING)} \longrightarrow \text{Finishing (FINISHING)}$$

The Stitching Department is responsible for receiving precision-cut and separated embroidered panels and components from Recutting, validating them against the authoritative **Production Sheet** (`Program`), allocating production lines/machines/operators, stitching the components into finished garments or products, executing quality checks, reconciling inputs and outputs, and issuing outgoing Challans to the next configured department.

---

## 2. Domain Entities & Database Architecture Audit

| Entity / Model | Existing Database Support | Reuse Strategy for Stitching |
| :--- | :--- | :--- |
| **`Program` (Production Sheet)** | Full schema (`programNumber`, `designNumber`, `wilcomDesignNumber`, `styleCode`, `buyerName`, `clientName`, `fabricName`, `targetQuantity`, `deliveryDate`). | Direct source of truth. Stitching links directly to `Program` to verify garment styling, Wilcom design references, and specs. |
| **`Challan`** | Full schema (`challanNumber`, `fromDepartment`, `toDepartment`, `status`, `fabricIn`, `fabricOut`, `parentChallanId`, `childChallans`). | Primary material transfer instrument. Incoming Challans from Recutting (`toDepartment = 'STITCHING'`) are received, and outgoing Challans (`fromDepartment = 'STITCHING'`) are issued with `parentChallanId` genealogy. |
| **`ChallanItem`** | Full schema (`itemDescription`, `fabricCode`, `colour`, `quantity`, `uom`, `unitType`, `barcode`, `remarks`). | Detailed component/garment tracking. Quantities must specify `unitType: 'PCS'` and `uom: 'PCS'`. |
| **`ChallanEvent`** | Full schema (`challanId`, `action`, `fromStatus`, `toStatus`, `actorId`, `notes`, `createdAt`). | Event audit log for all receipt, allocation, stitching, and handover transitions. |
| **`ProductionTransaction`** | Full schema (`departmentCode`, `operationName`, `inputQuantity`, `goodQuantity`, `reworkQuantity`, `rejectQuantity`, `wasteQuantity`, `unitOfMeasure`, `operatorId`). | Standard MES operation log. Stitching operations persist with `departmentCode: 'STITCHING'` and `operationName: 'GARMENT_STITCHING'`. |
| **`DefectRecord`** | Full schema (`challanId`, `programId`, `departmentCode`, `defectCode`, `itemDescription`, `severity`, `quantity`, `reason`, `detectedById`, `status`). | Rejection and defect audit logging. Reject pieces in stitching automatically create `DefectRecord` with `departmentCode: 'STITCHING'`. |
| **`Department`** | Fully seeded with `code: 'STITCHING'`, `name: 'Stitching Department'`, `sequenceOrder: 11`. | Foreign key references for `fromDeptRel` and `toDeptRel`. Next department resolved dynamically from `STANDARD_FACTORY_ROUTE`. |
| **`UserRole` & `Role`** | `STITCHING_SUPERVISOR` enum exists in `@subham/types`. | Core user `stitching` seeded with PIN `1234` and `STITCHING_SUPERVISOR` role. |

---

## 3. Workflow Gap Analysis & Requirements

1. **No Hardcoded Next Department**:
   - Outgoing Challans must resolve the next eligible destination from the production route (`STANDARD_FACTORY_ROUTE` or `Program.metadataJson`), defaulting to `FINISHING` while allowing override if configured for alternative routing (e.g. `BUTTON_ATTACHMENT` or `FINAL_QC`).
2. **Component & Material Reconciliation**:
   - Stitching processes cut panels received from Recutting into assembled garments.
   - Enforce: $\text{Received Cut Panels} = \text{Good Finished Garments} + \text{Rework / Re-stitch} + \text{Scrap / Rejection} + \text{WIP / Unstitched Balance}$.
3. **Line, Machine & Operator Assignment**:
   - Allow assignment of stitching jobs to operators, lines, and machines with timestamp tracking for `IN_PROCESS`, `PAUSED`, and `COMPLETED`.
4. **Pre-Handover Quality Control**:
   - Inspection criteria: Seam strength, thread tension, dimensional fit against size spec, SPI (Stitches Per Inch), and absence of puckering/fraying.
5. **Traceability Preservation**:
   - Upstream Recutting Challan and Production Sheet references must be permanently connected to outgoing Challans.

---

## 4. Architecture Verification Conclusion

The existing database architecture fully supports the required Stitching Department without modifying core schema definitions or breaking upstream/downstream departments. Implementation requires adding specialized API controllers, React UI pages, state transitions, and tests.
