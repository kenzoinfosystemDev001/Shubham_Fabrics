# STEAM PRESS API CONTRACT
## Shubham Fabrics MES

### 1. Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/steam-press/dashboard` | KPI metrics, active jobs, recent transactions |
| `GET` | `/api/steam-press/incoming` | Inward Challans routed to `STEAM_PRESS` |
| `POST` | `/api/steam-press/challans/[id]/receive` | Physical bundle receipt confirmation |
| `GET` | `/api/steam-press/queue` | Active work queue on Steam Press floor |
| `GET` | `/api/steam-press/jobs/[id]` | Detailed job view with specifications and events |
| `POST` | `/api/steam-press/jobs/[id]/start` | Station allocation and operation initiation |
| `POST` | `/api/steam-press/jobs/[id]/pause` | Put job on hold with pause reason |
| `POST` | `/api/steam-press/jobs/[id]/resume` | Resume job from hold |
| `POST` | `/api/steam-press/jobs/[id]/complete` | Reconcile pieces out ($Input = Good + Rework + Reject + Bal$) |
| `POST` | `/api/steam-press/jobs/[id]/inspect` | Record appearance and crease audit before handover |
| `GET` | `/api/steam-press/floor-board` | 4-lane Kanban floor board view |
| `POST` | `/api/steam-press/issue-challan` | Issue outgoing Challan to `FINAL_CHECK` |
| `GET` | `/api/steam-press/reports` | Throughput, yield, and defect analytics |
