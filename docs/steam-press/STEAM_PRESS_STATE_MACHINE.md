# STEAM PRESS STATE MACHINE & LIFECYCLE
## Shubham Fabrics MES

### 1. State Transitions

```mermaid
stateDiagram-v2
    [*] --> ISSUED: Issued by Finishing (CH-FN-*)
    ISSUED --> RECEIVED: Physically Inwarded & Verified
    RECEIVED --> IN_PROCESS: Table Allocated & Pressing Started
    IN_PROCESS --> ON_HOLD: Paused (Steam pressure / break)
    ON_HOLD --> IN_PROCESS: Resumed
    IN_PROCESS --> COMPLETED: Output Reconciled (Good/Rework/Reject)
    COMPLETED --> READY_FOR_HANDOVER: Appearance & Crease Audit Passed
    READY_FOR_HANDOVER --> HANDED_OVER: Outgoing Challan Issued to Final QC (CH-SP-*)
    HANDED_OVER --> [*]
```

### 2. Guard Rules
- **Receipt Guard**: Only Challans where `toDepartment` is `STEAM_PRESS` and status is `ISSUED` can be inwarded.
- **Over-Receipt Guard**: `receivedQuantity` cannot exceed `issuedQuantity`.
- **Start Guard**: Job must be in `RECEIVED` or `ON_HOLD` status.
- **Completion Guard**: Strict reconciliation: $Input = Good + Rework + Reject + Balance$.
- **Handover Guard**: Outgoing quantity cannot exceed available unissued good balance.
