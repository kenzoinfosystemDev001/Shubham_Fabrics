# Packing & Finished Goods RBAC & Permissions Matrix

## Shubham Fabrics MES | Access Control & Station Roles

---

## 1. Role Definitions

| Role | Department Code | Description |
|---|---|---|
| `ADMIN` | `ADMIN` | System administrator with full access to all departments |
| `PACKING_SUPERVISOR` | `PACKING` | Station supervisor: manages incoming receipts, packing floor, carton creation, inventory oversight |
| `PACKING_OPERATOR` | `PACKING` | Floor operator: packs cartons, weighs boxes, prints barcode stickers |
| `DISPATCH_MANAGER` | `DISPATCH` | Read-only view of Finished Goods inventory for order reservation and dispatch |

---

## 2. Permissions Matrix

| Operational Action | Route / Endpoint | ADMIN | PACKING_SUPERVISOR | PACKING_OPERATOR | OTHER DEPARTMENTS |
|---|---|---|---|---|---|
| View Packing Dashboard | `GET /api/packing/dashboard` | Allowed | Allowed | Allowed | Denied |
| View Incoming Challans | `GET /api/packing/incoming` | Allowed | Allowed | Allowed | Denied |
| Acknowledge Receipt | `POST /api/packing/challans/:id/receive` | Allowed | Allowed | Denied (Supervisor only) | Denied |
| Mark Handover On Hold | `POST /api/packing/challans/:id/receive` | Allowed | Allowed | Denied (Supervisor only) | Denied |
| Pack Carton & Post to FG | `POST /api/packing/jobs/:id/pack` | Allowed | Allowed | Allowed | Denied |
| Print Carton Barcode Label | Client Modal | Allowed | Allowed | Allowed | Allowed |
| View FG Inventory Balances | `GET /api/packing/inventory` | Allowed | Allowed | Allowed | Read-only (Dispatch) |
| View FG Stock Ledger Audit | `GET /api/packing/inventory` | Allowed | Allowed | Denied | Denied |
| View Reports & Yield | `GET /api/packing/reports` | Allowed | Allowed | Denied | Denied |

---

## 3. Floor Station Fallback & Protection
- Workstation routes under `/packing/*` are protected by `DepartmentGuard` and role-based redirect rules.
- Station auto-login tile available on `/login` (`packing` / `1234`).
- Non-packing users attempting to access `/packing` are automatically redirected to their respective station home.
