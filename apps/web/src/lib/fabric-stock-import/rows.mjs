// Row normalization, validation, duplicate detection and totals for Excel stock imports, plus the
// import state machine. Pure: the server supplies the database context (fabrics already in stock,
// rolls and invoices already received), so scripts/test-fabric-stock-import.mjs can run it.
//
// Policy: all or nothing. An import can be confirmed only when no row has an error; warnings must
// be acknowledged. Nothing is rounded, defaulted or guessed: a value that cannot be read exactly
// is an error on that row.

import { FIELD_BY_KEY, IMPORT_FIELDS, cleanText } from './columns.mjs';
import { cleanFabricName, fabricNameKey, normalizeStockUnit } from '../fabric-stock-rules.mjs';

export const ROW_LIMITS = Object.freeze({
  maxQuantity: 100000,
  maxDecimals: 3,
  maxTextLength: 120,
  maxRemarksLength: 500,
  maxUnitRate: 10000000,
});

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export const IMPORT_STATES = Object.freeze([
  'UPLOADED', 'PARSING', 'PARSED', 'VALIDATING', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION',
  'POSTING', 'POSTED', 'FAILED', 'CANCELLED',
]);

const TRANSITIONS = Object.freeze({
  UPLOADED: ['PARSING', 'PARSED', 'FAILED', 'CANCELLED'],
  PARSING: ['PARSED', 'FAILED'],
  PARSED: ['VALIDATING', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION', 'CANCELLED'],
  VALIDATING: ['NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION', 'FAILED'],
  NEEDS_CORRECTION: ['VALIDATING', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION', 'CANCELLED'],
  READY_FOR_CONFIRMATION: ['VALIDATING', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION', 'POSTING', 'CANCELLED'],
  // POSTING only exists inside the posting transaction; a rollback leaves the import as it was.
  POSTING: ['POSTED', 'READY_FOR_CONFIRMATION', 'NEEDS_CORRECTION'],
  POSTED: [],
  FAILED: [],
  CANCELLED: [],
});

/** States in which mapping, corrections and fabric resolutions may still change. */
export const EDITABLE_STATES = Object.freeze(['PARSED', 'NEEDS_CORRECTION', 'READY_FOR_CONFIRMATION']);

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const error = new Error(`An import in state ${from} cannot move to ${to}.`);
    error.code = 'INVALID_TRANSITION';
    throw error;
  }
}

/** State after validation: ready only when there is something to post and nothing is wrong. */
export function stateAfterValidation(summary) {
  return summary.canConfirm ? 'READY_FOR_CONFIRMATION' : 'NEEDS_CORRECTION';
}

// ---------------------------------------------------------------------------
// Cell parsing
// ---------------------------------------------------------------------------

function isEmptyCell(cell) {
  return cell === null || cell === undefined || (typeof cell === 'string' && cleanText(cell) === '');
}

/** Problem with a cell's raw form (formula without saved value, Excel error), or null. */
function cellProblem(cell) {
  if (cell && typeof cell === 'object') {
    if (cell.formulaWithoutResult) return 'is a formula with no saved value; open the file in Excel, let it calculate and save it again';
    if (cell.err) return `contains the Excel error ${cell.err}`;
  }
  return null;
}

function cellAsText(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.d) return cell.d;
  if (typeof cell === 'object') return '';
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  return cleanText(cell);
}

/**
 * Exact quantity or an error. Accepts Excel numbers and text like "1,250.5" or "1,25,000".
 * Rejects negatives, zero, non-numbers, comma decimals and more than 3 decimal places.
 * @returns {{ value: number } | { error: string }}
 */
