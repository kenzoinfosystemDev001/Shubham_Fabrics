// Production fixes tests: manual challan numbers, Fabric Store stock in meters and pieces
// (pure rules plus the real ledger service against an in-memory Prisma stand-in), and the
// Fabric Store -> Dyeing instruction lines, and the Upload Stock Sheet rules (file types, Excel
// columns, quantities, dates, row validation), and finished-garment challans
// (Finishing onward: garment name and image only). Touches no database.
// Run: node --test scripts/test-production-fixes.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as challanNumber from '../apps/web/src/lib/challan-number.mjs';
import * as stock from '../apps/web/src/lib/fabric-stock-rules.mjs';
import * as dyeing from '../apps/web/src/lib/dyeing-instructions.mjs';
import * as stockImport from '../apps/web/src/lib/stock-import-rules.mjs';
import * as finished from '../apps/web/src/lib/finished-garments.mjs';

// ---------------------------------------------------------------------------
// Manual challan numbers
// ---------------------------------------------------------------------------

test('challan number: empty and whitespace-only numbers are rejected', () => {
  for (const raw of [undefined, null, '', '   ', '\t']) {
    const result = challanNumber.validateChallanNumber(raw);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Challan Number is required.');
  }
});

test('challan number: saved exactly as typed apart from surrounding whitespace', () => {
  assert.deepEqual(challanNumber.validateChallanNumber('  st/1042-a '), { ok: true, value: 'st/1042-a' });
  assert.deepEqual(challanNumber.validateChallanNumber('CH 07'), { ok: true, value: 'CH 07' });
  assert.deepEqual(challanNumber.validateChallanNumber(1042), { ok: true, value: '1042' });
});

test('challan number: overlong and unprintable numbers are rejected', () => {
  assert.equal(challanNumber.validateChallanNumber('x'.repeat(65)).ok, false);
  assert.equal(challanNumber.validateChallanNumber('x'.repeat(64)).ok, true);
  assert.equal(challanNumber.validateChallanNumber('CH\n01').ok, false);
});

test('challan number: duplicate detection ignores letter case and padding', () => {
  assert.equal(challanNumber.challanNumberKey(' CH-001 '), challanNumber.challanNumberKey('ch-001'));
  assert.notEqual(challanNumber.challanNumberKey('CH-001'), challanNumber.challanNumberKey('CH-0001'));
  assert.match(challanNumber.duplicateChallanNumberMessage('CH-001'), /CH-001.*already used/);
});

test('challan number set: every number required and all distinct', () => {
  const ok = challanNumber.validateChallanNumberSet([
    { field: 'passChallanNumber', label: 'Embroidery challan number', value: 'E-1' },
    { field: 'rejectChallanNumber', label: 'Defective shelf challan number', value: ' R-1 ' },
  ]);
  assert.deepEqual(ok, { ok: true, values: { passChallanNumber: 'E-1', rejectChallanNumber: 'R-1' } });

  const missing = challanNumber.validateChallanNumberSet([
    { field: 'passChallanNumber', label: 'Embroidery challan number', value: 'E-1' },
    { field: 'reworkChallanNumber', label: 'Rework challan number', value: '' },
  ]);
  assert.deepEqual(missing, { ok: false, field: 'reworkChallanNumber', error: 'Rework challan number is required.' });

  const same = challanNumber.validateChallanNumberSet([
    { field: 'passChallanNumber', label: 'Embroidery challan number', value: 'X-9' },
    { field: 'rejectChallanNumber', label: 'Defective shelf challan number', value: 'x-9' },
  ]);
  assert.equal(same.ok, false);
  assert.equal(same.field, 'rejectChallanNumber');
});

// ---------------------------------------------------------------------------
// Stock rules (pure)
// ---------------------------------------------------------------------------

function bookWith(inwards) {
  const book = stock.createStockBook();
  for (const line of inwards) stock.addInward(book, line);
  return book;
}

test('units: MTR and PCS of the same fabric and colour are separate buckets, never combined', () => {
  const book = bookWith([
    { fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'MTR', quantity: 100 },
    { fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'pcs', quantity: 40 },
  ]);
  assert.equal(book.buckets.size, 2);
  const summary = stock.summarizeBuckets(book.buckets.values());
  assert.equal(summary.availableBalanceMeters, 100);
  assert.equal(summary.availableBalancePcs, 40);

  // 120 meters cannot be satisfied by 100 MTR + 40 PCS.
  const plan = stock.planIssue(book, [{ fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'MTR', quantity: 120 }]);
  assert.equal(plan.ok, false);
  assert.match(plan.errors[0], /120 MTR requested, 100 MTR available/);

  const pcs = stock.planIssue(book, [{ fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'PCS', quantity: 40 }]);
  assert.equal(pcs.ok, true);
  assert.equal(pcs.allocations[0].key, stock.stockKey({ fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'PCS' }));
});

test('unit normalization accepts common spellings and rejects others', () => {
  assert.equal(stock.normalizeStockUnit('mtr'), 'MTR');
  assert.equal(stock.normalizeStockUnit('Meters'), 'MTR');
  assert.equal(stock.normalizeStockUnit('pcs'), 'PCS');
  assert.equal(stock.normalizeStockUnit('Pieces'), 'PCS');
  assert.equal(stock.normalizeStockUnit('KG'), null);
  assert.equal(stock.resolveIssueBucket(bookWith([]), { fabric: 'X', unit: 'KG', quantity: 1 }).ok, false);
});

test('one inward entry with several fabrics and colours keeps each line in its own bucket', () => {
  const book = bookWith([
    { fabric: 'Rayon', type: 'DYED', colour: 'Red', unit: 'MTR', quantity: 50 },
    { fabric: 'Rayon', type: 'DYED', colour: 'Blue', unit: 'MTR', quantity: 30 },
    { fabric: 'Chanderi', type: 'DYED', colour: 'Red', unit: 'PCS', quantity: 12 },
  ]);
  assert.equal(book.buckets.size, 3);
  const red = stock.resolveIssueBucket(book, { fabric: 'Rayon', type: 'DYED', colour: 'red ', unit: 'MTR' });
  assert.equal(red.ok, true);
  assert.equal(stock.bucketBalance(book, red.key), 50);

  const green = stock.resolveIssueBucket(book, { fabric: 'Rayon', type: 'DYED', colour: 'Green', unit: 'MTR' });
  assert.equal(green.ok, false);
  assert.match(green.error, /colour "Green".*Stocked colours: Red, Blue/);

  const blank = stock.resolveIssueBucket(book, { fabric: 'Rayon', type: 'DYED', colour: '', unit: 'MTR' });
  assert.equal(blank.ok, false, 'a blank colour is ambiguous when the fabric is stocked in several colours');
});

