# OCR design

## Status: OCR is not enabled

Agreed with the user on 2026-10-26: ship the Excel import, and keep scanned documents as evidence.
No OCR library or provider has been added, and nothing in the app presents OCR output.

## What is implemented

- **Extraction:** images embedded in uploaded workbooks are pulled out at upload by `readWorkbook()`
  in `lib/fabric-stock-import/workbook.ts`. Scanned invoices, delivery challans and packing lists
  pasted into Excel all arrive this way. Accepted formats are PNG, JPEG, GIF, BMP, TIFF and WebP. The
  limits are 10 images per workbook and 3 MB per image; larger or unknown formats are skipped.
- **Storage:** each image is a `FabricStockImportDocument` row (bytes, MIME type, size, SHA-256,
  sheet name) with `ocrStatus = 'NOT_CONFIGURED'`.
- **Display:** the wizard lists the images and opens them only through
  `GET /api/fabric-store/stock-imports/:id/documents/:docId`, which requires the Store department. The
  page tells the user to compare quantities with the rows themselves.
- **Data source:** normal worksheet cells are always read directly. OCR is never used where the cell
  values can be read.

## How OCR plugs in later

1. **Provider:** choose one.
   - `tesseract.js` is free but slow, English-focused, large, and may hit Vercel time limits.
   - A managed API (Google Vision, Azure Document Intelligence) is paid, and sends invoice images to
     the provider.
2. **Configuration:** server-side only, for example `OCR_PROVIDER`, `OCR_API_KEY`, `OCR_TIMEOUT_MS`
   and `OCR_MAX_CONCURRENCY`. The feature stays off when they are unset.
3. **Processing:** after upload, run OCR per document with a timeout and bounded concurrency.
   - Store candidate fields (invoice number, quantities, roll numbers) with the provider's confidence
     only if the provider gives it; never invent a confidence score.
   - Set `ocrStatus` to DONE or FAILED.
4. **Comparison:** compare candidates with the mapped rows and show discrepancies as warnings that need
   a decision. For example, if the invoice says 180 and the sheet says 160, nothing is chosen
   automatically.
5. **Failure handling:** an OCR failure or timeout leaves the import usable; Excel parsing does not
   depend on OCR.
6. **Retention:** decide how long images and OCR text are kept, and add a purge job.

## Acceptance scenario 8 (OCR discrepancy)

Not applicable until a provider is chosen. With no extraction, the system never compares or picks
values from images.
