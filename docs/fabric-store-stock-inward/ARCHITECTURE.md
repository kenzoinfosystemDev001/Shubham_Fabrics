# Architecture

```
Browser (Fabric Store > Inventory > Import Stock)
  |  multipart upload (.xlsx, <= 4 MB)
  v
POST /api/fabric-store/stock-imports            requireDepartment('STORE')
  |  workbook-guard.mjs   sniff bytes, read ZIP directory: refuse .xls/encrypted/HTML/bombs
  |  workbook.ts          exceljs: cell values only, saved formula results, embedded images
  v
FabricStockImport (PARSED)  + original bytes + sheet grids + FabricStockImportDocument (images)
  |  header detected and every column named exactly -> mapping applied automatically
  |  otherwise the user picks sheet, header row and columns (POST .../configure)
  v
validation (rows.mjs + service.ts)  against current store: fabrics in stock, rolls, bills, same file
  |  -> NEEDS_CORRECTION  (row corrections, fabric MAP / ACCEPT_NEW, revalidate)
  |  -> READY_FOR_CONFIRMATION + payloadHash of exactly what would post
  v
POST .../confirm  (approver role, idempotency key, payloadHash, warning acknowledgement)
  one Prisma transaction, pg advisory stock lock:
    revalidate -> claim READY->POSTING -> FabricInward rows (importId, roll, row number)
    -> postNewInwardRows(): StockLedgerEntry RECEIPT per row (same keys as manual inward)
    -> import POSTED + receipt number + result + AuditLog
  v
Total Stock / Inward Stock / challan stock checks read the same FabricInward + ledger data
```

## Modules (`apps/web/src/lib/fabric-stock-import/`)

| File | Role |
|---|---|
| `workbook-guard.mjs` | Limits, file-type sniffing, ZIP central-directory checks, safe file names (pure) |
| `columns.mjs` | Import fields, header normalization, header-row detection, mapping suggestion and checks (pure, also used by the browser) |
| `rows.mjs` | Cell parsing, row validation, duplicates, totals, canonical posting payload, state machine (pure) |
| `permissions.mjs` | Approver roles (pure) |
| `workbook.ts` | exceljs reading, template and validation-report generation |
| `service.ts` | Database operations: create, configure, correct, resolve, revalidate, cancel, confirm, history |
| `http.ts` | Route wrapper: Store department guard, error mapping, attachment responses |

The stock posting reuses `lib/fabric-stock-ledger.ts` (`lockFabricStock`, `loadStockBook`, and the
new `postNewInwardRows`). No second stock engine was added.

## Frontend

- `app/fabric-store/inventory/import/page.tsx`: template download, upload and paginated history.
- `app/fabric-store/inventory/import/[id]/page.tsx`: the wizard. It covers worksheet and columns,
  review (filter, search, sort, pagination, row fixes, fabric resolution), confirmation and the receipt.
- Entry points: the "Import Fabric Stock" button on Inward Stock, and the "Import Stock" link in the
  Fabric Store navigation.

## Not introduced

- No queue or background job. Workbooks are bounded (4 MB, 2,000 rows per sheet), so each step runs
  within a single request.
- No object storage. The original file and the extracted images live in the database (bytea), so they
  are private, served only through authorized routes, and tied to the import.
