# FINAL QUALITY CONTROL (FINAL QC) API CONTRACT
## Shubham Fabrics MES | Backend REST Endpoint Specifications

Base Path: `/api/final-check`

---

## 1. DASHBOARD & QUEUE ENDPOINTS

### `GET /api/final-check/dashboard`
Returns live KPI metrics and queue counts.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "kpis": {
        "awaitingReceipt": 2,
        "awaitingInspection": 5,
        "inInspection": 1,
        "onHold": 0,
        "readyForHandover": 3,
        "handedOver": 12,
        "totalInspectedPieces": 1450,
        "firstPassYield": 96.2
      },
      "activeJobs": [ ... ],
      "recentTransactions": [ ... ]
    }
  }
  ```

### `GET /api/final-check/incoming`
Returns Challans issued to Final QC awaiting physical acknowledgment (`status: 'ISSUED'`).

### `POST /api/final-check/challans/[id]/receive`
Acknowledges physical bundle receipt and count verification.
- **Request Body**:
  ```json
  {
    "receivedQuantity": 100,
    "remarks": "Bundle count verified, labels intact",
    "markOnHold": false
  }
  ```
- **Validation**:
  - `receivedQuantity > 0` and `receivedQuantity <= issuedQuantity`.
- **Transitions**: Updates Challan status to `'RECEIVED'`, logs `ChallanEvent`.

### `GET /api/final-check/queue`
Returns active jobs in Final QC (`RECEIVED`, `IN_PROCESS`, `COMPLETED`, `READY_FOR_HANDOVER`, `ON_HOLD`).

### `GET /api/final-check/jobs/[id]`
Returns single job details including linked Production Sheet (`Program`), events, defect records, and prior inspections.

---

## 2. INSPECTION & WORKFLOW EXECUTION

### `POST /api/final-check/jobs/[id]/start`
Allocates inspection table and inspector.
- **Request Body**:
  ```json
  {
    "workstationNumber": "QC Table 1",
    "inspectorName": "Senior QC Inspector",
    "inspectionStandard": "AQL_100_PERCENT"
  }
  ```
- **Transitions**: Updates Challan status to `'IN_PROCESS'`.

### `POST /api/final-check/jobs/[id]/inspect`
Submits authoritative inspection results, parameter checkpoints, defect categorization, and output quantity reconciliation.
- **Request Body**:
  ```json
  {
    "inspectedQuantity": 100,
    "acceptedQuantity": 95,
    "reworkQuantity": 3,
    "rejectQuantity": 2,
    "balanceQuantity": 0,
    "inspectionChecks": {
      "visualAppearance": "PASS",
      "stitchingSeams": "PASS",
      "embroideryIntegrity": "PASS",
      "trimmingCleanliness": "PASS",
      "pressingQuality": "PASS",
      "measurements": "PASS",
      "trimsAndLabels": "PASS"
    },
    "defects": [
      { "type": "Loose seam thread", "count": 3, "severity": "MINOR" },
      { "type": "Non-removable fabric stain", "count": 2, "severity": "CRITICAL" }
    ],
    "notes": "Passed full AQL audit with 2 fabric stain scraps quarantined.",
    "autoAdvance": true
  }
  ```
- **Validation**:
  - `inspectedQuantity == acceptedQuantity + reworkQuantity + rejectQuantity + balanceQuantity`.
  - Non-negative integers.
- **Database Operations**:
  - Creates `QualityInspection`, `QualityInspectionParameter` records, `DefectLog` records.
  - Creates `ProductionTransaction` (`departmentCode: 'FINAL_CHECK'`).
  - Creates `DefectRecord` (`status: 'SCRAP'`) if `rejectQuantity > 0`.
  - Updates Challan `fabricOut = acceptedQuantity`, `reworkQty = reworkQuantity`, `rejectQty = rejectQuantity`.
  - Status updated to `'READY_FOR_HANDOVER'` (if autoAdvance) or `'COMPLETED'`.

### `POST /api/final-check/jobs/[id]/hold` & `POST /api/final-check/jobs/[id]/resume`
Places job on hold for supervisor review or resumes it.

---

## 3. DOWNSTREAM HANDOVER & REPORTING

### `POST /api/final-check/issue-challan`
Generates outgoing handover Challan to next stage (`PACKING`).
- **Request Body**:
  ```json
  {
    "parentChallanId": "uuid",
    "programId": "uuid",
    "toDepartment": "PACKING",
    "priority": "NORMAL",
    "remarks": "Final QC passed garments transferred for folding & packaging.",
    "items": [
      {
        "itemDescription": "Inspected Kurti Garments - Passed Final QC",
        "fabricCode": "GARMENT",
        "colour": "TEAL",
        "quantity": 95,
        "uom": "PCS",
        "unitType": "PCS",
        "remarks": "100% Passed AQL audit"
      }
    ]
  }
  ```
- **Guards**: Handover quantity cannot exceed available accepted good quantity.
- **Outputs**: Generates sequential Challan (`CH-FQC-XXXX-XXXX`), assigns Code-128 barcode, marks parent `HANDED_OVER`.

### `GET /api/final-check/floor-board`
Returns 4-lane live Kanban board:
1. `INCOMING`
2. `IN_INSPECTION`
3. `SUPERVISOR_REVIEW`
4. `READY_FOR_DISPATCH`

### `GET /api/final-check/reports`
First-pass yield, defect Pareto distribution, style throughput, and audit trail.
