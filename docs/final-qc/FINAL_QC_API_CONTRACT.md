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
  - Issued and received counts must be positive whole-number quantities.
  - `receivedQuantity <= issuedQuantity`.
- **Transitions**: Conditionally changes `ISSUED` to `RECEIVED` (or `ON_HOLD` when a shortage is explicitly held), logs `ChallanEvent`, and returns `409` when another action already changed the record.

### `GET /api/final-check/queue`
Returns Final QC jobs with linked program, items, recent production transactions, inspections/defects, and outgoing challans. Available handover quantity is accepted output minus prior normal downstream transfers.

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
Submits authoritative inspection results, parameter checkpoints, defect categorization, and output quantity reconciliation. Inspector/operator identity comes from the authenticated session.
- **Request Body**:
  ```json
  {
    "inputQuantity": 100,
    "acceptedQuantity": 95,
    "reworkQuantity": 3,
    "rejectedQuantity": 2,
    "pendingQuantity": 0,
    "appearanceCheck": "PASS",
    "measurementCheck": "PASS",
    "labelCheck": "PASS",
    "stitchingQuality": "PASS",
    "packagingReadiness": "PASS",
    "overallResult": "PASS",
    "defectReason": "",
    "reworkReason": "",
    "notes": "Inspection observations"
  }
  ```
- **Validation**:
  - `inputQuantity == acceptedQuantity + reworkQuantity + rejectedQuantity + pendingQuantity`.
  - Non-negative safe integers; input must equal the remaining batch balance.
  - All five checkpoints and the overall result are required.
- **Database Operations**:
  - Creates `QualityInspection`, `QualityInspectionParameter` records, `DefectLog` records.
  - Creates `ProductionTransaction` (`departmentCode: 'FINAL_CHECK'`).
  - Creates `DefectRecord` with `OPEN` disposition for rejected pieces; it does not automatically classify them as scrap.
  - Tracks accepted output cumulatively in `fabricOut`.
  - Routes rejected pieces to the Final QC defective shelf and records rework without inventing a downstream route.
  - Conditionally claims the `IN_PROCESS` state to prevent duplicate concurrent submissions.

### `POST /api/final-check/jobs/[id]/hold` & `POST /api/final-check/jobs/[id]/resume`
Places job on hold for supervisor review or resumes it.

---

## 3. DOWNSTREAM HANDOVER & REPORTING

### `POST /api/final-check/issue-challan`
Generates outgoing handover Challan to the next stage from `STANDARD_FACTORY_ROUTE` (currently `PACKING`).
- **Request Body**:
  ```json
  {
    "parentChallanId": "uuid",
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
- **Guards**: Each item count is a positive whole number; requested transfer cannot exceed accepted quantity minus previous normal downstream transfers. A client-supplied destination must match configured routing.
- **Outputs**: Creates an audited child Challan with a unique `CH-FQC-...` identifier. Code-128 image generation is not implemented.

### `GET /api/final-check/floor-board`
Returns 4-lane live Kanban board:
1. `INCOMING`
2. `IN_INSPECTION`
3. `SUPERVISOR_REVIEW`
4. `READY_FOR_DISPATCH`

### `GET /api/final-check/reports`
Returns database-derived inspection totals, yield, defect summary, style metrics, and transaction history for the requested reporting period.
