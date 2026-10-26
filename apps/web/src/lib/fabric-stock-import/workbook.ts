import ExcelJS from 'exceljs';
import { IMPORT_FIELDS, cleanText, detectHeaderRow } from './columns.mjs';
import { IMPORT_LIMITS, WorkbookRejectedError } from './workbook-guard.mjs';

/**
 * Server-side workbook reading for Excel stock imports. Only cell values are read: formulas are
 * never evaluated (their saved result is used, or the cell is flagged), and embedded images are
 * returned as evidence. Call inspectWorkbookBytes() first; it refuses unsafe files before this
 * parser decompresses anything.
 */

export type StoredCell =
  | null
  | string
  | number
  | boolean
  | { d: string }
  | { formulaWithoutResult: true }
  | { err: string };

export interface StoredRow {
  rowNumber: number;
  cells: StoredCell[];
}

export interface StoredSheet {
  name: string;
  hidden: boolean;
  rowCount: number;
  columnCount: number;
  detectedHeaderRow: number | null;
  imageCount: number;
  rows: StoredRow[];
}

export interface ExtractedImage {
  sheetName: string | null;
  mimeType: string;
  data: Buffer;
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

function isoFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** An exceljs cell value as plain data; formulas use their saved result only. */
export function toStoredCell(value: unknown): StoredCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? { err: '#DATE' } : { d: isoFromDate(value) };
  if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { err: '#NUM!' };
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, any>;
    if ('formula' in v || 'sharedFormula' in v) {
      const result = v.result;
      if (result === undefined || result === null || result === '') return { formulaWithoutResult: true };
      if (typeof result === 'object' && result && 'error' in result) return { err: String(result.error) };
      return toStoredCell(result);
    }
    if ('error' in v) return { err: String(v.error) };
    if (Array.isArray(v.richText)) return v.richText.map((part: any) => String(part?.text ?? '')).join('');
    if ('text' in v) return toStoredCell(v.text);
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new WorkbookRejectedError('TIMEOUT', 'The workbook took too long to read. Remove unused sheets or rows and try again.')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Reads every worksheet's values (bounded) and the embedded images. */
export async function readWorkbook(bytes: Buffer, limits = IMPORT_LIMITS): Promise<{ sheets: StoredSheet[]; images: ExtractedImage[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await withTimeout(workbook.xlsx.load(bytes as any), limits.parseTimeoutMs);
  } catch (error) {
    if (error instanceof WorkbookRejectedError) throw error;
    throw new WorkbookRejectedError('MALFORMED', 'The workbook could not be read. Open it in Excel, save it as .xlsx and try again.');
  }

  if (workbook.worksheets.length === 0) throw new WorkbookRejectedError('EMPTY', 'The workbook has no worksheets.');
  if (workbook.worksheets.length > limits.maxSheets) {
    throw new WorkbookRejectedError('TOO_MANY_SHEETS', `The workbook has ${workbook.worksheets.length} worksheets; the limit is ${limits.maxSheets}.`);
  }

  let totalCells = 0;
  const sheets: StoredSheet[] = [];
  const images: ExtractedImage[] = [];

  for (const worksheet of workbook.worksheets) {
    const rows: StoredRow[] = [];
    let columnCount = 0;
    let failure: WorkbookRejectedError | null = null;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (failure) return;
      const cells: StoredCell[] = [];
      let lastFilled = -1;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (failure) return;
        const stored = toStoredCell(cell.value);
        const filled = stored !== null && !(typeof stored === 'string' && cleanText(stored) === '');
        if (!filled) return;
        if (colNumber > limits.maxColumns) {
          failure = new WorkbookRejectedError('TOO_MANY_COLUMNS', `Sheet "${worksheet.name}" has data beyond column ${limits.maxColumns}. Remove unused columns.`);
          return;
        }
        cells[colNumber - 1] = stored;
        lastFilled = Math.max(lastFilled, colNumber - 1);
      });
      if (lastFilled < 0) return;
      for (let i = 0; i <= lastFilled; i++) if (cells[i] === undefined) cells[i] = null;
      columnCount = Math.max(columnCount, lastFilled + 1);
      rows.push({ rowNumber, cells: cells.slice(0, lastFilled + 1) });
      totalCells += lastFilled + 1;
      if (rows.length > limits.maxRowsPerSheet) {
        failure = new WorkbookRejectedError('TOO_MANY_ROWS', `Sheet "${worksheet.name}" has more than ${limits.maxRowsPerSheet} rows. Split the import into smaller workbooks.`);
      } else if (totalCells > limits.maxCellsTotal) {
        failure = new WorkbookRejectedError('TOO_LARGE', 'The workbook has too many filled cells to import at once. Split it into smaller workbooks.');
      }
    });
    if (failure) throw failure;

    let imageCount = 0;
    for (const image of worksheet.getImages()) {
      const media = workbook.getImage(Number(image.imageId)) as { buffer?: Buffer; extension?: string } | undefined;
      const mimeType = media?.extension ? IMAGE_TYPES[media.extension.toLowerCase()] : undefined;
      if (!media?.buffer || !mimeType) continue;
      if (media.buffer.length > limits.maxImageBytes) continue;
      if (images.length >= limits.maxImages) break;
      images.push({ sheetName: worksheet.name, mimeType, data: Buffer.from(media.buffer) });
      imageCount += 1;
    }

    sheets.push({
      name: worksheet.name,
      hidden: worksheet.state !== 'visible',
      rowCount: rows.length,
      columnCount,
      detectedHeaderRow: detectHeaderRow(rows),
      imageCount,
      rows,
    });
  }
  return { sheets, images };
}

