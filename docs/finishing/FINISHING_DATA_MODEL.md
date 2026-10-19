# SHUBHAM FABRICS MES — FINISHING DATA MODEL

## 1. Primary Entities & Relationships

### Challan (`Challan`)
Represents the material transfer into and out of Finishing:
- `challanNumber`: Unique alphanumeric identifier (e.g. `CH-ST-...` incoming, `CH-FN-...` outgoing).
- `fromDepartment`: `STITCHING` (incoming) or `FINISHING` (outgoing).
- `toDepartment`: `FINISHING` (incoming) or configured next department (`BUTTON_ATTACHMENT` / `PACKING`).
- `parentChallanId`: Direct pointer to upstream Challan for vertical genealogy.
- `programId`: Foreign key to `Program`.
- `status`: `ISSUED` | `RECEIVED` | `IN_PROCESS` | `ON_HOLD` | `COMPLETED` | `READY_FOR_HANDOVER` | `HANDED_OVER`.
- `fabricIn`: Total received garments (pcs).
- `fabricOut`: Total completed good garments (pcs).
- `defectivePieces`: Total rejected / scrap garments (pcs).

### Challan Item (`ChallanItem`)
- `challanId`: Cascade relation to `Challan`.
- `itemDescription`: Textual specification of the finished garment.
- `fabricCode`: Default `'GARMENT'` or `'FINISHED_GARMENT'`.
- `colour`: Master color reference.
- `quantity`: Quantity in pieces.
- `uom`: `'PCS'`.
- `unitType`: `'PCS'`.
- `barcode`: Code-128 barcode value (e.g. `BC-FN-...`).
- `remarks`: Line inspection or batch remarks.

### Production Transaction (`ProductionTransaction`)
Records granular physical work:
- `programId`: Linked Production Sheet.
- `challanId`: Finishing job Challan ID.
- `departmentCode`: `'FINISHING'`.
- `operationName`: `'GARMENT_FINISHING'`.
- `operatorId`: ID of responsible finishing operator.
- `inputQuantity`: Total garments admitted into finishing.
- `goodQuantity`: Finished good garments meeting standard.
- `reworkQuantity`: Garments requiring touch-up trimming or spot cleaning.
- `rejectQuantity`: Quarantined scrap garments.
- `balanceQuantity`: Work-in-progress remaining.
- `unitOfMeasure`: `'PCS'`.
- `recordedAt`: Timestamp.
- `notes`: Shift details and observations.

### Defect Record (`DefectRecord`)
Quarantine record for defects identified during finishing:
- `defectCode`: Unique code (e.g. `DEF-FN-...`).
- `programId`: Program ID.
- `challanId`: Finishing job ID.
- `departmentCode`: `'FINISHING'`.
- `itemDescription`: Defect description (e.g. permanent oil mark, fabric snags).
- `severity`: `'MINOR'` | `'MAJOR'` | `'CRITICAL'`.
- `quantity`: Count of scrapped garments.
- `reason`: Root cause failure.
- `detectedById`: Inspector / Operator ID.
- `status`: `'OPEN'`.
