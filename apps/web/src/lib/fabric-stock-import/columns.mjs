// Import fields, header normalization and column mapping for Excel stock imports. Pure, shared by
// the server, the import wizard and scripts/test-fabric-stock-import.mjs.
//
// A column is mapped automatically only when its header is exactly one of a field's known names
// (after normalizing case, spacing and punctuation). Anything else, and any field claimed by two
// columns, is left for the user to map.

/** @typedef {{ key: string, label: string, required: boolean, aliases: string[], help: string, example: string }} ImportField */

/** @type {ImportField[]} */
export const IMPORT_FIELDS = [
  { key: 'fabricName', label: 'Fabric Name', required: true, example: 'Cotton 60x60 Cambric',
    help: 'Fabric as already named in Fabric Store stock. A name never received before must be accepted as a new fabric before confirming.',
    aliases: ['fabric name', 'fabric', 'item name', 'item', 'material name', 'material', 'fabric description', 'quality', 'quality name'] },
  { key: 'fabricType', label: 'Fabric Type', required: true, example: 'UNDYED',
    help: 'UNDYED (also Kora / Grey / Greige) or DYED.',
    aliases: ['fabric type', 'type', 'stock type', 'entry type', 'dyed undyed', 'kora dyed'] },
  { key: 'colour', label: 'Colour', required: false, example: 'Off White',
    help: 'Current colour of the fabric. Stock is kept per colour.',
    aliases: ['colour', 'color', 'colour name', 'color name', 'fabric colour', 'fabric color'] },
  { key: 'shade', label: 'Shade', required: false, example: 'SH-104',
    help: 'Supplier shade number or code.',
    aliases: ['shade', 'shade no', 'shade number', 'shade code', 'colour code', 'color code'] },
  { key: 'composition', label: 'Composition', required: false, example: '100% Cotton',
    help: 'Fibre content as on the invoice.',
    aliases: ['composition', 'content', 'fibre content', 'fiber content', 'blend'] },
  { key: 'width', label: 'Width', required: false, example: '58 in',
    help: 'Width with its unit, as written by the supplier.',
    aliases: ['width', 'fabric width', 'width inches', 'width inch', 'panna'] },
  { key: 'quantity', label: 'Quantity', required: true, example: '120.5',
    help: 'Received quantity, greater than zero, at most 3 decimal places. Use a dot for decimals.',
    aliases: ['quantity', 'qty', 'received qty', 'received quantity', 'bill qty', 'bill quantity', 'meters', 'metres', 'mtrs', 'pieces', 'pcs'] },
  { key: 'unit', label: 'Unit', required: true, example: 'MTR',
    help: 'MTR (meters) or PCS (pieces). Fabric Store stock is kept in these two units only; they are never converted.',
    aliases: ['unit', 'uom', 'unit of measure', 'unit of measurement', 'units'] },
  { key: 'rollNumber', label: 'Roll Number', required: false, example: 'R-0012',
    help: "Supplier's roll (than) number. One roll per supplier: a roll already in stock is rejected.",
    aliases: ['roll no', 'roll number', 'roll id', 'roll', 'roll code', 'than no', 'than number', 'than'] },
  { key: 'batchNumber', label: 'Batch / Lot', required: false, example: 'LOT-2291',
    help: 'Supplier lot or batch.',
    aliases: ['batch', 'batch no', 'batch number', 'lot', 'lot no', 'lot number'] },
  { key: 'supplierName', label: 'Supplier Name', required: false, example: 'Vardhman Textiles',
    help: 'Required when a roll number is given (rolls are unique per supplier).',
    aliases: ['supplier', 'supplier name', 'vendor', 'vendor name', 'mill', 'mill name', 'party', 'party name'] },
  { key: 'billNo', label: 'Bill / Invoice No', required: true, example: 'INV-90214',
    help: 'Supplier bill or invoice number.',
    aliases: ['bill no', 'bill number', 'invoice no', 'invoice number', 'invoice', 'bill', 'supplier invoice', 'supplier invoice no'] },
  { key: 'billDate', label: 'Bill Date', required: true, example: '20-10-2026',
    help: 'Date on the bill, DD-MM-YYYY (or an Excel date).',
    aliases: ['bill date', 'invoice date', 'date of bill', 'date of invoice'] },
  { key: 'receivedDate', label: 'Received Date', required: true, example: '24-10-2026',
    help: 'Date the fabric arrived in store, DD-MM-YYYY (or an Excel date). Not in the future.',
    aliases: ['received date', 'receiving date', 'receipt date', 'date received', 'inward date', 'grn date'] },
  { key: 'purchaseOrderNumber', label: 'PO Number', required: false, example: 'PO-3312',
    help: 'Purchase order reference, if any.',
    aliases: ['po', 'po no', 'po number', 'purchase order', 'purchase order no', 'purchase order number'] },
  { key: 'unitRate', label: 'Unit Rate', required: false, example: '86.50',
    help: 'Price per unit, zero or more.',
    aliases: ['rate', 'unit rate', 'rate per unit', 'unit price', 'price'] },
  { key: 'storageLocation', label: 'Storage Location', required: false, example: 'RACK-A1',
    help: 'Rack or bin in the Fabric Store, free text.',
    aliases: ['location', 'rack', 'rack no', 'bin', 'storage location', 'store location'] },
  { key: 'remarks', label: 'Remarks', required: false, example: '',
    help: 'Up to 500 characters.',
    aliases: ['remarks', 'remark', 'notes', 'note', 'comments'] },
];

