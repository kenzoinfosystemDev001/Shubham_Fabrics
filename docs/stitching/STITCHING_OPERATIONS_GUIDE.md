# Standard Operating Procedure (SOP): Stitching Department

**Document Version:** 1.0.0  
**Department:** Garment Assembly & Stitching (`STITCHING`)  

---

## 1. Daily Operating Procedures

### Morning Shift Intake (08:00 AM)
1. Log in to the MES using the **Stitching** quick login tile on `/login` (PIN: `1234`).
2. Navigate to **Incoming (Recutting)** `/stitching/incoming`.
3. Check the physical bundles against the incoming Challan details.
4. Verify bundle labels and count of cut embroidered pieces.
5. Click **Verify Physical Count & Receive**.

### Job Allocation & Stitching
1. Navigate to **Stitching Queue** `/stitching/my-work`.
2. Select the received job and open **Tech Sheet** to review garment construction specs, stitch type, and Wilcom motif layout.
3. Assign the production line and machine (e.g. Line 1 / SNLS-02).
4. Click **Start Stitching Operation**.
5. If the operator needs to halt work for maintenance or needle replacement, click **Pause** and enter the reason; click **Resume** once cleared.

### Output Reconciliation & QC Inspection
1. Upon job assembly completion, click **Log Output & Reconcile Pieces**.
2. Enter good garments, re-stitch items, and scrap. Verify the balance equation equals 0 diff.
3. If scrap exists, select the appropriate defect code (e.g. `NEEDLE_HOLE_DAMAGE`, `TENSION_PUCKERING`).
4. Quality Inspector performs end-line check: validates SPI, seams, fit, and symmetry.
5. Submits **Approve for Handover**.

### Outward Handover Dispatch
1. Open **Issue Challan** `/stitching/issue-challan`.
2. Confirm destination department (automatically selected based on production route, e.g. `FINISHING`).
3. Enter outgoing bundle quantities and submit.
4. Print the Code-128 barcode dispatch sticker and affix to the bundle.
