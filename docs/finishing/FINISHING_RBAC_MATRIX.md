# SHUBHAM FABRICS MES — FINISHING RBAC MATRIX

## 1. Role Capabilities

| Action | `ADMIN` / `SUPER_ADMIN` | `FINISHING_SUPERVISOR` | `FINISHING_OPERATOR` | Other Departments |
|---|---|---|---|---|
| View Finishing Dashboard | Allowed | Allowed | Allowed | Restricted |
| Confirm Physical Receipt | Allowed | Allowed | Restricted | Restricted |
| Allocate Workstation & Start | Allowed | Allowed | Allowed | Restricted |
| Pause / Resume Operations | Allowed | Allowed | Allowed | Restricted |
| Record Output Reconciliation | Allowed | Allowed | Allowed | Restricted |
| Approve Finishing QA | Allowed | Allowed | Restricted | Restricted |
| Issue Outgoing Challan | Allowed | Allowed | Restricted | Restricted |
| View Scrap & Yield Reports | Allowed | Allowed | Allowed | Restricted |

## 2. Personas & Station Authentication
- **User:** `finishing`
- **Role:** `FINISHING_SUPERVISOR`
- **Default PIN:** `1234`
- **Department Code:** `FINISHING`
- **Home Route:** `/finishing`
