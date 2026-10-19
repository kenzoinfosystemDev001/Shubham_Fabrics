# API Contract & Specifications: Stitching Department

**Document Version:** 1.0.0  
**Department:** Stitching Section (`STITCHING`)  
**Base URL:** `/api/stitching`  

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Access Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stitching/dashboard` | Returns operational KPIs, pipeline counts, live pulse, and recent activity | `STITCHING_SUPERVISOR`, `ADMIN` |
| `GET` | `/api/stitching/incoming` | Lists incoming challans issued by Recutting pending physical receipt | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/challans/:id/receive` | Receives incoming challan with quantity validation and audit logging | `STITCHING_SUPERVISOR`, `ADMIN` |
| `GET` | `/api/stitching/queue` | Lists active jobs in the Stitching Work Queue | `STITCHING_SUPERVISOR`, `ADMIN` |
| `GET` | `/api/stitching/jobs/:id` | Returns complete job details, linked Production Sheet & Wilcom design | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/jobs/:id/start` | Assigns line/operator/machine and transitions state to `IN_PROCESS` | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/jobs/:id/pause` | Pauses active stitching operation with reason | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/jobs/:id/resume` | Resumes paused stitching operation | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/jobs/:id/complete` | Reconciles assembled output, writes `ProductionTransaction`, logs scrap | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/jobs/:id/inspect` | Records in-line/end-line QC inspection results | `STITCHING_SUPERVISOR`, `QC_INSPECTOR`, `ADMIN` |
| `GET` | `/api/stitching/floor-board` | Returns 4-lane live Kanban floor board | `STITCHING_SUPERVISOR`, `ADMIN` |
| `POST` | `/api/stitching/issue-challan` | Creates outgoing Challan to next department (e.g. `FINISHING`) with genealogy | `STITCHING_SUPERVISOR`, `ADMIN` |
| `GET` | `/api/stitching/reports` | Returns throughput, style-wise yield, operator efficiency, defect audit | `STITCHING_SUPERVISOR`, `ADMIN` |

---

## 2. Sample Payloads & Schemas

### 2.1 POST `/api/stitching/challans/:id/receive`
```json
{
  "receivedQuantity": 194,
  "remarks": "Physical verification completed. 194 cut embroidered panels received in good order from Recutting.",
  "actorId": "usr-stc-001"
}
```

### 2.2 POST `/api/stitching/jobs/:id/start`
```json
{
  "lineNumber": "Line 2",
  "machineNumber": "SNLS-04",
  "assignedOperator": "Ramesh Kumar",
  "notes": "Starting garment assembly per Wilcom embroidery alignment chart."
}
```

### 2.3 POST `/api/stitching/jobs/:id/complete`
```json
{
  "inputQuantity": 194,
  "goodQuantity": 190,
  "reworkQuantity": 2,
  "rejectQuantity": 2,
  "balanceQuantity": 0,
  "operatorNotes": "Assembled 190 complete garments. 2 marked for seam restitch. 2 scrapped due to needle cut.",
  "defectCode": "NEEDLE_HOLE_DAMAGE"
}
```

### 2.4 POST `/api/stitching/jobs/:id/inspect`
```json
{
  "outcome": "APPROVED",
  "seamStrengthChecked": true,
  "spiChecked": true,
  "tensionChecked": true,
  "sizingChecked": true,
  "symmetryChecked": true,
  "notes": "All 190 garments passed stitch per inch (12 SPI) and tension checks."
}
```

### 2.5 POST `/api/stitching/issue-challan`
```json
{
  "parentChallanId": "chl-rec-12345",
  "programId": "prg-54321",
  "toDepartment": "FINISHING",
  "priority": "HIGH",
  "remarks": "190 assembled embroidered garments transferred to Finishing Department for thread trimming.",
  "items": [
    {
      "itemDescription": "Assembled Embroidered Dress - Ready for Finishing",
      "fabricCode": "GARMENT",
      "colour": "Royal Navy",
      "quantity": 190,
      "uom": "PCS",
      "unitType": "PCS",
      "remarks": "Passed stitching end-line QC"
    }
  ]
}
```
