# Packing & Inventory Updation — Quantity Accounting & Invariants

## Shubham Fabrics MES | Conservation of Production Quantities

---

## 1. The Core Conservation Law

In an authoritative Manufacturing Execution System, physical garments can neither be spontaneously created nor silently lost.

For any handover job $J$:
$$\text{Received Quantity} = \text{Total Packed in Cartons} + \text{Remaining Balance to Pack} + \text{Recorded Floor Defects}$$

Where:
- $\text{Received Quantity} \in \mathbb{Z}_{\ge 0}$
- $\text{Total Packed in Cartons} = \sum_{k=1}^{N} Q_{\text{carton}_k}$, with $Q_{\text{carton}_k} \in \mathbb{Z}_{> 0}$
- $\text{Remaining Balance to Pack} \ge 0$

---

## 2. Invariant Rules

### Rule 1: Whole Garment Enforcement (Integer Only)
Garments are discrete finished products. Fractional piece counts (e.g., $10.5\text{ pcs}$) are strictly rejected at the API boundary with HTTP 400.

### Rule 2: Non-Negative Bounded Inventory
Under-packing is permissible (creates multiple cartons across shifts), but over-packing is impossible:
$$\sum Q_{\text{cartons}} \le Q_{\text{received}}$$
Any packing transaction where $Q_{\text{pack}} > Q_{\text{remaining}}$ is rejected immediately before transaction initiation.

### Rule 3: Reconciled Stock Ledger Updates
Every piece packed into a carton increments the Finished Goods stock by exactly that number of pieces:
$$\Delta \text{InventoryStock}_{\text{FINISHED\_GOODS}} = +Q_{\text{pack}}$$
And generates an immutable `StockLedgerEntry`:
$$\text{entryType} = \text{'RECEIPT'},\quad \text{quantity} = +Q_{\text{pack}},\quad \text{balanceAfter} = \text{balanceBefore} + Q_{\text{pack}}$$

---

## 3. Multi-Carton Reconciliation Table Example

Consider a batch of 100 shirts received from Final QC:

| Step | Action | Pack Qty | Carton # | Cartons Total | Remaining to Pack | FG Stock Delta | Ledger Balance | Status |
|---|---|---|---|---|---|---|---|---|
| 0 | Receive Challan | - | - | 0 | 100 | 0 | 0 | `RECEIVED` |
| 1 | Pack Box 1 (Size M) | 40 | `CTN-01` | 40 | 60 | +40 | 40 | `IN_PROCESS` |
| 2 | Pack Box 2 (Size L) | 35 | `CTN-02` | 75 | 25 | +35 | 75 | `IN_PROCESS` |
| 3 | Pack Box 3 (Size XL) | 25 | `CTN-03` | 100 | **0** | +25 | 100 | `COMPLETED` |
| 4 | Attempt to pack 5 pcs | 5 | - | - | - | **REJECTED** | 100 | HTTP 400 |
