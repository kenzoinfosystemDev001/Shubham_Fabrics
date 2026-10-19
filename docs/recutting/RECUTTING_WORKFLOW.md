# Standard Operating Procedure & Workflow: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  
**Pipeline Sequence:** $\text{QC Washing} \longrightarrow \text{Recutting} \longrightarrow \text{Stitching}$  

---

## 1. Overview & Operational Purpose

The **Recutting Department** is responsible for the precision cutting, separation, and dimensioning of embroidered panels and dress components following garment washing and laundry QC. 

Embroidered fabric undergoes dimensional shifts, relaxation, and minor distortion during dyeing and washing cycles. The Recutting artisan or operator aligns each embroidered piece against the **Production Sheet** (`Program`) specifications and Wilcom design guides, executing precise perimeter cuts to guarantee exact seam allowances for the downstream **Stitching Department** (`STITCHING`).

---

## 2. End-to-End Workflow Stages

```
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. QC WASHING ISSUANCE                                       │
   │    QC Washing approves washed lot and issues Challan         │
   │    toDepartment = 'RECUTTING' (with linked Production Sheet) │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 2. MATERIAL RECEIPT & PHYSICAL AUDIT                         │
   │    Recutting verifies physical count vs Challan & Sheet.     │
   │    Logs verified count / records any transit discrepancy.    │
   │    Challan status: ISSUED ──► RECEIVED                       │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 3. PRODUCTION QUEUE & WORKSPACE PREPARATION                  │
   │    Job enters 'Ready for Recutting'. Operator opens focused  │
   │    Workspace with Wilcom Design & Cutting Tech Sheet.        │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 4. PRECISION RECUTTING OPERATION                             │
   │    Operator executes precision cuts on embroidered panels.   │
   │    Tracks input pcs, operator ID, cutting machine/bench.     │
   │    Challan status: RECEIVED ──► IN_PROCESS                   │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 5. OUTPUT RECONCILIATION & ACCOUNTING                        │
   │    Reconciles: Input = Completed + Re-trim + Scrap + Balance │
   │    Creates ProductionTransaction record in DB.               │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 6. PRE-STITCHING QUALITY VERIFICATION                        │
   │    Confirms panel symmetry, edge margins, notches, and       │
   │    bundle completeness. Marks job as APPROVED_FOR_STITCHING. │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 7. ISSUE CHALLAN TO STITCHING                                │
   │    Creates new outgoing Challan (CH-RC-...) with             │
   │    fromDepartment = 'RECUTTING', toDepartment = 'STITCHING'  │
   │    Maintains full parentChallan genealogy link.              │
   └──────────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Operating Instructions

### Step 1: Incoming Challan Receiving
1. Operator accesses `/recutting/incoming`.
2. Inspects pending incoming challans issued by `QC3` (QC Washing).
3. Clicks **Receive Material**:
   - Compares physical piece count with the challan item quantity.
   - Cross-checks with the linked Production Sheet design number.
   - Enters verified quantity and optional notes.
   - System updates `challan.status = 'RECEIVED'`, records `receivedDate`, and updates genealogy.

### Step 2: Recutting Work Queue
1. Jobs automatically appear in `/recutting/my-work` under the **Active Queue**.
2. Items display design number, Wilcom embroidery design, component breakdown, and piece count.
3. Operator selects **Start Recutting**:
   - System transitions status to `IN_PROCESS`.
   - Records start timestamp and operator assignment.

### Step 3: Focused Operation Workspace
1. Operator works in `/recutting/workspace/[id]`.
2. Visualizes full design details, garment style, Wilcom digitizing code, and cutting notes.
3. May click **View Tech Sheet** to inspect the interactive `ProductionSheetPrintModal`.
4. Performs manual precision cutting / panel separation on the cutting table.

### Step 4: Output Reconciliation
1. Operator records completed units:
   - **Good Completed Output** (pieces ready for assembly).
   - **Re-trim / Rework** (pieces needing secondary edge trim).
   - **Damaged / Reject** (defective panels quarantined).
   - **WIP Balance** (remaining uncut pieces).
2. The server strictly validates:
   $$\text{Completed} + \text{Rework} + \text{Reject} + \text{Balance} = \text{Input Quantity}$$
3. Transaction writes a `ProductionTransaction` entry atomically.

### Step 5: Verification & Stitching Handover
1. Supervisor or quality inspector verifies panel margins.
2. Upon approval, operator clicks **Issue Handover to Stitching**:
   - Navigates to `/recutting/issue-challan`.
   - System generates sequential challan number `CH-RC-XXXXXX`.
   - Sets `fromDepartment = 'RECUTTING'` and `toDepartment = 'STITCHING'`.
   - Embeds printable barcode sticker and detailed bundle items.
   - Sets `parentChallanId` to the incoming QC Washing Challan ID, ensuring 100% digital thread integrity.
