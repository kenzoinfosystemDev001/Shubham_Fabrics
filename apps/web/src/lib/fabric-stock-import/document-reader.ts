import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import { IMPORT_FIELDS, cleanText } from './columns.mjs';
import { IMPORT_LIMITS } from './workbook-guard.mjs';
import type { StoredCell, StoredRow, StoredSheet } from './workbook';

/**
 * Reads any stock document for the Excel stock import pipeline, so every file ends up as the same
 * worksheet grid that the column mapping, row validation, review and confirm steps already use:
 * - .xlsx: read as before (workbook.ts).
 * - .xls, .ods, .csv / .tsv / .txt and HTML tables: converted to .xlsx with SheetJS, then read as before.
 * - Spreadsheets whose columns cannot be mapped automatically: Claude names which column holds which
 *   field and reads values written once in the sheet heading (bill no, bill date, supplier). Every
 *   cell value is still copied from the file, never retyped.
 * - PDF bills and photos / scans: Claude transcribes the stock lines into a grid with the standard
 *   column names.
 * Nothing here writes to the database or stock; the rows still go through review and confirmation.
 * Claude needs ANTHROPIC_API_KEY (or another Anthropic credential) in the web app's environment; the
 * model can be changed with STOCK_IMPORT_MODEL.
 */

export type SourceKind = 'XLSX' | 'SPREADSHEET' | 'PDF' | 'IMAGE';

/** Failure the user can act on; `status` is the HTTP status to answer with. */
export class DocumentReadError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'UNREADABLE') {
    super(message);
    this.name = 'DocumentReadError';
  }
}

const startsWith = (bytes: Buffer, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);

/** What kind of file this is, from its first bytes (the name only separates .ods from .xlsx). */
export function detectSourceKind(name: string, bytes: Buffer): SourceKind | null {
  if (!bytes || bytes.length < 4) return null;
  const ext = String(name || '').toLowerCase().split('.').pop() || '';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'PDF'; // %PDF
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    startsWith(bytes, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) || // GIF
    startsWith(bytes, [0x42, 0x4d]) || // BMP
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]) || // TIFF
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) // WEBP
  ) {
    return 'IMAGE';
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return ext === 'ods' ? 'SPREADSHEET' : 'XLSX';
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'SPREADSHEET'; // .xls
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512));
  // CSV / TSV / plain text and HTML-table "xls" exports: printable text only.
  if (!/[\u0000-\u0008\u000e-\u001f]/.test(head)) return 'SPREADSHEET';
  return null;
}

/** .xls / .ods / .csv / HTML table -> .xlsx bytes, so the existing workbook reader handles it. */
export function convertToXlsx(bytes: Buffer): Buffer {
  const isText = !startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && !startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]);
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'buffer',
      cellDates: true,
      // Text files keep their text: "05-10-2026" stays as written (day first), never read month-first.
      raw: isText,
      sheetRows: IMPORT_LIMITS.maxRowsPerSheet + 50,
    });
  } catch {
    throw new DocumentReadError('This file could not be opened as a spreadsheet. It may be damaged or password protected; save it again as .xlsx and upload it.', 400, 'MALFORMED');
  }
  if (!workbook.SheetNames.length) throw new DocumentReadError('This file has no worksheets.', 400, 'EMPTY');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-opus-5-5';
const READ_FIELDS = IMPORT_FIELDS.map((f) => f.key);
/** Fields that are usually written once for the whole bill rather than on every line. */
const HEADING_FIELDS = ['supplierName', 'billNo', 'billDate', 'receivedDate', 'fabricType', 'unit', 'purchaseOrderNumber'] as const;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new DocumentReadError(
      'Reading PDFs and photos is not set up on this server (ANTHROPIC_API_KEY is missing). Upload the stock as an Excel sheet, or ask the administrator to add the key.',
      503,
      'READER_NOT_CONFIGURED',
    );
  }
  // Retries rate limits, overloads and dropped connections twice with backoff (SDK default).
  client ??= new Anthropic({ timeout: 4 * 60 * 1000, maxRetries: 2 });
  return client;
}

export function documentReaderConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const nullableString = (description: string) => ({ anyOf: [{ type: 'string' }, { type: 'null' }], description });