export const FIELD_BY_KEY = Object.freeze(Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f])));
export const REQUIRED_FIELD_KEYS = Object.freeze(IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key));

/** Unicode-normalized, zero-width characters removed, whitespace collapsed. */
export function cleanText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Roll No." -> "roll no"; "Qty (Mtr)" -> "qty"; "Fabric_Type" -> "fabric type". */
export function normalizeHeader(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ALIAS_INDEX = (() => {
  const index = new Map();
  for (const field of IMPORT_FIELDS) {
    // The field's own label is always recognized (the generated template uses it).
    for (const alias of [field.label, ...field.aliases]) {
      const key = normalizeHeader(alias);
      if (!index.has(key)) index.set(key, []);
      if (!index.get(key).includes(field.key)) index.get(key).push(field.key);
    }
  }
  return index;
})();

/** Field keys whose known names equal this header exactly (after normalization). */
export function fieldsForHeader(header) {
  return ALIAS_INDEX.get(normalizeHeader(header)) || [];
}

/**
 * The header row among the first `scanRows` rows: the one naming the most distinct fields,
 * at least two. Returns a 1-based row number or null.
 * @param {Array<{ rowNumber: number, cells: unknown[] }>} rows
 */
export function detectHeaderRow(rows, scanRows = 20) {
  let best = null;
  for (const row of rows.slice(0, scanRows)) {
    const fields = new Set();
    for (const cell of row.cells) {
      if (typeof cell !== 'string') continue;
      for (const key of fieldsForHeader(cell)) fields.add(key);
    }
    if (fields.size >= 2 && (!best || fields.size > best.score)) best = { rowNumber: row.rowNumber, score: fields.size };
  }
  return best ? best.rowNumber : null;
}

/**
 * Suggested mapping for a header row.
 * @param {unknown[]} headers cell values of the header row (index = column)
 * @returns {{
 *   mapping: Record<string, number>,
 *   columns: Array<{ index: number, header: string, field: string | null, reason: string }>,
 *   ambiguities: Array<{ field: string, columns: number[], message: string }>,
 *   missingRequired: string[],
 * }}
 */
export function suggestMapping(headers) {
  const claims = new Map();
  const columns = headers.map((raw, index) => {
    const header = cleanText(raw);
    const fields = header ? fieldsForHeader(header) : [];
    if (fields.length === 1) {
      if (!claims.has(fields[0])) claims.set(fields[0], []);
      claims.get(fields[0]).push(index);
    }
    return {
      index,
      header,
      field: null,
      reason: !header ? 'Empty header' : fields.length === 0 ? 'Not a known field name; map it yourself or leave it unused' : '',
    };
  });

  const mapping = {};
  const ambiguities = [];
  for (const [field, indexes] of claims) {
    if (indexes.length === 1) {
      mapping[field] = indexes[0];
      columns[indexes[0]].field = field;
      columns[indexes[0]].reason = `Header matches "${FIELD_BY_KEY[field].label}" exactly`;
    } else {
      const names = indexes.map((i) => `"${columns[i].header}" (column ${columnLetter(i)})`).join(' and ');
      ambiguities.push({ field, columns: indexes, message: `${names} both look like ${FIELD_BY_KEY[field].label}. Choose one.` });
      for (const i of indexes) columns[i].reason = `Several columns look like ${FIELD_BY_KEY[field].label}`;
    }
  }
  const missingRequired = REQUIRED_FIELD_KEYS.filter((key) => mapping[key] === undefined);
  return { mapping, columns, ambiguities, missingRequired };
}

/**
 * Checks a user-confirmed mapping: known fields, existing columns, no column used twice, every
 * required field mapped.
 * @returns {{ ok: true, mapping: Record<string, number> } | { ok: false, errors: string[] }}
 */
export function validateMapping(mapping, columnCount) {
  const errors = [];
  const clean = {};
  const used = new Map();
  for (const [field, raw] of Object.entries(mapping || {})) {
    if (raw === null || raw === undefined || raw === '') continue;
    if (!FIELD_BY_KEY[field]) {
      errors.push(`Unknown field "${field}".`);
      continue;
    }
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
      errors.push(`${FIELD_BY_KEY[field].label} points to a column that does not exist.`);
      continue;
    }
    if (used.has(index)) {
      errors.push(`Column ${columnLetter(index)} is mapped to both ${FIELD_BY_KEY[used.get(index)].label} and ${FIELD_BY_KEY[field].label}.`);
      continue;
    }
    used.set(index, field);
    clean[field] = index;
  }
  for (const key of REQUIRED_FIELD_KEYS) {
    if (clean[key] === undefined) errors.push(`Map a column to ${FIELD_BY_KEY[key].label} (required).`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, mapping: clean };
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function columnLetter(index) {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
