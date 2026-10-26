// Rules for the Fabric Store "Upload Stock Sheet" Excel import: recognising the file, reading Excel
// columns and values, and validating each row before it is added to Inward Stock.
// Plain JavaScript so node:test scripts can load it without a TypeScript build.
//
// Values are never invented: a row with anything missing or unclear (no fabric, no valid quantity, no
// MTR/PCS unit, no bill no./date) is skipped with the reason. Units are kept exactly as found.
import { normalizeStockUnit } from './fabric-stock-rules.mjs';

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

export const IMPORT_FIELDS = [
  'itemName',
  'fabricCode',
  'colour',
  'dyeColour',
  'quantity',
  'unit',
  'supplierName',
  'billNo',
  'billDate',
  'remarks',
];

/** What each field is called in the sheet, for messages. */
export const FIELD_LABELS = {
  itemName: 'Fabric name',
  fabricCode: 'Fabric code',
  colour: 'Colour',
  dyeColour: 'Dyeing colour',
  quantity: 'Quantity',
  unit: 'Unit',
  supplierName: 'Supplier',
  billNo: 'Challan / bill no.',
  billDate: 'Challan / bill date',
  remarks: 'Remarks',
};

// ---------------------------------------------------------------------------
// File type
// ---------------------------------------------------------------------------

const startsWith = (bytes, signature) => signature.every((b, i) => bytes[i] === b);

/**
 * The kind of an uploaded file, from its first bytes (the extension must agree): .xlsx and .xls
 * workbooks. Returns null for anything else.
 */
export function sniffImportFile(bytes, fileName) {
  const ext = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
  if (!bytes || bytes.length < 8) return null;
  // A password-protected .xlsx is stored as an OLE file; it is accepted here so the reader can say why it cannot open it.
  const ole = startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if ((startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || ole) && ext === 'xlsx') {
    return { source: 'EXCEL', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
  if (ole && ext === 'xls') {
    return { source: 'EXCEL', mimeType: 'application/vnd.ms-excel' };
  }
  return null;
}

/** A file name safe to store and to send back in Content-Disposition. */
export function safeFileName(name) {
  const clean = String(name || 'stock-sheet')
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ()]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-120);
  return clean || 'stock-sheet';
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || /^(-+|—|n\/?a|nil|null|none|\?+)$/i.test(text)) return null;
  return text;
}

/**
 * A quantity as written: "1,250.5", "120 mtr", "45 pcs". Returns the number (null if it is not a clear
 * positive number) and the unit written next to it, if any. Indian digit grouping ("1,25,000") is fine.
 */
export function parseQuantity(value) {
  if (typeof value === 'number') {
    return { value: Number.isFinite(value) && value > 0 ? value : null, unit: null, raw: String(value) };
  }
  const raw = cleanText(value);
  if (!raw) return { value: null, unit: null, raw: null };
  const match = raw.match(/^([0-9][0-9,]*(?:\.[0-9]+)?|\.[0-9]+)\s*([a-zA-Z.]*)$/);
  if (!match) return { value: null, unit: normalizeStockUnit(raw.replace(/[^a-zA-Z]/g, '')), raw };
  const number = Number(match[1].replace(/,/g, ''));
  const unit = match[2] ? normalizeStockUnit(match[2]) : null;
  // Letters after the digits that are not a unit ("12O", "5 yards") make the whole reading doubtful.
  if (match[2] && !unit) return { value: null, unit: null, raw };
  return { value: Number.isFinite(number) && number > 0 ? number : null, unit, raw };
}

const pad = (n) => String(n).padStart(2, '0');

function isoDate(year, month, day) {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 2000 || year > 2100) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A date as YYYY-MM-DD, or null when it is not a real date. Numbers written with separators are read
 * day first (Indian challans): 05/10/2026 is 5 October. Excel dates arrive as Date objects.
 */
