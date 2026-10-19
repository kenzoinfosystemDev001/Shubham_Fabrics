# Automated Test Report: Recutting Department Integration

**Document Version:** 1.0.0  
**Test Suite:** Recutting End-to-End & Integrity Suite  
**Date:** 2026-10-19  

---

## 1. Test Execution Summary

| Test Case ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :---: |
| **TC-RC-01** | Eligible QC Washing challan appears in Recutting incoming queue | Listed with correct piece count and Production Sheet link | PASS |
| **TC-RC-02** | Challan from unauthorized or non-QC3 department rejected | HTTP 400/403 with error message | PASS |
| **TC-RC-03** | Mismatched production sheet and challan cannot be received | HTTP 400 Bad Request | PASS |
| **TC-RC-04** | Duplicate receipt requests do not create duplicate transfers | Idempotent response / rejected | PASS |
| **TC-RC-05** | Over-receipt exceeding issued quantity rejected | HTTP 400 validation error | PASS |
| **TC-RC-06** | Received lot enters Active Work Queue | Displayed in `/my-work` with `RECEIVED` status | PASS |
| **TC-RC-07** | Workspace displays Wilcom design and cutting specifications | Accurate design code, components, and notes | PASS |
| **TC-RC-08** | Operators cannot alter protected Production Sheet specs | Spec fields read-only in workspace | PASS |
| **TC-RC-09** | Valid precision cutting operation logged with ProductionTransaction | Database record created atomically | PASS |
| **TC-RC-10** | Mathematical quantity reconciliation strictly enforced | Mismatched sum rejected by backend | PASS |
| **TC-RC-11** | Outgoing Challan issued to STITCHING with correct parentChallanId | Full digital genealogy preserved | PASS |
| **TC-RC-12** | Duplicate challan issuance prevented | HTTP 400 / idempotency guard | PASS |
| **TC-RC-13** | Unauthorized role blocked from Recutting restricted actions | HTTP 403 Forbidden | PASS |
| **TC-RC-14** | Atomic rollback on partial failure | Zero dangling database records | PASS |
| **TC-RC-15** | QC Washing and Stitching workflows remain fully functional | Regression suite passed | PASS |
