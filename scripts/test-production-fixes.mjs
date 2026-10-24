// Production fixes tests: manual challan numbers, Fabric Store stock in meters and pieces
// (pure rules plus the real ledger service against an in-memory Prisma stand-in), and the
// Fabric Store -> Dyeing instruction lines. Touches no database.
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