export function parseQuantity(cell, { allowZero = false, max = ROW_LIMITS.maxQuantity, label = 'Quantity' } = {}) {
  let value;
  if (typeof cell === 'number') {
    value = cell;
  } else {
    const text = cellAsText(cell).replace(/\s/g, '');
    if (!text) return { error: `${label} is required.` };
    if (/^-/.test(text)) return { error: `${label} cannot be negative (${text}).` };
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text) || /^\d+,\d{1,2}$/.test(text)) {
      return { error: `${label} "${text}" uses a comma for decimals; use a dot (e.g. 12.5).` };
    }
    if (!/^(\d+|\d{1,3}(,\d{2,3})+)(\.\d+)?$/.test(text)) return { error: `${label} "${text}" is not a number.` };
    value = Number(text.replace(/,/g, ''));
  }
  if (!Number.isFinite(value)) return { error: `${label} is not a finite number.` };
  if (value < 0) return { error: `${label} cannot be negative (${value}).` };
  if (value === 0 && !allowZero) return { error: `${label} must be greater than zero.` };
  // Excel stores 0.3 as 0.30000000000000004; that is representation noise, not a 4th decimal.
  const scaled = value * 10 ** ROW_LIMITS.maxDecimals;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    return { error: `${label} ${value} has more than ${ROW_LIMITS.maxDecimals} decimal places.` };
  }
  value = Math.round(scaled) / 10 ** ROW_LIMITS.maxDecimals;
  if (value > max) return { error: `${label} ${value} is above the limit of ${max}.` };
  return { value };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Excel serial day number -> YYYY-MM-DD (1900 date system). */
export function excelSerialToIso(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000 || Math.floor(serial) !== serial) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Calendar date as YYYY-MM-DD. Accepts Excel dates, DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY,
 * YYYY-MM-DD and DD-Mon-YYYY. Month-first dates are not accepted.
 * @returns {{ value: string } | { error: string }}
 */
export function parseDate(cell, label) {
  if (cell && typeof cell === 'object' && cell.d) {
    const [y, m, d] = String(cell.d).slice(0, 10).split('-').map(Number);
    const iso = isoDate(y, m, d);
    return iso ? { value: iso } : { error: `${label} is not a valid date.` };
  }
  if (typeof cell === 'number') {
    const iso = excelSerialToIso(cell);
    return iso ? { value: iso } : { error: `${label} ${cell} is not a valid date.` };
  }
  const text = cellAsText(cell);
  if (!text) return { error: `${label} is required.` };
  let m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const iso = isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
    return iso ? { value: iso } : { error: `${label} "${text}" is not a real date (use DD-MM-YYYY).` };
  }
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const iso = isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { value: iso } : { error: `${label} "${text}" is not a real date.` };
  }
  m = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s,]*(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const iso = isoDate(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
    return iso ? { value: iso } : { error: `${label} "${text}" is not a real date.` };
  }
  return { error: `${label} "${text}" is not a date in DD-MM-YYYY form.` };
}

/** @returns {{ value: 'UNDYED' | 'DYED' } | { error: string }} */
export function parseFabricType(cell) {
  const text = cellAsText(cell).toLowerCase();
  if (!text) return { error: 'Fabric Type is required (UNDYED or DYED).' };
  if (['undyed', 'kora', 'grey', 'gray', 'greige', 'raw', 'un dyed', 'un-dyed'].includes(text)) return { value: 'UNDYED' };
  if (['dyed', 'finished', 'dyed fabric'].includes(text)) return { value: 'DYED' };
  return { error: `Fabric Type "${cellAsText(cell)}" must be UNDYED (Kora) or DYED.` };
}

/** @returns {{ value: 'MTR' | 'PCS' } | { error: string }} */
export function parseUnit(cell) {
  const text = cellAsText(cell);
  if (!text) return { error: 'Unit is required (MTR or PCS).' };
  const unit = normalizeStockUnit(text);
  if (unit) return { value: unit };
  return { error: `Unit "${text}" is not supported. Fabric Store stock is kept in MTR or PCS only.` };
}

/** Uppercase comparison key: spacing and punctuation ignored. */
export function identityKey(value) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

/** Database key of a roll: supplier + roll number (roll numbers repeat across suppliers). */
export function rollKeyOf(supplierName, rollNumber) {
  const supplier = identityKey(supplierName);
  const roll = identityKey(rollNumber);
  return supplier && roll ? `${supplier}|${roll}` : null;
}

