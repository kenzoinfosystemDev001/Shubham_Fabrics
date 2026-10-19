# SHUBHAM FABRICS MES — FINISHING API CONTRACT

## 1. Summary Endpoint Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/finishing/dashboard` | Returns KPIs, live pulse, incoming/outgoing summary. |
| `GET` | `/api/finishing/incoming` | Lists incoming Challans from `STITCHING`. |
| `POST` | `/api/finishing/challans/[id]/receive` | Confirms physical receipt with over-receipt guard. |
| `GET` | `/api/finishing/queue` | Active finishing jobs with linked programs & items. |
| `GET` | `/api/finishing/jobs/[id]` | Full detailed record of a finishing job. |
| `POST` | `/api/finishing/jobs/[id]/start` | Allocates station, machine & operator, transitions to `IN_PROCESS`. |
| `POST` | `/api/finishing/jobs/[id]/pause` | Pauses work with reason, transitions to `ON_HOLD`. |
| `POST` | `/api/finishing/jobs/[id]/resume` | Resumes work, transitions to `IN_PROCESS`. |
| `POST` | `/api/finishing/jobs/[id]/complete` | Atomic output reconciliation & defect logging, transitions to `COMPLETED`. |
| `POST` | `/api/finishing/jobs/[id]/inspect` | Comprehensive finishing inspection, transitions to `READY_FOR_HANDOVER`. |
| `GET` | `/api/finishing/floor-board` | 4-lane Kanban data (Incoming, Finishing, Inspection, Handover). |
| `POST` | `/api/finishing/issue-challan` | Issues outgoing transfer Challan to downstream department with barcode. |
| `GET` | `/api/finishing/reports` | Yield, operator performance, defect breakdown, and transactions. |
