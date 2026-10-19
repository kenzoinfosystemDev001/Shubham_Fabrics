# SHUBHAM FABRICS MES — FINISHING TEST REPORT

## 1. Test Suite Scenarios
1. **Core User Verification:** `finishing` user existence, role assignment, and PIN verification.
2. **Program Reference:** Verification of linked `Program` (Production Sheet).
3. **Incoming Challan Creation:** Stitching-to-Finishing Challan generation.
4. **Over-Receipt Guard:** Verifying rejection when received count exceeds issued count.
5. **Physical Receipt Confirmation:** Transitioning status to `RECEIVED` and logging `ChallanEvent`.
6. **Station Allocation & Start:** Allocating iron table / trimmer, moving status to `IN_PROCESS`.
7. **Pause & Resume Lifecycle:** Verifying hold transitions and notes.
8. **Output Reconciliation Math:** Enforcing $Input = Good + Rework + Reject + WIP$ and creating atomic `ProductionTransaction`.
9. **Finishing Quality Inspection:** Verifying thread trimming, pressing, clean fabric, and advancing status to `READY_FOR_HANDOVER`.
10. **Outgoing Handover Challan:** Resolving downstream department from factory route, enforcing balance guard, generating barcode, and marking parent `HANDED_OVER`.