const TEMPLATE_SHEET = 'Fabric Stock Inward';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE5F7' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF8A8A8A' } } };
  });
}

/**
 * The import template, generated from the same field list the server maps and validates, so it
 * cannot drift from the backend. `knownFabrics` lists fabric names already in stock.
 */
export async function buildTemplate(knownFabrics: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Subham Fabrics MES';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 110;
  const lines = [
    'Fabric Store stock inward: import template',
    '',
    `1. Enter one line per roll (or per lot when there is no roll number) on the "${TEMPLATE_SHEET}" sheet. Keep the header row as it is.`,
    '2. Required columns: ' + IMPORT_FIELDS.filter((f) => f.required).map((f) => f.label).join(', ') + '.',
    '3. Units: MTR (meters) or PCS (pieces) only. Meters and pieces are separate stock and are never converted or added together.',
    '4. Quantity: greater than zero, at most 3 decimal places, dot for decimals (120.5). Negative or zero quantities are rejected, never changed.',
    '5. Dates: DD-MM-YYYY, or real Excel dates. The received date cannot be in the future.',
    '6. Fabric Name: use the name already used in Fabric Store (see the "Fabrics in Stock" sheet). A name never received before stays unresolved until a Fabric Store incharge maps it to an existing fabric or accepts it as a new fabric.',
    '7. Fabric Type: UNDYED (Kora / Grey) or DYED. Colour is optional but stock is kept per colour.',
    '8. Rolls: Roll Number is optional. When given, Supplier Name is required, and a supplier\'s roll number can be received only once. A roll already in stock is rejected, never added again or overwritten.',
    '9. Bills: a bill that already has stock received against it is shown as a warning that must be acknowledged before posting.',
    '10. Formulas: only the value Excel saved is read. A formula without a saved value is an error; open the file in Excel and save it again.',
    '11. Nothing is invented: missing fabric, quantity, unit, bill number or dates are errors on that row.',
    '12. Upload: Fabric Store > Inward Stock > Import Fabric Stock. Review every row, fix errors, then an authorized Fabric Store user confirms. Stock changes only when the import is confirmed; one invalid row blocks the whole import.',
    `Limits: ${IMPORT_LIMITS.maxFileBytes / 1048576} MB per file, ${IMPORT_LIMITS.maxSheets} sheets, ${IMPORT_LIMITS.maxRowsPerSheet} rows per sheet, ${IMPORT_LIMITS.maxColumns} columns. Only .xlsx files.`,
  ];
  lines.forEach((text, i) => {
    const row = instructions.addRow([text]);
    row.alignment = { wrapText: true, vertical: 'top' };
    if (i === 0) row.font = { bold: true, size: 14 };
  });

  const sheet = workbook.addWorksheet(TEMPLATE_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = IMPORT_FIELDS.map((field) => ({
    header: field.required ? `${field.label} *` : field.label,
    key: field.key,
    width: Math.max(14, field.label.length + 4),
  }));
  styleHeader(sheet.getRow(1));
  const lastRow = 1 + IMPORT_LIMITS.maxRowsPerSheet - 1;
  const columnOf = (key: string) => IMPORT_FIELDS.findIndex((f) => f.key === key) + 1;
  const letter = (n: number) => sheet.getColumn(n).letter;
  const listValidation = (key: string, values: string[]) => {
    const col = letter(columnOf(key));
    (sheet as any).dataValidations.add(`${col}2:${col}${lastRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Not allowed',
      error: `Use one of: ${values.join(', ')}`,
    });
  };
  listValidation('fabricType', ['UNDYED', 'DYED']);
  listValidation('unit', ['MTR', 'PCS']);
  for (const key of ['billDate', 'receivedDate']) sheet.getColumn(columnOf(key)).numFmt = 'dd-mm-yyyy';
  for (const key of ['quantity', 'unitRate']) sheet.getColumn(columnOf(key)).numFmt = '0.###';
  for (const key of ['billNo', 'rollNumber', 'batchNumber', 'purchaseOrderNumber', 'shade']) sheet.getColumn(columnOf(key)).numFmt = '@';

  const reference = workbook.addWorksheet('Field Reference');
  reference.columns = [
    { header: 'Column', key: 'label', width: 22 },
    { header: 'Required', key: 'required', width: 10 },
    { header: 'Rule', key: 'help', width: 80 },
    { header: 'Example', key: 'example', width: 22 },
    { header: 'Also recognized as', key: 'aliases', width: 60 },
  ];
  styleHeader(reference.getRow(1));
  for (const field of IMPORT_FIELDS) {
    reference.addRow({ label: field.label, required: field.required ? 'Yes' : 'No', help: field.help, example: field.example, aliases: field.aliases.join(', ') });
  }
  reference.eachRow((row) => (row.alignment = { wrapText: true, vertical: 'top' }));

  const fabrics = workbook.addWorksheet('Fabrics in Stock');
  fabrics.columns = [{ header: 'Fabric name as used in Fabric Store', key: 'name', width: 50 }];
  styleHeader(fabrics.getRow(1));
  for (const name of knownFabrics) fabrics.addRow({ name });
  if (knownFabrics.length === 0) fabrics.addRow({ name: '(no fabric received yet)' });

  workbook.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: 'visible' }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Text written to a spreadsheet report: a leading = + - @ would become a formula elsewhere. */
export function spreadsheetSafe(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export async function buildValidationReport(input: {
  fileName: string;
  receiptNumber: string | null;
  status: string;
  rows: Array<{ rowNumber: number; status: string; values: Record<string, any>; fabric: { name: string; isNew: boolean } | null; errors: Array<{ message: string }>; warnings: Array<{ message: string }> }>;
  summary: Record<string, any>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Validation');
  sheet.columns = [
    { header: 'Row', key: 'row', width: 7 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Fabric (as stocked)', key: 'fabric', width: 28 },
    { header: 'Type', key: 'type', width: 9 },
    { header: 'Colour', key: 'colour', width: 14 },
    { header: 'Quantity', key: 'quantity', width: 11 },
    { header: 'Unit', key: 'unit', width: 7 },
    { header: 'Roll', key: 'roll', width: 12 },
    { header: 'Supplier', key: 'supplier', width: 20 },
    { header: 'Bill', key: 'bill', width: 14 },
    { header: 'Errors', key: 'errors', width: 60 },
    { header: 'Warnings', key: 'warnings', width: 60 },
  ];
  styleHeader(sheet.getRow(1));
  for (const row of input.rows) {
    if (row.status === 'SKIPPED') continue;
    sheet.addRow({
      row: row.rowNumber,
      status: row.status,
      fabric: spreadsheetSafe(row.fabric ? `${row.fabric.name}${row.fabric.isNew ? ' (new)' : ''}` : row.values.fabricName),
      type: spreadsheetSafe(row.values.fabricType),
      colour: spreadsheetSafe(row.values.colour),
      quantity: typeof row.values.quantity === 'number' ? row.values.quantity : '',
      unit: spreadsheetSafe(row.values.unit),
      roll: spreadsheetSafe(row.values.rollNumber),
      supplier: spreadsheetSafe(row.values.supplierName),
      bill: spreadsheetSafe(row.values.billNo),
      errors: spreadsheetSafe(row.errors.map((e) => e.message).join(' | ')),
      warnings: spreadsheetSafe(row.warnings.map((w) => w.message).join(' | ')),
    });
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ header: 'Item', key: 'k', width: 34 }, { header: 'Value', key: 'v', width: 50 }];
  styleHeader(summary.getRow(1));
  const s = input.summary;
  const add = (k: string, v: unknown) => summary.addRow({ k, v: spreadsheetSafe(v) });
  add('File', input.fileName);
  add('Status', input.status);
  add('Receipt', input.receiptNumber || 'Not posted');
  add('Rows', s.totalRows);
  add('Valid rows', s.validRows);
  add('Rows with warnings', s.warningRows);
  add('Rows with errors', s.errorRows);
  for (const [unit, qty] of Object.entries(s.byUnit || {})) add(`Total ${unit}`, qty);
  for (const f of s.byFabric || []) add(`${f.fabric} ${f.fabricType}${f.colour ? ` ${f.colour}` : ''}`, `${f.quantity} ${f.unit} (${f.rows} rows)`);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
