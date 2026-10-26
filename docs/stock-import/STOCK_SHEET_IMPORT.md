# Upload Stock Sheet (Fabric Store → Inward Stock)

Adds inward fabric stock from an Excel file (`.xlsx` or `.xls`, up to 10 MB). Choose the fabric type
(Undyed or Dyed) and the receiving date, pick the file, and every complete row is added to Inward Stock
at once. Total Stock updates the same way as for a manual New Fabric Arrival.

No setup or extra database table is needed.

## The sheet

The first rows of a sheet must name the columns. Order and letter case don't matter, and title rows
above the headings are fine. Recognised headings:

| Field | Headings |
|---|---|
| Fabric (required) | Fabric, Item, Quality, Description, Particulars |
| Quantity (required) | Qty, Quantity, Meters, Mtrs, Pcs, Pieces |
| Unit (required, unless the quantity heading names it, e.g. "Qty (Mtr)") | Unit, UOM |
| Challan / bill no. (required) | Challan No, Bill No, Invoice No |
| Challan / bill date (required) | Date, Challan Date, Bill Date (day first: 05/10/2026 = 5 October) |
| Optional | Colour / Shade, Fabric Code, Dyeing Colour, Supplier / Party / Mill, Remarks |

- Every sheet in the workbook that has headings is read.
- Merged cells, e.g. one challan number covering several rows, count for every row they cover.
- Blank rows and total rows are ignored.
- A sheet is read up to 1,000 rows.

## What gets added

- Each row becomes its own inward entry, with its own unit. MTR and PCS are never converted, and rows are never merged.
- Fabric code and dyeing colour go into the entry's remarks, e.g. `Code: RS-14 · Dye to: Maroon`.
- **Skipped rows** are listed with the reason after the upload. A row is skipped when:
  - its fabric, quantity, unit (MTR or PCS), challan no. or date is missing or invalid;
  - it is already in Inward Stock (same challan no., fabric, colour, quantity and unit). This means uploading the same sheet twice adds nothing twice.
- All rows of one upload, and their stock postings, are saved in a single transaction, so a failure saves nothing.
- Only Fabric Store and Admin users can upload. The server checks that the file really is an Excel workbook.

## Code

- `apps/web/src/app/api/fabric-store/inward/import/route.ts`: `POST` multipart with `file`, `entryType` and `receivingDate`. Returns `{ added, totals: { MTR, PCS }, skipped[], notes[] }`.
- `apps/web/src/lib/stock-import-server.ts`: reads the workbook (SheetJS).
- `apps/web/src/lib/stock-import-rules.mjs`: column headings, quantities, dates and row validation. Its tests are in `scripts/test-production-fixes.mjs`.
- `apps/web/src/components/fabric-store/StockImportModal.tsx`: the upload window.
