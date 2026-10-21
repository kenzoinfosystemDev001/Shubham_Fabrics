# STEAM PRESS DATA MODEL & ENTITY RELATIONSHIPS
## Shubham Fabrics MES

### 1. Reused Models & Relations

1. **Challan**:
   - `id`: UUID
   - `challanNumber`: Unique sequential identifier (`CH-SP-XXXX-XXXX`)
   - `parentChallanId`: Direct reference to upstream Finishing Challan (`parentChallan`)
   - `fromDepartment`: `'STEAM_PRESS'`
   - `toDepartment`: `'FINAL_CHECK'` (or configurable downstream department)
   - `programId`: Foreign key to `Program`
   - `fabricIn`: Total pieces physically inwarded
   - `fabricOut`: Total good pieces pressed & issued
   - `status`: `'ISSUED' | 'RECEIVED' | 'IN_PROCESS' | 'ON_HOLD' | 'COMPLETED' | 'READY_FOR_HANDOVER' | 'HANDED_OVER'`

2. **ChallanItem**:
   - `id`: UUID
   - `challanId`: Foreign key to `Challan`
   - `itemDescription`: Text description of pressed garments
   - `fabricCode`: Fabric identifier
   - `colour`: Color/shade specification
   - `quantity`: Float/Int piece count
   - `uom`: Unit of measurement (`'PCS'`)
   - `barcode`: Code-128 barcode sticker string (`BC-SP-XXXXXX`)

3. **ProductionTransaction**:
   - `departmentCode`: `'STEAM_PRESS'`
   - `operationName`: `'STEAM_PRESSING'`
   - `inputQuantity`: Integer piece count received
   - `goodQuantity`: Integer piece count successfully pressed
   - `reworkQuantity`: Integer count requiring re-press
   - `rejectQuantity`: Integer count scrapped due to iron burns/glaze
   - `balanceQuantity`: Integer count remaining in queue
   - `unitOfMeasure`: `'PCS'`

4. **DefectRecord**:
   - `defectCode`: Unique defect code (`DEF-SP-XXXXXX`)
   - `departmentCode`: `'STEAM_PRESS'`
   - `itemDescription`: Garment details
   - `severity`: `'CRITICAL' | 'MAJOR' | 'MINOR'`
   - `status`: `'SCRAP' | 'REWORK'`
   - `reason`: Description of defect (e.g. Scorch Mark, Water Staining)