const FIELD_HINTS: Record<string, string> = {
  fabricName: 'Fabric name / quality / item description of the line.',
  fabricType: 'UNDYED when the document says Kora, Grey, Greige, Raw or Undyed; DYED when it says Dyed or Finished. null when not stated - never guess.',
  colour: 'Colour of the fabric as received.',
  shade: 'Shade number or code, if written.',
  composition: 'Fibre content, if written (e.g. 100% Cotton).',
  width: 'Width with its unit as written (e.g. 58 in).',
  quantity: 'Quantity of the line, digits only with a dot for decimals (e.g. "1250.5"). Never a total of several lines.',
  unit: 'MTR for meters / mtrs / mtr / m, PCS for pieces / pcs / nos. null when no unit is written for the line or its column.',
  rollNumber: 'Roll / than number of the line, if written.',
  batchNumber: 'Lot / batch number, if written.',
  supplierName: 'Supplier / party / mill name.',
  billNo: 'Bill / invoice / challan number.',
  billDate: 'Bill / invoice date as YYYY-MM-DD. Indian documents write dates day first (05/10/2026 is 5 October 2026).',
  receivedDate: 'Date the goods were received, as YYYY-MM-DD, only when written (e.g. a receiving stamp or GRN date).',
  purchaseOrderNumber: 'Purchase order number, if written.',
  unitRate: 'Rate per unit, digits only (e.g. "86.50").',
  storageLocation: 'Rack / bin location, if written.',
  remarks: 'Other notes on the line (bale, lot remarks), if any.',
};

const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false when this is not a fabric bill / stock document, or is too blurred or cut off to read the lines.' },
    problem: nullableString('Short reason when the document or parts of it cannot be read.'),
    heading: {
      type: 'object',
      description: 'Values written once for the whole document (heading or footer).',
      properties: Object.fromEntries(HEADING_FIELDS.map((k) => [k, nullableString(FIELD_HINTS[k])])),
      required: [...HEADING_FIELDS],
      additionalProperties: false,
    },
    rows: {
      type: 'array',
      description: 'One entry per fabric line item, in document order.',
      items: {
        type: 'object',
        properties: Object.fromEntries(READ_FIELDS.map((k) => [k, nullableString(FIELD_HINTS[k])])),
        required: READ_FIELDS,
        additionalProperties: false,
      },
    },
  },
  required: ['readable', 'problem', 'heading', 'rows'],
  additionalProperties: false,
};

const DOCUMENT_PROMPT = `You transcribe fabric purchase documents (supplier bills, tax invoices, delivery challans, packing lists, stock sheets; printed or handwritten) for a garment factory's Fabric Store. A store clerk reviews your output before it is added to stock, so a wrong number is worse than an empty one.

Rules:
- Transcribe only what is written. Never guess, complete or calculate a value; return null when a value is not on the document or cannot be read with reasonable certainty.
- One row per fabric line item. A fabric received in several colours or rolls is several lines; keep each with its own quantity. Leave out total, subtotal, tax, freight and carried-forward lines, and non-fabric charges.
- Quantity: the received quantity of that line (meters or pieces), not an amount in rupees.
- Unit: from the line or its column heading (a "Mtrs" column means MTR). Never convert meters to pieces or back.
- Values written once for the whole document (supplier, bill no., bill date, received date, a fabric type or unit stated for all lines) go in "heading", not on each row; put a value on a row only when the row itself shows it.
- Dates are day first (Indian format); return them as YYYY-MM-DD.
- If this is not a fabric stock document, or it cannot be read, set readable to false, explain in problem, and return only the rows you can read.`;

const LAYOUT_SCHEMA = {
  type: 'object',
  properties: {
    headerRow: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Row number (as given) of the column headings of the stock lines; null when the sheet has no stock lines.' },
    columns: {
      type: 'object',
      description: 'For each field, the column letter (as given) that holds it on the stock lines, or null when no column holds it.',
      properties: Object.fromEntries(READ_FIELDS.map((k) => [k, nullableString(FIELD_HINTS[k])])),
      required: READ_FIELDS,
      additionalProperties: false,
    },
    heading: {
      type: 'object',
      description: 'Values that apply to every stock line but are written once (e.g. in the title rows above the headings, or implied by a heading such as "Qty (Mtrs)"). Only for fields that have no column.',
      properties: Object.fromEntries(HEADING_FIELDS.map((k) => [k, nullableString(FIELD_HINTS[k])])),
      required: [...HEADING_FIELDS],
      additionalProperties: false,
    },
  },
  required: ['headerRow', 'columns', 'heading'],
  additionalProperties: false,
};

const LAYOUT_PROMPT = `You read the layout of a fabric stock spreadsheet (a supplier bill, packing list or stock register exported to Excel) for a garment factory's Fabric Store. You do not copy the stock lines; you say which column holds which field, so the program can copy every cell itself.

Rules:
- Name a column only when its heading or contents clearly hold that field. A column of amounts in rupees is not Quantity; a serial-number column is not Roll Number unless it is headed roll / than.
- Each column holds at most one field.
- "heading" values are for fields that have no column and are written once for the whole sheet (title rows, a "Bill No: 1234" cell above the table) or implied by a column heading (a "Qty (Mtrs)" heading means unit MTR). Never guess; null when not written.
- Dates are day first (Indian format); return them as YYYY-MM-DD.`;

