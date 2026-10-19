# RBAC Matrix & Access Control: Stitching Department

**Document Version:** 1.0.0  
**Department:** Stitching Section (`STITCHING`)  

---

## 1. Role Capabilities Matrix

| Operation / Capability | `STITCHING_SUPERVISOR` | `STITCHING_OPERATOR` | `QC_INSPECTOR` | `ADMIN` / `SUPER_ADMIN` | Other Departments |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Stitching Dashboard & Queue | ✅ | ✅ | ✅ | ✅ | ❌ |
| Receive Incoming Challans | ✅ | ✅ | ❌ | ✅ | ❌ |
| Assign Line / Machine / Operator | ✅ | ❌ | ❌ | ✅ | ❌ |
| Start / Pause / Resume Stitching | ✅ | ✅ | ❌ | ✅ | ❌ |
| Log Assembled Output & Reconcile | ✅ | ✅ | ❌ | ✅ | ❌ |
| Perform End-Line Quality Inspection | ✅ | ❌ | ✅ | ✅ | ❌ |
| Issue Outgoing Challan to Next Dept | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Production & Scrap Analytics | ✅ | ❌ | ✅ | ✅ | ❌ |

---

## 2. Credentials & Core Personas

- **Username:** `stitching`
- **PIN / Password:** `1234`
- **Default Role:** `STITCHING_SUPERVISOR`
- **Department Scope:** `STITCHING`
- **Portal Landing Route:** `/stitching`