test('stock totals are kept per unit: meters and pieces are never added together', () => {
  const totals = stock.unitTotals();
  stock.addToUnitTotals(totals, 'mtr', 30);
  stock.addToUnitTotals(totals, 'Pieces', 10);
  stock.addToUnitTotals(totals, 'MTR', 25.5);
  assert.deepEqual(totals, { MTR: 55.5, PCS: 10 });
  assert.equal(stock.formatUnitTotals(totals), '55.5 MTR · 10 PCS');
  assert.equal(stock.formatUnitTotals(stock.unitTotals()), '0');
  assert.equal(stock.formatUnitTotals({ MTR: 0, PCS: 4 }), '4 PCS', 'a unit with nothing is left out');
  assert.equal(stock.formatUnitTotals(stock.addToUnitTotals(stock.unitTotals(), 'ROLL', 2)), '2 ROLL', 'an unknown unit is never counted as meters or pieces');

  // A challan with Pink 30 MTR, Red 10 PCS, Blue 25 MTR: each line keeps its unit.
  const mixed = stock.lineTotals([{ quantity: 30, uom: 'MTR' }, { quantity: 10, uom: 'PCS' }, { quantity: 25, uom: 'MTR' }]);
  assert.deepEqual([mixed.totals, mixed.single, mixed.label], [{ MTR: 55, PCS: 10 }, null, '55 MTR · 10 PCS']);
  const single = stock.lineTotals([{ quantity: 12, uom: 'PCS' }, { quantity: 8, uom: 'PCS' }]);
  assert.deepEqual(single.single, { quantity: 20, unit: 'PCS' });
  assert.deepEqual(stock.lineTotals([], 'MTR').single, { quantity: 0, unit: 'MTR' });
});

test('stock recorded before colour tracking serves coloured issues of that fabric and unit', () => {
  const book = bookWith([{ fabric: 'Cotton 60x60 Cambric', type: 'UNDYED', colour: null, unit: 'MTR', quantity: 80 }]);
  const resolved = stock.resolveIssueBucket(book, { fabric: 'Cotton 60x60 Cambric', type: 'UNDYED', colour: 'Off White', unit: 'MTR' });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.key, stock.stockKey({ fabric: 'Cotton 60x60 Cambric', type: 'UNDYED', colour: '', unit: 'MTR' }));
  // ...but never the pieces bucket.
  assert.equal(stock.resolveIssueBucket(book, { fabric: 'Cotton 60x60 Cambric', colour: 'Off White', unit: 'PCS' }).ok, false);
});

test('fabric names: exact, cleaned and unambiguous partial matches; ambiguous partial is refused', () => {
  const book = bookWith([
    { fabric: 'Cotton Cambric', type: 'UNDYED', unit: 'MTR', quantity: 10 },
    { fabric: 'Cotton Slub', type: 'UNDYED', unit: 'MTR', quantity: 10 },
  ]);
  assert.equal(stock.resolveIssueBucket(book, { fabric: 'Cotton Cambric — White', unit: 'MTR' }).ok, true);
  const ambiguous = stock.resolveIssueBucket(book, { fabric: 'Cotton', unit: 'MTR' });
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.error, /more than one fabric/);
});

test('several lines drawing on one bucket are summed before the balance check', () => {
  const book = bookWith([{ fabric: 'Georgette', type: 'UNDYED', colour: 'White', unit: 'MTR', quantity: 100 }]);
  const lines = [
    { fabric: 'Georgette', type: 'UNDYED', colour: 'White', unit: 'MTR', quantity: 60 },
    { fabric: 'Georgette', type: 'UNDYED', colour: 'White', unit: 'MTR', quantity: 50 },
  ];
  const plan = stock.planIssue(book, lines);
  assert.equal(plan.ok, false, '60 + 50 exceeds 100 even though each line fits alone');
  assert.equal(plan.movements.size, 1);
  assert.equal([...plan.movements.values()][0], -110);
  assert.equal(stock.planIssue(book, [lines[0], { ...lines[1], quantity: 40 }]).ok, true);
});

test('invalid quantities are refused per line', () => {
  const book = bookWith([{ fabric: 'Silk', unit: 'MTR', quantity: 5 }]);
  const plan = stock.planIssue(book, [{ fabric: 'Silk', unit: 'MTR', quantity: 0 }, { fabric: 'Silk', unit: 'MTR', quantity: 'x' }]);
  assert.equal(plan.ok, false);
  assert.equal(plan.errors.length, 2);
});

test('ledger reconciliation posts only differences, so retries post nothing', () => {
  const desired = new Map([['a|UNDYED||MTR', -40]]);
  const first = stock.planLedgerAdjustments(desired, new Map());
  assert.deepEqual(first, [{ key: 'a|UNDYED||MTR', delta: -40 }]);
  // Same document posted again (retry / double click): nothing new.
  assert.deepEqual(stock.planLedgerAdjustments(desired, new Map([['a|UNDYED||MTR', -40]])), []);
  // Cancellation: desired becomes empty, the issue is reversed exactly once.
  assert.deepEqual(stock.planLedgerAdjustments(new Map(), new Map([['a|UNDYED||MTR', -40]])), [{ key: 'a|UNDYED||MTR', delta: 40 }]);
  assert.deepEqual(stock.planLedgerAdjustments(new Map(), new Map([['a|UNDYED||MTR', 0]])), []);
  // Edit 40 -> 25 and a move to another bucket.
  assert.deepEqual(
    stock.planLedgerAdjustments(new Map([['b|UNDYED||MTR', -25]]), new Map([['a|UNDYED||MTR', -40]])),
    [{ key: 'a|UNDYED||MTR', delta: 40 }, { key: 'b|UNDYED||MTR', delta: -25 }],
  );
  // Floating point noise is not a movement.
  assert.deepEqual(stock.planLedgerAdjustments({ k: -0.1 - 0.2 }, { k: -0.3 }), []);
});

