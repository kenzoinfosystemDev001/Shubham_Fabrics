# Standard Operating Procedure (SOP-01)
## Raw Material Inward, Roll Verification & 4-Point Inspection Gate (QC1)

### 1. Purpose
To ensure that all raw fabric received from dye-houses or fabric mills is rigorously accounted for by weight, length, roll number, and quality grading before being accepted into store inventory or issued to the cutting section.

### 2. Scope
Applies to the Raw Material Store, Dyeing Unit, and Fabric Quality Gate (QC1) within Subham Fabrics.

### 3. Step-by-Step Procedure
1. **Physical Unloading & Gate Pass Verification**:
   - Store operator logs invoice number, mill roll count, and gross lorry weight.
2. **Roll Weighment & Barcode Tagging**:
   - Every individual roll is weighed on calibrated floor scales.
   - Individual roll barcode tag (`ROL-XXXX-NNN`) is affixed.
3. **Draft Inward Challan Generation**:
   - Store supervisor initiates inward challan `CH-STR-YYYY-NNNNNN` with fabric code, color, shade lot, gross weight, and net weight.
4. **4-Point Fabric Inspection (QC1)**:
   - Minimum 10% sample rolls inspected per lot on 45° inspection table.
   - Defects scored:
     - Flaw up to 3 inches: 1 Point
     - Flaw between 3 to 6 inches: 2 Points
     - Flaw between 6 to 9 inches: 3 Points
     - Flaw over 9 inches or hole: 4 Points
   - Maximum acceptable penalty: < 40 points per 100 linear square yards.
5. **Challan Status Transition**:
   - If Pass: QC Inspector signs off on MES (`QC_APPROVED`).
   - If Fail: Flagged as `REJECTED` or `ON_HOLD`, supplier notified, and debit note generated.
