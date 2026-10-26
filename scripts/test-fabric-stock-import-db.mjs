// Excel stock import against a real PostgreSQL test database: the actual service code
// (apps/web/src/lib/fabric-stock-import/service.ts) and stock ledger, posting through Prisma.
//
// Needs TEST_DATABASE_URL in apps/web/.env.test (a dedicated Neon branch or empty database).
// Refuses to run when it points at the database in apps/web/.env. Brings the test database
// schema up to date with `prisma db push` (no data-loss flag), creates its own test user, and
// removes the rows it created at the end.
// Run: node --test scripts/test-fabric-stock-import-db.mjs
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as guard from '../apps/web/src/lib/fabric-stock-import/workbook-guard.mjs';
import * as columns from '../apps/web/src/lib/fabric-stock-import/columns.mjs';
import * as rowsLib from '../apps/web/src/lib/fabric-stock-import/rows.mjs';
import * as permissions from '../apps/web/src/lib/fabric-stock-import/permissions.mjs';
import * as stockRules from '../apps/web/src/lib/fabric-stock-rules.mjs';
import * as deadlineRules from '../apps/web/src/lib/deadline-alerts/rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const webSrc = path.join(root, 'apps/web/src');
const require = createRequire(import.meta.url);

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const TEST_URL = process.env.TEST_DATABASE_URL || readEnv(path.join(root, 'apps/web/.env.test')).TEST_DATABASE_URL;
const SHARED_URL = readEnv(path.join(root, 'apps/web/.env')).DATABASE_URL;
const sameDb = (a, b) => {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname === y.hostname && x.pathname === y.pathname;
  } catch {
    return a === b;
  }
};

const skip = !TEST_URL
  ? 'TEST_DATABASE_URL is not set (apps/web/.env.test)'
  : SHARED_URL && sameDb(TEST_URL, SHARED_URL)
    ? 'TEST_DATABASE_URL points at the shared database in apps/web/.env; refusing to run'
    : false;

let service;
let ledger;
let prisma;
const RUN = `T${Date.now().toString(36).toUpperCase()}`;
const FABRIC_A = `ZZ ${RUN} Cambric`;
const FABRIC_B = `ZZ ${RUN} Rayon`;
const SUPPLIER = `ZZ ${RUN} Mills`;
let approver;
let operator;
const created = { imports: [], users: [] };

