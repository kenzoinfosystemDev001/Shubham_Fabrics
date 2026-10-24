# Final QC Operations Guide

## Access

Use the Final QC quick-login station or sign in with an active account assigned to Final QC. The department routes are under `/final-qc`; the workspace refreshes from the database periodically and on tab focus. The quick-login station's seeded credential is for local development only and must not be used as a production credential.

## Daily workflow

1. **Incoming Challans**: open an `ISSUED` challan routed to Final QC, compare the physical piece count to its items, enter the actual count, and add a discrepancy note. The received count cannot exceed the issued count. A shortage can be received onto hold.
2. **Inspection Queue**: start a received job and use the inspection action to record each checkpoint, the overall result, piece dispositions, and reasons for rejected or rework quantities.
3. **Reconciliation**: ensure accepted + rework + rejected + pending equals the current remaining inspection input. Pending pieces remain on hold and are the next inspection balance.
4. **Hold and resume**: hold a received/in-process job when review is needed; resume returns a held job to in-process. The authenticated session user is the audit actor.
5. **Issue Challan**: transfer only accepted pieces to the next department configured in `STANDARD_FACTORY_ROUTE` (currently Packing). Partial transfers remain available; the parent closes as handed over once the accepted balance is fully transferred.
6. **Floor Board and Quality Summary**: use these pages for current work-in-progress and database-derived production/quality metrics.

## Defect and rework handling

Rejected garments are recorded with an `OPEN` defect record and a defective-return Challan to `DEF-SHELF-FINAL-QC`. They are not automatically marked as scrap. Rework is recorded with its reason and status `REWORK`; no rework destination is currently configured, so operators must coordinate disposition with a supervisor instead of assuming an automatic return route.

## Error recovery

- A `409` response means another user changed the job during the action. Refresh before retrying.
- A `400` response indicates invalid quantities, inspection fields, or route input. Correct the input; do not retry unchanged.
- A `401` requires signing in again. A `403` requires an authorized Final QC or administrator account.
- If a `5xx` occurs, preserve the challan number and request time for support. Do not repeat potentially mutating actions until the current database state has been checked.

## Operational limitations

The browser uses polling rather than push/WebSocket updates. The existing session token format is not cryptographically signed and must be replaced by the shared authentication service before production hardening. Database-backed end-to-end testing must use an isolated test database.
