# STEAM PRESS DEPARTMENT WORKFLOW SPECIFICATION
## Shubham Fabrics MES

### 1. End-to-End Production Routing
```mermaid
flowchart LR
    Finishing[Finishing Department] -->|CH-FN-* Outward| SteamPress[Steam Press Department]
    SteamPress -->|Acknowledge Inward| InQueue[Queue / Table Allocation]
    InQueue -->|Steam Pressing & Inspection| Pressed[Reconciled Output]
    Pressed -->|CH-SP-* Outward| FinalQC[Final QC Department]
```

### 2. Step-by-Step Operator Lifecycle

1. **Inward Receipt & Verification**:
   - Operator navigates to `/steam-press/incoming`.
   - Locates Challans issued by `FINISHING` addressed to `STEAM_PRESS`.
   - Opens Physical Bundle Verification modal.
   - Enters physically counted piece quantity.
   - System checks $Received \le Issued$. If discrepancies exist, logs alert.
   - Status updates `ISSUED` &rarr; `RECEIVED`.

2. **Workstation Table Allocation**:
   - Operator selects received Challan from `/steam-press/my-work`.
   - Assigns Pressing Table (e.g. Table 1, Table 2, Vacuum Table, Buck Press).
   - Records Operator Name & Pressing Method.
   - Status updates `RECEIVED` &rarr; `IN_PROCESS`.

3. **Steam Pressing Operation & Output Reconciliation**:
   - Presser uses steam iron / buck press to set creases, remove wrinkles, and shape garments according to Production Sheet.
   - Accesses Focus Mode (`/steam-press/workspace/[id]`) or Complete Output Dialog.
   - Reconciles piece counts:
     - Good Pressed Garments
     - Re-press / Rework (garments needing another pressing pass or drying)
     - Reject / Scrapped (severe iron burn, glaze shine, fabric water stain)
     - Balance (garments still on table)
   - Status updates `IN_PROCESS` &rarr; `COMPLETED` (or directly `READY_FOR_HANDOVER` if auto-released).

4. **Quality & Appearance Audit**:
   - Crease alignment check, shine/glaze inspection, wrinkle removal verification, moisture dry check.
   - Status updates `COMPLETED` &rarr; `READY_FOR_HANDOVER`.

5. **Issue Outgoing Handover Challan to Final QC**:
   - Operator opens `/steam-press/issue-challan?jobId=[id]`.
   - Target department defaults to `FINAL_QC` (Final Quality Check).
   - Validates requested quantity $\le$ unissued good balance.
   - Creates outgoing Challan `CH-SP-XXXX-XXXX` with Code-128 barcode sticker.
   - Status of parent job transitions to `HANDED_OVER`.
