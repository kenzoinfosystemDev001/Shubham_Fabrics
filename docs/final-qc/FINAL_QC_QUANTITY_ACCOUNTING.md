# FINAL QUALITY CONTROL (FINAL QC) QUANTITY ACCOUNTING
## Shubham Fabrics MES | Mathematical Integrity & Invariants

---

## 1. CORE QUANTITY INVARIANTS

Every garment entering the Final Quality Control Department is an indivisible, integer-based physical unit (`PCS`).

### Invariant 1: Inward Receipt Guard
$$\text{Received Quantity} \le \text{Issued Quantity}$$
Any attempt to acknowledge more than the issued quantity from the upstream Challan is rejected at the API level with a `400 Bad Request`.

### Invariant 2: Mutually Exclusive Output Accounting
For any inspected batch:
$$\text{Pieces Inspected} = Q_{\text{accepted}} + Q_{\text{rework}} + Q_{\text{rejected}}$$

Where:
- $Q_{\text{accepted}} \ge 0$: Pieces fully meeting AQL specifications.
- $Q_{\text{rework}} \ge 0$: Pieces with rectifiable defects (e.g. untrimmed threads, washable spot, loose button).
- $Q_{\text{rejected}} \ge 0$: Pieces with non-recoverable defects (e.g. cut yarn, scorch burn, fabric tear).

### Invariant 3: Total Batch Balance
$$\text{Total Inward Input} = \text{Pieces Inspected} + Q_{\text{pending}}$$

Where:
- $Q_{\text{pending}} \ge 0$: Uninspected garments remaining in WIP balance.

$$\text{Total Inward Input} = Q_{\text{accepted}} + Q_{\text{rework}} + Q_{\text{rejected}} + Q_{\text{pending}}$$

---

## 2. DOWNSTREAM ELIGIBILITY FORMULA

Only accepted garments are eligible for downstream transfer to Packing:
$$\text{Handover Eligible Quantity} = Q_{\text{accepted}} - Q_{\text{previously transferred}}$$

Under no circumstances may $Q_{\text{rework}}$ or $Q_{\text{rejected}}$ be added into the outgoing handover bundle.

---

## 3. DEFECT QUARANTINE LEDGER

When $Q_{\text{rejected}} > 0$:
1. A permanent `DefectRecord` is written with status `'SCRAP'`.
2. The item is isolated from active inventory and linked to the Challan and Program for scrap tracking.
3. The defect reason is captured (e.g., "Permanent oil mark", "Fabric cut during trimming").

When $Q_{\text{rework}} > 0$:
1. A `ReworkTransaction` is initiated or the pieces are flagged for internal line touch-up.
2. The pieces must be reinspected before becoming eligible for handover.
