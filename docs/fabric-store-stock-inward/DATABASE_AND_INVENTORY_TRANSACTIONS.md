# Database and inventory transactions

## Schema changes (additive)

The migration is `packages/database/prisma/manual-migrations/20261026_fabric_stock_import.sql`.

- **`FabricInward`** gains nullable `rollNumber`, `rollKey` (unique), `batchNumber`, `shade`,
  `composition`, `width`, `unitRate`, `storageLocation`, `purchaseOrderNumber`, `importId` (FK) and
  `importRowNumber`, plus an index on `importId`. Existing rows keep NULL in all of them.
- **`FabricStockImport`** holds one import:
  - the original bytes and their SHA-256;
  - the sheet grids and the mapping, corrections and resolutions (JSON);
  - the validation result and `payloadHash`;
  - `receiptNumber` (unique), `confirmKey` (unique) and the posted result;
  - who uploaded and who posted it.
- **`FabricStockImportDocument`** holds images embedded in the workbook.

To apply (shared database, needs approval):
```
cd packages/database
npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261026_fabric_stock_import.sql
```

## Single stock engine

- **Where stock lives:** received stock is the `FabricInward` rows. Every stock-changing document posts
  the difference between what it should contribute and what it already contributed to
  `StockLedgerEntry` (department `STORE`). Total Stock, challan stock checks and Outward all read this
  data.
- **What an import writes:** one new `FabricInward` row per worksheet row, plus one ledger `RECEIPT` per
  row through `postNewInwardRows()`.
- **Ledger keys:** each receipt has the idempotency key a manual inward would get
  (`FABRIC_INWARD:<inwardId>:<bucket>:r0`). Editing or removing an imported row later goes through the
  normal `syncInwardStock()` and posts only the difference.
- **No direct balance writes:** no balance column is incremented directly, so stock is not added in
  two ways.

## The posting transaction (`confirmImport`)

1. Check the approver role. A denial is audited, and nothing else happens.
2. If the import is already POSTED, return the stored result. This is a replay and posts nothing.
3. In one interactive Prisma transaction (timeout 30 s):
   1. Take the Fabric Store advisory lock (`pg_advisory_xact_lock`), the same lock challan issues and
      inward edits use.
   2. Re-read the import. If it is POSTED, return the replay. If it is not READY_FOR_CONFIRMATION,
      fail with 409.
   3. Revalidate against the database inside the lock. The payload hash must equal the hash the user
      confirmed, the import must still be confirmable, and warnings must be acknowledged.
   4. Claim the import with `updateMany(status READY -> POSTING)`. The update must change exactly one row.
   5. Load the stock book, then compute the receipt number `FSR-YYYY-NNNN`, which is unique and
      serialized by the lock.
   6. `createMany` the FabricInward rows (each carries its importId, row number, roll and rollKey),
      then `postNewInwardRows` the ledger receipts with running balances.
   7. Set the import to POSTED with the receipt number, `confirmKey`, posting time and user, and the
      result.
   8. Write the audit log (`FABRIC_STOCK_IMPORT_POSTED`).
4. Any error rolls everything back, and the import stays READY_FOR_CONFIRMATION. If another request
   committed first, its result is returned instead of an error.

## Worked example (acceptance scenario 1)

The workbook has rolls A001 (120 MTR) and A002 (95 MTR) of fabric A, and B001 (80 MTR) of fabric B.

1. Posting creates 3 FabricInward rows and 3 ledger RECEIPTs (+120, +95 and +80).
2. In Total Stock, fabric A goes up by 215 MTR and fabric B by 80 MTR.
3. Confirming again returns the same receipt and adds no ledger rows.
4. A failure inside the transaction leaves no rows at all, and the import can be retried.