test('balance check refuses only reductions that end below zero', () => {
  const base = new Map([['k', 30], ['j', 0]]);
  const ok = stock.checkDocumentBalances(base, new Map([['k', -30]]), [{ key: 'k', delta: -30 }]);
  assert.deepEqual(ok.violations, []);
  assert.equal(ok.balances.get('k'), 0);
  const bad = stock.checkDocumentBalances(base, new Map([['k', -31]]), [{ key: 'k', delta: -31 }]);
  assert.deepEqual(bad.violations, [{ key: 'k', balance: -1 }]);
  // Giving stock back never violates, even into a short bucket.
  const back = stock.checkDocumentBalances(new Map([['j', -5]]), new Map(), [{ key: 'j', delta: 3 }]);
  assert.deepEqual(back.violations, []);
});

test('legacy outward documents still count and unmatched ones get their own bucket', () => {
  const book = bookWith([{ fabric: 'Linen', type: 'DYED', unit: 'MTR', quantity: 20 }]);
  const matched = stock.addLegacyOutward(book, { fabric: 'Linen', type: 'DYED', colour: 'Beige', unit: 'MTR', quantity: 5 });
  assert.equal(stock.bucketBalance(book, matched), 15);
  const unmatched = stock.addLegacyOutward(book, { fabric: 'Velvet', type: 'DYED', unit: 'PCS', quantity: 3 });
  assert.equal(stock.bucketBalance(book, unmatched), -3);
});

test('challan stock lines keep each item unit and fall back to challan totals', () => {
  const lines = stock.challanStockLines({
    toDepartment: 'DYEING',
    fabricUnit: 'MTR',
    items: [
      { id: 'i1', fabricCode: 'Rayon', colour: 'White', uom: 'MTR', quantity: 10 },
      { id: 'i2', fabricCode: 'Rayon', colour: 'Cream', uom: 'MTR', quantity: 0 },
    ],
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].type, 'UNDYED');
  assert.deepEqual(
    stock.challanStockLines({ toDepartment: 'EMBROIDERY', fabricUnit: 'PCS', fabricOut: 7, items: [], program: { fabricName: 'Silk' } }),
    [{ itemId: null, fabric: 'Silk', type: 'DYED', colour: null, unit: 'PCS', quantity: 7 }],
  );
});

// ---------------------------------------------------------------------------
// Ledger service against an in-memory Prisma stand-in
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '../apps/web/src');
const require = createRequire(import.meta.url);
const ts = require('typescript');

function eq(value, cond) {
  if (cond && typeof cond === 'object' && 'in' in cond) return cond.in.includes(value);
  return value === cond;
}

function createFakeDb() {
  const db = { fabricInward: [], fabricOutward: [], challans: [], ledger: [] };
  let seq = 0;
  const tx = {
    async $executeRawUnsafe() { return 1; },
    fabricInward: {
      findMany: async () => db.fabricInward.map((r) => ({ ...r })),
      findUnique: async ({ where }) => db.fabricInward.find((r) => r.id === where.id) || null,
    },
    fabricOutward: {
      findMany: async () => db.fabricOutward.map((r) => ({ ...r })),
      findUnique: async ({ where }) => db.fabricOutward.find((r) => r.id === where.id) || null,
    },
    challan: {
      // The service filters Fabric Store challans itself; the stand-in returns them all.
      findMany: async () => db.challans.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) })),
      findUnique: async ({ where }) => {
        const c = db.challans.find((row) => row.id === where.id);
        return c ? { ...c, items: c.items.map((i) => ({ ...i })) } : null;
      },
    },
    stockLedgerEntry: {
      findMany: async ({ where }) =>
        db.ledger.filter((row) => Object.entries(where).every(([k, cond]) => eq(row[k], cond))).map((r) => ({ ...r })),
      create: async ({ data }) => {
        if (data.idempotencyKey && db.ledger.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          const error = new Error('Unique constraint failed on idempotencyKey');
          error.code = 'P2002';
          throw error;
        }
        const row = { id: `sle-${++seq}`, createdAt: new Date(2026, 9, 24, 10, 0, seq), ...data };
        db.ledger.push(row);
        return row;
      },
    },
  };
  return { db, tx };
}

const stubs = { '@subham/database': {} };
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  if (request.endsWith('fabric-stock-rules.mjs')) return stock;
  return originalLoad.call(this, request, parent, ...rest);
};
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) {
    const base = path.join(webSrc, request.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  return originalResolve.call(this, request, parent, ...rest);
};
Module._extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const ledger = require(path.join(webSrc, 'lib/fabric-stock-ledger.ts'));
const { syncChallanStock, syncInwardStock, syncManualOutwardStock, loadStockBook, FabricStockError } = ledger;

const ACTOR = 'user-store';
const inward = (id, fields) => ({
  id, entryType: 'UNDYED', itemName: 'Cotton Cambric', colour: 'White', unit: 'MTR', billQty: 100,
  billNo: `B-${id}`, receivingDate: new Date(2026, 9, 1), createdAt: new Date(2026, 9, 1), ...fields,
});
const storeChallan = (id, items, fields = {}) => ({
  id, challanNumber: `ST-${id}`, fromDepartment: 'STORE', toDepartment: 'DYEING', status: 'ISSUED',
  programId: 'prog-1', fabricUnit: items[0]?.uom || 'MTR', issuedDate: new Date(2026, 9, 2), createdAt: new Date(2026, 9, 2),
  program: { fabricName: 'Cotton Cambric' }, items: items.map((it, i) => ({ id: `${id}-i${i}`, ...it })), ...fields,
});

async function balanceOf(tx, key) {
  const { book } = await loadStockBook(tx);
  return stock.bucketBalance(book, key);
}
const WHITE_MTR = stock.stockKey({ fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'MTR' });
const WHITE_PCS = stock.stockKey({ fabric: 'Cotton Cambric', type: 'UNDYED', colour: 'White', unit: 'PCS' });

test('ledger: an issue deducts the matching bucket once, however often it is synced', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'), inward('in2', { unit: 'PCS', billQty: 30 }));
  await syncInwardStock(tx, 'in1', ACTOR);
  await syncInwardStock(tx, 'in2', ACTOR);
  db.challans.push(storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 40 }]));

  await syncChallanStock(tx, 'c1', ACTOR);
  await syncChallanStock(tx, 'c1', ACTOR); // retry
  await syncChallanStock(tx, 'c1', ACTOR); // double click

  const issues = db.ledger.filter((r) => r.referenceType === 'CHALLAN');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].entryType, 'ISSUE');
  assert.equal(issues[0].quantity, -40);
  assert.equal(issues[0].uom, 'MTR');
  assert.equal(issues[0].balanceAfter, 60);
  assert.equal(await balanceOf(tx, WHITE_MTR), 60);
  assert.equal(await balanceOf(tx, WHITE_PCS), 30, 'pieces untouched by a meters issue');
});

