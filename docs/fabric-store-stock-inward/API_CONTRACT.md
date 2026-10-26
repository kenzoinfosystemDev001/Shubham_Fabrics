# API contract

All routes are Next.js route handlers under `/api/fabric-store/stock-imports`.

- **Session:** every route requires a signed-in user of the Store department; administrators always
  pass.
- **Errors:** JSON of the form `{ error, code, details }`.
- **Statuses:** 400 bad input, 401 or 403 auth, 404 unknown import, 409 state or duplicate conflict,
  413 file too large, 500 unexpected error. A 500 never posts anything.
- **Import view (`presentImport`):** `{ id, status, fileName, fileSize, fileHash, createdAt,
  uploadedBy, postedBy, postedAt, receiptNumber, failureReason, documents[], sheets[{ name, hidden,
  rowCount, columnCount, detectedHeaderRow, imageCount, preview (first 20 rows) }], selectedSheet,
  headerRow, headers[], suggestion, mapping, corrections, resolutions, validation{ rows[], summary,
  fileErrors[], unresolvedFabrics[], knownFabricNames[] }, payloadHash, result, permissions{ canApprove } }`.
  It never includes the file bytes.

| Method and path | Body | Result |
|---|---|---|
| `GET /` `?page&pageSize` (at most 50) | none | `{ total, page, pageSize, data[] }` history, newest first |
| `POST /` | multipart, `file` (.xlsx) | 201 import view. 400 for refused files: `NOT_XLSX`, `XLS_OR_ENCRYPTED`, `MALFORMED`, `EMPTY`, `TOO_MANY_SHEETS`, `TOO_MANY_ROWS`, `TOO_MANY_COLUMNS`, `TOO_COMPLEX`, `TIMEOUT`. 413 `TOO_LARGE` |
| `GET /template` | none | .xlsx attachment |
| `GET /:id` | none | import view |
| `POST /:id/configure` | `{ sheetName, headerRow, mapping: { field: columnIndex } }` | import view after validation. 400 `BAD_SHEET`, `BAD_HEADER_ROW` or `BAD_MAPPING` (`details.errors`). 409 `NOT_EDITABLE` |
| `POST /:id/validate` | none | import view revalidated against current stock |
| `PATCH /:id/rows` | `{ rowNumber, field, value }` (`value: null` removes the correction) | import view. 400 `BAD_FIELD` or `BAD_ROW` |
| `POST /:id/fabrics` | `{ name, action: 'MAP' \| 'ACCEPT_NEW' \| 'CLEAR', target? }` | import view. 403 when a non-approver accepts a new fabric. 400 `UNKNOWN_TARGET` |
| `POST /:id/confirm` | `{ idempotencyKey, payloadHash, acknowledgeWarnings }`; the `Idempotency-Key` header is also accepted | 201 `{ result, replayed: false, import }`, or 200 `{ ..., replayed: true }`. 403 `FORBIDDEN`. 409 `NOT_READY`, `STALE_PREVIEW`, `PAYLOAD_MISMATCH`, `ROLL_CONFLICT`, `KEY_REUSED` or `CONFLICT`. 400 `WARNINGS_NOT_ACKNOWLEDGED` |
| `POST /:id/cancel` | none | import view, status CANCELLED. 409 when posted |
| `GET /:id/report` | none | validation report .xlsx. 409 when not yet validated |
| `GET /:id/file` | none | the original workbook |
| `GET /:id/documents/:docId` | none | an embedded image |

## Confirm `result`

`{ receiptNumber, postedAt, postedBy{ id, name }, rowsPosted, rollsCreated, inwardIds[], ledgerEntryIds[],
totalsByUnit{ MTR?, PCS? }, totalsByFabric[{ fabric, fabricType, colour, unit, quantity, rows, isNew }], newFabrics[] }`

Downloads are sent as attachments with `Cache-Control: private, no-store` and
`X-Content-Type-Options: nosniff`.