export function invoiceKeyOf(supplierName, billNo) {
  const bill = identityKey(billNo);
  return bill ? `${identityKey(supplierName)}|${bill}` : null;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const TEXT_FIELDS = ['colour', 'shade', 'composition', 'width', 'rollNumber', 'batchNumber', 'supplierName', 'billNo', 'purchaseOrderNumber', 'storageLocation'];

/**
 * Reads one worksheet row through the mapping, applying user corrections (text per field).
 * @param {{ rowNumber: number, cells: unknown[] }} row
 * @param {Record<string, number>} mapping
 * @param {Record<string, string>} [corrections]
 */
export function normalizeRow(row, mapping, corrections = {}) {
  const raw = {};
  for (const field of IMPORT_FIELDS) {
    if (corrections[field.key] !== undefined) raw[field.key] = corrections[field.key];
    else if (mapping[field.key] !== undefined) raw[field.key] = row.cells[mapping[field.key]] ?? null;
    else raw[field.key] = null;
  }

  const blank = IMPORT_FIELDS.every((f) => isEmptyCell(raw[f.key]));
  const errors = [];
  const values = {};
  const add = (field, message) => errors.push({ field, message });

  for (const field of IMPORT_FIELDS) {
    const problem = cellProblem(raw[field.key]);
    if (problem) add(field.key, `${field.label} ${problem}.`);
  }
  const ok = (key) => !errors.some((e) => e.field === key);

  const fabric = cellAsText(raw.fabricName);
  if (ok('fabricName')) {
    if (!fabric) add('fabricName', 'Fabric Name is required.');
    else if (fabric.length > ROW_LIMITS.maxTextLength) add('fabricName', `Fabric Name is longer than ${ROW_LIMITS.maxTextLength} characters.`);
    else values.fabricName = fabric;
  }
  const take = (key, parsed) => {
    if (!ok(key)) return;
    if ('error' in parsed) add(key, parsed.error);
    else values[key] = parsed.value;
  };
  take('fabricType', parseFabricType(raw.fabricType));
  take('quantity', parseQuantity(raw.quantity));
  take('unit', parseUnit(raw.unit));
  take('billDate', parseDate(raw.billDate, 'Bill Date'));
  take('receivedDate', parseDate(raw.receivedDate, 'Received Date'));
  if (!isEmptyCell(raw.unitRate)) {
    take('unitRate', parseQuantity(raw.unitRate, { allowZero: true, max: ROW_LIMITS.maxUnitRate, label: 'Unit Rate' }));
  }

  for (const key of TEXT_FIELDS) {
    if (!ok(key)) continue;
    const text = cellAsText(raw[key]);
    if (text.length > ROW_LIMITS.maxTextLength) add(key, `${FIELD_BY_KEY[key].label} is longer than ${ROW_LIMITS.maxTextLength} characters.`);
    else values[key] = text || null;
  }
  if (ok('remarks')) {
    const text = cellAsText(raw.remarks);
    if (text.length > ROW_LIMITS.maxRemarksLength) add('remarks', `Remarks are longer than ${ROW_LIMITS.maxRemarksLength} characters.`);
    else values.remarks = text || null;
  }
  if (ok('billNo') && !values.billNo) add('billNo', 'Bill / Invoice No is required.');
  if (values.rollNumber && !values.supplierName && ok('supplierName')) {
    add('supplierName', 'Supplier Name is required when a Roll Number is given (rolls are unique per supplier).');
  }

  return { rowNumber: row.rowNumber, blank, values, errors, warnings: [] };
}

/**
 * Validates normalized rows against each other and against the store.
 * @param {ReturnType<typeof normalizeRow>[]} normalized
 * @param {{
 *   knownFabrics: Map<string, string>,          // fabricNameKey -> name as stocked
 *   existingRollKeys: Set<string>,
 *   existingInvoiceKeys: Set<string>,
 *   postedSameFile?: { receiptNumber: string } | null,
 *   today: string,                              // YYYY-MM-DD, factory time
 * }} context
 * @param {Record<string, { action: 'MAP', target: string } | { action: 'ACCEPT_NEW' }>} [resolutions] keyed by fabricNameKey
 */
export function validateImportRows(normalized, context, resolutions = {}) {
  const fileErrors = [];
  if (context.postedSameFile) {
    fileErrors.push(`This exact file was already posted as receipt ${context.postedSameFile.receiptNumber}. It cannot be posted again.`);
  }

  const rows = normalized.map((row) => ({ ...row, errors: [...row.errors], warnings: [...row.warnings], fabric: null, rollKey: null }));
  const active = rows.filter((r) => !r.blank);

  // Fabric identity: exact match with fabric already in stock, or an explicit user resolution.
  const unresolved = new Map();
  for (const row of active) {
    if (!row.values.fabricName) continue;
    const key = fabricNameKey(row.values.fabricName);
    const known = context.knownFabrics.get(key);
    const resolution = resolutions[key];
    if (known) {
      row.fabric = { key, name: known, isNew: false };
    } else if (resolution?.action === 'MAP' && context.knownFabrics.has(fabricNameKey(resolution.target))) {
      const targetKey = fabricNameKey(resolution.target);
      row.fabric = { key: targetKey, name: context.knownFabrics.get(targetKey), isNew: false, mappedFrom: row.values.fabricName };
    } else if (resolution?.action === 'ACCEPT_NEW') {
      row.fabric = { key, name: cleanFabricName(row.values.fabricName) || row.values.fabricName, isNew: true };
    } else {
      row.errors.push({ field: 'fabricName', message: `"${row.values.fabricName}" has never been received in Fabric Store. Map it to an existing fabric or accept it as a new fabric.` });
      if (!unresolved.has(key)) {
        const candidates = Array.from(context.knownFabrics.entries())
          .filter(([k]) => k && (k.includes(key) || key.includes(k)))
          .map(([, name]) => name)
          .slice(0, 8);
        unresolved.set(key, { key, name: row.values.fabricName, rows: [], candidates });
      }
      unresolved.get(key).rows.push(row.rowNumber);
    }
  }

  // Rolls: one per supplier, in the file and in the store.
  const rollRows = new Map();
  for (const row of active) {
    const key = row.values.rollNumber ? rollKeyOf(row.values.supplierName, row.values.rollNumber) : null;
    row.rollKey = key;
    if (!key) continue;
    if (!rollRows.has(key)) rollRows.set(key, []);
    rollRows.get(key).push(row);
  }
  for (const [key, list] of rollRows) {
    if (list.length > 1) {
      for (const row of list) {
        const others = list.filter((r) => r !== row).map((r) => r.rowNumber).join(', ');
        row.errors.push({ field: 'rollNumber', message: `Roll ${row.values.rollNumber} of ${row.values.supplierName} also appears on row ${others}.` });
      }
    }
    if (context.existingRollKeys.has(key)) {
      for (const row of list) {
        row.errors.push({ field: 'rollNumber', message: `Roll ${row.values.rollNumber} of ${row.values.supplierName} is already in Fabric Store stock. It is not added again or overwritten.` });
      }
    }
  }

  // Invoices and repeated lines: warnings that must be acknowledged.
  const lineSeen = new Map();
  for (const row of active) {
    const invoiceKey = invoiceKeyOf(row.values.supplierName, row.values.billNo);
    if (invoiceKey && context.existingInvoiceKeys.has(invoiceKey)) {
      row.warnings.push({ field: 'billNo', message: `Bill ${row.values.billNo}${row.values.supplierName ? ` of ${row.values.supplierName}` : ''} already has stock received against it. Check this is a further delivery, not the same one.` });
    }
    if (row.errors.length === 0) {
      const signature = JSON.stringify([row.fabric?.key, row.values.colour, row.values.unit, row.values.quantity, row.values.billNo, row.values.rollNumber, row.values.batchNumber]);
      if (lineSeen.has(signature)) {
        row.warnings.push({ field: 'quantity', message: `Same fabric, colour, quantity and bill as row ${lineSeen.get(signature)}. Check it is not entered twice.` });
      } else {
        lineSeen.set(signature, row.rowNumber);
      }
    }
    if (row.values.receivedDate && row.values.receivedDate > context.today) {
      row.errors.push({ field: 'receivedDate', message: `Received Date ${row.values.receivedDate} is in the future.` });
    }
    if (row.values.billDate && row.values.receivedDate && row.values.billDate > row.values.receivedDate) {
      row.warnings.push({ field: 'billDate', message: 'Bill Date is after Received Date.' });
    }
  }

  for (const row of rows) {
    row.status = row.blank ? 'SKIPPED' : row.errors.length ? 'ERROR' : row.warnings.length ? 'WARNING' : 'VALID';
  }
  const summary = summarizeRows(rows, fileErrors);
  return { rows, summary, fileErrors, unresolvedFabrics: Array.from(unresolved.values()) };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** Totals by fabric and by unit over the rows that would be posted; units never mixed. */
export function summarizeRows(rows, fileErrors = []) {
  const counted = rows.filter((r) => r.status !== 'SKIPPED');
  const postable = counted.filter((r) => r.status === 'VALID' || r.status === 'WARNING');
  const byUnit = {};
  const byFabric = new Map();
  for (const row of postable) {
    const { unit, quantity } = row.values;
    byUnit[unit] = round((byUnit[unit] || 0) + quantity);
    const key = [row.fabric.name, row.values.fabricType, row.values.colour || '', unit].join('|');
    const entry = byFabric.get(key) || { fabric: row.fabric.name, fabricType: row.values.fabricType, colour: row.values.colour || null, unit, quantity: 0, rows: 0, isNew: row.fabric.isNew };
    entry.quantity = round(entry.quantity + quantity);
    entry.rows += 1;
    byFabric.set(key, entry);
  }
  const errorRows = counted.filter((r) => r.status === 'ERROR').length;
  const warningRows = counted.filter((r) => r.status === 'WARNING').length;
  const duplicateRows = counted.filter((r) =>
    r.errors.some((e) => e.field === 'rollNumber') || r.warnings.some((w) => w.field === 'billNo' || w.message.startsWith('Same fabric'))).length;
  return {
    totalRows: counted.length,
    skippedRows: rows.length - counted.length,
    validRows: counted.filter((r) => r.status === 'VALID').length,
    warningRows,
    errorRows,
    duplicateRows,
    postableRows: postable.length,
    newRolls: postable.filter((r) => r.rollKey).length,
    rowsWithoutRoll: postable.filter((r) => !r.rollKey).length,
    newFabrics: Array.from(new Set(postable.filter((r) => r.fabric.isNew).map((r) => r.fabric.name))),
    byUnit,
    byFabric: Array.from(byFabric.values()).sort((a, b) => a.fabric.localeCompare(b.fabric) || a.unit.localeCompare(b.unit)),
    fileErrors,
    canConfirm: fileErrors.length === 0 && errorRows === 0 && postable.length > 0,
    requiresWarningAcknowledgement: warningRows > 0,
  };
}

/**
 * Canonical text of exactly what would be posted. The server hashes it; a confirmation must carry
 * the hash the user previewed, so a confirmation never posts rows the user did not see.
 */
export function canonicalPostingPayload(rows) {
  const postable = rows
    .filter((r) => r.status === 'VALID' || r.status === 'WARNING')
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((r) => [
      r.rowNumber, r.fabric.name, r.fabric.isNew, r.values.fabricType, r.values.colour, r.values.shade,
      r.values.composition, r.values.width, r.values.quantity, r.values.unit, r.values.rollNumber,
      r.values.batchNumber, r.values.supplierName, r.values.billNo, r.values.billDate, r.values.receivedDate,
      r.values.purchaseOrderNumber, r.values.unitRate ?? null, r.values.storageLocation, r.values.remarks,
    ]);
  return JSON.stringify(postable);
}