type Effort = 'low' | 'medium' | 'high';

async function askClaude(content: Anthropic.Beta.BetaContentBlockParam[], system: string, schema: Record<string, unknown>, effort: Effort): Promise<any> {
  const api = anthropic();
  const model = process.env.STOCK_IMPORT_MODEL || DEFAULT_MODEL;
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = api.beta.messages.stream({
      model,
      max_tokens: 64000,
      // Re-runs on Anthropic's recommended model if a safety classifier declines the request.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    throw describeApiError(error);
  }
  if (message.stop_reason === 'refusal') {
    throw new DocumentReadError('This file could not be read as a fabric stock document. Upload the bill or stock sheet itself.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new DocumentReadError('This document has too many lines to read at once. Split it into smaller files (for example one page each) and upload each.');
  }
  const text = message.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text;
  try {
    return JSON.parse(text || '');
  } catch {
    throw new DocumentReadError('The document reader returned an incomplete answer. Try uploading the file again.', 502, 'READER_FAILED');
  }
}

function describeApiError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new DocumentReadError('The document reader rejected this server\'s API key. Ask the administrator to check ANTHROPIC_API_KEY. Excel sheets with clear column headings still import.', 503, 'READER_NOT_CONFIGURED');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new DocumentReadError('The document reader is busy right now. Wait a minute and upload the file again.', 429, 'READER_BUSY');
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('Stock document request rejected:', error.message);
    return new DocumentReadError('This file could not be processed. If it is a scanned PDF, try a photo (JPG or PNG) of each page instead.');
  }
  if (error instanceof Anthropic.APIError) {
    console.error('Stock document reader unavailable:', error.message);
    return new DocumentReadError('The document reader is temporarily unavailable. Try again in a few minutes.', 503, 'READER_UNAVAILABLE');
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** A phone photo or scan as an upright JPEG of a size the model reads well. */
async function prepareImage(bytes: Buffer) {
  try {
    return await sharp(bytes, { failOn: 'error', limitInputPixels: 100_000_000 })
      .rotate() // apply the camera's orientation
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    throw new DocumentReadError('This image could not be opened. It may be damaged; take the photo again and upload it.');
  }
}

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

const LABEL: Record<string, string> = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label]));
const DATE_FIELDS = new Set(['billDate', 'receivedDate']);

function text(value: unknown): string | null {
  const t = cleanText(value);
  return t ? t.slice(0, 500) : null;
}

/** A value for a grid cell: ISO dates become date cells, the rest stays text as read. */
function cellOf(field: string, value: unknown): StoredCell {
  const t = text(value);
  if (t === null) return null;
  if (DATE_FIELDS.has(field) && /^\d{4}-\d{2}-\d{2}$/.test(t)) return { d: t };
  return t;
}

export interface ReadResult {
  sheet: StoredSheet;
  /** Field key -> column index of `sheet`. */
  mapping: Record<string, number>;
  headerRow: number;
  engine: string;
  notes: string[];
}

/**
 * Reads a PDF bill or a photo / scan into a grid with the standard column names: row 1 holds the
 * headings, every following row one stock line. Values written once for the document are copied to
 * every line; a received date that is not written is the upload day (`today`, YYYY-MM-DD).
 */
export async function readDocument(kind: 'PDF' | 'IMAGE', bytes: Buffer, fileName: string, today: string): Promise<ReadResult> {
  const source: Anthropic.Beta.BetaContentBlockParam =
    kind === 'PDF'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await prepareImage(bytes)).toString('base64') } };
  const parsed = await askClaude([source, { type: 'text', text: 'Transcribe the fabric stock lines of this document.' }], DOCUMENT_PROMPT, DOCUMENT_SCHEMA, 'medium');

  const lines: any[] = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const heading = parsed?.heading || {};
  if (lines.length === 0) {
    throw new DocumentReadError(
      parsed?.readable === false && parsed?.problem
        ? `This file could not be read: ${String(parsed.problem).replace(/\.$/, '')}. Upload a clearer copy of the bill or stock sheet.`
        : 'No fabric lines were found in this file. Check that it is the bill or stock sheet with the fabric lines.',
    );
  }
  if (lines.length > IMPORT_LIMITS.maxRowsPerSheet) {
    throw new DocumentReadError(`This document has more than ${IMPORT_LIMITS.maxRowsPerSheet} lines. Split it into smaller files.`);
  }

  const rows: StoredRow[] = [{ rowNumber: 1, cells: READ_FIELDS.map((k) => LABEL[k]) }];
  lines.forEach((line, i) => {
    rows.push({
      rowNumber: i + 2,
      cells: READ_FIELDS.map((k) => {
        const own = cellOf(k, line?.[k]);
        if (own !== null) return own;
        const shared = (HEADING_FIELDS as readonly string[]).includes(k) ? cellOf(k, heading[k]) : null;
        if (shared !== null) return shared;
        return k === 'receivedDate' ? { d: today } : null;
      }),
    });
  });

  const notes: string[] = [];
  if (parsed?.readable === false) notes.push(`Parts of the file could not be read${parsed?.problem ? ` (${String(parsed.problem).replace(/\.$/, '')})` : ''}. Check every row against the document.`);
  if (!text(heading.receivedDate) && !lines.some((l) => text(l?.receivedDate))) notes.push(`No received date is written; ${today} (the upload day) is used.`);

  const name = (fileName.replace(/\.[^.]+$/, '') || 'Document').slice(0, 31);
  return {
    sheet: { name, hidden: false, rowCount: rows.length, columnCount: READ_FIELDS.length, detectedHeaderRow: 1, imageCount: 0, rows },
    mapping: Object.fromEntries(READ_FIELDS.map((k, i) => [k, i])),
    headerRow: 1,
    engine: kind === 'PDF' ? 'claude-pdf' : 'claude-image',
    notes,
  };
}