before(async () => {
  if (skip) return;
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'], {
    cwd: path.join(root, 'packages/database'),
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  const { PrismaClient } = require(path.join(root, 'packages/database/src/generated/client'));
  prisma = new PrismaClient({ datasourceUrl: TEST_URL });

  const ts = require('typescript');
  const esm = {
    'fabric-stock-import/workbook-guard.mjs': guard,
    'fabric-stock-import/columns.mjs': columns,
    'fabric-stock-import/rows.mjs': rowsLib,
    'fabric-stock-import/permissions.mjs': permissions,
    'fabric-stock-rules.mjs': stockRules,
    'deadline-alerts/rules.mjs': deadlineRules,
    './workbook-guard.mjs': guard,
    './columns.mjs': columns,
    './rows.mjs': rowsLib,
    './permissions.mjs': permissions,
  };
  const originalLoad = Module._load;
  const originalResolve = Module._resolveFilename;
  Module._load = function (request, parent, ...rest) {
    if (request === '@subham/database') return { prisma };
    for (const [suffix, mod] of Object.entries(esm)) if (request.endsWith(suffix)) return mod;
    return originalLoad.call(this, request, parent, ...rest);
  };
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request.startsWith('@/')) {
      const base = path.join(webSrc, request.slice(2));
      for (const c of [base, `${base}.ts`]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    if (request.startsWith('./') && parent?.filename?.endsWith('.ts')) {
      const base = path.resolve(path.dirname(parent.filename), request);
      if (fs.existsSync(`${base}.ts`)) return `${base}.ts`;
    }
    return originalResolve.call(this, request, parent, ...rest);
  };
  Module._extensions['.ts'] = function (module, filename) {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
  ledger = require(path.join(webSrc, 'lib/fabric-stock-ledger.ts'));
  service = require(path.join(webSrc, 'lib/fabric-stock-import/service.ts'));

  const mkUser = (suffix, roles) =>
    prisma.user.create({ data: { username: `zz-${RUN}-${suffix}`.toLowerCase(), email: `zz-${RUN}-${suffix}@test.invalid`.toLowerCase(), fullName: `Test ${suffix}`, passwordHash: 'x', departmentCode: 'STORE' } })
      .then((u) => { created.users.push(u.id); return { id: u.id, isAdmin: false, roles }; });
  approver = await mkUser('incharge', ['FABRIC_STORE']);
  operator = await mkUser('operator', ['STORE_OPERATOR']);

  // Fabrics already in stock: the import identifies fabric by these names.
  for (const itemName of [FABRIC_A, FABRIC_B]) {
    const inward = await prisma.fabricInward.create({
      data: { entryType: 'UNDYED', itemName, colour: 'White', billNo: `${RUN}-SEED`, billDate: new Date(), receivingDate: new Date(), billQty: 10, unit: 'MTR', supplierName: SUPPLIER },
    });
    await prisma.$transaction((tx) => ledger.syncInwardStock(tx, inward.id, approver.id));
  }
});

after(async () => {
  if (skip || !prisma) return;
  const inwards = await prisma.fabricInward.findMany({ where: { OR: [{ itemName: { startsWith: `ZZ ${RUN}` } }, { billNo: { startsWith: RUN } }] }, select: { id: true } });
  const ids = inwards.map((i) => i.id);
  await prisma.stockLedgerEntry.deleteMany({ where: { referenceId: { in: ids } } });
  await prisma.fabricInward.deleteMany({ where: { id: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: created.users } } });
  await prisma.fabricStockImport.deleteMany({ where: { uploadedById: { in: created.users } } });
  await prisma.stockLedgerEntry.deleteMany({ where: { actorId: { in: created.users } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});

const ExcelJS = require('exceljs');
const HEADERS = ['Fabric Name', 'Fabric Type', 'Colour', 'Quantity', 'Unit', 'Roll No', 'Supplier', 'Bill No', 'Bill Date', 'Received Date'];
const row = (fabric, qty, roll, bill = `${RUN}-INV1`) => [fabric, 'UNDYED', 'White', qty, 'MTR', roll, SUPPLIER, bill, '20-10-2026', '24-10-2026'];
async function workbookOf(rows, title = null) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inward');
  if (title) ws.addRow([title]);
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function upload(rows, actor = approver) {
  const record = await service.createImport({ name: `${RUN}.xlsx`, bytes: await workbookOf(rows) }, actor);
  created.imports.push(record.id);
  return record;
}
const KEY = (fabric) => stockRules.stockKey({ fabric, type: 'UNDYED', colour: 'White', unit: 'MTR' });
async function balance(fabric) {
  const { book } = await ledger.loadStockBook(prisma);
  return stockRules.bucketBalance(book, KEY(fabric));
}
async function ledgerRowsFor(importId) {
  const inwards = await prisma.fabricInward.findMany({ where: { importId }, select: { id: true } });
  return prisma.stockLedgerEntry.findMany({ where: { referenceType: 'FABRIC_INWARD', referenceId: { in: inwards.map((i) => i.id) } } });
}

test('scenario 1: normal inward posts 215 MTR of fabric A and 80 MTR of fabric B, with a receipt', { skip }, async () => {
  const [a0, b0] = [await balance(FABRIC_A), await balance(FABRIC_B)];
  const bytes = await workbookOf([row(FABRIC_A, 120, 'A001'), row(FABRIC_A, 95, 'A002'), row(FABRIC_B, 80, 'B001')]);
  const rec = await service.createImport({ name: `${RUN}.xlsx`, bytes }, approver);
  assert.equal(rec.status, 'READY_FOR_CONFIRMATION');
  assert.equal(await balance(FABRIC_A), a0, 'upload alone changes nothing');
  const { result, replayed } = await service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k1`, payloadHash: rec.payloadHash }, approver);
  assert.equal(replayed, false);
  assert.match(result.receiptNumber, /^FSR-\d{4}-\d{4}$/);
  assert.equal(result.rowsPosted, 3);
  assert.equal(await balance(FABRIC_A), a0 + 215);
  assert.equal(await balance(FABRIC_B), b0 + 80);
  const inwards = await prisma.fabricInward.findMany({ where: { importId: rec.id }, orderBy: { importRowNumber: 'asc' } });
  assert.deepEqual(inwards.map((i) => [i.rollNumber, i.billQty, i.importRowNumber]), [['A001', 120, 2], ['A002', 95, 3], ['B001', 80, 4]]);
  const rows = await ledgerRowsFor(rec.id);
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((s, r) => s + r.quantity, 0), 295);
  const after = await service.getImport(rec.id);
  assert.equal(after.status, 'POSTED');
  assert.ok(await prisma.auditLog.findFirst({ where: { entityId: rec.id, action: 'FABRIC_STOCK_IMPORT_POSTED' } }));

  // Scenario 5: the same confirmation again posts nothing and returns the same receipt.
  const again = await service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k1`, payloadHash: rec.payloadHash }, approver);
  assert.equal(again.replayed, true);
  assert.equal(again.result.receiptNumber, result.receiptNumber);
  assert.equal((await ledgerRowsFor(rec.id)).length, 3);
  assert.equal(await balance(FABRIC_A), a0 + 215);
  await assert.rejects(() => service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k1`, payloadHash: 'other' }, approver), { code: 'PAYLOAD_MISMATCH' });

  // Scenario 4: a roll already received is rejected, never added again.
  const dup = await upload([row(FABRIC_A, 120, 'A001', `${RUN}-INV2`)]);
  assert.equal(dup.status, 'NEEDS_CORRECTION');
  assert.match(JSON.parse(dup.validationJson).rows[0].errors[0].message, /already in Fabric Store stock/);

  // Same file again (renamed): refused at file level by its content hash.
  const sameFile = await service.createImport({ name: 'renamed copy.xlsx', bytes }, approver);
  const sameValidation = JSON.parse(sameFile.validationJson);
  assert.equal(sameValidation.summary.canConfirm, false);
  assert.match(sameValidation.fileErrors[0], new RegExp(result.receiptNumber));
});

test('scenario 2: an invalid row blocks posting until corrected', { skip }, async () => {
  const a0 = await balance(FABRIC_A);
  const rec = await upload([row(FABRIC_A, 20, 'C001', `${RUN}-INV3`), row(FABRIC_A, -5, 'C002', `${RUN}-INV3`), row(FABRIC_A, 8, 'C003', `${RUN}-INV3`)]);
  assert.equal(rec.status, 'NEEDS_CORRECTION');
  await assert.rejects(() => service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k2`, payloadHash: rec.payloadHash }, approver), { code: 'NOT_READY' });
  assert.equal(await balance(FABRIC_A), a0);
  const fixed = await service.correctRow(rec.id, { rowNumber: 3, field: 'quantity', value: '5' }, approver);
  assert.equal(fixed.status, 'READY_FOR_CONFIRMATION');
  await service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k2`, payloadHash: fixed.payloadHash }, approver);
  assert.equal(await balance(FABRIC_A), a0 + 33);
});

test('scenario 3: unknown fabric needs a mapping; only an approver can accept a new fabric', { skip }, async () => {
  const rec = await upload([row(`${FABRIC_A}x`, 3, 'D001', `${RUN}-INV4`)], operator);
  assert.equal(rec.status, 'NEEDS_CORRECTION');
  await assert.rejects(() => service.resolveFabric(rec.id, { name: `${FABRIC_A}x`, action: 'ACCEPT_NEW' }, operator), { status: 403 });
  const mapped = await service.resolveFabric(rec.id, { name: `${FABRIC_A}x`, action: 'MAP', target: FABRIC_A }, operator);
  assert.equal(mapped.status, 'READY_FOR_CONFIRMATION');
  const inward = JSON.parse(mapped.validationJson).rows[0];
  assert.equal(inward.fabric.name.toLowerCase(), FABRIC_A.toLowerCase());
});

test('scenario 9: a user without the approver role cannot post; nothing changes and it is audited', { skip }, async () => {
  const a0 = await balance(FABRIC_A);
  const rec = await upload([row(FABRIC_A, 4, 'E001', `${RUN}-INV5`)], operator);
  await assert.rejects(() => service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k9`, payloadHash: rec.payloadHash }, operator), { status: 403 });
  assert.equal((await service.getImport(rec.id)).status, 'READY_FOR_CONFIRMATION');
  assert.equal(await balance(FABRIC_A), a0);
  assert.ok(await prisma.auditLog.findFirst({ where: { entityId: rec.id, action: 'FABRIC_STOCK_IMPORT_CONFIRM_DENIED' } }));
});