test('ledger: insufficient stock is refused and nothing is posted', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1', { billQty: 25 }));
  db.challans.push(storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 26 }]));
  await assert.rejects(() => syncChallanStock(tx, 'c1', ACTOR), (err) => {
    assert.ok(err instanceof FabricStockError);
    assert.match(err.details.join(' '), /26 MTR requested, 25 MTR available/);
    return true;
  });
  assert.equal(db.ledger.filter((r) => r.referenceType === 'CHALLAN').length, 0);
});

test('ledger: cancelling returns stock once; reinstating re-issues it once', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'));
  const challan = storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 40 }]);
  db.challans.push(challan);
  await syncChallanStock(tx, 'c1', ACTOR);

  challan.status = 'CANCELLED';
  await syncChallanStock(tx, 'c1', ACTOR);
  await syncChallanStock(tx, 'c1', ACTOR);
  assert.equal(await balanceOf(tx, WHITE_MTR), 100);
  const rows = db.ledger.filter((r) => r.referenceType === 'CHALLAN');
  assert.deepEqual(rows.map((r) => [r.entryType, r.quantity]), [['ISSUE', -40], ['ADJUSTMENT', 40]]);
  assert.equal(new Set(rows.map((r) => r.idempotencyKey)).size, rows.length);

  challan.status = 'ISSUED';
  await syncChallanStock(tx, 'c1', ACTOR);
  assert.equal(await balanceOf(tx, WHITE_MTR), 60);
});

test('ledger: deleting a challan gives its stock back', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'));
  db.challans.push(storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 40 }]));
  await syncChallanStock(tx, 'c1', ACTOR);
  await syncChallanStock(tx, 'c1', ACTOR, { removed: true });
  db.challans.length = 0;
  assert.equal(await balanceOf(tx, WHITE_MTR), 100);
});

test('ledger: two issues cannot spend the same balance', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1', { billQty: 50 }));
  db.challans.push(storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 30 }]));
  await syncChallanStock(tx, 'c1', ACTOR);
  db.challans.push(storeChallan('c2', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 30 }]));
  await assert.rejects(() => syncChallanStock(tx, 'c2', ACTOR), FabricStockError);
  db.challans.pop(); // the route creates the challan in the same transaction, so it is rolled back
  assert.equal(await balanceOf(tx, WHITE_MTR), 20);
});

test('ledger: an inward edit below what was already issued is refused; a valid edit posts the delta', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'));
  await syncInwardStock(tx, 'in1', ACTOR);
  db.challans.push(storeChallan('c1', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 70 }]));
  await syncChallanStock(tx, 'c1', ACTOR);

  db.fabricInward[0].billQty = 60;
  await assert.rejects(() => syncInwardStock(tx, 'in1', ACTOR), FabricStockError);

  db.fabricInward[0].billQty = 90;
  await syncInwardStock(tx, 'in1', ACTOR);
  const receipts = db.ledger.filter((r) => r.referenceType === 'FABRIC_INWARD');
  assert.deepEqual(receipts.map((r) => [r.entryType, r.quantity]), [['RECEIPT', 100], ['ADJUSTMENT', -10]]);
  assert.equal(await balanceOf(tx, WHITE_MTR), 20);
});

test('ledger: challans recorded before the ledger still reduce stock and are not double counted', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'));
  // Legacy challan: no ledger rows.
  db.challans.push(storeChallan('old', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 30 }]));
  assert.equal(await balanceOf(tx, WHITE_MTR), 70);
  db.challans.push(storeChallan('new', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 70 }]));
  await syncChallanStock(tx, 'new', ACTOR);
  assert.equal(await balanceOf(tx, WHITE_MTR), 0);
  db.challans.push(storeChallan('more', [{ fabricCode: 'Cotton Cambric', colour: 'White', uom: 'MTR', quantity: 1 }]));
  await assert.rejects(() => syncChallanStock(tx, 'more', ACTOR), FabricStockError);
});

test('ledger: challans that do not leave the Fabric Store are ignored', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1'));
  db.challans.push(storeChallan('ret', [{ fabricCode: 'Cotton Cambric', uom: 'PCS', quantity: 5 }], { fromDepartment: 'THREAD_CUTTING', toDepartment: 'STORE' }));
  assert.deepEqual(await syncChallanStock(tx, 'ret', ACTOR), []);
  assert.equal(db.ledger.length, 0);
});

test('ledger: manual outward deducts by colour and unit; challan mirrors post nothing', async () => {
  const { db, tx } = createFakeDb();
  db.fabricInward.push(inward('in1', { entryType: 'DYED', colour: 'Red', unit: 'PCS', billQty: 10 }));
  db.fabricOutward.push({ id: 'o1', itemName: 'Cotton Cambric', fabricType: 'DYED', colour: 'Red', unit: 'PCS', issueQty: 4, challanId: null, challanNumber: null, date: new Date() });
  await syncManualOutwardStock(tx, 'o1', ACTOR);
  const key = stock.stockKey({ fabric: 'Cotton Cambric', type: 'DYED', colour: 'Red', unit: 'PCS' });
  assert.equal(await balanceOf(tx, key), 6);
  db.fabricOutward.push({ id: 'o2', itemName: 'Cotton Cambric', fabricType: 'DYED', colour: 'Red', unit: 'PCS', issueQty: 4, challanId: 'c9', challanNumber: null, date: new Date() });
  assert.deepEqual(await syncManualOutwardStock(tx, 'o2', ACTOR), []);
  assert.equal(await balanceOf(tx, key), 6);
});