function columnIndex(letters: unknown): number | null {
  const t = String(letters ?? '').trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(t)) return null;
  let n = 0;
  for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function letterOf(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const gridText = (cell: StoredCell) =>
  cell === null ? '' : typeof cell === 'object' ? ('d' in cell ? cell.d : '') : String(cell).replace(/[\t\r\n]+/g, ' ').slice(0, 60);

/**
 * Works out the layout of a spreadsheet whose headings are not the standard names: Claude names the
 * column of each field and the values written once for the sheet; the program then copies the cells.
 * Fields without a column get an added column holding the sheet-wide value (received date: the
 * upload day when not written). Returns null when no stock table is found.
 */
export async function readSheetLayout(sheet: StoredSheet, today: string): Promise<ReadResult | null> {
  // Enough of the sheet to see its title rows, headings and the shape of the lines.
  const sample = sheet.rows.slice(0, 40);
  const width = Math.min(sheet.columnCount, IMPORT_LIMITS.maxColumns);
  const grid = [
    ['row', ...Array.from({ length: width }, (_, i) => letterOf(i))].join('\t'),
    ...sample.map((r) => [String(r.rowNumber), ...Array.from({ length: width }, (_, i) => gridText(r.cells[i] ?? null))].join('\t')),
  ].join('\n');
  const parsed = await askClaude(
    [{ type: 'text', text: `Sheet "${sheet.name}" (${sheet.rowCount} filled rows; the first ${sample.length} are shown, tab separated):\n\n${grid}` }],
    LAYOUT_PROMPT,
    LAYOUT_SCHEMA,
    'low',
  );

  const headerRow = Number(parsed?.headerRow);
  if (!Number.isInteger(headerRow) || !sheet.rows.some((r) => r.rowNumber === headerRow)) return null;
  const mapping: Record<string, number> = {};
  const used = new Set<number>();
  for (const key of READ_FIELDS) {
    const index = columnIndex(parsed?.columns?.[key]);
    if (index === null || index >= sheet.columnCount || used.has(index)) continue;
    used.add(index);
    mapping[key] = index;
  }
  if (mapping.fabricName === undefined || mapping.quantity === undefined) return null;

  // Fields with no column but a sheet-wide value become added columns.
  const heading = parsed?.heading || {};
  const added: Array<{ key: string; value: StoredCell }> = [];
  for (const key of HEADING_FIELDS) {
    if (mapping[key] !== undefined) continue;
    const value = cellOf(key, heading[key]) ?? (key === 'receivedDate' ? { d: today } : null);
    if (value !== null) added.push({ key, value });
  }
  const base = sheet.columnCount;
  added.forEach((a, i) => (mapping[a.key] = base + i));
  const rows = sheet.rows
    .filter((r) => r.rowNumber >= headerRow)
    .map((r) => {
      const cells = Array.from({ length: base }, (_, i) => r.cells[i] ?? null);
      const isHeader = r.rowNumber === headerRow;
      return { rowNumber: r.rowNumber, cells: [...cells, ...added.map((a) => (isHeader ? LABEL[a.key] : a.value))] };
    });

  const notes: string[] = [];
  if (added.some((a) => a.key === 'receivedDate') && !text(heading.receivedDate)) notes.push(`No received date is written; ${today} (the upload day) is used.`);
  return {
    sheet: { ...sheet, rows, rowCount: rows.length, columnCount: base + added.length, detectedHeaderRow: headerRow },
    mapping,
    headerRow,
    engine: 'claude-layout',
    notes,
  };
}
