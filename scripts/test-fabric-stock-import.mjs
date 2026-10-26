// Excel stock import tests that need no database: upload guard, column mapping, row validation,
// state machine, permissions, and the real workbook reader / template / report (exceljs) on
// workbooks built in memory. Database behaviour (posting, idempotency, concurrency, rollback) is
// in scripts/test-fabric-stock-import-db.mjs.
// Run: node --test scripts/test-fabric-stock-import.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as guard from '../apps/web/src/lib/fabric-stock-import/workbook-guard.mjs';
import * as columns from '../apps/web/src/lib/fabric-stock-import/columns.mjs';
import * as rowsLib from '../apps/web/src/lib/fabric-stock-import/rows.mjs';
import * as permissions from '../apps/web/src/lib/fabric-stock-import/permissions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '../apps/web/src');
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const ts = require('typescript');

// Load workbook.ts (TypeScript) as CommonJS with its .mjs imports served from the ESM modules above.
const esm = { 'columns.mjs': columns, 'workbook-guard.mjs': guard };
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  for (const [suffix, mod] of Object.entries(esm)) if (request.endsWith(suffix)) return mod;
  return originalLoad.call(this, request, parent, ...rest);
};
Module._extensions['.ts'] = function (module, filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const workbook = require(path.join(webSrc, 'lib/fabric-stock-import/workbook.ts'));

const HEADERS = ['Fabric Name', 'Fabric Type', 'Colour', 'Quantity', 'Unit', 'Roll No', 'Supplier', 'Bill No', 'Bill Date', 'Received Date'];

async function xlsx(build) {
  const wb = new ExcelJS.Workbook();
  await build(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const CONTEXT = (over = {}) => ({
  knownFabrics: new Map([['cotton cambric', 'Cotton Cambric'], ['rayon', 'Rayon'], ['cotton slub', 'Cotton Slub']]),
  existingRollKeys: new Set(),
  existingInvoiceKeys: new Set(),
  postedSameFile: null,
  today: '2026-10-26',
  ...over,
});

function grid(rows, startRow = 2) {
  return rows.map((cells, i) => ({ rowNumber: startRow + i, cells }));
}
const MAPPING = { fabricName: 0, fabricType: 1, colour: 2, quantity: 3, unit: 4, rollNumber: 5, supplierName: 6, billNo: 7, billDate: 8, receivedDate: 9 };
const line = (fabric, qty, roll, extra = {}) => {
  const r = [fabric, 'UNDYED', 'White', qty, 'MTR', roll, 'Vardhman', 'INV-1', '20-10-2026', '24-10-2026'];
  for (const [k, v] of Object.entries(extra)) r[MAPPING[k]] = v;
  return r;
};
function validate(cells, context = CONTEXT(), resolutions = {}, corrections = {}) {
  const normalized = grid(cells).map((row) => rowsLib.normalizeRow(row, MAPPING, corrections[row.rowNumber] || {}));
  return rowsLib.validateImportRows(normalized, context, resolutions);
}

// ---------------------------------------------------------------------------
// Upload guard
// ---------------------------------------------------------------------------

test('guard: a real .xlsx passes and reports its parts', async () => {
  const bytes = await xlsx((wb) => { wb.addWorksheet('A').addRow(['x']); wb.addWorksheet('B'); });
  const info = guard.inspectWorkbookBytes(bytes);
  assert.equal(info.worksheetParts, 2);
});

test('guard: .xls / encrypted (OLE), HTML, CSV, empty and oversized files are refused', () => {
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
  assert.throws(() => guard.inspectWorkbookBytes(ole), { code: 'XLS_OR_ENCRYPTED' });
  assert.throws(() => guard.inspectWorkbookBytes(Buffer.from('<html><table><tr><td>1</td></tr></table></html>')), { code: 'NOT_XLSX' });
  assert.throws(() => guard.inspectWorkbookBytes(Buffer.from('Fabric,Qty\nRayon,10\n')), { code: 'NOT_XLSX' });
  assert.throws(() => guard.inspectWorkbookBytes(Buffer.alloc(0)), { code: 'EMPTY' });
  assert.throws(() => guard.inspectWorkbookBytes(Buffer.alloc(guard.IMPORT_LIMITS.maxFileBytes + 1, 0x50)), { code: 'TOO_LARGE' });
});

/** A ZIP whose central directory claims one entry with the given sizes and flags. */
function fakeZip(name, compressed, uncompressed, flags = 0) {
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  nameBytes.copy(local, 30);
  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(flags, 8);
  central.writeUInt32LE(compressed, 20);
  central.writeUInt32LE(uncompressed, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  nameBytes.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
}

test('guard: decompression bombs, encrypted entries and damaged ZIPs are refused before parsing', () => {
  assert.throws(() => guard.inspectWorkbookBytes(fakeZip('xl/worksheets/sheet1.xml', 1000, 900 * 1024 * 1024)), { code: 'TOO_COMPLEX' });
  assert.throws(() => guard.inspectWorkbookBytes(fakeZip('xl/worksheets/sheet1.xml', 10, 10, 1)), { code: 'XLS_OR_ENCRYPTED' });
  assert.throws(() => guard.inspectWorkbookBytes(fakeZip('random.txt', 10, 10)), { code: 'NOT_XLSX' });
  const truncated = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);
  assert.throws(() => guard.inspectWorkbookBytes(truncated), { code: 'MALFORMED' });
});

test('guard: too many worksheets is refused', async () => {
  const bytes = await xlsx((wb) => { for (let i = 0; i < 11; i++) wb.addWorksheet(`S${i}`).addRow([i]); });
  assert.throws(() => guard.inspectWorkbookBytes(bytes), { code: 'TOO_MANY_SHEETS' });
});

test('guard: uploaded file names are display-only and stripped of paths and control characters', () => {
  assert.equal(guard.safeFileName('..\\..\\etc/passwd'), 'passwd');
  assert.equal(guard.safeFileName('stock\u0000"<inv>".xlsx'), 'stockinv.xlsx');
  assert.equal(guard.safeFileName(''), 'workbook.xlsx');
});

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

test('headers: case, spacing, punctuation, unit hints and Unicode are normalized', () => {
  assert.equal(columns.normalizeHeader('  ROLL  No. '), 'roll no');
  assert.equal(columns.normalizeHeader('Qty (Mtr)'), 'qty');
  assert.equal(columns.normalizeHeader('Fabric_Type'), 'fabric type');
  assert.equal(columns.normalizeHeader('Ｆａｂｒｉｃ​ Name'), 'fabric name');
  assert.deepEqual(columns.fieldsForHeader('Invoice No'), ['billNo']);
  assert.deepEqual(columns.fieldsForHeader('Fabric Composition Details'), [], 'no vague matches');
});

test('mapping: exact headers map, unknown headers are left for the user, duplicates are ambiguous', () => {
  const s = columns.suggestMapping(['Fabric Name', 'Type', 'Qty', 'UOM', 'Bill No', 'Bill Date', 'Received Date', 'Mystery']);
  assert.deepEqual(s.mapping, { fabricName: 0, fabricType: 1, quantity: 2, unit: 3, billNo: 4, billDate: 5, receivedDate: 6 });
  assert.deepEqual(s.missingRequired, []);
  assert.match(s.columns[7].reason, /Not a known field/);

  const dup = columns.suggestMapping(['Fabric', 'Qty', 'Quantity', 'Unit']);
  assert.equal(dup.mapping.quantity, undefined);
  assert.equal(dup.ambiguities.length, 1);
  assert.match(dup.ambiguities[0].message, /"Qty" \(column B\) and "Quantity" \(column C\)/);
  assert.ok(dup.missingRequired.includes('quantity'));
});

test('mapping: header row is found below title rows; user mappings are checked', () => {
  const sheetRows = grid([['Vardhman delivery 24 Oct'], [], HEADERS, line('Rayon', 5, 'R1')], 1).filter((r) => r.cells.length);
  assert.equal(columns.detectHeaderRow(sheetRows), 3);
  assert.equal(columns.validateMapping({ ...MAPPING }, 10).ok, true);
  const bad = columns.validateMapping({ fabricName: 0, quantity: 0 }, 10);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /mapped to both/.test(e)));
  assert.ok(bad.errors.some((e) => /Unit \(required\)/.test(e)));
  assert.equal(columns.validateMapping({ ...MAPPING, remarks: 99 }, 10).ok, false);
  assert.equal(columns.columnLetter(27), 'AB');
});

// ---------------------------------------------------------------------------
// Cell parsing
// ---------------------------------------------------------------------------

test('quantities: exact values only; nothing is rounded or defaulted', () => {
  assert.deepEqual(rowsLib.parseQuantity(120), { value: 120 });
  assert.deepEqual(rowsLib.parseQuantity('1,25,000'), { error: 'Quantity 125000 is above the limit of 100000.' }, 'Indian grouping is read');
  assert.deepEqual(rowsLib.parseQuantity('12,500.25'), { value: 12500.25 });
  assert.deepEqual(rowsLib.parseQuantity('1,250.5'), { value: 1250.5 });
  assert.deepEqual(rowsLib.parseQuantity(0.1 + 0.2), { value: 0.3 }, 'binary noise is not a 4th decimal');
  for (const bad of [-5, '-5', 0, '0', 'abc', '12.3.4', '1e3', '12,5', '1.234,5', NaN, Infinity, 1.2345, '', null]) {
    assert.ok('error' in rowsLib.parseQuantity(bad), `rejects ${String(bad)}`);
  }
  assert.match(rowsLib.parseQuantity('12,5').error, /comma for decimals/);
  assert.match(rowsLib.parseQuantity(100001).error, /above the limit/);
  assert.deepEqual(rowsLib.parseQuantity('', { allowZero: true, label: 'Unit Rate' }), { error: 'Unit Rate is required.' });
});

test('dates: Excel dates and serials, DD-MM-YYYY, ISO and DD-Mon-YYYY; impossible dates rejected', () => {
  assert.deepEqual(rowsLib.parseDate({ d: '2026-10-24' }, 'D'), { value: '2026-10-24' });
  assert.deepEqual(rowsLib.parseDate(46319, 'D'), { value: '2026-10-24' });
  assert.deepEqual(rowsLib.parseDate('24-10-2026', 'D'), { value: '2026-10-24' });
  assert.deepEqual(rowsLib.parseDate('24/10/2026', 'D'), { value: '2026-10-24' });
  assert.deepEqual(rowsLib.parseDate('2026-10-24', 'D'), { value: '2026-10-24' });
  assert.deepEqual(rowsLib.parseDate('24-Oct-2026', 'D'), { value: '2026-10-24' });
  for (const bad of ['31-02-2026', '10/24/2026', 'yesterday', '', 46319.5]) assert.ok('error' in rowsLib.parseDate(bad, 'D'), `rejects ${bad}`);
});

test('type and unit: Kora is UNDYED; only MTR and PCS are accepted', () => {
  assert.deepEqual(rowsLib.parseFabricType('Kora'), { value: 'UNDYED' });
  assert.deepEqual(rowsLib.parseFabricType('dyed'), { value: 'DYED' });
  assert.ok('error' in rowsLib.parseFabricType('printed'));
  assert.deepEqual(rowsLib.parseUnit('mtrs'), { value: 'MTR' });
  assert.deepEqual(rowsLib.parseUnit('Pieces'), { value: 'PCS' });
  assert.match(rowsLib.parseUnit('KG').error, /MTR or PCS only/);
});

test('rows: formula cells without a saved value and Excel errors are flagged, not guessed', () => {
  const row = rowsLib.normalizeRow({ rowNumber: 5, cells: ['Rayon', 'DYED', null, { formulaWithoutResult: true }, 'MTR', null, null, 'B1', '20-10-2026', { err: '#REF!' }] }, MAPPING);
  assert.ok(row.errors.some((e) => e.field === 'quantity' && /formula with no saved value/.test(e.message)));
  assert.ok(row.errors.some((e) => e.field === 'receivedDate' && /#REF!/.test(e.message)));
});

// ---------------------------------------------------------------------------
// Validation (acceptance scenarios on the rule level)
// ---------------------------------------------------------------------------

test('scenario 1: three valid rolls; totals per fabric and unit', () => {
  const v = validate([line('Cotton Cambric', 120, 'A001'), line('Cotton Cambric', 95, 'A002'), line('Rayon', 80, 'B001')]);
  assert.equal(v.summary.errorRows, 0);
  assert.equal(v.summary.canConfirm, true);
  assert.deepEqual(v.summary.byUnit, { MTR: 295 });
  assert.deepEqual(v.summary.byFabric.map((f) => [f.fabric, f.quantity]), [['Cotton Cambric', 215], ['Rayon', 80]]);
  assert.equal(v.summary.newRolls, 3);
  assert.equal(rowsLib.stateAfterValidation(v.summary), 'READY_FOR_CONFIRMATION');
});

test('scenario 2: a negative quantity blocks the whole import and is never replaced', () => {
  const v = validate([line('Cotton Cambric', 120, 'A001'), line('Cotton Cambric', -95, 'A002'), line('Cotton Cambric', 80, 'A003')]);
  const bad = v.rows.find((r) => r.rowNumber === 3);
  assert.equal(bad.status, 'ERROR');
  assert.match(bad.errors[0].message, /cannot be negative \(-95\)/);
  assert.equal(bad.values.quantity, undefined);
  assert.equal(v.summary.canConfirm, false, 'all or nothing');
  assert.equal(rowsLib.stateAfterValidation(v.summary), 'NEEDS_CORRECTION');
  // Correction for this import only, then valid.
  const fixed = validate([line('Cotton Cambric', 120, 'A001'), line('Cotton Cambric', -95, 'A002'), line('Cotton Cambric', 80, 'A003')], CONTEXT(), {}, { 3: { quantity: '95' } });
  assert.equal(fixed.summary.canConfirm, true);
  assert.deepEqual(fixed.summary.byUnit, { MTR: 295 });
});

test('scenario 3: unknown fabric stays unresolved until mapped or explicitly accepted', () => {
  const cells = [line('Cotton Cambrik', 50, 'X1'), line('Cotton', 10, 'X2')];
  const v = validate(cells);
  assert.equal(v.summary.canConfirm, false);
  assert.deepEqual(v.unresolvedFabrics.map((f) => f.name), ['Cotton Cambrik', 'Cotton']);
  assert.deepEqual(v.unresolvedFabrics[1].candidates.sort(), ['Cotton Cambric', 'Cotton Slub'], 'similar names are only suggestions');
  const mapped = validate(cells, CONTEXT(), {
    'cotton cambrik': { action: 'MAP', target: 'Cotton Cambric' },
    cotton: { action: 'ACCEPT_NEW' },
  });
  assert.equal(mapped.summary.canConfirm, true);
  assert.equal(mapped.rows[0].fabric.name, 'Cotton Cambric');
  assert.equal(mapped.rows[0].fabric.mappedFrom, 'Cotton Cambrik');
  assert.equal(mapped.rows[1].fabric.isNew, true);
  assert.deepEqual(mapped.summary.newFabrics, ['Cotton']);
  // Mapping to a name that is not in stock does not resolve anything.
  assert.equal(validate(cells, CONTEXT(), { 'cotton cambrik': { action: 'MAP', target: 'Silk' } }).rows[0].status, 'ERROR');
});

test('scenario 4: a roll already in stock or repeated in the file is rejected', () => {
  const existing = CONTEXT({ existingRollKeys: new Set([rowsLib.rollKeyOf('Vardhman', 'A001')]) });
  const v = validate([line('Cotton Cambric', 120, 'a-001'), line('Cotton Cambric', 5, 'B7'), line('Cotton Cambric', 6, 'b 7')], existing);
  assert.match(v.rows[0].errors[0].message, /already in Fabric Store stock/);
  assert.match(v.rows[1].errors[0].message, /also appears on row 4/);
  assert.equal(v.summary.canConfirm, false);
  // Same roll number from a different supplier is a different roll.
  const other = validate([line('Cotton Cambric', 120, 'A001', { supplierName: 'Arvind' })], existing);
  assert.equal(other.summary.canConfirm, true);
  // A roll number needs a supplier.
  const noSupplier = validate([line('Cotton Cambric', 1, 'Z1', { supplierName: '' })]);
  assert.match(noSupplier.rows[0].errors[0].message, /Supplier Name is required when a Roll Number/);
});

test('duplicates: a bill already received and repeated lines are warnings needing acknowledgement', () => {
  const ctx = CONTEXT({ existingInvoiceKeys: new Set([rowsLib.invoiceKeyOf('Vardhman', 'INV-1')]) });
  const v = validate([line('Rayon', 10, ''), line('Rayon', 10, '')], ctx);
  assert.equal(v.summary.errorRows, 0);
  assert.equal(v.summary.warningRows, 2);
  assert.ok(v.rows[1].warnings.some((w) => /Same fabric, colour, quantity and bill as row 2/.test(w.message)));
  assert.equal(v.summary.canConfirm, true);
  assert.equal(v.summary.requiresWarningAcknowledgement, true);
});

test('same file already posted is a file-level error', () => {
  const v = validate([line('Rayon', 10, 'R1')], CONTEXT({ postedSameFile: { receiptNumber: 'FSR-2026-0003' } }));
  assert.match(v.fileErrors[0], /FSR-2026-0003/);
  assert.equal(v.summary.canConfirm, false);
});

test('incompatible units are totalled separately, never added together', () => {
  const v = validate([line('Rayon', 100, 'R1'), line('Rayon', 25, 'R2', { unit: 'PCS' })]);
  assert.deepEqual(v.summary.byUnit, { MTR: 100, PCS: 25 });
  assert.equal(v.summary.byFabric.length, 2);
});

test('future received dates are errors; blank rows are skipped, not counted', () => {
  const v = validate([line('Rayon', 1, 'R1', { receivedDate: '27-10-2026' }), [null, '', '   ']]);
  assert.match(v.rows[0].errors[0].message, /in the future/);
  assert.equal(v.rows[1].status, 'SKIPPED');
  assert.equal(v.summary.totalRows, 1);
  assert.equal(v.summary.skippedRows, 1);
});

test('nothing to post means not confirmable', () => {
  const v = validate([[null]]);
  assert.equal(v.summary.canConfirm, false);
});

test('canonical payload changes when any posted value changes', () => {
  const a = rowsLib.canonicalPostingPayload(validate([line('Rayon', 10, 'R1')]).rows);
  const b = rowsLib.canonicalPostingPayload(validate([line('Rayon', 10.5, 'R1')]).rows);
  assert.notEqual(a, b);
  assert.equal(a, rowsLib.canonicalPostingPayload(validate([line('Rayon', 10, 'R1')]).rows));
});

test('state machine: posted, failed and cancelled imports are final', () => {
  assert.equal(rowsLib.canTransition('READY_FOR_CONFIRMATION', 'POSTING'), true);
  assert.equal(rowsLib.canTransition('NEEDS_CORRECTION', 'POSTING'), false);
  assert.equal(rowsLib.canTransition('PARSED', 'POSTED'), false);
  for (const final of ['POSTED', 'FAILED', 'CANCELLED']) {
    for (const to of rowsLib.IMPORT_STATES) assert.equal(rowsLib.canTransition(final, to), false, `${final} -> ${to}`);
  }
  assert.throws(() => rowsLib.assertTransition('POSTED', 'READY_FOR_CONFIRMATION'), { code: 'INVALID_TRANSITION' });
});

test('permissions: only Fabric Store approvers and admins may post or accept new fabrics', () => {
  assert.equal(permissions.canApproveStockInward({ isAdmin: false, roles: ['FABRIC_STORE'] }), true);
  assert.equal(permissions.canApproveStockInward({ isAdmin: false, roles: ['STORE_OPERATOR'] }), false);
  assert.equal(permissions.canApproveStockInward({ isAdmin: false, roles: [] }), false);
  assert.equal(permissions.canApproveStockInward({ isAdmin: true, roles: [] }), true);
});

// ---------------------------------------------------------------------------
// Real workbook reading (exceljs)
// ---------------------------------------------------------------------------

test('reader: multiple sheets, header below a title, blank rows, numbers as text, dates, formulas, images', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const bytes = await xlsx((wb) => {
    wb.addWorksheet('Notes').addRow(['Read me']);
    const ws = wb.addWorksheet('Delivery');
    ws.addRow(['Vardhman delivery']);
    ws.addRow([]);
    ws.addRow(HEADERS);
    ws.addRow(['Rayon', 'DYED', 'Red', '120.5', 'MTR', 'R1', 'Vardhman', 'INV-9', new Date(Date.UTC(2026, 9, 20)), new Date(Date.UTC(2026, 9, 24))]);
    ws.addRow([]);
    ws.addRow(['Rayon', 'DYED', 'Red', { formula: 'D4*2', result: 241 }, 'MTR', 'R2', 'Vardhman', 'INV-9', '20-10-2026', '24-10-2026']);
    ws.addRow(['Rayon', 'DYED', 'Red', { formula: 'D4*3' }, 'MTR', 'R3', 'Vardhman', 'INV-9', '20-10-2026', '24-10-2026']);
    const imageId = wb.addImage({ buffer: png, extension: 'png' });
    ws.addImage(imageId, 'L2:M4');
  });
  guard.inspectWorkbookBytes(bytes);
  const { sheets, images } = await workbook.readWorkbook(bytes);
  assert.deepEqual(sheets.map((s) => s.name), ['Notes', 'Delivery']);
  const delivery = sheets[1];
  assert.equal(delivery.detectedHeaderRow, 3);
  assert.equal(sheets[0].detectedHeaderRow, null);
  assert.deepEqual(delivery.rows.map((r) => r.rowNumber), [1, 3, 4, 6, 7], 'blank rows are not stored');
  const r4 = delivery.rows.find((r) => r.rowNumber === 4).cells;
  assert.equal(r4[3], '120.5');
  assert.deepEqual(r4[8], { d: '2026-10-20' });
  assert.equal(delivery.rows.find((r) => r.rowNumber === 6).cells[3], 241, 'saved formula result is used');
  assert.deepEqual(delivery.rows.find((r) => r.rowNumber === 7).cells[3], { formulaWithoutResult: true });
  assert.equal(images.length, 1);
  assert.equal(images[0].mimeType, 'image/png');
  assert.equal(images[0].sheetName, 'Delivery');

  const header = delivery.rows.find((r) => r.rowNumber === 3);
  const { mapping, missingRequired } = columns.suggestMapping(header.cells);
  assert.deepEqual(missingRequired, []);
  const normalized = delivery.rows.filter((r) => r.rowNumber > 3).map((r) => rowsLib.normalizeRow(r, mapping));
  const v = rowsLib.validateImportRows(normalized, CONTEXT());
  assert.deepEqual(v.rows.map((r) => r.status), ['VALID', 'VALID', 'ERROR']);
  assert.deepEqual(v.summary.byUnit, { MTR: 361.5 });
});

test('reader: an empty workbook, too many rows and data past the column limit are refused', async () => {
  const many = await xlsx((wb) => { const ws = wb.addWorksheet('S'); for (let i = 0; i < guard.IMPORT_LIMITS.maxRowsPerSheet + 2; i++) ws.addRow([i]); });
  await assert.rejects(() => workbook.readWorkbook(many), { code: 'TOO_MANY_ROWS' });
  const wide = await xlsx((wb) => { wb.addWorksheet('S').getCell(1, guard.IMPORT_LIMITS.maxColumns + 1).value = 'x'; });
  await assert.rejects(() => workbook.readWorkbook(wide), { code: 'TOO_MANY_COLUMNS' });
  const empty = await xlsx((wb) => { wb.addWorksheet('S'); });
  const { sheets } = await workbook.readWorkbook(empty);
  assert.equal(sheets[0].rowCount, 0);
});

test('reader: a damaged workbook body is refused with a readable message', async () => {
  const bytes = await xlsx((wb) => { wb.addWorksheet('S').addRow(['x']); });
  const damaged = Buffer.from(bytes);
  damaged.fill(0x41, 200, 600); // corrupt compressed data, keep the directory
  await assert.rejects(() => workbook.readWorkbook(damaged), (err) => err.code === 'MALFORMED' || err.code === 'TIMEOUT');
});

test('template: generated from the import fields and maps itself completely', async () => {
  const bytes = await workbook.buildTemplate(['Cotton Cambric', 'Rayon']);
  guard.inspectWorkbookBytes(bytes);
  const { sheets } = await workbook.readWorkbook(bytes);
  assert.deepEqual(sheets.map((s) => s.name), ['Instructions', 'Fabric Stock Inward', 'Field Reference', 'Fabrics in Stock']);
  const inward = sheets[1];
  assert.equal(inward.detectedHeaderRow, 1);
  const header = inward.rows[0].cells.map((c) => String(c).replace(/ \*$/, ''));
  const suggestion = columns.suggestMapping(header);
  assert.deepEqual(suggestion.missingRequired, []);
  assert.equal(Object.keys(suggestion.mapping).length, columns.IMPORT_FIELDS.length, 'every column maps to its field');
  assert.deepEqual(sheets[3].rows.slice(1).map((r) => r.cells[0]), ['Cotton Cambric', 'Rayon']);
});

test('report: formula-looking text is neutralized', async () => {
  assert.equal(workbook.spreadsheetSafe('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.equal(workbook.spreadsheetSafe('+91'), "'+91");
  assert.equal(workbook.spreadsheetSafe('Rayon'), 'Rayon');
  const v = validate([line('=cmd|calc', 1, 'R1')]);
  const bytes = await workbook.buildValidationReport({ fileName: 'x.xlsx', receiptNumber: null, status: 'NEEDS_CORRECTION', rows: v.rows, summary: v.summary });
  const { sheets } = await workbook.readWorkbook(bytes);
  const fabricCell = sheets[0].rows[1].cells[2];
  assert.equal(fabricCell, "'=cmd|calc");
});