// ---------------------------------------------------------------------------
// Fabric Store -> Dyeing instruction lines
// ---------------------------------------------------------------------------

const storeToDyeing = {
  id: 'ch-1',
  challanNumber: 'FS/2231',
  fabricUnit: 'MTR',
  program: { id: 'prog-1', programNumber: 'PRG-2026-0007', programSerialNo: 'SR-114', fabricName: 'Rayon', fabricType: 'Woven' },
  items: [
    { id: 'it-1', fabricCode: 'Rayon', colour: 'White', shade: 'Natural', requiredColour: 'Bottle Green', requiredQuantity: 40, quantity: 42, uom: 'MTR' },
    { id: 'it-2', fabricCode: 'Rayon', colour: 'White', shade: null, requiredColour: 'Maroon', requiredQuantity: null, quantity: 18, uom: 'MTR' },
    { id: 'it-3', fabricCode: 'Rayon', colour: 'White', shade: null, requiredColour: 'bottle green', quantity: 10, uom: 'MTR' },
  ],
};

test('dyeing lines: every challan line keeps its own colours, quantity, unit and references', () => {
  const lines = dyeing.mapChallanItemsToDyeingLines(storeToDyeing);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], {
    itemId: 'it-1', lineNo: 1, fabric: 'Rayon', fabricType: 'Woven',
    currentColour: 'White', currentShade: 'Natural', requiredColour: 'Bottle Green',
    quantity: 42, unit: 'MTR', requiredQuantity: 40,
    challanId: 'ch-1', challanNumber: 'FS/2231', programId: 'prog-1', programRef: 'SR-114',
  });
  assert.equal(lines[1].requiredColour, 'Maroon');
  assert.equal(lines[1].requiredQuantity, null);
  assert.deepEqual(dyeing.dyeingLineTotals(lines), { MTR: 70 });
});

test('dyeing lines: target colour summarizes distinct required colours instead of keeping only the first', () => {
  const lines = dyeing.mapChallanItemsToDyeingLines(storeToDyeing);
  assert.deepEqual(dyeing.requiredColours(lines), ['Bottle Green', 'Maroon']);
  assert.equal(dyeing.summarizeTargetColour(lines, 'White'), 'Bottle Green / Maroon');
});

test('dyeing lines: old records never get an invented required colour', () => {
  const legacy = {
    challanNumber: 'CH-STR-2026-00012',
    items: [{ id: 'old-1', fabricCode: 'Cotton', colour: 'White', shade: 'Navy', quantity: 25, uom: 'MTR' }],
    program: { fabricName: 'Cotton', fabricColor: 'Navy' },
  };
  const lines = dyeing.mapChallanItemsToDyeingLines(legacy);
  assert.equal(lines[0].requiredColour, null, 'the old shade column is not promoted to a required colour');
  assert.equal(lines[0].currentShade, 'Navy');
  assert.equal(dyeing.summarizeTargetColour(lines, 'White'), 'White', 'order keeps its previous target colour');
  assert.deepEqual(dyeing.mapChallanItemsToDyeingLines(null), []);
});

test('dyeing lines: mixed units stay separate in the totals', () => {
  const lines = dyeing.mapChallanItemsToDyeingLines({
    items: [
      { fabricCode: 'Rayon', requiredColour: 'Red', quantity: 10, uom: 'MTR' },
      { fabricCode: 'Rayon dupatta', requiredColour: 'Red', quantity: 6, uom: 'PCS' },
    ],
  });
  assert.deepEqual(dyeing.dyeingLineTotals(lines), { MTR: 10, PCS: 6 });
});

test('issue form fields: current colour and required dyeing colour are stored apart', () => {
  assert.deepEqual(
    dyeing.storeDyeingItemFields({ color: ' White ', requiredDyeColor: 'Mustard', requiredDyeQuantity: '35' }),
    { colour: 'White', shade: null, requiredColour: 'Mustard', requiredQuantity: 35 },
  );
  assert.deepEqual(
    dyeing.storeDyeingItemFields({ colour: 'Kora', shade: 'Greige', requiredDyeColor: '', requiredDyeQuantity: '' }),
    { colour: 'Kora', shade: 'Greige', requiredColour: null, requiredQuantity: null },
  );
});

// ---------------------------------------------------------------------------
// Production Sheets: every sheet of a production, however many it has
// ---------------------------------------------------------------------------

const sheets = require(path.join(webSrc, 'lib/download-production-sheet.ts'));

const component = (category, enabled, forwarded, styleName = category) => ({
  enabled,
  forwarded,
  category,
  styleName,
  fabricName: 'Rayon',
  fabricWidth: '44"',
  subStyles: [{ name: 'A', average: 1.2 }],
  productionGrid: [{ color: 'Red', pcs: 10, mtr: 12 }],
});
const programWith = (components, forwardedComponents) => ({
  programSerialNo: 'SR-9',
  designNumber: 'D-9',
  metadataJson: JSON.stringify({ components, ...(forwardedComponents ? { forwardedComponents } : {}) }),
});

test('production sheets: a production with no component data is its single TOP sheet', () => {
  assert.deepEqual(sheets.productionSheetCategories({ programSerialNo: 'SR-1' }), ['TOP']);
  assert.deepEqual(sheets.productionSheetCategories({ metadataJson: '{not json' }), ['TOP']);
});

test('production sheets: all forwarded sheets, in order, any number, custom styles included', () => {
  const three = programWith(
    { TOP: component('TOP', true, true), BOTTOM: component('BOTTOM', true, true), DUPATTA: component('DUPATTA', true, true) },
    ['TOP', 'BOTTOM', 'DUPATTA'],
  );
  assert.deepEqual(sheets.productionSheetCategories(three), ['TOP', 'BOTTOM', 'DUPATTA']);
  const custom = programWith(
    { TOP: component('TOP', true, true), KAFTAN: component('KAFTAN', true, true, 'Kaftan'), BOTTOM: component('BOTTOM', false, false) },
    ['TOP', 'KAFTAN'],
  );
  assert.deepEqual(sheets.productionSheetCategories(custom), ['TOP', 'KAFTAN'], 'disabled sheets are not part of the production');
  const noTop = programWith({ TOP: component('TOP', false, false), DUPATTA: component('DUPATTA', true, true) }, ['DUPATTA']);
  assert.deepEqual(sheets.productionSheetCategories(noTop), ['DUPATTA'], 'a production without a TOP sheet');
});

