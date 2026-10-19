# Digital Thread & Traceability: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  

---

## 1. Upstream & Downstream Genealogy

Every garment component processed in Recutting retains its full lineage through the `parentChallanId` pointer on `Challan` and the master `programId` pointer on `Program`:

```
[Raw Fabric Store]
      │ (CH-STR-...)
      ▼
   [Dyeing]
      │ (CH-DYE-...)
      ▼
  [Dyeing QC1]
      │ (CH-QC1-...)
      ▼
[Thread Cutting]
      │ (CH-TC-...)
      ▼
[Thread Cut QC2]
      │ (CH-QC2-...)
      ▼
   [Washing]
      │ (CH-WSH-...)
      ▼
 [QC Washing (QC3)]
      │ (CH-QCW-...)  ◄─── Incoming Challan to Recutting
      ▼
┌──────────────────────────────────────────────┐
│ RECUTTING DEPARTMENT                         │
│ 1. Verified Receipt                          │
│ 2. Precision Panel Cutting                   │
│ 3. Output Reconciliation                     │
│ 4. Pre-Stitching Quality Check               │
└──────────────────────┬───────────────────────┘
                       │ (CH-RC-...)  ◄─── Outgoing Challan with parentChallanId = CH-QCW
                       ▼
            [Stitching Department]
```

---

## 2. Traceability Query Pattern
Given any outgoing Stitching Challan (`CH-RC-XXXXXX`):
1. Its `parentChallanId` retrieves the exact QC Washing batch (`CH-QCW-XXXXXX`), its inspection parameters, wash date, and defect log.
2. Its `programId` retrieves the original client order, design number, Wilcom embroidery design, colorway, and sizing grid.
3. Its `productionLogs` retrieve the exact operator, machine/table, timestamps, and cut balance.
