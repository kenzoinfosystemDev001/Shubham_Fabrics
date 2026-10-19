# Role-Based Access Control (RBAC) Matrix: Recutting Department

**Document Version:** 1.0.0  
**Department:** Panel & Embroidery Recutting Section (`RECUTTING`)  

---

## 1. Access Matrix by Role

| Operation / Route | Admin / Super Admin | Recutting Supervisor | Recutting Operator | Other Depts |
| :--- | :---: | :---: | :---: | :---: |
| **View Dashboard** (`/recutting`) | ✅ Full | ✅ Full | ✅ View Only | ❌ Denied |
| **Inspect Incoming** (`/recutting/incoming`) | ✅ Full | ✅ Full | ✅ View Only | ❌ Denied |
| **Receive Material** (`POST /receive`) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **View Tech Sheet** (Production Sheet Modal) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **Start Cutting Operation** (`POST /start`) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **Log Output & Reconciliation** (`POST /complete`) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **Pre-Stitching Quality Check** (`POST /verify`) | ✅ Allowed | ✅ Allowed | ⚠️ Restricted | ❌ Denied |
| **Issue Outgoing Challan to Stitching** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **View Stitching Handover** (`/recutting/issue-challan`) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **View Floor Board Kanban** (`/recutting/floor-board`) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied |
| **Throughput & Scrap Reports** (`/recutting/reports`) | ✅ Full | ✅ Full | ⚠️ Summary Only | ❌ Denied |

---

## 2. Core Personas & Test Credentials
- **Username**: `recutting`
- **Password / Default PIN**: `1234`
- **Role**: `RECUTTING_SUPERVISOR` / `RECUTTING_OPERATOR`
- **Department Code**: `RECUTTING`
- **Station Home / Default Redirect**: `/recutting`