test('production sheets: unforwarded drafts only for Programming / Admin; older records use their flags', () => {
  const p = programWith({ TOP: component('TOP', true, true), BOTTOM: component('BOTTOM', true, false) }, ['TOP']);
  assert.deepEqual(sheets.productionSheetCategories(p), ['TOP']);
  assert.deepEqual(sheets.productionSheetCategories(p, { withUnforwarded: true }), ['TOP', 'BOTTOM']);
  const noList = programWith({ TOP: component('TOP', true, true), BOTTOM: component('BOTTOM', true, true) });
  assert.deepEqual(sheets.productionSheetCategories(noList), ['TOP', 'BOTTOM']);
});

test('production sheets: print / download without a category carries every sheet of the production', () => {
  const p = programWith(
    { TOP: component('TOP', true, true), BOTTOM: component('BOTTOM', true, true), DUPATTA: component('DUPATTA', true, true), KAFTAN: component('KAFTAN', true, true, 'Kaftan') },
    ['TOP', 'BOTTOM', 'DUPATTA', 'KAFTAN'],
  );
  const html = sheets.generateProductionSheetHtml(p);
  const titles = Array.from(html.matchAll(/<div class="header-title">PRODUCTION SHEET &mdash; ([^<]+)<\/div>/g), (m) => m[1]);
  assert.deepEqual(titles, ['TOP', 'BOTTOM', 'DUPATTA', 'Kaftan']);
  assert.match(html, /All Production Sheets/);
  const one = sheets.generateProductionSheetHtml(p, 'BOTTOM');
  assert.deepEqual(Array.from(one.matchAll(/<div class="header-title">PRODUCTION SHEET &mdash; ([^<]+)<\/div>/g), (m) => m[1]), ['BOTTOM'], 'a single sheet can still be chosen');
});

// ---------------------------------------------------------------------------
// Upload Stock Sheet rules (lib/stock-import-rules.mjs)
// ---------------------------------------------------------------------------

const fileHead = (...b) => Uint8Array.from([...b, ...new Array(16).fill(0)]);

test('rules: only real XLSX/XLS files are accepted, and the extension must agree', () => {
  assert.equal(stockImport.sniffImportFile(fileHead(0xff, 0xd8, 0xff, 0xe0), 'a.jpg'), null, 'photos are not imported');
  assert.equal(stockImport.sniffImportFile(fileHead(0x50, 0x4b, 0x03, 0x04), 'stock.xlsx').source, 'EXCEL');
  assert.equal(stockImport.sniffImportFile(fileHead(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), 'old.xls').source, 'EXCEL');
  assert.equal(stockImport.sniffImportFile(fileHead(0x50, 0x4b, 0x03, 0x04), 'evil.png'), null, 'a zip named .png');
  assert.equal(stockImport.sniffImportFile(fileHead(0xff, 0xd8, 0xff), 'photo.xlsx'), null);
  assert.equal(stockImport.sniffImportFile(fileHead(0x25, 0x50, 0x44, 0x46), 'bill.pdf'), null);
  assert.equal(stockImport.sniffImportFile(new TextEncoder().encode('fabric,qty\nx,1\n'), 'sheet.xlsx'), null);
  assert.equal(stockImport.sniffImportFile(new Uint8Array(3), 'a.jpg'), null);
  assert.equal(stockImport.safeFileName('../../etc/pass wd<script>.xlsx'), '.._.._etc_pass wd_script_.xlsx');
});

test('rules: quantities are read exactly; anything unclear stays empty', () => {
  assert.deepEqual(stockImport.parseQuantity('1,250.5'), { value: 1250.5, unit: null, raw: '1,250.5' });
  assert.deepEqual(stockImport.parseQuantity('1,25,000'), { value: 125000, unit: null, raw: '1,25,000' });
  assert.equal(stockImport.parseQuantity('120 mtr').unit, 'MTR');
  assert.equal(stockImport.parseQuantity('120 mtr').value, 120);
  assert.equal(stockImport.parseQuantity('45 Pcs').unit, 'PCS');
  assert.equal(stockImport.parseQuantity(37.25).value, 37.25);
  for (const bad of ['12O', 'abc', '0', '-5', '1.2.3', '', null, '--', '5 yards x', 0, -3, NaN]) {
    assert.equal(stockImport.parseQuantity(bad).value, null, `"${bad}" is not a quantity`);
  }
  assert.equal(stockImport.parseQuantity('5 yards').unit, null, 'only MTR and PCS are units here');
});

test('rules: dates are read day first and must be real', () => {
  assert.equal(stockImport.parseSheetDate('05/10/2026'), '2026-10-05');
  assert.equal(stockImport.parseSheetDate('5-10-26'), '2026-10-05');
  assert.equal(stockImport.parseSheetDate('2026-10-05'), '2026-10-05');
  assert.equal(stockImport.parseSheetDate('5 Oct 2026'), '2026-10-05');
  assert.equal(stockImport.parseSheetDate('05-October-2026'), '2026-10-05');
  assert.equal(stockImport.parseSheetDate(new Date(2026, 9, 5)), '2026-10-05');
  for (const bad of ['31/02/2026', '13/13/2026', 'yesterday', '2026', '', null, '05/10/1890', new Date('x')]) {
    assert.equal(stockImport.parseSheetDate(bad), null, `${bad} is not a date`);
  }
});

