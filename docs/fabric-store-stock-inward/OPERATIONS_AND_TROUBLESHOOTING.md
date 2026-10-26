# Operations and troubleshooting

## Deploying

1. Apply `packages/database/prisma/manual-migrations/20261026_fabric_stock_import.sql` to the
   database. The Fabric Store and inward APIs read the new columns, so apply it before deploying.
2. Deploy the web app. `exceljs` is a new dependency and is listed in `serverExternalPackages`.
3. No new environment variables are needed. Limits are constants in `workbook-guard.mjs` and
   `rows.mjs`.

## Configuration

| Item | Where | Default |
|---|---|---|
| File size, sheets, rows, columns, cells, images, parse timeout | `IMPORT_LIMITS` in `lib/fabric-stock-import/workbook-guard.mjs` | 4 MB, 10, 2000, 50, 200,000, 10 images of 3 MB each, 20 s |
| Quantity max, decimals, text lengths | `ROW_LIMITS` in `rows.mjs` | 100000, 3, 120, 500 for remarks |
| Approver roles | `permissions.mjs` | FABRIC_STORE, STORE_MANAGER, STORE_INCHARGE, FABRIC_STORE_INCHARGE |
| Factory day for future-date checks | `service.ts` | Asia/Kolkata |
| Integration test database | `apps/web/.env.test` `TEST_DATABASE_URL` | none; the database tests are skipped without it |
| Isolated build directory | `NEXT_DIST_DIR` env for `next build` | `.next` |

## Common problems

| Symptom | Cause and fix |
|---|---|
| "old .xls workbook or a password-protected file" | Save the workbook as .xlsx without a password. |
| "Several columns look like Quantity" | Two headers match one field; choose the column on the mapping step. |
| Row says "never been received in Fabric Store" | The fabric name doesn't match stock. Map it to the right fabric, or have an approver accept it as new. |
| "formula with no saved value" | Generated sheets often lack saved results. Open the file in Excel, let it calculate, and save it again. |
| "Stock or the import changed since the preview" (409) | Another inward or challan touched the same data. Press Revalidate, review, and confirm again. |
| Confirm button disabled | The user is not an approver, rows have errors, or the warnings are not yet acknowledged. |
| Import shows Posted, but the stock is wrong | Check the receipt's inward rows (Inward Stock, search the receipt number) and the ledger rows. Correct a row through the Inward Stock edit; the ledger reconciles by the difference. |
| Upload returns 413 | The file is over 4 MB. Split the workbook. |

## Follow-ups (not implemented)

- Retention and purge for stored workbooks and images.
- OCR provider integration (see `OCR_DESIGN.md`).
- Reversal of a whole posted receipt as one controlled document. Today, correction is per inward row.
- Supplier, fabric and location masters, once the business populates them. The import validates
  against free text today because the masters are empty.
- ESLint setup and a real CI test step. The CI test command is a placeholder that only prints "passed".
