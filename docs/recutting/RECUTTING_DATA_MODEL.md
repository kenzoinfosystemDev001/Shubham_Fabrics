# Data Model & Entity Specifications: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  
**Database:** PostgreSQL (Neon Cloud) via Prisma ORM  

---

## 1. Domain Entities & Relationships

The Recutting department leverages the core domain models of the Shubham Fabrics MES without creating disconnected shadow tables.

```mermaid
erDiagram
    DEPARTMENT ||--o{ CHALLAN : "issues / receives"
    PROGRAM ||--o{ CHALLAN : "specifies"
    PROGRAM ||--o{ PRODUCTION_TRANSACTION : "tracks"
    CHALLAN ||--o{ CHALLAN_ITEM : "contains"
    CHALLAN ||--o{ CHALLAN_EVENT : "logs history"
    CHALLAN ||--o{ PRODUCTION_TRANSACTION : "executes"
    CHALLAN ||--o{ CHALLAN : "genealogy (parent-child)"
    USER ||--o{ CHALLAN : "creates / issues / receives"
    USER ||--o{ PRODUCTION_TRANSACTION : "operates"

    DEPARTMENT {
        string code PK "RECUTTING, QC3, STITCHING"
        string name "Panel Re-Cutting Section"
        int sequenceOrder "10"
    }

    PROGRAM {
        string id PK
        string programNumber "PRG-2026-XXXX"
        string programSerialNo "SF-001"
        string clientName "Client / Buyer"
        string styleCode "KURTI / POLO"
        string designNumber "DSG-101"
        string wilcomDesignNumber "W-7821-EMB"
        string embroideryDetails "Thread/Needle notes"
        string componentDetails "TOP, SLEEVE, DUPATTA"
    }

    CHALLAN {
        string id PK
        string challanNumber "CH-RC-XXXXXX"
        string challanType "INTER_DEPARTMENT"
        string fromDepartment "QC3 or RECUTTING"
        string toDepartment "RECUTTING or STITCHING"
        string parentChallanId FK "Genealogy link"
        string status "ISSUED, RECEIVED, IN_PROCESS, COMPLETED"
        string priority "NORMAL, HIGH, URGENT"
        float fabricIn "Input pieces"
        float fabricOut "Completed cut pieces"
        datetime issuedDate
        datetime receivedDate
        datetime completedDate
    }

    CHALLAN_ITEM {
        string id PK
        string challanId FK
        string itemDescription "Recut Embroidered Panels"
        string fabricCode "PANEL / PIECE"
        string colour "Colour name"
        float quantity "Item count"
        string uom "PCS"
        string unitType "PCS"
        string bundleNumber
    }

    PRODUCTION_TRANSACTION {
        string id PK
        string programId FK
        string challanId FK
        string departmentCode "RECUTTING"
        string operationName "EMBROIDERY_RECUTTING"
        string operatorId FK
        float inputQuantity
        float goodQuantity
        float reworkQuantity
        float rejectQuantity
        float wasteQuantity
        float balanceQuantity
        string unitOfMeasure "PCS"
        datetime recordedAt
    }
```

---

## 2. Field Specifications for Recutting Operations

### 2.1 Outgoing Challan Creation Payload (`CH-RC-...`)
When issuing material from Recutting to Stitching:
- `challanNumber`: System-generated sequential identifier (e.g. `CH-RC-104921`).
- `challanType`: `'INTER_DEPARTMENT'`.
- `fromDepartment`: `'RECUTTING'`.
- `toDepartment`: `'STITCHING'`.
- `parentChallanId`: Mandatory foreign key referencing the incoming QC Washing challan.
- `programId`: Inherited from the incoming lot's linked Production Sheet.
- `status`: `'ISSUED'`.
- `priority`: Inherited or elevated (`'NORMAL'`, `'HIGH'`, `'URGENT'`).
- `items`: List of cut components with:
  - `itemDescription`: Detailed panel description (e.g., `"Front Embroidered Cut Panels - Ready for Stitching"`).
  - `fabricCode`: Piece/Component identifier.
  - `colour`: Matched with production sheet specifications.
  - `quantity`: Exact verified count of good cut pieces.
  - `uom`: `'PCS'`.
  - `unitType`: `'PCS'`.
  - `remarks`: Inspection clearance notes.

### 2.2 Production Transaction Schema
For every batch cut:
- `operationName`: `'EMBROIDERY_RECUTTING'`.
- `departmentCode`: `'RECUTTING'`.
- `inputQuantity`: Number of washed embroidered pieces taken for cutting.
- `goodQuantity`: Number of accurately dimensioned panels produced.
- `reworkQuantity`: Number of panels requiring edge re-trimming.
- `rejectQuantity`: Scrapped panels damaged by miss-cuts.
- `wasteQuantity`: Trim margin shavings.
- `balanceQuantity`: Remaining uncut panels.
- `unitOfMeasure`: `'PCS'`.
- `notes`: Specific cutting table, blade, or Wilcom layout notations.

---

## 3. Data Integrity & Invariants

1. **Genealogy Invariant**: Every outgoing Challan from Recutting must have a non-null `parentChallanId` referencing a verified `QC3` challan.
2. **Quantity Conservation Invariant**:
   $$\text{Output Good Quantity} + \text{Rework Quantity} + \text{Reject Quantity} + \text{Balance} = \text{Input Quantity}$$
3. **No Over-Issuance**:
   $$\sum \text{Issued To Stitching} \le \text{Total Verified Good Recut Output}$$
4. **Program Consistency**: All child challans, items, and production transactions must reference the identical `programId` of the parent Production Sheet.