const STOCK_SHEET = [
  ['SHUBHAM FABRICS — FABRIC RECEIPT REGISTER', null, null, null, null, null, null],
  [null, null, null, null, null, null, null],
  ['S.No', 'Fabric Name', 'Fabric Code', 'Colour', 'Dyeing Colour', 'Qty (Mtr)', 'Unit', 'Challan No', 'Challan Date', 'Supplier'],
  [1, 'Rayon Slub', 'RS-14', 'Off White', 'Maroon', 120.5, null, 'CH-881', '05/10/2026', 'Vardhman Mills'],
  [2, 'Rayon Slub', 'RS-14', 'Off White', 'Navy', 80, null, null, null, null],
  [3, 'Cotton Cambric', 'CC-60', 'Black', null, '45', 'Pcs', null, null, null],
  [null, null, null, null, null, null, null, null, null, null],
  [4, 'Cotton Cambric', 'CC-60', 'Black', null, 'illegible', 'Pcs', null, null, null],
  [null, 'Total', null, null, null, 245.5, null, null, null, null],
];

test('rules: Excel columns are found under title rows; merged cells fill the rows they cover; totals are left out', () => {
  const matrix = STOCK_SHEET.map((r) => [...r]);
  // Challan No, Challan Date and Supplier are merged down over rows 4-8 (0-based 3-7).
  stockImport.expandMerges(matrix, [7, 8, 9].map((c) => ({ s: { r: 3, c }, e: { r: 7, c } })));
  const read = stockImport.rowsFromSheet(matrix, 'Sheet1');
  assert.equal(read.error, null);
  assert.equal(read.headerRow, 3);
  assert.equal(read.rows.length, 4, 'blank row and total row are not stock rows');
  assert.deepEqual(read.notes, ['Sheet1 row 9: total row left out.']);
  const [a, b, c, d] = read.rows;
  assert.deepEqual(
    [a.itemName, a.fabricCode, a.colour, a.dyeColour, a.quantity, a.unit, a.billNo, a.billDate, a.supplierName, a.source],
    ['Rayon Slub', 'RS-14', 'Off White', 'Maroon', 120.5, 'MTR', 'CH-881', '2026-10-05', 'Vardhman Mills', 'Sheet1 row 4'],
  );
  // Same fabric and colour, different dyeing colour: two separate rows, never merged.
  assert.deepEqual([b.itemName, b.colour, b.dyeColour, b.quantity, b.unit, b.billNo], ['Rayon Slub', 'Off White', 'Navy', 80, 'MTR', 'CH-881']);
  // The Unit column overrides the quantity heading: pieces stay pieces.
  assert.deepEqual([c.quantity, c.unit], [45, 'PCS']);
  assert.deepEqual([d.quantity, d.quantityText, d.unit], [null, 'illegible', 'PCS']);
});

// Layout of the "Daily Stock Inwards Report" sheet the Fabric Store keeps.
const DAILY_INWARDS_SHEET = [
  ['Shubham Fabrics India Pvt. Ltd. Daily Stock Inwards Report For The Month Jul 2026'],
  ['S.No', 'Item Name', 'Bill/Ch. No', 'Bill/Ch. Date', 'Receiving Date', 'Bill/Ch. Qty.', 'Price Per Unit', 'Box/Than Qty', 'HSN Code', 'Tax %', 'Party Name', 'Biller State/Citi', 'Remarks'],
  [1, 'Rayon Slub 14kg', 'B-221', '02/07/2026', '04/07/2026', '1,250.5 mtr', 118.5, 9, 5407, '5%', 'Vardhman Mills', 'Gujarat / Surat', 'Lot 7'],
  [2, 'Lining', 'B-222', '03/07/2026', null, '40 pcs', '₹ 32', null, '6217', 'GST', 'Arvind', 'Ahmedabad', null],
];

test('rules: the Daily Stock Inwards Report columns are all read, bill / ch. headings included', () => {
  const read = stockImport.rowsFromSheet(DAILY_INWARDS_SHEET.map((r) => [...r]), 'Jul');
  assert.equal(read.error, null);
  assert.equal(read.headerRow, 2);
  const [a, b] = read.rows;
  assert.deepEqual(
    [a.itemName, a.billNo, a.billDate, a.receivingDate, a.quantity, a.unit, a.pricePerUnit, a.boxThanQty, a.hsnCode, a.taxPercent, a.supplierName, a.billerStateCity, a.remarks],
    ['Rayon Slub 14kg', 'B-221', '2026-07-02', '2026-07-04', 1250.5, 'MTR', 118.5, 9, 5407, '5%', 'Vardhman Mills', 'Gujarat / Surat', 'Lot 7'],
  );
  const ok = stockImport.validateConfirmRows({ entryType: 'UNDYED', receivingDate: '2026-07-10', header: {}, rows: read.rows });
  assert.deepEqual(ok.errors, []);
  const [la, lb] = ok.lines;
  assert.deepEqual(
    [la.pricePerUnit, la.boxThanQty, la.hsnCode, la.taxPercent, la.billerStateCity, la.receivingDate.toISOString().slice(0, 10), la.remarks],
    [118.5, 9, '5407', 5, 'Gujarat / Surat', '2026-07-04', 'Lot 7'],
  );
  // No receiving date in the row: the upload's date. An unclear tax is kept in remarks, never guessed.
  assert.deepEqual(
    [lb.unit, lb.pricePerUnit, lb.boxThanQty, lb.hsnCode, lb.taxPercent, lb.receivingDate.toISOString().slice(0, 10), lb.remarks],
    ['PCS', 32, null, '6217', null, '2026-07-10', 'Tax %: GST'],
  );
});

test('rules: optional bill details are numbers of zero or more; tax at most 100', () => {
  assert.equal(stockImport.parseOptionalAmount(''), null);
  assert.equal(stockImport.parseOptionalAmount(null), null);
  assert.equal(stockImport.parseOptionalAmount('1,200.50'), 1200.5);
  assert.equal(stockImport.parseOptionalAmount('Rs. 40'), 40);
  assert.equal(stockImport.parseOptionalAmount(0), 0);
  for (const bad of ['abc', '-5', -1, '5 kg', NaN]) assert.ok(Number.isNaN(stockImport.parseOptionalAmount(bad)), `${bad}`);
  const { details, problems } = stockImport.inwardLineDetails({ pricePerUnit: '10', boxThanQty: 'x', taxPercent: 120, hsnCode: ' 5407 ' });
  assert.deepEqual(details, { pricePerUnit: 10, boxThanQty: null, hsnCode: '5407', taxPercent: null });
  assert.deepEqual(problems, ['boxThanQty', 'taxPercent']);
});

