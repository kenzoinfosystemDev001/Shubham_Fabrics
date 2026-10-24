# FINAL QUALITY CONTROL (FINAL QC) DATA MODEL SPECIFICATION
## Shubham Fabrics MES | Entity Relationships & Schemas

---

## 1. REUSED PRISMA ENTITY RELATIONSHIPS

```mermaid
erDiagram
    PROGRAM ||--o{ CHALLAN : "production orders"
    CHALLAN ||--o{ CHALLAN_ITEM : "contains"
    CHALLAN ||--o{ CHALLAN_EVENT : "audit history"
    CHALLAN ||--o| QUALITY_INSPECTION : "inspection audit"
    QUALITY_INSPECTION ||--o{ QUALITY_INSPECTION_PARAMETER : "evaluated checkpoints"
    QUALITY_INSPECTION ||--o{ DEFECT_LOG : "recorded defects"
    CHALLAN ||--o{ PRODUCTION_TRANSACTION : "piece accounting"
    CHALLAN ||--o{ DEFECT_RECORD : "quarantined scraps"
    CHALLAN ||--o{ CHALLAN : "genealogical parent-child"
```

---

## 2. MODEL DETAILS

### `QualityInspection` (Inspection Header)
- `id`: UUID (Primary Key)
- `challanId`: References `Challan(id)`
- `programId`: References `Program(id)`
- `departmentCode`: `'FINAL_QC'`
- `inspectorId`: References `User(id)`
- `sampleSize`: Total pieces inspected in this audit session
- `status`: workflow values such as `'PASS'`, `'REWORK'`, `'REJECT'`, or `'HOLD'`
- `notes`: Inspector summary observations
- `inspectedAt`: Timestamp of audit completion

### `QualityInspectionParameter` (Checkpoints)
- `inspectionId`: References `QualityInspection(id)`
- `parameterName`: e.g. `'Visual Appearance'`, `'Seam Strength'`, `'Measurement Chest'`, `'Zero Scorch Glaze'`
- `expectedValue`: Standard from Production Sheet
- `measuredValue`: Observed actual value
- `tolerance`: e.g. `'+/- 0.5 inch'`
- `status`: `'PASS'` | `'FAIL'` | `'OBSERVATION'`
- `comments`: Detailed checkpoint remarks

### `DefectLog` (Categorized QC Defects)
- `inspectionId`: References `QualityInspection(id)`
- `defectType`: Categorized defect name (e.g. `'Stain spot'`, `'Broken stitch'`, `'Measurement out of spec'`)
- `count`: Number of pieces affected
- `severity`: `'MINOR'` | `'MAJOR'` | `'CRITICAL'`

### `ProductionTransaction` (Quantitative Audit)
- `challanId`: References `Challan(id)`
- `programId`: References `Program(id)`
- `departmentCode`: `'FINAL_QC'`
- `operationName`: `'FINAL_QUALITY_INSPECTION'`
- `operatorId`: References `User(id)`
- `inputQuantity`: Total pieces presented for inspection
- `goodQuantity`: Pieces passed AQL 100% audit (Accepted)
- `reworkQuantity`: Pieces flagged for alteration / touch-up
- `rejectQuantity`: Permanent scrap / rejected pieces
- `balanceQuantity`: Remaining uninspected WIP pieces
- `unitOfMeasure`: `'PCS'`

### `DefectRecord` (Rejected or Rework Tracking)
- `defectCode`: Unique code e.g. `DEF-FQC-YYYY-XXXX`
- `departmentCode`: `'FINAL_QC'`
- `itemDescription`: Garment description
- `severity`: `'CRITICAL'`
- `quantity`: Number of rejected pieces
- `status`: `'OPEN'` for rejected garments and `'REWORK'` for rework garments; Final QC does not silently mark pieces as scrap.
- `reason`: Primary defect cause (e.g. `'Fabric tear'`, `'Oil stain non-removable'`)

### `Challan` & Outgoing Transfer
- Unique outgoing identifier: `CH-FQC-<timestamp>-<random suffix>`
- `fromDepartment`: `'FINAL_QC'`
- `toDepartment`: Dynamically resolved (`'PACKING'` by default)
- `parentChallanId`: Direct reference to the incoming Steam Press / Finishing Challan. Child items preserve transferred quantities and genealogy.

## 3. IMPLEMENTATION BOUNDARIES

- No new schema migration is required for the implemented workflow.
- Final QC uses the web application's Prisma API handlers. A previously added NestJS Final QC module also exists; inspect its consumers before removing or redirecting it.
- Production Sheet identification comes from the linked `Program` (including `programSerialNo` where present); no separate ProductionSheet model is assumed.
- Rework is recorded in `DefectLog`, `DefectRecord`, and `ProductionTransaction`; no rework-loop destination is configured.
