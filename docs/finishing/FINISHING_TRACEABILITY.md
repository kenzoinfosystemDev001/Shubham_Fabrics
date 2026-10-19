# SHUBHAM FABRICS MES — FINISHING TRACEABILITY SPECIFICATION

## 1. Upstream-to-Downstream Lineage
Each outgoing Challan from Finishing contains:
- `parentChallanId`: Direct reference to the incoming Stitching Challan (`CH-ST-...`).
- `programId`: Direct reference to the original Production Sheet (`PRG-...`).
- `operationName`: `'GARMENT_FINISHING'` logged in `ProductionTransaction`.
- `barcode`: Code-128 barcode format `BC-FN-{timestamp}`.

## 2. Defect & Scrap Traceability
Every rejected garment generates a persisted `DefectRecord` with:
- Defect code: `DEF-FN-{timestamp}`
- Department: `FINISHING`
- Reason: Detailed categorization (e.g. burn mark, tear, oil smudge).
- Status: `OPEN` for quarantine control.