test('rules: a sheet with no fabric/quantity headings is refused; a missing unit stays empty', () => {
  assert.equal(stockImport.rowsFromSheet([['Name', 'Phone'], ['A', '1']], 'S').error, 'no-header');
  const read = stockImport.rowsFromSheet([['Item', 'Quantity'], ['Georgette', 10]], 'S');
  assert.deepEqual([read.rows[0].itemName, read.rows[0].quantity, read.rows[0].unit], ['Georgette', 10, null]);
  const pcs = stockImport.rowsFromSheet([['Quality', 'Pieces'], ['Lining', 7]], 'S');
  assert.equal(pcs.rows[0].unit, 'PCS', 'a Pieces column means PCS');
});

test('rules: confirm validation checks every row, keeps units, and puts code and dye colour in remarks', () => {
  const body = {
    entryType: 'dyed',
    receivingDate: '2026-10-26',
    header: { billNo: 'CH-9', billDate: '2026-10-25', supplierName: 'Mill' },
    rows: [
      { rowNo: 1, itemName: ' Rayon ', colour: 'Red', quantity: 10.12345, unit: 'MTR', fabricCode: 'R-1', dyeColour: 'Wine', remarks: 'Lot 4' },
      { rowNo: 2, itemName: 'Rayon', colour: 'Red', quantity: '5', unit: 'pcs', billNo: 'CH-10', supplierName: 'Other' },
    ],
  };
  const ok = stockImport.validateConfirmRows(body);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.entryType, 'DYED');
  assert.deepEqual(
    ok.lines.map((l) => [l.itemName, l.billQty, l.unit, l.billNo, l.supplierName, l.remarks, l.billDate.toISOString().slice(0, 10)]),
    [
      ['Rayon', 10.123, 'MTR', 'CH-9', 'Mill', 'Code: R-1 · Dye to: Wine · Lot 4', '2026-10-25'],
      ['Rayon', 5, 'PCS', 'CH-10', 'Other', null, '2026-10-25'],
    ],
  );
  const bad = stockImport.validateConfirmRows({ entryType: 'X', receivingDate: '', header: {}, rows: [{ rowNo: 7, itemName: 'A', quantity: 0, unit: 'KG' }] });
  assert.deepEqual(bad.errors, [
    'Choose Undyed or Dyed fabric.',
    'Receiving date is required.',
    'Row 7: quantity must be a number greater than zero, unit must be MTR or PCS, challan / bill no. is required, challan / bill date is required.',
  ]);
  assert.deepEqual(stockImport.validateConfirmRows({ entryType: 'UNDYED', receivingDate: '2026-10-26', rows: [] }).errors, ['There are no rows to add.']);
});

// ---------------------------------------------------------------------------
// Finished-garment challans (lib/finished-garments.mjs)
// ---------------------------------------------------------------------------

test('finished garments: Finishing, Steam Press and Final QC challans carry garments by name only', () => {
  assert.deepEqual(['FINISHING', 'STEAM_PRESS', 'FINAL_CHECK', 'STITCHING', 'INVENTORY'].map((d) => finished.isFinishedGoodsChallan({ fromDepartment: d })), [true, true, true, false, false]);
  assert.equal(finished.isFinishedGoodsChallan(null), false);
  assert.equal(finished.garmentName({ garmentCategory: 'TOP', styleRef: 'Kurta', colour: 'Red', fabricName: 'Rayon' }), 'Top · Kurta', 'no colour or fabric in the name');
  assert.equal(finished.garmentName({ garmentCategory: 'DUPATTA', colour: 'Red' }), 'Dupatta');
  assert.equal(finished.garmentName({ fabricName: 'Rayon Slub' }), 'Rayon Slub', 'lines without a category keep their cloth name');
});

test('finished garments: each colour of a garment is one line, but the challan shows the garment once', () => {
  const lines = [
    { id: 'a', programId: 'p1', garmentCategory: 'TOP', styleRef: 'Kurta', colour: 'Red' },
    { id: 'b', programId: 'p1', garmentCategory: 'TOP', styleRef: 'Kurta', colour: 'Blue' },
    { id: 'c', programId: 'p1', garmentCategory: 'TOP', styleRef: 'Short Kurta', colour: 'Red' },
    { id: 'd', programId: 'p2', garmentCategory: 'TOP', styleRef: 'Kurta', colour: 'Red' },
    { id: 'e', programId: 'p1', garmentCategory: 'BOTTOM', styleRef: null, colour: 'Red' },
  ];
  assert.deepEqual(finished.groupGarments(lines).map((g) => [g.name, g.programId, g.items.map((i) => i.id)]), [
    ['Top · Kurta', 'p1', ['a', 'b']],
    ['Top · Short Kurta', 'p1', ['c']],
    ['Top · Kurta', 'p2', ['d']],
    ['Bottom', 'p1', ['e']],
  ]);
});

test('finished garments: the style image, else the category image, never another sheet', () => {
  const images = [
    { id: 'i1', programId: 'p1', garmentCategory: 'TOP', styleRef: 'Kurta', version: 2 },
    { id: 'i2', programId: 'p1', garmentCategory: 'TOP', styleRef: '', version: 1 },
    { id: 'i3', programId: 'p2', garmentCategory: 'BOTTOM', styleRef: '', version: 1 },
  ];
  assert.equal(finished.imageFor(images, { programId: 'p1', garmentCategory: 'TOP', styleRef: 'Kurta' }).id, 'i1');
  assert.equal(finished.imageFor(images, { programId: 'p1', garmentCategory: 'TOP', styleRef: 'Short Kurta' }).id, 'i2');
  assert.equal(finished.imageFor(images, { programId: 'p1', garmentCategory: 'BOTTOM' }), null);
  assert.equal(finished.imageFor(images, { programId: 'p3', garmentCategory: 'TOP', styleRef: 'Kurta' }), null);
  assert.equal(finished.garmentImageUrl(images[0]), '/api/garment-images/i1?v=2');
  assert.equal(finished.garmentImageUrl(null), null);
});
