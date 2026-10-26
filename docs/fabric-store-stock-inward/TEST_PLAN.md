# Test plan

| Suite | Command | Needs | Covers |
|---|---|---|---|
| Unit + workbook | `node --test scripts/test-fabric-stock-import.mjs` | nothing | Upload guard (.xls, encrypted, HTML, CSV, empty, oversized, ZIP bomb, damaged ZIP, too many sheets); header normalization (case, punctuation, Unicode); mapping (exact only, ambiguity, header below title rows, mapping checks); quantity, date, type and unit parsing; formula and Excel error cells; row validation for acceptance scenarios 1-4; duplicate warnings; same-file error; units kept apart; future dates; blank rows; payload canonicalization; state machine; permissions; real exceljs reading (multiple sheets, blank rows, text numbers, dates, formulas with and without saved values, embedded image); row, column and cell limits; damaged workbook; generated template maps itself; report formula-injection guard |
| Database integration | `node --test scripts/test-fabric-stock-import-db.mjs` | `TEST_DATABASE_URL` in `apps/web/.env.test`. It refuses the shared DB, runs `prisma db push` on the test DB and cleans up its own rows. | The real `service.ts` and `fabric-stock-ledger.ts` against PostgreSQL. Scenario 1 (posting, receipt, ledger, Total Stock balance), 2 (invalid row blocks, then correction), 3 (mapping; ACCEPT_NEW forbidden for operators), 4 (roll already in stock), 5 (replay posts nothing; different payload rejected), 6 (concurrent confirmations post once), 7 (failure mid-posting rolls back; retry works), 9 (unauthorized: 403, audited, no stock change), the same file renamed, two imports racing for one roll, stale preview, and an edit of a posted row reconciling by the difference |
| Stock ledger regression | `node --test scripts/test-production-fixes.mjs` | nothing | Existing stock rules and ledger (challans, inward, outward) are unchanged |
| Typecheck | `npx tsc --noEmit -p apps/web/tsconfig.json` | nothing | Whole web app |
| Production build | `cd apps/web && NEXT_DIST_DIR=.next-verify npx next build` | nothing (an isolated output dir) | Compilation of all routes and pages |
| End-to-end in the browser | manual run in the built-in browser against a dev server on the test DB | test DB plus a Store approver login seeded there | Template download, upload, mapping, review, fix, confirm, receipt, Total Stock, retry, unauthorized user |

## Acceptance scenarios

| # | Scenario | Where |
|---|---|---|
| 1 | Normal inward | Unit (rules) + DB |
| 2 | Invalid row | Unit + DB |
| 3 | Unknown fabric | Unit + DB |
| 4 | Duplicate roll | Unit + DB |
| 5 | Duplicate confirmation | DB |
| 6 | Concurrent confirmation | DB |
| 7 | Database failure | DB (failure injected in ledger posting inside the transaction) |
| 8 | OCR discrepancy | Not applicable: OCR is not enabled (see `OCR_DESIGN.md`) |
| 9 | Unauthorized posting | Unit (permissions) + DB |
| 10 | Regression | `test-production-fixes.mjs`, the DB edit-reconcile test, typecheck and build |

Every DB scenario checks the ledger rows and the Total Stock balance (computed by `loadStockBook`,
the same function the Total Stock API uses), not only the API response.
