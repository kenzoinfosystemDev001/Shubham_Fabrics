# STEAM PRESS QUANTITY ACCOUNTING & INTEGRITY
## Shubham Fabrics MES

### 1. Fundamental Equation
Every Steam Press job enforces exact integer piece accounting:
$$\text{Input Pieces} = \text{Good Pressed Pieces} + \text{Re-press Pieces} + \text{Scrap / Burnt Pieces} + \text{Balance in WIP}$$

### 2. Guard Verifications
1. **Integer Only**: Piece counts must be non-negative integers ($\ge 0$). No floating point or null values.
2. **Bounds**: $0 \le \text{Good} \le \text{Input}$.
3. **Over-Issuance Prevention**:
   $$\text{Available Good} = \text{Total Good Produced} - \sum \text{Previously Issued Pieces}$$
   Any outgoing Challan requesting $> \text{Available Good}$ is strictly rejected with HTTP 400.
4. **Discrepancy Logging**:
   If physically received quantity $<$ issued quantity, discrepancy is permanently recorded in `ChallanEvent`.
