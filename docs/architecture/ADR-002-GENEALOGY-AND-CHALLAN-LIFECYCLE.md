# Architecture Decision Record (ADR-002)
## Multi-Tier Challan System & Piece-Level Backward Genealogy

### Context
When quality defects emerge late in the manufacturing pipeline (e.g. shade variation detected at Steam Press or skipped stitches at Finishing), factories struggle to trace which raw fabric roll, dyeing lot, or cutting lay generated the defective garments.

### Decision
1. **Mandatory Electronic Challans**:
   Every department-to-department handoff generates a globally unique Challan (`CH-<DEPT>-YYYY-NNNNNN`).
2. **Genealogy Linkage**:
   Each Challan retains a `parentChallanId`. Items within Challans retain pointers to `sourceRollId`, `sourceLotId`, and `sourceBundleId`.
3. **State Machine Verification**:
   Handoffs cannot jump states. Handoffs require digital sign-offs from both the issuing supervisor and receiving supervisor.

### Consequences
- Unbroken backward genealogy from any finished carton at Dispatch back to the specific raw fabric roll and dyeing batch.
