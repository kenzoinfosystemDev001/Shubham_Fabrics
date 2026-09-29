# Standard Operating Procedure (SOP-02)
## Inter-Departmental Challan Handoff & Genealogy Lifecycle

### 1. Purpose
To ensure zero unaccounted inventory between factory stations. Every physical movement of materials must be accompanied by an electronic Challan signed by both dispatching and receiving supervisors.

### 2. Challan Lifecycle States
```mermaid
stateDiagram-v2
    [*] --> DRAFT : Creator drafts items
    DRAFT --> SUBMITTED : Supervisor submits
    SUBMITTED --> ISSUED : Gate dispatch & issue timestamp
    ISSUED --> RECEIVED : Recipient verifies items & qty
    RECEIVED --> IN_PROCESS : Work started on line
    IN_PROCESS --> COMPLETED : Station output completed
    COMPLETED --> QC_PENDING : If QC gate required
    QC_PENDING --> QC_APPROVED : QA passes inspection
    QC_PENDING --> REWORK : QA identifies repairable defect
    QC_APPROVED --> HANDED_OVER : Next station Challan generated
    HANDED_OVER --> CLOSED : Final reconciliation
```

### 3. Traceability Chain
Every Challan record stores:
- `programId`: The overarching manufacturing order.
- `parentChallanId`: Direct antecedent handoff document.
- `sourceLotId` / `sourceRollId` / `sourceBundleId`: Piece-level backward genealogy.
