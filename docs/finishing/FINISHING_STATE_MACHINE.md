# SHUBHAM FABRICS MES — FINISHING STATE MACHINE SPECIFICATION

## 1. Lifecycle States
- `ISSUED`: Upstream Stitching Challan dispatched to Finishing receiving dock.
- `RECEIVED`: Verified by Finishing receiving supervisor; added to Finishing queue.
- `IN_PROCESS`: Workstation assigned; thread trimming, spot cleaning, and pressing active.
- `ON_HOLD`: Paused for maintenance, steam boiler pressure, or quality check.
- `COMPLETED`: Operations finished; quantities reconciled and logged.
- `READY_FOR_HANDOVER`: Quality check passed; eligible for downstream Challan.
- `HANDED_OVER`: All approved finished garments transferred to downstream department.

## 2. Permitted Transitions
- `ISSUED` $\rightarrow$ `RECEIVED` | `ON_HOLD`
- `RECEIVED` $\rightarrow$ `IN_PROCESS`
- `IN_PROCESS` $\rightarrow$ `ON_HOLD` | `COMPLETED` | `READY_FOR_HANDOVER`
- `ON_HOLD` $\rightarrow$ `IN_PROCESS`
- `COMPLETED` $\rightarrow$ `READY_FOR_HANDOVER` | `ON_HOLD`
- `READY_FOR_HANDOVER` $\rightarrow$ `HANDED_OVER`
