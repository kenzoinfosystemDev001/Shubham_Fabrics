# STEAM PRESS TEST REPORT & VERIFICATION EVIDENCE
## Shubham Fabrics MES

### 1. Test Suite Scenarios
1. Core User & RBAC Verification (`steampress` user with valid PIN `1234`).
2. Production Sheet / Program resolution without mutation.
3. Inward Challan creation from Finishing to Steam Press.
4. Over-receipt rejection guard verification ($received > issued$).
5. Physical receipt confirmation and transition to `RECEIVED`.
6. Pressing operation start & workstation allocation (`IN_PROCESS`).
7. Pause & Resume mechanism (`IN_PROCESS` &rarr; `ON_HOLD` &rarr; `IN_PROCESS`).
8. Mathematical output reconciliation ($Input = Good + Rework + Reject + Balance$).
9. Quality appearance & crease audit release (`READY_FOR_HANDOVER`).
10. Outgoing Handover Challan generation to `FINAL_CHECK` with Code-128 barcode and parent update to `HANDED_OVER`.
11. Final QC receipt verification of issued Challan.
