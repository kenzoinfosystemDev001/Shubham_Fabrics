# Material Accounting & Reconciliation: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  

---

## 1. Mathematical Accounting Formula

In the precision cutting of embroidered panels, material conservation must hold true across all operations:

$$\text{Incoming Verified Quantity} = \text{Good Output (Approved)} + \text{Rework / Re-trim} + \text{Rejection (Miss-cuts)} + \text{WIP Balance}$$

Where:
- $\text{Incoming Verified Quantity}$: Total pieces received via the incoming Washing QC challan.
- $\text{Good Output (Approved)}$: Accurately separated embroidered panels ready for Stitching.
- $\text{Rework / Re-trim}$: Panels requiring secondary edging without dimensional violation.
- $\text{Rejection}$: Panels rendered unusable due to blade deviation, incorrect notch cut, or fabric tearing during cutting.
- $\text{WIP Balance}$: Remainder of lot currently uncut on the table.

---

## 2. Handover Balancing Equation

When transferring to Stitching:
$$\sum_{k=1}^{n} \text{ChallanItem.quantity}_k = \text{Good Output (Approved)} - \text{Previously Handed Over}$$

The system prevents:
1. Double handover of the same cut batch.
2. Partial transfers exceeding the approved total.
3. Transfer of unverified or rejected panels.
