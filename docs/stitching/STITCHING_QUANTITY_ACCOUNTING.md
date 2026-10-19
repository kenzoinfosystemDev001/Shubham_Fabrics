# Quantity Accounting & Output Reconciliation: Stitching Department

**Document Version:** 1.0.0  
**Department:** Garment Assembly & Stitching (`STITCHING`)  

---

## 1. Mathematical Conservation Formula

The Stitching Department operates on strict discrete manufacturing piece accounting:

$$\mathbf{Input\ Quantity} = \mathbf{Good\ Finished\ Output} + \mathbf{Rework\ (Re\text{-}stitch)} + \mathbf{Reject\ (Cut/Fabric\ Scrap)} + \mathbf{Unstitched\ WIP\ Balance}$$

### Where:
1. **$\text{Input Quantity}$**: Total cut embroidered panels/components received from the Recutting Department via the incoming Challan.
2. **$\text{Good Finished Output}$**: Assembled complete garments that passed dimensional, seam strength, and aesthetic requirements.
3. **$\text{Rework (Re-stitch)}$**: Garments with repairable defects (e.g., loose thread tension, missed lockstitch, easily resewn seam).
4. **$\text{Reject (Scrap)}$**: Irreparably damaged garments (e.g., needle cut into fabric, irreversible machine snag, severe stain).
5. **$\text{Unstitched WIP Balance}$**: Cut components remaining in bundle ready for subsequent shift/run.

---

## 2. Server-Side Reconciliation Guards

The backend API enforces:

1. **Equation Equality**:
   ```typescript
   const totalReconciled = Number(goodQuantity) + Number(reworkQuantity) + Number(rejectQuantity) + Number(balanceQuantity);
   if (totalReconciled !== Number(inputQuantity)) {
     throw new Error(`Quantity reconciliation error: Sum (${totalReconciled}) does not equal input (${inputQuantity})`);
   }
   ```

2. **Over-Production Protection**:
   `goodQuantity` cannot exceed `inputQuantity`.

3. **Handover Balance Guard**:
   $$\text{Available Good to Handover} = \text{Good Output} - \sum \text{Previously Handed Over Pieces}$$
   Any outgoing Challan requesting quantity $> \text{Available Good to Handover}$ is rejected with HTTP 400.

4. **Scrap Logging Guard**:
   If $\text{Reject Quantity} > 0$, an explicit `DefectRecord` row is mandatory with defect code, reason, and quantity.
