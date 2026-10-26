# RBAC and audit

## Permissions (enforced on the server)

| Action | Who |
|---|---|
| Download the template, upload, view history and imports, map columns, correct rows, map a fabric to an existing one, revalidate, cancel, download the report, original file and images | Members of the Store department (`requireDepartment('STORE')`) and administrators |
| Accept a never-received fabric name as a new fabric | Approvers: roles `FABRIC_STORE`, `STORE_MANAGER`, `STORE_INCHARGE`, `FABRIC_STORE_INCHARGE`, and administrators |
| Confirm (post to stock) | Approvers only |
| Correct a posted row | The existing Inward Stock edit (Store department) |

- `STORE_OPERATOR` and Store users without an approver role can prepare an import but cannot post it.
- Every route re-reads the session user and roles from the database. The UI hides or disables the
  buttons a user may not use, but the server check is what decides.

## Audit events (`AuditLog`, entity `FabricStockImport`)

| Action | Data |
|---|---|
| `FABRIC_STOCK_IMPORT_UPLOADED` | file name, SHA-256, size, sheets and their row counts, image count |
| `FABRIC_STOCK_IMPORT_FAILED` | file name, SHA-256, reason code |
| `FABRIC_STOCK_IMPORT_MAPPED` | worksheet, header row, mapping |
| `FABRIC_STOCK_IMPORT_ROW_CORRECTED` | row, field, new value |
| `FABRIC_STOCK_IMPORT_FABRIC_RESOLVED` | fabric name, action, target |
| `FABRIC_STOCK_IMPORT_CANCELLED` | previous state |
| `FABRIC_STOCK_IMPORT_CONFIRM_DENIED` | the user's roles |
| `FABRIC_STOCK_IMPORT_POSTED` | receipt number, file hash, rows, totals by unit, new fabrics, inward IDs, ledger entry IDs |

## Other records

The import row itself keeps the uploader, upload time, file hash, original file name (display only),
selected sheet, mapping, corrections, resolutions, validation, payload hash, poster, posting time,
receipt number and result. Ledger rows carry the posting user as `actorId`.
