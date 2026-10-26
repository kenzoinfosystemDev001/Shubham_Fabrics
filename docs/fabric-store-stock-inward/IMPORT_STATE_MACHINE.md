# Import state machine

The states and allowed transitions are defined in `lib/fabric-stock-import/rows.mjs`. The server
enforces them with `assertTransition()`, and the conditional `updateMany` claims a status by
re-checking it in the database. The client never sets a status.

```
UPLOADED -> PARSING -> PARSED ---------------------------> CANCELLED
                 \         \
                  FAILED    -> (VALIDATING) -> NEEDS_CORRECTION <-> READY_FOR_CONFIRMATION
                                                    |                     |
                                                    v                     v
                                                CANCELLED     POSTING (inside the posting transaction)
                                                                          |
                                                                          v
                                                                        POSTED
```

| From | To |
|---|---|
| UPLOADED | PARSING, PARSED, FAILED, CANCELLED |
| PARSING | PARSED, FAILED |
| PARSED | VALIDATING, NEEDS_CORRECTION, READY_FOR_CONFIRMATION, CANCELLED |
| VALIDATING | NEEDS_CORRECTION, READY_FOR_CONFIRMATION, FAILED |
| NEEDS_CORRECTION | VALIDATING, NEEDS_CORRECTION, READY_FOR_CONFIRMATION, CANCELLED |
| READY_FOR_CONFIRMATION | VALIDATING, NEEDS_CORRECTION, READY_FOR_CONFIRMATION, POSTING, CANCELLED |
| POSTING | POSTED (commit). A rollback leaves the stored state unchanged. |
| POSTED, FAILED, CANCELLED | none (final) |

## How the states are used

- **Stored states:** upload and validation run synchronously within one request, so the stored states
  are PARSED, NEEDS_CORRECTION, READY_FOR_CONFIRMATION, POSTED, FAILED and CANCELLED. UPLOADED,
  PARSING and VALIDATING are valid names for a future background mode, but they are never persisted
  today, and the UI shows no progress it does not have.
- **POSTING:** is written inside the posting transaction and becomes POSTED in that same
  transaction. A failure rolls it back to READY_FOR_CONFIRMATION, so POSTING is never visible after
  a crash.
- **Editable states:** mapping, corrections and fabric decisions are allowed only in PARSED,
  NEEDS_CORRECTION and READY_FOR_CONFIRMATION.
- **Posted imports:** never become editable again. A posted row is corrected through the Inward Stock
  edit, which posts only the ledger difference.
- **FAILED:** is recorded when a workbook passes the byte checks but cannot be read, so the attempt
  appears in history. Files refused by the byte checks create no import.
