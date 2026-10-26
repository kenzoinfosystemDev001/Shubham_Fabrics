# Idempotency and duplicate handling

## Confirmation

| Threat | Protection |
|---|---|
| Double click | The button is disabled while posting. The second request finds the import POSTED and gets the replay (200, `replayed: true`). |
| Retry after a timeout (committed but the response was lost) | The idempotency key is kept per import in sessionStorage and reused. The server returns the stored result. |
| Refresh during confirmation | Same as above. The wizard reloads the import and shows the receipt. |
| Two simultaneous confirmations | The advisory lock serializes them, and the conditional `READY -> POSTING` update claims the import once. The loser reads POSTED and replays. |
| The same key with a different payload | 409 `PAYLOAD_MISMATCH`. Nothing is posted. |
| The same key used on another import | `confirmKey` is unique, so the request fails with 409 `KEY_REUSED`. |
| A preview changed after review | `payloadHash` covers exactly the rows and values that would be posted. A mismatch inside the lock gives 409 `STALE_PREVIEW`. |
| Ledger written twice | Each ledger row has a unique `idempotencyKey`, and the receipts reuse the manual-inward key scheme. |

## Duplicate data

| Signal | Behaviour |
|---|---|
| Same file content already posted (SHA-256, file name ignored) | File-level error naming the earlier receipt. The import cannot be posted. |
| Supplier and roll number already in stock | Row error. The roll is never added again or overwritten. The database enforces this too, with a unique `FabricInward.rollKey` (normalized supplier and roll). |
| Same supplier and roll twice in one file | Row error on both rows. |
| Two imports racing for the same roll | The second is revalidated inside the lock and gets 409 `STALE_PREVIEW`, or 409 `ROLL_CONFLICT` if the unique index fires. |
| Supplier and bill already received | Warning; acknowledgement is required. A bill can have several deliveries, so this cannot be an error. |
| Repeated identical line within the file | Warning; acknowledgement is required. |

## What the import never does

- Update the quantity or metadata of an existing roll or inward row.
- Reverse a receipt. To correct a posted row, use the Inward Stock edit, which reconciles the ledger
  by the difference and refuses to go below what has already been issued.
