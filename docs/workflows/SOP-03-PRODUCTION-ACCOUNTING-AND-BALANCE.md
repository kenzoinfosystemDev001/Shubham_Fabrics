# Standard Operating Procedure (SOP-03)
## Strict Production Accounting & Mathematical Balance Validation

### 1. Fundamental Principle
At every operational department, quantity cannot appear from nowhere and cannot disappear without record.

$$\mathbf{Input = Good + Rework + Reject + Waste + Balance}$$

### 2. Operational Definitions
- **Input Quantity**: Total units (Roll weight in KG, Cut bundles, or Stitched garments) received via inward Challan.
- **Good Quantity**: First-time-right finished units meeting all quality specifications, packaged or staged for next station handoff.
- **Rework Quantity**: Units failing quality check that can be corrected (e.g. skipped stitch, slight oil stain, loose button).
- **Reject Quantity**: Unusable units that cannot be rectified (e.g. fabric hole across garment center, knife chew in cutting).
- **Waste Quantity**: Inherent process scrap (cutting selvage, thread trimming clippings).
- **Balance Quantity**: Unprocessed WIP remaining on line at end of shift.

### 3. Backend Enforcement Rules
1. Any production transaction where:
   $$\text{Input} \neq \text{Good} + \text{Rework} + \text{Reject} + \text{Waste} + \text{Balance}$$
   will be rejected with HTTP 422 Unprocessable Entity.
2. If $\text{Rework} > 0$, an approved Rework Reason Code is required.
3. If $\text{Reject} > 0$, a Reject Reason Code is required.
4. Production transactions are immutable; adjustments require supervisor reversal transactions with full audit logging.
