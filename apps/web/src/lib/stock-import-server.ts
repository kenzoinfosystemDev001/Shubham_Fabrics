import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import {
  MAX_IMPORT_ROWS,
  commonValue,
  expandMerges,
  rowsFromSheet,
  rowsFromVision,
} from '@/lib/stock-import-rules.mjs';

/**
 * Reads stock rows from an uploaded stock sheet: Excel workbooks directly (SheetJS), photos and scans
 * with Claude vision. Nothing here writes to the database; the rows go to a person for review first.
 *
 * Photo reading needs ANTHROPIC_API_KEY in the web app's environment (apps/web/.env.local). The model
 * can be changed with STOCK_IMPORT_MODEL. Keys are never stored in code.
 */

export interface ImportRow {
  rowNo: number;
  source: string;
  itemName: string | null;
  fabricCode: string | null;
  colour: string | null;
  dyeColour: string | null;
  quantity: number | null;
  quantityText: string | null;
  unit: 'MTR' | 'PCS' | null;
  unitText: string | null;
  supplierName: string | null;
  billNo: string | null;
  billDate: string | null;
  billDateText: string | null;
  remarks: string | null;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  unreadable?: string[];
}

export interface ImportHeader {
  supplierName: string | null;
  billNo: string | null;
  billDate: string | null;
  billDateText?: string | null;
  confidence?: Record<string, 'high' | 'medium' | 'low'>;
}

export interface ExtractionResult {
  engine: string;
  header: ImportHeader;
  rows: ImportRow[];
  notes: string[];
}

/** The file itself is the problem (unreadable, empty, wrong columns); the user should fix the file. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFileError';
  }
}

/** Reading is unavailable (not set up, rate limited, service down); the file may be fine. */
export class ImportServiceError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
    this.name = 'ImportServiceError';
  }
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const EXPECTED_COLUMNS = 'Fabric (or Item / Quality / Description) and Qty (or Meters / Pcs); optionally Colour, Unit, Fabric Code, Dyeing Colour, Supplier, Challan No., Date';

export function readExcel(bytes: Buffer): ExtractionResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'buffer',
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      sheetRows: MAX_IMPORT_ROWS + 50,
    });
  } catch (error) {
    const message = String((error as Error)?.message || '');
    if (/password-protected|ECMA-376 Encrypted|EncryptionInfo|Encryption (Flags|scheme)/i.test(message)) throw new ImportFileError('This Excel file is password protected. Save a copy without a password and upload that.');
    throw new ImportFileError('This Excel file could not be opened. It may be damaged; open it in Excel, save it again as .xlsx and upload that.');
  }

  const rows: ImportRow[] = [];
  const notes: string[] = [];
  let sheetsWithHeader = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    // Merges are in sheet coordinates; the matrix starts at the top-left of the used range.
    const merges = (sheet['!merges'] || []).map((m) => ({
      s: { r: m.s.r - range.s.r, c: m.s.c - range.s.c },
      e: { r: m.e.r - range.s.r, c: m.e.c - range.s.c },
    }));
    expandMerges(matrix as unknown[][], merges);
    const read = rowsFromSheet(matrix, sheetName);
    if (read.error) continue;
    sheetsWithHeader += 1;
    notes.push(...read.notes);
    for (const row of read.rows) {
      if (rows.length >= MAX_IMPORT_ROWS) break;
      rows.push({ ...row, rowNo: rows.length + 1 } as ImportRow);
    }
  }

  if (sheetsWithHeader === 0) {
    throw new ImportFileError(`No column headings were recognised in this workbook. The first rows of a sheet should name the columns: ${EXPECTED_COLUMNS}.`);
  }
  if (rows.length === 0) throw new ImportFileError('The sheet has column headings but no stock rows under them.');

  return { engine: 'sheetjs', header: headerFromRows(rows), rows, notes };
}

function headerFromRows(rows: ImportRow[]): ImportHeader {
  return {
    supplierName: commonValue(rows, 'supplierName'),
    billNo: commonValue(rows, 'billNo'),
    billDate: commonValue(rows, 'billDate'),
  };
}

// ---------------------------------------------------------------------------
// Photos and scans (Claude vision)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-opus-5-5';

