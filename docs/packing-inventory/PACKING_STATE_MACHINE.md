# Packing Department — State Machine & Lifecycle Transitions

## Shubham Fabrics MES | Challan & Carton Lifecycle

---

## 1. Handover Challan State Transitions

A Challan directed to the Packing Department undergoes the following strict lifecycle:

```mermaid
stateDiagram-v2
    [*] --> ISSUED : Final QC issues handover
    ISSUED --> RECEIVED : Floor acknowledges piece count
    ISSUED --> ON_HOLD : Discrepancy / Transit damage detected
    ON_HOLD --> RECEIVED : Supervisor resolves discrepancy
    RECEIVED --> IN_PROCESS : Partial pieces packed into carton
    RECEIVED --> COMPLETED : All pieces packed into cartons (Remaining = 0)
    IN_PROCESS --> IN_PROCESS : Additional carton packed (Remaining > 0)
    IN_PROCESS --> COMPLETED : Final carton packed (Remaining = 0)
    COMPLETED --> [*]
```

### Transition Matrix

| Current State | Event Trigger | Next State | Allowed Actor | Validation Checks |
|---|---|---|---|---|
| `ISSUED` | `RECEIVE_CHALLAN` | `RECEIVED` | Packing Supervisor / Admin | Received count must be positive integer |
| `ISSUED` | `RECEIVE_CHALLAN (markOnHold=true)` | `ON_HOLD` | Packing Supervisor / Admin | Discrepancy remarks required |
| `ON_HOLD` | `RELEASE_HOLD` | `RECEIVED` | Packing Supervisor / Admin | Supervisor sign-off required |
| `RECEIVED` | `PACK_CARTON (Remaining > 0)` | `IN_PROCESS` | Packing Operator | Packed count $\le$ Remaining count |
| `RECEIVED` | `PACK_CARTON (Remaining = 0)` | `COMPLETED` | Packing Operator | Entire received batch boxed |
| `IN_PROCESS` | `PACK_CARTON (Remaining > 0)` | `IN_PROCESS` | Packing Operator | Cumulative count bounded by received count |
| `IN_PROCESS` | `PACK_CARTON (Remaining = 0)` | `COMPLETED` | Packing Operator | All pieces accounted for in cartons |

---

## 2. Carton State Lifecycle

Physical Cartons follow this lifecycle:

```mermaid
stateDiagram-v2
    [*] --> IN_FG_STORE : Carton packed & placed on rack
    IN_FG_STORE --> RESERVED_FOR_DISPATCH : Assigned to customer sales order
    RESERVED_FOR_DISPATCH --> DISPATCHED : Outward gate pass issued
    IN_FG_STORE --> DISPATCHED : Direct outward gate pass
    DISPATCHED --> [*]
```

### Carton Invariants
1. `cartonNumber` is unique across the entire application lifecycle (`CTN-...`).
2. Each carton belongs to exactly one `Program` and optionally one source `Challan`.
3. Carton piece quantity must be a strictly positive whole number.
4. Carton status defaults to `'IN_FG_STORE'` upon packing completion.
