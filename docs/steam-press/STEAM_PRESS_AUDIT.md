# STEAM PRESS DEPARTMENT ARCHITECTURAL AUDIT
## Shubham Fabrics MES | Production Architecture Inspection

### 1. Executive Summary & Mission
The **Steam Press Department** (`STEAM_PRESS`) serves as a critical bridge between garment finishing and final quality inspection:
$$\text{Finishing (FINISHING)} \longrightarrow \text{Steam Press (STEAM\_PRESS)} \longrightarrow \text{Final QC (FINAL\_CHECK)}$$

Steam Press receives stitched, trimmed, and pre-checked garments, executes high-temperature steam ironing and crease setting, verifies piece quantities, performs quick visual check for steam scorch/burns or residual moisture, reconciles output, and issues an outgoing Challan to **Final Quality Check** (`FINAL_QC`).

### 2. Architectural Findings & Component Reuse
1. **Challan Engine**:
   - Reuses `Challan` with `ChallanItem` and `ChallanEvent`.
   - Inward Challans arrive with `toDepartment: { in: ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'] }`.
   - Outward Challans are issued with `fromDepartment: 'STEAM_PRESS'` and `toDepartment: 'FINAL_QC'`.
   - Outward Challans preserve `parentChallanId` to maintain the complete multi-department genealogical chain back to `STITCHING`, `RECUTTING`, `WASHING_QC`, and the root `Program`.

2. **Production Sheet Association**:
   - Reuses `Program` (Production Sheet) without copying or mutating original design/order records.
   - Preserves `programNumber`, `styleCode`, `clientName`, `buyerName`, and design specifications.

3. **Production Transactions & Accounting**:
   - Reuses `ProductionTransaction` with `departmentCode: 'STEAM_PRESS'` and `operationName: 'STEAM_PRESSING'`.
   - Strict integer piece-based accounting:
     $$\text{Input Pieces} = \text{Good Pressed Pieces} + \text{Re-press / Rework} + \text{Scorch / Reject Scrap} + \text{Balance in Pressing}$$
   - Any scrap/burn defect is recorded in `DefectRecord` with `defectCode`, `departmentCode: 'STEAM_PRESS'`, `itemDescription`, and quarantined status.

4. **Authentication & RBAC**:
   - New role: `STEAM_PRESS_SUPERVISOR` / `STEAM_PRESS_OPERATOR` / `STEAM_PRESS_INCHARGE`.
   - Seeded user: `steampress` (PIN `1234`).
   - Quick login tile integrated in `apps/web/src/app/login/page.tsx`.

5. **No Schema Changes Needed**:
   - Existing Prisma schema models (`Challan`, `ChallanItem`, `ChallanEvent`, `Program`, `ProductionTransaction`, `DefectRecord`, `Department`, `User`, `Role`) completely fulfill all requirements.