const field = (description: string) => ({
  type: 'object',
  description,
  properties: {
    value: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Exactly as written, or null when it is not on the page or cannot be read.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['value', 'confidence'],
  additionalProperties: false,
});

const ROW_FIELDS = {
  itemName: field('Fabric name / quality / description of the line.'),
  fabricCode: field('Fabric, item, quality or article code of the line, if one is written.'),
  colour: field('Colour or shade of the fabric as received.'),
  dyeColour: field('Colour the fabric is to be dyed to, only when the document has a separate column or note for it.'),
  quantity: field('Quantity of the line, digits as written (e.g. "1,250.5"). Never a total of several lines.'),
  unit: field('Unit of the quantity as written on the line or in its column heading (e.g. MTR, Mtrs, Meters, PCS, Pcs).'),
  supplierName: field('Supplier / party / mill of this line, only if written on the line itself.'),
  billNo: field('Challan / bill / invoice number of this line, only if written on the line itself.'),
  billDate: field('Challan / bill date of this line, only if written on the line itself, as written.'),
  remarks: field('Other notes on this line (lot, bale, roll), if any.'),
};

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    document: {
      type: 'object',
      properties: {
        readable: { type: 'boolean', description: 'false when the image is not a stock document or is too blurred, dark or cut off to read the lines.' },
        problem: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Short reason when the document or parts of it cannot be read.' },
        supplierName: field('Supplier / party / mill named in the document heading.'),
        billNo: field('Challan / bill / invoice number in the document heading.'),
        billDate: field('Challan / bill date in the document heading, as written.'),
      },
      required: ['readable', 'problem', 'supplierName', 'billNo', 'billDate'],
      additionalProperties: false,
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...ROW_FIELDS,
          unreadableFields: {
            type: 'array',
            items: { type: 'string', enum: Object.keys(ROW_FIELDS) },
            description: 'Fields that are written on the line but could not be read.',
          },
        },
        required: [...Object.keys(ROW_FIELDS), 'unreadableFields'],
        additionalProperties: false,
      },
    },
  },
  required: ['document', 'rows'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You transcribe fabric stock documents (supplier challans, bills, stock registers; printed or handwritten) for a garment factory's Fabric Store. Your output is reviewed by a store clerk and then added to stock, so a wrong number is worse than an empty one.

Rules:
- Transcribe only what is written. Never guess, complete or calculate a value. If a value is not on the page, or you cannot read it with reasonable certainty, return null for it (and list it in unreadableFields when something is written there but illegible).
- One row per line item. A fabric received in several colours appears as several lines; keep each line separate with its own quantity, even when names or colours repeat. Do not merge or total lines. Leave out total, subtotal and carried-forward lines.
- Quantities: copy the digits of that line exactly as written. Units: take the unit from the line or from its column heading (e.g. a "Mtrs" column means MTR for that line). If no unit is written for a line, return null; do not convert between meters and pieces.
- Where a line carries a ditto mark (", 〃, do, same) or is visibly grouped under a fabric name written once, you may repeat that value for the line, with confidence "medium".
- Confidence: "high" when clearly legible, "medium" when legible but with some doubt (e.g. 1 vs 7, smudged), "low" when you are unsure.
- Document heading fields (supplier, challan/bill no., date) go in "document"; repeat them on a row only when the row itself shows a different value.
- If the image is not a stock document, or is too blurred, dark, angled or cut off to read the lines, set readable to false, explain briefly in problem, and return only the rows you can read.`;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ImportServiceError(
      'Reading photos is not set up on this server (ANTHROPIC_API_KEY is missing). Excel files and manual entry still work; ask the administrator to add the key to apps/web/.env.local and restart the web app.',
    );
  }
  // Retries rate limits, overloads and dropped connections twice with backoff (SDK default).
  client ??= new Anthropic({ timeout: 4 * 60 * 1000, maxRetries: 2 });
  return client;
}

/** Turns a phone photo or scan into an upright JPEG of a size the model reads well. */
async function prepareImage(bytes: Buffer) {
  try {
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: 100_000_000 });
    const meta = await image.metadata();
    const notes: string[] = [];
    const shortSide = Math.min(meta.width || 0, meta.height || 0);
    if (shortSide && shortSide < 500) notes.push('The photo is small; small writing may not be readable. A closer, sharper photo gives better results.');
    const data = await image
      .rotate() // apply the camera's orientation
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { data, notes };
  } catch {
    throw new ImportFileError('This image could not be opened. It may be damaged or not a real JPG/PNG; take the photo again and upload it.');
  }
}

export async function readPhoto(bytes: Buffer): Promise<ExtractionResult> {
  const { data, notes } = await prepareImage(bytes);
  const model = process.env.STOCK_IMPORT_MODEL || DEFAULT_MODEL;
  const api = anthropic();

  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = api.beta.messages.stream({
      model,
      max_tokens: 64000,
      // Re-runs on Anthropic's recommended model if a safety classifier declines the request.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema: VISION_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: data.toString('base64') } },
            { type: 'text', text: 'Transcribe the stock lines of this document.' },
          ],
        },
      ],
    });
    message = await stream.finalMessage();
  } catch (error) {
    throw describeApiError(error);
  }

  if (message.stop_reason === 'refusal') {
    throw new ImportFileError('This image could not be read as a stock document. Upload a clear photo of the challan or stock sheet, or enter the rows by hand.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new ImportFileError('This page has too many lines to read at once. Photograph it in two or more parts and upload each part.');
  }
  const text = message.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || '');
  } catch {
    throw new ImportServiceError('The photo reader returned an incomplete answer. Try again.', 502);
  }

  const read = rowsFromVision(parsed) as unknown as { header: ImportHeader; rows: ImportRow[]; readable: boolean; problem: string | null };
  if (!read.readable && read.rows.length === 0) {
    throw new ImportFileError(
      `This photo could not be read${read.problem ? `: ${read.problem.replace(/\.$/, '')}` : ''}. Take a sharper, well-lit photo of the whole page, straight on, or enter the rows by hand.`,
    );
  }
  if (read.rows.length === 0) {
    throw new ImportFileError('No stock lines were found in this photo. Check that it shows the fabric lines of the challan or stock sheet.');
  }
  if (!read.readable) notes.push(`Parts of the photo could not be read${read.problem ? ` (${read.problem.replace(/\.$/, '')})` : ''}. Check every row against the paper.`);
  return { engine: message.model || model, header: read.header, rows: read.rows, notes };
}

function describeApiError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ImportServiceError('The photo reader rejected this server\'s API key. Check ANTHROPIC_API_KEY in apps/web/.env.local. Excel files and manual entry still work.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ImportServiceError('The photo reader is busy right now. Wait a minute and try again, or enter the rows by hand.', 429);
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('Stock sheet photo request rejected:', error.message);
    return new ImportFileError('This photo could not be processed. Try a different photo (JPG or PNG), or enter the rows by hand.');
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIError) {
    console.error('Stock sheet photo reader unavailable:', error.message);
    return new ImportServiceError('The photo reader is temporarily unavailable. Try again in a few minutes, or enter the rows by hand.');
  }
  return error instanceof Error ? error : new Error(String(error));
}
