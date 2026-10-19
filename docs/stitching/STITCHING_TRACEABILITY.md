# End-to-End Traceability & Genealogy: Stitching Department

**Document Version:** 1.0.0  
**Department:** Stitching Section (`STITCHING`)  

---

## 1. Upstream & Downstream Genealogy Chain

```mermaid
graph LR
    P["Production Sheet (Program)"] -->|"Authoritative Specs"| CH_REC["Recutting Challan"]
    CH_REC -->|"parentChallanId"| CH_STC["Stitching Job / Challan"]
    CH_STC -->|"Line / Machine / Operator"| PT["ProductionTransaction (GARMENT_STITCHING)"]
    CH_STC -->|"Scrap Exceptions"| DR["DefectRecord (STITCHING)"]
    CH_STC -->|"parentChallanId"| CH_FIN["Outgoing Handover Challan to Next Dept"]
```

---

## 2. Traceability Guarantees

1. **Parent-Child Linkage**:
   Every outgoing Challan created by Stitching sets `parentChallanId` to the incoming Stitching Challan's ID.
2. **Production Order Fidelity**:
   Every transaction, inspection, defect, and Challan carries `programId`, ensuring direct relationship to customer, buyer, design number, and Wilcom technical file.
3. **Machine & Line Auditing**:
   Every stitching operation records the assigned line, machine number, operator identity, and timestamps in `ChallanEvent` and `ProductionTransaction`.
4. **Barcode Encoding**:
   Outgoing bundle stickers encode Code-128 barcodes linking Challan Number, Program Number, Design Number, and piece quantities.