export function parseSheetDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // SheetJS builds dates in local time; read them back the same way.
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = text.match(/^(\d{1,2})[\s\-./]*([a-zA-Z]{3,9})[\s\-.,/]*(\d{2}|\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (month >= 0) return isoDate(Number(m[3]), month + 1, Number(m[1]));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Excel columns
// ---------------------------------------------------------------------------

// Checked in order; the first field whose pattern matches a heading takes that column.
const HEADER_PATTERNS = [
  ['dyeColour', /(dye|dyeing|req(uired)?|to\s*be)\s*(colou?r|shade)|colou?r\s*(to\s*dye|required|req)/],
  ['fabricCode', /(fabric|item|quality|article|design)\s*(code|no|number|#)|^(code|art(icle)?\s*no|quality\s*no)$/],
  ['billNo', /(challan|chalan|bill|invoice|inv|dc|lr|gr)\s*(no|number|#)|^(challan|chalan|bill|invoice)$/],
  ['billDate', /(challan|chalan|bill|invoice|inv|dc)\s*date|^date$|^dated$/],
  ['supplierName', /supplier|party|mill|vendor|seller|^from$|received\s*from|weaver/],
  ['colour', /^(colou?r|shade|clr)(\s*name)?$|colou?r|shade/],
  ['unit', /^(unit|uom|units|measure(ment)?|u\/m)$/],
  ['quantity', /qty|quantity|meters?|metres?|mtrs?|pcs|pieces|^nos?$|^total$/],
  ['itemName', /fabric|item|quality|description|particulars?|material|cloth|product|name/],
  ['remarks', /remark|note|comment|lot|bale|roll/],
];

const normalHeading = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[_.:()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Maps column index to field for one header row. A field takes only its first matching column. */
export function mapHeaderRow(cells) {
  const columns = {};
  const taken = new Set();
  const unitHints = {};
  cells.forEach((cell, index) => {
    const heading = normalHeading(cell);
    if (!heading || heading.length > 60) return;
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (taken.has(field) || !pattern.test(heading)) continue;
      columns[index] = field;
      taken.add(field);
      // "Qty (Mtr)" / "Meters" / "Pcs" name the unit of that column.
      if (field === 'quantity') {
        if (/met(er|re)s?|mtrs?|\bm\b/.test(heading)) unitHints[index] = 'MTR';
        else if (/pcs|pieces?|nos?\b/.test(heading)) unitHints[index] = 'PCS';
      }
      return;
    }
  });
  return { columns, fields: taken, unitHints };
}

/**
 * The header row of a sheet: the first row (of the first 20) naming a fabric column and a quantity
 * column. Returns null when there is none.
 */
export function findHeaderRow(matrix) {
  let best = null;
  for (let r = 0; r < Math.min(matrix.length, 20); r++) {
    const mapped = mapHeaderRow(matrix[r] || []);
    if (!mapped.fields.has('itemName') || !mapped.fields.has('quantity')) continue;
    if (!best || mapped.fields.size > best.mapped.fields.size) best = { row: r, mapped };
  }
  return best;
}

/** Copies the value of each merged area into every cell it covers (SheetJS keeps it top-left only). */
export function expandMerges(matrix, merges = []) {
  for (const merge of merges) {
    const value = matrix[merge.s.r]?.[merge.s.c];
    if (value === undefined || value === null || value === '') continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      matrix[r] = matrix[r] || [];
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        if (matrix[r][c] === undefined || matrix[r][c] === null || matrix[r][c] === '') matrix[r][c] = value;
      }
    }
  }
  return matrix;
}

const LINE_FIELDS = ['itemName', 'fabricCode', 'colour', 'dyeColour', 'quantity'];
const TOTAL_ROW = /^(grand\s*)?(sub\s*)?total\b|^g\.?\s*total/i;

/**
 * Reads the stock rows of one sheet (a matrix of cell values, merges already expanded). Returns the rows
 * with the problems found, or an `error` when the sheet has no usable header row.
 */
export function rowsFromSheet(matrix, sheetName) {
  const header = findHeaderRow(matrix);
  if (!header) return { rows: [], notes: [], error: 'no-header' };
  const { columns, unitHints } = header.mapped;
  const rows = [];
  const notes = [];
  for (let r = header.row + 1; r < matrix.length; r++) {
    if (rows.length >= MAX_IMPORT_ROWS) {
      notes.push(`${sheetName}: only the first ${MAX_IMPORT_ROWS} rows were read; split the sheet to add the rest.`);
      break;
    }
    const cells = matrix[r] || [];
    const raw = {};
    let quantityColumn = null;
    for (const [index, field] of Object.entries(columns)) {
      raw[field] = cells[Number(index)];
      if (field === 'quantity') quantityColumn = Number(index);
    }
    const name = cleanText(raw.itemName);
    if ((name && TOTAL_ROW.test(name)) || (!name && cells.some((c) => TOTAL_ROW.test(String(c ?? '').trim())))) {
      notes.push(`${sheetName} row ${r + 1}: total row left out.`);
      continue;
    }
    // A stock line names a fabric or a quantity; rows holding only merged challan/supplier cells are not lines.
    const lineValues = LINE_FIELDS.map((f) => raw[f]).filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    if (lineValues.length === 0) continue;
    const qty = parseQuantity(raw.quantity);
    const unitFromColumn = raw.unit !== undefined ? normalizeStockUnit(cleanText(raw.unit) || '') : null;
    const unit = unitFromColumn || qty.unit || (quantityColumn !== null ? unitHints[quantityColumn] : null) || null;
    const rawDate = raw.billDate;
    const billDate = parseSheetDate(rawDate);
    const row = {
      rowNo: rows.length + 1,
      source: `${sheetName} row ${r + 1}`,
      itemName: name,
      fabricCode: cleanText(raw.fabricCode),
      colour: cleanText(raw.colour),
      dyeColour: cleanText(raw.dyeColour),
      quantity: qty.value,
      quantityText: qty.raw,
      unit,
      unitText: cleanText(raw.unit),
      supplierName: cleanText(raw.supplierName),
      billNo: cleanText(raw.billNo),
      billDate,
      billDateText: billDate ? null : cleanText(rawDate instanceof Date ? null : rawDate),
      remarks: cleanText(raw.remarks),
      confidence: {},
    };
    rows.push(row);
  }
  return { rows, notes, error: null, headerRow: header.row + 1, columns: Object.values(columns) };
}

// ---------------------------------------------------------------------------
// Header shared by the rows
// ---------------------------------------------------------------------------

/** When every row that has a value agrees on it, that value is the sheet's header value. */
export function commonValue(rows, name) {
  const values = new Set(rows.map((row) => row[name]).filter(Boolean).map((v) => String(v)));
  return values.size === 1 ? [...values][0] : null;
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

function toDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fabric code and dyeing colour have no columns of their own on an inward entry; they go in remarks. */
export function inwardRemarks(row) {
  const parts = [];
  if (cleanText(row.fabricCode)) parts.push(`Code: ${cleanText(row.fabricCode)}`);
  if (cleanText(row.dyeColour)) parts.push(`Dye to: ${cleanText(row.dyeColour)}`);
  if (cleanText(row.remarks)) parts.push(cleanText(row.remarks));
  return parts.length ? parts.join(' · ').slice(0, 500) : null;
}

/**
 * Validates the rows a user confirmed. Returns inward lines ready to save, or the errors (all rows are
 * checked; nothing is saved while any row has an error).
 */
export function validateConfirmRows(body) {
  const errors = [];
  const entryType = String(body?.entryType || '').toUpperCase();
  if (!['UNDYED', 'KORA', 'DYED'].includes(entryType)) errors.push('Choose Undyed or Dyed fabric.');
  const receivingDate = toDate(body?.receivingDate);
  if (!receivingDate) errors.push('Receiving date is required.');
  const header = body?.header || {};
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) errors.push('There are no rows to add.');
  if (rows.length > MAX_IMPORT_ROWS) errors.push(`At most ${MAX_IMPORT_ROWS} rows can be added at once.`);

  const lines = [];
  rows.slice(0, MAX_IMPORT_ROWS).forEach((row, index) => {
    const label = `Row ${row?.rowNo ?? index + 1}`;
    const itemName = cleanText(row?.itemName);
    const quantity = typeof row?.quantity === 'number' ? row.quantity : Number(String(row?.quantity ?? '').replace(/,/g, ''));
    const unit = normalizeStockUnit(row?.unit || '');
    const billNo = cleanText(row?.billNo) || cleanText(header.billNo);
    const billDate = toDate(row?.billDate || header.billDate);
    const problems = [];
    if (!itemName) problems.push('fabric name is required');
    if (!Number.isFinite(quantity) || quantity <= 0) problems.push('quantity must be a number greater than zero');
    if (!unit) problems.push('unit must be MTR or PCS');
    if (!billNo) problems.push('challan / bill no. is required');
    if (!billDate) problems.push('challan / bill date is required');
    if (problems.length) {
      errors.push(`${label}: ${problems.join(', ')}.`);
      return;
    }
    lines.push({
      rowNo: row?.rowNo ?? index + 1,
      itemName: itemName.slice(0, 200),
      colour: cleanText(row?.colour)?.slice(0, 100) || null,
      billQty: Math.round(quantity * 1000) / 1000,
      unit,
      billNo: billNo.slice(0, 100),
      billDate,
      supplierName: (cleanText(row?.supplierName) || cleanText(header.supplierName))?.slice(0, 200) || null,
      remarks: inwardRemarks(row || {}),
      allowDuplicate: row?.allowDuplicate === true,
    });
  });
  return { errors, lines, entryType: entryType === 'DYED' ? 'DYED' : 'UNDYED', receivingDate };
}

/** Key used to spot a line that is already in Inward Stock (same bill, fabric, colour, quantity, unit). */
export function inwardDuplicateKey(line) {
  return [line.billNo, line.itemName, line.colour || '', Number(line.billQty), line.unit]
    .map((v) => String(v).trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}
