# File security

## Upload checks (before any parser runs)

- **Size:** `Content-Length` and the file size are each checked against 4 MB (Vercel caps bodies at
  4.5 MB).
- **Content sniffing:** the first bytes decide what the file is; the extension is ignored by the
  server.
  - A ZIP is accepted.
  - An OLE container (`.xls` or a password-protected workbook) is refused with "save as .xlsx".
  - HTML, CSV and other text files are refused.
- **ZIP central directory:** read without decompressing anything. The upload is refused when any of
  these hold:
  - more than 2,000 entries;
  - ZIP64 or a truncated or damaged directory;
  - encrypted entries;
  - more than 60 MB in total once decompressed;
  - an entry over 1 MB that compresses more than 200:1 (decompression-bomb protection);
  - `[Content_Types].xml` or `xl/workbook.xml` is missing;
  - no worksheets, or more than 10.
- **Parser limits:** a 20 s parse timeout, at most 2,000 rows per sheet, data no further than column
  50, at most 200,000 filled cells, and at most 10 images of up to 3 MB each.

## Processing

- **Formulas are never evaluated.** Only the result Excel saved is read; a formula without one is an
  error on its row.
- **The upload is never written to disk, never executed, and never served from a public path.** The
  bytes are stored in PostgreSQL (`FabricStockImport.fileData`, bytea) and returned only by an
  authorized route.
- **The original file name is display-only.** `safeFileName()` strips paths, control and header
  characters, and it is never used as a storage key.
- **Downloads** are sent as `Content-Disposition: attachment` with an ASCII-safe name (plus
  `filename*` for the original), `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
- **Cell text is rendered as React text**, so it is escaped; no HTML from files is rendered.
- **Formula injection in reports:** the validation report prefixes text that starts with `= + - @`,
  tab or CR with `'`.

## Retention

- Original workbooks and extracted images are kept with the import as inward evidence.
- There is no purge job yet. A retention period is a business decision, listed as follow-up in
  `OPERATIONS_AND_TROUBLESHOOTING.md`.
- There is no malware scanning, because no scanner is available in this deployment. Uploads are never
  executed, and only workbook cell values and images are read.

## Dependency note

- `exceljs@4.4.0` carries a moderate advisory through `uuid` (a buffer argument exceljs does not
  use).
- The existing `next` 15.x in this repository has critical advisories reported by `npm audit`. That
  predates this feature; upgrading `next` is recommended separately.