test('scenario 6: two simultaneous confirmations post once', { skip }, async () => {
  const a0 = await balance(FABRIC_A);
  const rec = await upload([row(FABRIC_A, 7, 'F001', `${RUN}-INV6`), row(FABRIC_A, 6, 'F002', `${RUN}-INV6`)]);
  const outcomes = await Promise.allSettled([
    service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k6a`, payloadHash: rec.payloadHash }, approver),
    service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k6b`, payloadHash: rec.payloadHash }, approver),
  ]);
  const ok = outcomes.filter((o) => o.status === 'fulfilled').map((o) => o.value);
  assert.ok(ok.length >= 1);
  assert.equal(ok.filter((o) => !o.replayed).length, 1, 'exactly one confirmation posts');
  for (const o of outcomes) if (o.status === 'rejected') assert.equal(o.reason.status, 409);
  assert.equal((await ledgerRowsFor(rec.id)).length, 2);
  assert.equal(await balance(FABRIC_A), a0 + 13);
});

test('two imports racing for the same roll: only one posts it', { skip }, async () => {
  const one = await upload([row(FABRIC_B, 2, 'G001', `${RUN}-INV7`)]);
  const two = await upload([row(FABRIC_B, 2, 'G001', `${RUN}-INV8`)]);
  const outcomes = await Promise.allSettled([
    service.confirmImport(one.id, { idempotencyKey: `${RUN}-k7a`, payloadHash: one.payloadHash }, approver),
    service.confirmImport(two.id, { idempotencyKey: `${RUN}-k7b`, payloadHash: two.payloadHash }, approver),
  ]);
  assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((o) => o.status === 'rejected').reason.status, 409);
  assert.equal(await prisma.fabricInward.count({ where: { rollNumber: 'G001', supplierName: SUPPLIER } }), 1);
});

