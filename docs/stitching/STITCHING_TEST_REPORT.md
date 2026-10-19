# Verification & Test Specification Report: Stitching Department

**Document Version:** 1.0.0  
**Department:** Stitching Section (`STITCHING`)  
**Test Script:** `scripts/test-stitching-workflow.js`  

---

## 1. Test Suite Scenarios Matrix

| Scenario # | Test Description | Target Entity / Route | Expected Result |
| :---: | :--- | :--- | :--- |
| **01** | Setup Program Sheet & Recutting Outgoing Challan | `Program`, `Challan` | Challan issued to `toDepartment: 'STITCHING'`. |
| **02** | User & Role Validation | `User`, `Role` | User `stitching` has role `STITCHING_SUPERVISOR` & dept `STITCHING`. |
| **03** | Over-Receipt Prevention Guard | `POST /receive` | Request with received quantity $>$ issued quantity rejected. |
| **04** | Physical Count Verification & Receipt | `POST /receive` | Status updated to `RECEIVED`, event recorded in `ChallanEvent`. |
| **05** | Production Line / Machine Allocation & Start | `POST /jobs/:id/start` | Status updated to `IN_PROCESS`, line/machine/operator assigned. |
| **06** | Runtime Pause Operation | `POST /jobs/:id/pause` | Status updated to `PAUSED`, pause reason logged in audit notes. |
| **07** | Runtime Resume Operation | `POST /jobs/:id/resume` | Status restored to `IN_PROCESS`, resume event logged. |
| **08** | Output Reconciliation Imbalance Guard | `POST /jobs/:id/complete` | Non-balancing quantities rejected with HTTP 400. |
| **09** | Valid Output Reconciliation & Completion | `POST /jobs/:id/complete` | Status updated to `COMPLETED`, atomic `ProductionTransaction` written. |
| **10** | Defect Record Logging for Scrap | `DefectRecord` | Scrap pieces generate `DefectRecord` with `departmentCode: 'STITCHING'`. |
| **11** | End-Line Quality Inspection | `POST /jobs/:id/inspect` | Status updated to `READY_FOR_HANDOVER` on approval. |
| **12** | Over-Issuance Prevention Guard | `POST /issue-challan` | Outgoing dispatch exceeding unissued good balance rejected. |
| **13** | Outgoing Challan Creation & Next Dept Routing | `POST /issue-challan` | Outgoing Challan created to next dept (e.g. `FINISHING`) with `parentChallanId`. |
| **14** | Parent Challan State Transition to `HANDED_OVER` | `Challan` | Parent status updated to `HANDED_OVER` once full balance dispatched. |
| **15** | Exhausted Balance Guard & Upstream Traceability | `GET /trace` | Double-dispatch blocked; full genealogy trace confirmed. |
