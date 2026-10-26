# State Machine & Status Transitions: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  

---

## 1. Lifecycle State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> ISSUED : Issued by Washing QC
    ISSUED --> RECEIVED : Physical Count Verified by Recutting
    ISSUED --> ON_HOLD : Discrepancy / Damaged in Transit
    ON_HOLD --> RECEIVED : Discrepancy Resolved / Rectified
    RECEIVED --> IN_PROCESS : Operator Starts Precision Cutting
    IN_PROCESS --> IN_PROCESS : Progress Logged / Paused / Resumed
    IN_PROCESS --> COMPLETED : Output Cut & Reconciled
    COMPLETED --> READY_FOR_STITCHING : Pre-stitching Quality Checks Approved
    COMPLETED --> ON_HOLD : Cut Defects Identified
    ON_HOLD --> IN_PROCESS : Rework / Secondary Trimming
    READY_FOR_STITCHING --> HANDED_OVER : Outgoing Challan Issued to STITCHING
    HANDED_OVER --> [*] : Received by Stitching Department
```

---

## 2. Transition Guard Rules & Validation

| Current State | Target State | Triggering Action | Guard Conditions & Business Rules |
| :--- | :--- | :--- | :--- |
| `ISSUED` | `RECEIVED` | `POST /receive` | 1. Caller belongs to `RECUTTING` or `ADMIN`.<br>2. `toDepartment` must match `RECUTTING`.<br>3. `receivedQuantity` must be $> 0$ and $\le$ issued item quantity.<br>4. Linked `Program` exists and is active. |
| `ISSUED` | `ON_HOLD` | `POST /receive` (with hold flag) | Transit damage or total piece count shortage detected. Notes required. |
| `RECEIVED` | `IN_PROCESS` | `POST /jobs/:id/start` | 1. Status is exactly `RECEIVED`.<br>2. Operator must be authenticated.<br>3. Valid cutting specifications present in Production Sheet. |
| `IN_PROCESS` | `COMPLETED` | `POST /jobs/:id/complete` | 1. Server validates $\text{Good} + \text{Rework} + \text{Reject} + \text{Balance} = \text{Input}$.<br>2. Good quantity cannot exceed input.<br>3. Atomic `ProductionTransaction` write. |
| `COMPLETED` | `READY_FOR_STITCHING` | `POST /jobs/:id/verify` | 1. Seam allowances, notches, and motif alignment checked.<br>2. Verified by authorized Supervisor or Inspector. |
| `READY_FOR_STITCHING` | `HANDED_OVER` | `POST /issue-challan` | 1. Outgoing Challan created with `toDepartment = 'STITCHING'`.<br>2. Issued quantity $\le$ verified good quantity.<br>3. Barcode and bundle labels generated. |
