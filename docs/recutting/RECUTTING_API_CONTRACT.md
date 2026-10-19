# API Contract & Specifications: Recutting Department

**Document Version:** 1.0.0  
**Department:** Recutting Section (`RECUTTING`)  
**Base URL:** `/api/recutting`  

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Access Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/recutting/dashboard` | Returns operational KPIs, pipeline counts, and recent activity | `RECUTTING_OPERATOR`, `ADMIN` |
| `GET` | `/api/recutting/incoming` | Lists incoming challans issued by QC Washing pending receipt | `RECUTTING_OPERATOR`, `ADMIN` |
| `POST` | `/api/recutting/challans/:id/receive` | Receives incoming challan, logs physical check & transit diffs | `RECUTTING_OPERATOR`, `ADMIN` |
| `GET` | `/api/recutting/queue` | Lists received jobs in the Recutting Work Queue | `RECUTTING_OPERATOR`, `ADMIN` |
| `GET` | `/api/recutting/jobs/:id` | Returns complete job details, linked Production Sheet & Wilcom info | `RECUTTING_OPERATOR`, `ADMIN` |
| `POST` | `/api/recutting/jobs/:id/start` | Marks job as `IN_PROCESS` and assigns operator | `RECUTTING_OPERATOR`, `ADMIN` |
| `POST` | `/api/recutting/jobs/:id/complete` | Records precision cut output, reconciliation, and scrap | `RECUTTING_OPERATOR`, `ADMIN` |
| `POST` | `/api/recutting/jobs/:id/verify` | Records pre-stitching quality check (dimensions, symmetry) | `RECUTTING_SUPERVISOR`, `ADMIN` |
| `GET` | `/api/recutting/floor-board` | Returns 4-lane live Kanban floor board | `RECUTTING_OPERATOR`, `ADMIN` |
| `GET` | `/api/recutting/stitching-handover` | Lists approved recut jobs ready to be dispatched to Stitching | `RECUTTING_OPERATOR`, `ADMIN` |
| `POST` | `/api/recutting/issue-challan` | Creates outgoing Challan to Stitching (`toDepartment: 'STITCHING'`) | `RECUTTING_OPERATOR`, `ADMIN` |
| `GET` | `/api/recutting/reports` | Returns throughput, design breakdown, and scrap reports | `RECUTTING_SUPERVISOR`, `ADMIN` |

---

## 2. Detailed Request & Response Schemas

### 2.1 POST `/api/recutting/challans/:id/receive`
**Payload:**
```json
{
  "receivedQuantity": 150,
  "remarks": "Physical verification completed. 150 washed embroidered pieces received in good condition.",
  "actorId": "usr-rec-001"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Challan received into Recutting Department successfully",
  "data": {
    "challanId": "chl-12345",
    "status": "RECEIVED",
    "receivedQuantity": 150,
    "receivedDate": "2026-10-19T14:15:00.000Z"
  }
}
```

### 2.2 POST `/api/recutting/jobs/:id/complete`
**Payload:**
```json
{
  "inputQuantity": 150,
  "goodQuantity": 146,
  "reworkQuantity": 2,
  "rejectQuantity": 2,
  "wasteQuantity": 0,
  "balanceQuantity": 0,
  "operatorNotes": "Wilcom design perimeter cuts aligned with seam notches. 2 pieces marked for edge re-trim.",
  "componentBreakdown": [
    { "component": "TOP", "quantity": 146 }
  ]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Recutting operation logged and output reconciled successfully",
  "data": {
    "jobId": "chl-12345",
    "status": "COMPLETED",
    "transactionId": "tx-9876",
    "goodQuantity": 146,
    "reworkQuantity": 2,
    "rejectQuantity": 2
  }
}
```

### 2.3 POST `/api/recutting/issue-challan`
**Payload:**
```json
{
  "parentChallanId": "chl-12345",
  "programId": "prg-54321",
  "priority": "HIGH",
  "remarks": "Handover to Stitching: 146 precision-cut embroidered panels verified against Production Sheet.",
  "items": [
    {
      "itemDescription": "Front & Back Embroidered Cut Panels - Ready for Stitching",
      "fabricCode": "PANEL",
      "colour": "Navy Blue",
      "quantity": 146,
      "uom": "PCS",
      "unitType": "PCS",
      "remarks": "Passed pre-stitching verification"
    }
  ]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Challan to Stitching issued successfully",
  "data": {
    "challanNumber": "CH-RC-104921",
    "fromDepartment": "RECUTTING",
    "toDepartment": "STITCHING",
    "totalQuantity": 146,
    "status": "ISSUED"
  }
}
```
