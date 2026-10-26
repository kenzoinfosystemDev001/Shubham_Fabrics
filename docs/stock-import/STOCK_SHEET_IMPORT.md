# Upload Stock Sheet (Fabric Store → Inward Stock)

Adds inward fabric stock from a photo, a scan or an Excel file. The rows that are read are always shown for
review and correction first. Nothing reaches stock until a user presses **Confirm & Add to Inward Stock**.

## Setup

1. **Database table.** From the `Shubham_Fabrics` folder run:

   ```
   node scripts/apply-appearance-migrations.js
   ```

   This applies `packages/database/prisma/manual-migrations/20261026_stock_imports.sql`, which creates the
   `StockImport` table. The migration is additive and safe to re-run. Restart the web app afterwards.

2. **Photo reading (optional).** Add the key to `apps/web/.env.local`, which git ignores, and restart:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   # optional; this is the default
   STOCK_IMPORT_MODEL=claude-opus-5-5
   ```

   Create the key at platform.claude.com (Settings → API keys). The key lives only in the environment and
   never in code. When it is missing, photo uploads return a setup message; Excel files and manual entry
   keep working.

   Privacy: uploaded photos are sent to Anthropic's API to be read. Excel files are read on the server and
   are never sent anywhere.

## How it reads files

| File | Reader | Notes |
|---|---|---|
| `.xlsx`, `.xls` | SheetJS 0.20.3 (from cdn.sheetjs.com; the npm `xlsx` package is outdated) | Finds the heading row in the first 20 rows. Reads every sheet that has headings. Copies merged cells down. Skips blank and total rows. Reads at most 1,000 rows. |
| `.jpg`, `.jpeg`, `.png` | Claude vision (`lib/stock-import-server.ts`) | The photo is turned upright and scaled to at most 2400 px. The model returns JSON in a strict schema, with a confidence level for every field. |

The model is told to copy what is written and never to guess. Anything missing or illegible comes back
empty. The server parses quantities and dates, not the model. A reading such as `12O` (letter O) or
`5 yards` therefore stays empty and is flagged. Units are only MTR or PCS and are never converted. A row
with no clear unit must be set by hand.

Recognised headings (any order or case): Fabric / Item / Quality / Description, Fabric Code / Quality No,
Colour / Shade, Dyeing Colour / Dye Shade, Qty / Quantity / Meters / Pcs, Unit / UOM, Supplier / Party /
Mill, Challan No / Bill No / Invoice No, Date / Challan Date.

Fabric code and dyeing colour have no columns on an inward entry. They are saved in its remarks, for
example `Code: RS-14 · Dye to: Maroon`.

## Safeguards

- **Access:** Fabric Store users and Admin only (`requireDepartment(request, 'STORE')`) on every endpoint.
- **File checks on the server:** the file type is checked from its content and must match the extension. The size limit is 10 MB, and the file name is cleaned.
- **Review before save:** the upload endpoint only reads the file. Rows reach stock only through the confirm endpoint.
- **Validation:** before anything is saved, every row needs a fabric, a quantity above 0, a unit of MTR or PCS, a bill number and a bill date. If any row is invalid, nothing is saved.
- **One entry per row:** rows are never merged, even when the fabric, colour and quantity are the same.
- **Atomic:** the inward rows, their stock-ledger receipts and the import status are written in one transaction, under the stock lock. A failure saves nothing, and the same request can be retried.
- **Idempotent:** `confirmKey` is generated once per review. A repeated confirm returns the first result and adds nothing. Two confirms at the same moment: one succeeds and the other gets a 409.
- **Duplicates:**
  - Re-uploading a file that was already imported (same SHA-256) is flagged, and the user must tick "This is a new delivery" to continue.
  - Rows already in Inward Stock (same bill, fabric, colour, quantity and unit) are skipped unless the user ticks "Add anyway".
  - Identical rows within one file are flagged, and both are kept unless one is removed.
- **Audit trail:** each `StockImport` row keeps:
  - the original file;
  - what was read;
  - who uploaded it and when;
  - who confirmed it and when;
  - the rows as confirmed;
  - the inward entries created and the rows skipped, with reasons.

  Unreadable uploads are kept too, with status `FAILED`.

## API

| Method & path | Purpose |
|---|---|
| `GET /api/fabric-store/inward/import` | Upload history: the last 50 uploads, without file contents |
| `POST /api/fabric-store/inward/import` | Multipart field `file`. Returns `{ import, header, rows, notes, duplicateOf, existing }`. Errors: 413 too large, 415 wrong type, 422 unreadable or bad headings, 429/503 photo reader unavailable. |
| `GET /api/fabric-store/inward/import/:id` | One import: what was read, what was confirmed and the result |
| `DELETE /api/fabric-store/inward/import/:id` | Discards an unconfirmed import. The record is kept. |
| `POST /api/fabric-store/inward/import/:id/confirm` | Body `{ confirmKey, entryType, receivingDate, header, rows[] }`. Returns `{ added[], skipped[], totals: { MTR, PCS }, replayed }`. |
| `GET /api/fabric-store/inward/import/:id/file` | Downloads the original file |

## Code

- `apps/web/src/lib/stock-import-rules.mjs`: file sniffing, headings, quantities, dates, review warnings and confirm validation (pure functions).
- `apps/web/src/lib/stock-import-server.ts`: the Excel reader and the Claude photo reader.
- `apps/web/src/lib/fabric-stock-ledger.ts`: `postNewInwardStock` posts many new inward rows with one stock-book load.
- `apps/web/src/components/fabric-store/StockImportModal.tsx`: the upload, review and summary screens.
- Tests: the import rules are covered in `node --test scripts/test-production-fixes.mjs`. The tests use no database and make no network calls.
