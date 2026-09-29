# Architecture Decision Record (ADR-001)
## Strict Mathematical Production Accounting Enforcement

### Context
In garment and textile manufacturing, material loss, scrap, end-bits, and rework are frequently untracked or misattributed. Many legacy systems allow operators to log arbitrary output numbers that do not match inward raw material weight or bundle count, leading to phantom inventory and untraceable shrinkage.

### Decision
The Subham Fabrics MES architecture enforces the invariant:

$$\mathbf{Input = Good + Rework + Reject + Waste + Balance}$$

1. **Backend as Supreme Authority**:
   No transaction can be recorded unless this mathematical equation holds to zero tolerance.
2. **Defect Reason Attribution**:
   Any non-zero Rework or Reject quantity requires an approved reason code.
3. **Immutability**:
   Once committed to the database, production transactions cannot be silently updated. Corrections require explicit adjustment transactions with full audit logging.

### Consequences
- **Positive**: 100% mathematical accountability for all fabric yards, KG, and garment bundles across all 17 manufacturing stages.
- **Negative**: Operators must balance end-of-shift WIP before clocking out, preventing lazy or imprecise accounting entries.