test('scenario 7: a failure while posting rolls everything back and can be retried', { skip }, async () => {
  const a0 = await balance(FABRIC_A);
  const rec = await upload([row(FABRIC_A, 9, 'H001', `${RUN}-INV9`)]);
  const original = ledger.postNewInwardRows;
  ledger.postNewInwardRows = async () => { throw new Error('simulated database failure'); };
  try {
    await assert.rejects(() => service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k8`, payloadHash: rec.payloadHash }, approver), /simulated database failure/);
  } finally {
    ledger.postNewInwardRows = original;
  }
  const afterFailure = await service.getImport(rec.id);
  assert.equal(afterFailure.status, 'READY_FOR_CONFIRMATION', 'not marked posted');
  assert.equal(afterFailure.receiptNumber, null);
  assert.equal(await prisma.fabricInward.count({ where: { importId: rec.id } }), 0, 'no partial inward rows');
  assert.equal(await balance(FABRIC_A), a0);
  const retry = await service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k8`, payloadHash: rec.payloadHash }, approver);
  assert.equal(retry.replayed, false);
  assert.equal(await balance(FABRIC_A), a0 + 9);
});

test('a stale preview cannot be confirmed', { skip }, async () => {
  const rec = await upload([row(FABRIC_B, 1, 'J001', `${RUN}-INV10`)]);
  await assert.rejects(() => service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k10`, payloadHash: 'not-what-was-shown' }, approver), { code: 'STALE_PREVIEW' });
  assert.equal(await prisma.fabricInward.count({ where: { importId: rec.id } }), 0);
});

test('regression: editing a posted inward row reconciles the ledger by the difference only', { skip }, async () => {
  const rec = await upload([row(FABRIC_B, 50, 'K001', `${RUN}-INV11`)]);
  await service.confirmImport(rec.id, { idempotencyKey: `${RUN}-k11`, payloadHash: rec.payloadHash }, approver);
  const b0 = await balance(FABRIC_B);
  const inward = await prisma.fabricInward.findFirst({ where: { importId: rec.id } });
  await prisma.$transaction(async (tx) => {
    await tx.fabricInward.update({ where: { id: inward.id }, data: { billQty: 45 } });
    await ledger.syncInwardStock(tx, inward.id, approver.id);
  });
  assert.equal(await balance(FABRIC_B), b0 - 5);
  const rows = await prisma.stockLedgerEntry.findMany({ where: { referenceId: inward.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(rows.map((r) => [r.entryType, r.quantity]), [['RECEIPT', 50], ['ADJUSTMENT', -5]]);
});

test('database tests ran against a dedicated test database', { skip: skip ? false : true }, () => {
  // Visible marker in the output when the suite was skipped.
  assert.ok(true, skip);
  console.log(`SKIPPED database tests: ${skip}`);
});
