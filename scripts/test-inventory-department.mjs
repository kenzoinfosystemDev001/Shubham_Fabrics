// Inventory Department tests (Packing is a module of Inventory): the stock and packing rules, and the
// real Inventory API handlers (lib/inventory-server.ts, app/api/inventory) against an in-memory Prisma
// stand-in with real signed sessions — receiving Final QC challans in pieces, Send for Packing, packing
// progress and returns, reconciliation with the ledger, garment images, permissions, and the
// Packing -> Inventory consolidation. Touches no database.
// Run: node --test scripts/test-inventory-department.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as inv from '../apps/web/src/lib/inventory.mjs';

// ---------------------------------------------------------------------------
// Rules (lib/inventory.mjs)
// ---------------------------------------------------------------------------

const rec = (over = {}) => ({
  id: 'w1',
  itemNumber: 'INV-2026-0001',
  departmentCode: 'INVENTORY',
  status: 'RECEIVED',
  uom: 'PCS',
  garmentCategory: 'TOP',
  styleRef: 'Kurta',
  colour: 'Red',
  expectedQuantity: 40,
  receivedQuantity: 38,
  takenQuantity: 0,
  processedQuantity: 0,
  ...over,
});

test('rules: quantities of a record, and its status from them only', () => {
  assert.deepEqual(inv.stockOf(rec({ takenQuantity: 25, processedQuantity: 10 })), { received: 38, sent: 25, packed: 10, available: 13, inPacking: 15, remaining: 28 });
  assert.equal(inv.stockOf(rec({ status: 'AWAITING_RECEIPT', receivedQuantity: null })).received, 0);
  assert.equal(inv.inventoryStatus(rec()), 'READY');
  assert.equal(inv.inventoryStatus(rec({ takenQuantity: 5 })), 'SENT');
  assert.equal(inv.inventoryStatus(rec({ takenQuantity: 5, processedQuantity: 2 })), 'PARTIAL');
  assert.equal(inv.inventoryStatus(rec({ takenQuantity: 38, processedQuantity: 38 })), 'PACKED');
  assert.equal(inv.inventoryStatus(rec({ receivedQuantity: 0 })), 'NOTHING_RECEIVED');
  assert.equal(inv.workStatusOf(rec({ takenQuantity: 5 })), 'IN_PROGRESS');
  assert.equal(inv.workStatusOf(rec({ takenQuantity: 38, processedQuantity: 38 })), 'COMPLETED');
  assert.equal(inv.garmentLabel(rec()), 'Top · Kurta · Red');
});

test('rules: Send for Packing takes whole pieces, within what is available, never meters', () => {
  const r = rec({ takenQuantity: 25 });
  const send = (input, item = r) => inv.validateSendForPacking(item, { packingDate: '2026-10-26', ...input });
  assert.match(send({ quantity: 0 }).error, /greater than zero/);
  assert.match(send({ quantity: 2.5 }).error, /whole number/);
  assert.match(send({ quantity: 14 }).error, /Only 13 PCS/);
  assert.match(send({ quantity: '' }).error, /Enter the quantity/);
  assert.match(send({ quantity: 5, packingDate: '' }).error, /packing date/);
  assert.match(send({ quantity: 5, priority: 'ASAP' }).error, /priority/);
  assert.match(send({ quantity: 5 }, rec({ uom: 'MTR' })).error, /only pieces can be packed/);
  assert.match(send({ quantity: 5 }, rec({ status: 'AWAITING_RECEIPT' })).error, /Receive these garments/);
  const ok = send({ quantity: 13, priority: 'urgent' });
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.quantity, ok.priority], [13, 'URGENT']);
});

test('rules: packing never exceeds what was sent; completion only when all of it is packed or returned', () => {
  const a = { packingNumber: 'PKG-2026-0001', quantity: 25, packedQuantity: 10, returnedQuantity: 0, startedAt: new Date() };
  assert.equal(inv.allocationOpen(a), 15);
  assert.match(inv.validatePacked(a, { quantity: 16 }).error, /Only 15 PCS of PKG-2026-0001/);
  assert.equal(inv.validatePacked(a, { quantity: 15 }).ok, true);
  assert.match(inv.validateReturn(a, { quantity: 5 }).error, /reason/);
  assert.equal(inv.validateReturn(a, { quantity: 5, remarks: 'Stain found' }).ok, true);
  assert.equal(inv.allocationStatus({ ...a, packedQuantity: 0, startedAt: null }), 'SENT_FOR_PACKING');
  assert.equal(inv.allocationStatus({ ...a, packedQuantity: 0 }), 'PACKING_IN_PROGRESS');
  assert.equal(inv.allocationStatus(a), 'PARTIALLY_PACKED');
  assert.equal(inv.allocationStatus({ ...a, packedQuantity: 20, returnedQuantity: 5 }), 'PACKING_COMPLETED');
  assert.equal(inv.allocationStatus({ ...a, packedQuantity: 0, returnedQuantity: 25 }), 'CANCELLED');
});

test('rules: balances rebuilt from the ledger', () => {
  const entries = [
    { entryType: 'RECEIPT', quantity: 38 },
    { entryType: 'SENT_FOR_PACKING', quantity: -25 },
    { entryType: 'PACKING_STARTED', quantity: 0 },
    { entryType: 'PACKED', quantity: 10 },
    { entryType: 'RETURNED_FROM_PACKING', quantity: 5 },
    { entryType: 'IMAGE_UPLOADED', quantity: 0 },
  ];
  assert.deepEqual(inv.balancesFromLedger(entries), { available: 18, packed: 10 });
});

// ---------------------------------------------------------------------------
// In-memory Prisma stand-in
// ---------------------------------------------------------------------------

const RELATIONS = {
  challan: {
    items: { model: 'challanItem', many: 'challanId' },
    workItemsInbound: { model: 'departmentWorkItem', many: 'inboundChallanId' },
    workTransfers: { model: 'departmentWorkTransfer', many: 'challanId' },
    events: { model: 'challanEvent', many: 'challanId' },
    program: { model: 'program', one: 'programId' },
    parentChallan: { model: 'challan', one: 'parentChallanId' },
    issuedBy: { model: 'user', one: 'issuedById' },
    receivedBy: { model: 'user', one: 'receivedById' },
  },
  challanEvent: { actor: { model: 'user', one: 'actorId' } },
  role: { userRoles: { model: 'userRole', many: 'roleId' } },
  departmentWorkItem: {
    program: { model: 'program', one: 'programId' },
    inboundChallan: { model: 'challan', one: 'inboundChallanId' },
    transfers: { model: 'departmentWorkTransfer', many: 'workItemId' },
    inspections: { model: 'workItemInspection', many: 'workItemId' },
    allocations: { model: 'workItemAllocation', many: 'workItemId' },
    packingAllocations: { model: 'packingAllocation', many: 'workItemId' },
    receivedBy: { model: 'user', one: 'receivedById' },
    sourceAllocation: { model: 'workItemAllocation', one: 'sourceAllocationId' },
    sourceWorkItem: { model: 'departmentWorkItem', one: 'sourceWorkItemId' },
  },
  departmentWorkTransfer: { challan: { model: 'challan', one: 'challanId' }, workItem: { model: 'departmentWorkItem', one: 'workItemId' }, createdBy: { model: 'user', one: 'createdById' } },
  packingAllocation: { workItem: { model: 'departmentWorkItem', one: 'workItemId' }, createdBy: { model: 'user', one: 'createdById' } },
  stockLedgerEntry: { actor: { model: 'user', one: 'actorId' }, program: { model: 'program', one: 'programId' } },
};
const UNIQUE = { challan: ['challanNumber'], departmentWorkItem: ['itemNumber'], idempotencyRecord: ['key'], packingAllocation: ['packingNumber'], stockLedgerEntry: ['idempotencyKey'] };
const COMPOUND = { garmentImage: { programId_garmentCategory_styleRef: ['programId', 'garmentCategory', 'styleRef'] } };
const DEFAULTS = {
  departmentWorkItem: {
    receivedQuantity: null, processedQuantity: 0, passedQuantity: 0, rejectedQuantity: 0, reworkQuantity: 0, transferredQuantity: 0,
    rejectSentQuantity: 0, reworkSentQuantity: 0, takenQuantity: 0, defectQuantity: 0, startedAt: null, completedAt: null, receivedAt: null,
    receivedById: null, receiptRemarks: null, remarks: null, expectedCompletionDate: null, lastTransferredAt: null, sourceAllocationId: null, sourceWorkItemId: null,
  },
  packingAllocation: { packedQuantity: 0, returnedQuantity: 0, startedAt: null, completedAt: null, remarks: null },
  garmentImage: { version: 1, styleRef: '' },
};
const OPS = new Set(['equals', 'not', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'mode']);

function createFakePrisma() {
  let db = {};
  let tick = 0;
  let queue = Promise.resolve();
  const now = () => new Date(Date.UTC(2026, 9, 26, 8, 0, 0) + ++tick);
  const table = (model) => (db[model] ??= []);
  const val = (v) => (v instanceof Date ? v.getTime() : v);
  const fold = (v, mode) => (mode === 'insensitive' && typeof v === 'string' ? v.toLowerCase() : val(v));
  const isOps = (c) => c && typeof c === 'object' && !(c instanceof Date) && !Array.isArray(c) && Object.keys(c).every((k) => OPS.has(k));

  function scalar(v, cond) {
    if (cond === null || typeof cond !== 'object' || cond instanceof Date) return val(v ?? null) === val(cond);
    const m = cond.mode;
    for (const [op, arg] of Object.entries(cond)) {
      if (op === 'mode') continue;
      const a = fold(v, m);
      const b = Array.isArray(arg) ? arg.map((x) => fold(x, m)) : fold(arg, m);
      const ok = {
        equals: () => a === b,
        not: () => (isOps(arg) ? !scalar(v, arg) : a !== b),
        in: () => b.includes(a),
        notIn: () => !b.includes(a),
        gt: () => a != null && a > b,
        gte: () => a != null && a >= b,
        lt: () => a != null && a < b,
        lte: () => a != null && a <= b,
        contains: () => typeof a === 'string' && a.includes(b),
        startsWith: () => typeof a === 'string' && a.startsWith(b),
        endsWith: () => typeof a === 'string' && a.endsWith(b),
      }[op];
      if (!ok()) return false;
    }
    return true;
  }
  const related = (model, row, field) => {
    const rel = RELATIONS[model][field];
    return rel.many ? table(rel.model).filter((r) => r[rel.many] === row.id) : table(rel.model).find((r) => r.id === row[rel.one]) || null;
  };
  function matches(model, row, where) {
    if (!where) return true;
    return Object.entries(where).every(([k, cond]) => {
      if (cond === undefined) return true;
      if (k === 'AND') return [].concat(cond).every((w) => matches(model, row, w));
      if (k === 'OR') return cond.some((w) => matches(model, row, w));
      if (k === 'NOT') return ![].concat(cond).some((w) => matches(model, row, w));
      const compound = COMPOUND[model]?.[k];
      if (compound) return compound.every((f) => row[f] === cond[f]);
      const rel = RELATIONS[model]?.[k];
      if (rel?.many) {
        const rows = related(model, row, k);
        if ('some' in cond) return rows.some((r) => matches(rel.model, r, cond.some));
        if ('none' in cond) return !rows.some((r) => matches(rel.model, r, cond.none));
        return rows.every((r) => matches(rel.model, r, cond.every));
      }
      if (rel) {
        const r = related(model, row, k);
        return cond === null ? r === null : r !== null && matches(rel.model, r, cond);
      }
      return scalar(row[k], cond);
    });
  }
  const sortRows = (rows, orderBy) => {
    for (const o of [].concat(orderBy || []).reverse()) {
      const [[k, dir]] = Object.entries(o);
      rows.sort((x, y) => {
        const a = val(x[k]);
        const b = val(y[k]);
        const c = a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1;
        return dir === 'desc' ? -c : c;
      });
    }
    return rows;
  };
  function shape(model, row, spec) {
    const out = { ...row };
    for (const [k, v] of Object.entries(spec || {})) {
      const rel = RELATIONS[model]?.[k];
      if (!rel || !v) continue;
      const nested = typeof v === 'object' ? v : {};
      const inner = nested.include || nested.select;
      if (rel.many) {
        let rows = sortRows(related(model, row, k).filter((r) => matches(rel.model, r, nested.where)), nested.orderBy);
        if (nested.take) rows = rows.slice(0, nested.take);
        out[k] = rows.map((r) => shape(rel.model, r, inner));
      } else {
        const r = related(model, row, k);
        out[k] = r ? shape(rel.model, r, inner) : null;
      }
    }
    return out;
  }
  const findMany = (model, args = {}) => {
    let rows = sortRows(table(model).filter((r) => matches(model, r, args.where)), args.orderBy);
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take) rows = rows.slice(0, args.take);
    return rows.map((r) => shape(model, r, args.include || args.select));
  };
  function checkUnique(model, row) {
    for (const k of UNIQUE[model] || []) {
      if (row[k] != null && table(model).some((r) => r !== row && r[k] === row[k])) {
        throw Object.assign(new Error(`Unique constraint failed on ${k}`), { code: 'P2002', meta: { target: [k] } });
      }
    }
  }
  const applyData = (row, data) => {
    for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] || 0) + v.increment : v;
    row.updatedAt = now();
  };
  const delegate = (model) => ({
    findMany: async (args) => findMany(model, args),
    findFirst: async (args = {}) => findMany(model, { ...args, take: 1 })[0] || null,
    findUnique: async (args) => findMany(model, args)[0] || null,
    findUniqueOrThrow: async (args) => findMany(model, args)[0] ?? Promise.reject(new Error(`${model} not found`)),
    count: async (args = {}) => table(model).filter((r) => matches(model, r, args.where)).length,
    create: async ({ data, include, select }) => {
      const t = now();
      const row = { id: `${model}-${table(model).length + 1}`, createdAt: t, updatedAt: t, ...(DEFAULTS[model] || {}), ...data };
      checkUnique(model, row);
      table(model).push(row);
      return shape(model, row, include || select);
    },
    createMany: async ({ data }) => {
      for (const d of data) await delegate(model).create({ data: d });
      return { count: data.length };
    },
    update: async ({ where, data, include }) => {
      const row = table(model).find((r) => matches(model, r, where));
      if (!row) throw new Error(`${model} to update not found`);
      applyData(row, data);
      checkUnique(model, row);
      return shape(model, row, include);
    },
    updateMany: async ({ where, data }) => {
      const rows = table(model).filter((r) => matches(model, r, where));
      for (const row of rows) applyData(row, data);
      return { count: rows.length };
    },
    upsert: async ({ where, create, update, select }) => {
      const row = table(model).find((r) => matches(model, r, where));
      if (row) {
        applyData(row, update);
        return shape(model, row, select);
      }
      return delegate(model).create({ data: create, select });
    },
  });
  const client = new Proxy(
    {
      // One transaction at a time (as row locks would order them); a failure restores the state before it.
      $transaction(fn) {
        const run = queue.then(async () => {
          const snapshot = structuredClone(db);
          try {
            return await fn(client);
          } catch (error) {
            db = snapshot;
            throw error;
          }
        });
        queue = run.catch(() => {});
        return run;
      },
    },
    { get: (target, prop) => (prop in target ? target[prop] : typeof prop === 'string' ? delegate(prop) : undefined) },
  );
  return {
    prisma: client,
    /** Holds every transaction until the returned function is called (to line up concurrent requests). */
    pause: () => {
      let release;
      const gate = new Promise((r) => (release = r));
      queue = queue.then(() => gate);
      return release;
    },
    rows: (model) => table(model),
    seed: (model, row) => {
      const t = now();
      const full = { createdAt: t, updatedAt: t, ...(DEFAULTS[model] || {}), ...row };
      table(model).push(full);
      return full;
    },
  };
}

// ---------------------------------------------------------------------------
// Real handlers, real sessions
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '../apps/web/src');
const require = createRequire(path.join(webSrc, 'lib/inventory-server.ts'));
const ts = require('typescript');
process.env.AUTH_SECRET = 'inventory-test-secret-0123456789abcdefghijklmnop';
for (const k of ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[k];

const fake = createFakePrisma();
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === '@subham/database') return { prisma: fake.prisma };
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
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const load = (p) => require(path.join(webSrc, p));
const route = (p) => load(`app/api/inventory/${p}/route.ts`);
const api = {
  challans: route('challans'),
  receive: route('challans/[id]/receive'),
  items: route('items'),
  item: route('items/[id]'),
  packing: route('packing'),
  packingAction: route('packing/[id]'),
  dashboard: route('dashboard'),
  transactions: route('transactions'),
  history: route('history'),
  images: route('garment-images'),
  image: route('garment-images/[id]'),
};
const { signSessionToken } = load('lib/auth/session-token.ts');
const access = load('lib/auth/department-access.ts');
const rbac = load('lib/rbac.ts');
const { MES_DEPARTMENTS } = load('lib/departments.ts');
const { alertConfigFor } = load('lib/deadline-alerts/config.ts');
const { WORKFLOWS, workflowReceiving } = load('lib/work-items-server.ts');

const USERS = {
  inventory: { id: 'u-inv', username: 'inventory', fullName: 'Inventory Supervisor', email: 'inv@x', departmentCode: 'INVENTORY', isActive: true, userRoles: [{ role: { code: 'INVENTORY_SUPERVISOR' } }] },
  // An account of the earlier Packing & Inventory department, before the migration moves it.
  legacy: { id: 'u-pk', username: 'packing', fullName: 'Packing Supervisor', email: 'pk@x', departmentCode: 'PACKING', isActive: true, userRoles: [{ role: { code: 'PACKING_SUPERVISOR' } }] },
  steam: { id: 'u-sp', username: 'steampress', fullName: 'Steam Press', email: 'sp@x', departmentCode: 'STEAM_PRESS', isActive: true, userRoles: [] },
  admin: { id: 'u-ad', username: 'admin', fullName: 'Administrator', email: 'ad@x', departmentCode: 'ADMIN', isActive: true, userRoles: [{ role: { code: 'ADMIN' } }] },
};
for (const u of Object.values(USERS)) fake.seed('user', u);
// Roles as the database stores them (Role + UserRole rows), for the session check's role lookup.
for (const u of Object.values(USERS)) {
  for (const { role } of u.userRoles) {
    let r = fake.rows('role').find((x) => x.code === role.code);
    if (!r) r = fake.seed('role', { id: `role-${role.code}`, code: role.code, name: role.code });
    fake.seed('userRole', { id: `ur-${u.id}-${role.code}`, userId: u.id, roleId: r.id });
  }
}
const tokens = {};
for (const [k, u] of Object.entries(USERS)) {
  tokens[k] = await signSessionToken({ sub: u.id, username: u.username, fullName: u.fullName, role: 'X', roles: u.userRoles.map((r) => r.role.code), dept: u.departmentCode });
}

async function call(handler, who, { method = 'GET', url = '/', body, id, form } = {}) {
  const headers = who ? { cookie: `subham_mes_token=${tokens[who]}` } : {};
  const init = form ? { method: 'POST', headers, body: form } : { method, headers: { ...headers, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) };
  const res = await handler(new Request(`http://localhost${url}`, init), { params: Promise.resolve({ id }) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer()) };
}

// Two designs; Final QC -> Inventory challans (current type, and the earlier Final QC module's).
const prog = (id, design, serial) =>
  fake.seed('program', { id, programNumber: `PRG-${serial}`, programSerialNo: serial, designNumber: design, wilcomDesignNumber: null, clientName: 'C', styleCode: 'S', deliveryDate: new Date(Date.UTC(2026, 9, 20)), priority: 'HIGH', status: 'IN_PRODUCTION' });
const p1 = prog('prog-1', 'D-77', 'SR-0101');
const p2 = prog('prog-2', 'D-88', 'SR-0102');
const challan = (id, number, programId, type, lines) => {
  fake.seed('challan', { id, challanNumber: number, challanType: type, programId, parentChallanId: null, fromDepartment: 'FINAL_CHECK', toDepartment: 'INVENTORY', status: 'ISSUED', priority: 'HIGH', issuedById: 'u-ad', issuedDate: new Date(Date.UTC(2026, 9, 25)), remarks: null });
  lines.forEach((l, i) => fake.seed('challanItem', { id: `${id}-l${i}`, challanId: id, itemDescription: 'x', fabricCode: 'Rayon', createdAt: new Date(i + 1), ...l }));
};
challan('ch-1', 'FQ/101', p1.id, 'FINAL_CHECK_TO_INVENTORY', [
  { colour: 'Red', garmentCategory: 'TOP', styleRef: 'Kurta', quantity: 40, uom: 'PCS' },
  { colour: 'Blue', garmentCategory: 'DUPATTA', styleRef: null, quantity: 15, uom: 'PCS' },
]);
challan('ch-2', 'FQ/OLD-7', p2.id, 'INTER_DEPARTMENT', [{ colour: 'Red', garmentCategory: 'TOP', styleRef: 'Kurta', quantity: 10, uom: 'PCS' }]);
challan('ch-3', 'FQ/M-1', p2.id, 'FINAL_CHECK_TO_PACKING', [{ colour: 'Green', garmentCategory: 'BOTTOM', styleRef: null, quantity: 4.5, uom: 'MTR' }]);
// The earlier Packing module's finished-goods ledger: history only.
fake.seed('stockLedgerEntry', { id: 'old-1', entryType: 'RECEIPT', departmentCode: 'FINISHED_GOODS', itemCode: 'ST-1-M', itemName: 'Old carton stock', quantity: 20, uom: 'PCS', referenceType: 'PRODUCTION', referenceId: null, programId: p1.id, actorId: 'u-pk', balanceAfter: 20 });

const line = (challanId, i) => fake.rows('departmentWorkItem').find((w) => w.inboundChallanItemId === `${challanId}-l${i}`);
const ledgerOf = (itemCode) => fake.rows('stockLedgerEntry').filter((e) => e.departmentCode === 'INVENTORY' && e.itemCode === itemCode);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

// The scenario runs in order: each test builds on the state the previous one left.

test('one Inventory Department: no Packing department in access, sign-in, routes or departments', () => {
  assert.ok('INVENTORY' in access.DEPARTMENT_ACCESS);
  assert.equal('PACKING' in access.DEPARTMENT_ACCESS, false);
  assert.equal(access.departmentKeyFor('PACKING'), 'INVENTORY', 'earlier records resolve to Inventory');
  assert.equal(MES_DEPARTMENTS.some((d) => d.code === 'PACKING'), false);
  const station = MES_DEPARTMENTS.find((d) => d.code === 'INVENTORY');
  assert.deepEqual([station.shortName, station.stationId, station.stationAliases], ['Inventory', 'inventory', ['packing']]);
  const u = { username: 'inventory', departmentCode: 'INVENTORY', role: 'INVENTORY_SUPERVISOR', roles: ['INVENTORY_SUPERVISOR'] };
  assert.equal(rbac.getUserStationHome(u), '/inventory');
  assert.equal(rbac.checkRouteAccess('/inventory/packing', u).allowed, true);
  assert.equal(rbac.checkRouteAccess('/packing', u).allowed, true, 'old links still reach Inventory (they redirect)');
  assert.equal(rbac.checkRouteAccess('/inventory', { username: 'stitching', departmentCode: 'STITCHING', role: 'STITCHING_SUPERVISOR', roles: [] }).allowed, false);
  assert.equal(WORKFLOWS.FINAL_CHECK.next.code, 'INVENTORY');
  assert.equal(WORKFLOWS.INVENTORY.next, undefined, 'Inventory is the last department');
  assert.equal(workflowReceiving({ fromDepartment: 'FINAL_CHECK', toDepartment: 'INVENTORY', challanType: 'FINAL_CHECK_TO_INVENTORY' })?.code, 'INVENTORY');
  assert.equal(fs.existsSync(path.join(webSrc, 'app/api/packing')), false, 'the separate Packing API is gone');
  for (const old of ['', '/incoming', '/inventory', '/queue', '/reports', '/workspace']) {
    assert.match(fs.readFileSync(path.join(webSrc, `app/packing${old}/page.tsx`), 'utf8'), /redirect\('\/inventory/);
  }
});

test('permissions: access granted by a role alone (no matching department), as the database stores roles', async () => {
  const roleOnly = { id: 'u-ro', username: 'helper', fullName: 'Helper', email: 'h@x', departmentCode: 'STITCHING', isActive: true };
  const adminByRole = { id: 'u-ar', username: 'boss', fullName: 'Boss', email: 'b@x', departmentCode: null, isActive: true };
  fake.seed('user', roleOnly);
  fake.seed('user', adminByRole);
  fake.seed('role', { id: 'role-INVENTORY_OPERATOR', code: 'INVENTORY_OPERATOR', name: 'Inventory Operator' });
  fake.seed('userRole', { id: 'ur-ro', userId: roleOnly.id, roleId: 'role-INVENTORY_OPERATOR' });
  fake.seed('userRole', { id: 'ur-ar', userId: adminByRole.id, roleId: fake.rows('role').find((r) => r.code === 'ADMIN').id });
  const sign = (u) => signSessionToken({ sub: u.id, username: u.username, fullName: u.fullName, role: 'X', roles: [], dept: u.departmentCode || '' });
  tokens.roleOnly = await sign(roleOnly);
  tokens.adminByRole = await sign(adminByRole);
  assert.equal((await call(api.items.GET, 'roleOnly')).status, 200, 'INVENTORY_OPERATOR role grants Inventory');
  assert.equal((await call(api.dashboard.GET, 'adminByRole')).status, 200, 'ADMIN role grants everything');
  // Deactivated: refused at once, roles notwithstanding.
  fake.rows('user').find((u) => u.id === roleOnly.id).isActive = false;
  assert.equal((await call(api.items.GET, 'roleOnly')).status, 401);
});

test('permissions: Inventory staff (and earlier Packing accounts) and administrators only', async () => {
  assert.equal((await call(api.items.GET, null)).status, 401);
  assert.equal((await call(api.items.GET, 'steam')).status, 403);
  assert.equal((await call(api.packing.POST, 'steam', { method: 'POST', body: {} })).status, 403);
  assert.equal((await call(api.items.GET, 'inventory')).status, 200);
  assert.equal((await call(api.items.GET, 'legacy')).status, 200);
  assert.equal((await call(api.dashboard.GET, 'admin')).status, 200);
});

test('incoming: Final QC challans listed by garment, in pieces, with no fabric fields', async () => {
  const res = await call(api.challans.GET, 'inventory', { url: '/?view=pending' });
  assert.equal(res.status, 200, res.body.error);
  assert.deepEqual(res.body.data.map((c) => c.challanNumber).sort(), ['FQ/101', 'FQ/M-1', 'FQ/OLD-7']);
  const c = res.body.data.find((x) => x.challanNumber === 'FQ/101');
  assert.equal(c.issuedBy.fullName, 'Administrator', 'department incharge');
  assert.deepEqual(c.lines.map((l) => [l.garment, l.dispatchedQuantity, l.receivedQuantity, l.uom]), [['Top · Kurta · Red', 40, null, 'PCS'], ['Dupatta · Blue', 15, null, 'PCS']]);
  const json = JSON.stringify(res.body);
  assert.equal(/fabricName|fabricCode|fabricProcessingStatus|itemDescription/.test(json), false, 'no fabric data');
});

test('receiving: actual pieces, never above dispatched, whole pieces, PCS only, posted once to the ledger', async () => {
  const post = (id, lines, who = 'inventory') => call(api.receive.POST, who, { method: 'POST', id, body: { lines } });
  const a = line('ch-1', 0).id;
  const b = line('ch-1', 1).id;
  assert.match((await post('ch-1', [{ workItemId: a, receivedQuantity: 41 }, { workItemId: b, receivedQuantity: 15 }])).body.error, /more than the 40 PCS dispatched/);
  assert.match((await post('ch-1', [{ workItemId: a, receivedQuantity: 38.5 }, { workItemId: b, receivedQuantity: 15 }])).body.error, /whole number of pieces/);
  assert.match((await post('ch-3', [{ workItemId: line('ch-3', 0).id, receivedQuantity: 4 }])).body.error, /pieces only/);
  assert.equal(line('ch-1', 0).status, 'AWAITING_RECEIPT', 'nothing saved');
  assert.equal(fake.rows('stockLedgerEntry').filter((e) => e.departmentCode === 'INVENTORY').length, 0);

  const ok = await post('ch-1', [{ workItemId: a, receivedQuantity: 38, remarks: '2 pieces torn in transit' }, { workItemId: b, receivedQuantity: 15 }]);
  assert.equal(ok.status, 200, ok.body.error);
  assert.match(ok.body.message, /1 discrepancy/);
  assert.deepEqual([line('ch-1', 0).receivedQuantity, line('ch-1', 0).expectedQuantity, line('ch-1', 0).receivedById], [38, 40, USERS.inventory.id]);
  assert.match(line('ch-1', 0).receiptRemarks, /Short by 2 PCS · 2 pieces torn in transit/);
  assert.equal(fake.rows('challan').find((c) => c.id === 'ch-1').status, 'RECEIVED');
  const receipt = ledgerOf(line('ch-1', 0).itemNumber);
  assert.equal(receipt.length, 1);
  assert.deepEqual([receipt[0].entryType, receipt[0].quantity, receipt[0].referenceType, receipt[0].referenceId, receipt[0].actorId], ['RECEIPT', 38, 'CHALLAN', 'ch-1', USERS.inventory.id]);
  assert.equal((await post('ch-1', [{ workItemId: a, receivedQuantity: 38 }])).status, 409, 'a challan is received once');
  assert.equal(ledgerOf(line('ch-1', 0).itemNumber).length, 1);

  assert.equal((await post('ch-2', [{ workItemId: line('ch-2', 0).id, receivedQuantity: 10 }], 'legacy')).status, 200, 'earlier Final QC handovers are received the same way');
});

test('inventory list: filters, sorting and server-side pages; garments only', async () => {
  const list = async (q) => (await call(api.items.GET, 'inventory', { url: `/?${q}` })).body;
  const all = await list('');
  assert.equal(all.total, 3);
  assert.deepEqual([all.page, all.pageSize], [1, 25]);
  assert.deepEqual((await list('category=dupatta')).data.map((r) => r.garment), ['Dupatta · Blue']);
  assert.deepEqual((await list('search=D-88')).data.map((r) => r.program.designNumber), ['D-88']);
  assert.deepEqual((await list('search=FQ/101')).total, 2);
  assert.deepEqual((await list('status=READY')).total, 3);
  const paged = await list('pageSize=5&page=2');
  assert.deepEqual([paged.total, paged.data.length], [3, 0]);
  const r = all.data.find((x) => x.itemNumber === line('ch-1', 0).itemNumber);
  assert.deepEqual(r.stock, { received: 38, sent: 0, packed: 0, available: 38, inPacking: 0, remaining: 38 });
  assert.equal(/fabric/i.test(JSON.stringify(all)), false, 'no fabric data');
});

let first;
test('Send for Packing: validated on the server, numbered, ledgered, idempotent and race-safe', async () => {
  const id = line('ch-1', 0).id;
  const send = (body, who = 'inventory') => call(api.packing.POST, who, { method: 'POST', body: { workItemId: id, packingDate: '2026-10-26', ...body } });
  assert.match((await send({ quantity: 0 })).body.error, /greater than zero/);
  assert.match((await send({ quantity: 39 })).body.error, /Only 38 PCS/);
  assert.match((await send({ quantity: 1.5 })).body.error, /whole number/);
  assert.match((await send({ quantity: 5, packingDate: '' })).body.error, /packing date/);
  assert.equal(fake.rows('packingAllocation').length, 0);

  const res = await send({ idempotencyKey: 'send-1', quantity: 25, priority: 'URGENT', remarks: 'Order A' });
  assert.equal(res.status, 201, res.body.error);
  first = res.body.data;
  assert.deepEqual([first.packingNumber, first.quantity, first.status, first.priority, first.open], [`PKG-${new Date().getFullYear()}-0001`, 25, 'SENT_FOR_PACKING', 'URGENT', 25]);
  assert.equal(first.record.stock.available, 13);
  const retry = await send({ idempotencyKey: 'send-1', quantity: 25 });
  assert.equal(retry.body.replayed, true);
  assert.equal(fake.rows('packingAllocation').length, 1, 'a retried submission sends nothing twice');
  assert.equal(line('ch-1', 0).takenQuantity, 25);
  const sent = ledgerOf(line('ch-1', 0).itemNumber).find((e) => e.entryType === 'SENT_FOR_PACKING');
  assert.deepEqual([sent.quantity, sent.balanceAfter, sent.referenceId], [-25, 13, first.id]);
  assert.equal(line('ch-1', 0).status, 'IN_PROGRESS', 'sending is not packing');
  assert.equal(line('ch-1', 0).processedQuantity, 0);

  // Two people send the last 13 pieces at the same moment (both read 13 available before either
  // saves): the guard on the record's totals lets only one through.
  const release = fake.pause();
  const both = Promise.all([send({ quantity: 13 }), send({ quantity: 13 })]);
  await new Promise((r) => setTimeout(r, 50));
  release();
  const [x, y] = await both;
  assert.deepEqual([x.status, y.status].sort(), [201, 409]);
  assert.match((x.status === 409 ? x : y).body.error, /changed just now/);
  assert.equal(line('ch-1', 0).takenQuantity, 38);
  assert.equal(fake.rows('packingAllocation').length, 2);
  assert.match((await send({ quantity: 1 })).body.error, /Only 0 PCS/, 'no negative stock');
});

test('packing progress: start, partial, complete; never more than sent; returns go back to available', async () => {
  const act = (id, body) => call(api.packingAction.POST, 'inventory', { method: 'POST', id, body });
  const second = fake.rows('packingAllocation').find((a) => a.id !== first.id);

  assert.equal((await act(first.id, { action: 'START' })).body.data.status, 'PACKING_IN_PROGRESS');
  assert.equal((await act(first.id, { action: 'START' })).status, 409);
  assert.match((await act(first.id, { action: 'PACK', quantity: 26 })).body.error, /Only 25 PCS/);
  assert.equal((await act(first.id, { action: 'PACK', quantity: 10, idempotencyKey: 'p-1' })).body.data.status, 'PARTIALLY_PACKED');
  assert.equal((await act(first.id, { action: 'PACK', quantity: 10, idempotencyKey: 'p-1' })).body.replayed, true);
  assert.equal(line('ch-1', 0).processedQuantity, 10, 'a retried update packs nothing twice');
  const done = await act(first.id, { action: 'PACK', quantity: 15 });
  assert.deepEqual([done.body.data.status, done.body.data.packedQuantity, done.body.data.open], ['PACKING_COMPLETED', 25, 0]);
  assert.ok(done.body.data.completedAt);
  assert.equal(line('ch-1', 0).status, 'IN_PROGRESS', 'the record is not complete while 13 pieces are unpacked');
  assert.match((await act(first.id, { action: 'PACK', quantity: 1 })).body.error, /Only 0 PCS/);

  assert.match((await act(second.id, { action: 'RETURN', quantity: 5 })).body.error, /reason/);
  const back = await act(second.id, { action: 'RETURN', quantity: 5, remarks: 'Stains found before packing' });
  assert.equal(back.status, 200, back.body.error);
  assert.deepEqual([back.body.data.returnedQuantity, back.body.data.open, back.body.data.record.stock.available], [5, 8, 5]);
  assert.equal((await act(second.id, { action: 'PACK', quantity: 8 })).body.data.status, 'PACKING_COMPLETED');

  // A reference returned in full is cancelled, and its pieces are available again.
  const third = (await call(api.packing.POST, 'inventory', { method: 'POST', body: { workItemId: line('ch-1', 0).id, quantity: 5, packingDate: '2026-10-27' } })).body.data;
  const cancelled = await act(third.id, { action: 'RETURN', quantity: 5, remarks: 'Order on hold' });
  assert.deepEqual([cancelled.body.data.status, cancelled.body.data.record.stock.available], ['CANCELLED', 5]);
  assert.equal(fake.rows('packingAllocation').length, 3, 'history kept, nothing deleted');
  assert.deepEqual(inv.stockOf(line('ch-1', 0)), { received: 38, sent: 33, packed: 33, available: 5, inPacking: 0, remaining: 5 });
  assert.equal(inv.inventoryStatus(line('ch-1', 0)), 'PARTIAL');
});

test('balances reconcile with the transaction history', () => {
  for (const item of fake.rows('departmentWorkItem').filter((w) => w.departmentCode === 'INVENTORY' && w.status !== 'AWAITING_RECEIPT')) {
    const fromLedger = inv.balancesFromLedger(ledgerOf(item.itemNumber));
    const s = inv.stockOf(item);
    assert.deepEqual(fromLedger, { available: s.available, packed: s.packed }, item.itemNumber);
  }
  const packed = fake.rows('packingAllocation').reduce((sum, a) => sum + a.packedQuantity, 0);
  assert.equal(packed, line('ch-1', 0).processedQuantity);
});

test('dashboard: every figure from records, allocations and the ledger', async () => {
  const res = await call(api.dashboard.GET, 'inventory');
  assert.equal(res.status, 200, res.body.error);
  const { totals, counts, recentReceipts, recentPacking } = res.body.data;
  assert.deepEqual(totals, { received: 63, available: 30, sentForPacking: 0, beingPacked: 0, packed: 33, remaining: 30, awaitingReceipt: 4.5 });
  assert.equal(totals.received, totals.available + totals.sentForPacking + totals.beingPacked + totals.packed, 'reconciles');
  assert.deepEqual([counts.pendingChallans, counts.records, counts.readyRecords, counts.partiallyPackedRecords, counts.packedRecords], [1, 3, 3, 1, 0]);
  assert.equal(counts.overdue, 3, 'delivery date passed with pieces still to pack');
  assert.equal(recentReceipts.length, 3);
  assert.ok(recentPacking.length > 0);
});

test('garment images: per design and category, validated, versioned, never another design', async () => {
  const upload = (fields, bytes = PNG, who = 'inventory') => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    form.set('file', new File([bytes], 'kurta.png', { type: 'image/png' }));
    return call(api.images.POST, who, { form });
  };
  assert.match((await upload({ programId: p1.id, garmentCategory: 'TOP', styleRef: 'Kurta' }, new TextEncoder().encode('not an image'))).body.error, /JPG, PNG or WebP/);
  assert.equal((await upload({ programId: p1.id, garmentCategory: 'BOTTOM' })).status, 404, 'only for garments held');
  assert.equal((await upload({ programId: p1.id, garmentCategory: 'TOP', styleRef: 'Kurta' }, PNG, 'steam')).status, 403);
  const ok = await upload({ programId: p1.id, garmentCategory: 'TOP', styleRef: 'Kurta' });
  assert.equal(ok.status, 201, ok.body.error);
  assert.equal((await upload({ programId: p1.id, garmentCategory: 'TOP', styleRef: 'Kurta' })).body.data.version, 2, 'replacing bumps the version');
  assert.equal(fake.rows('garmentImage').length, 1);

  const records = (await call(api.items.GET, 'inventory')).body.data;
  const mine = records.find((r) => r.programId === p1.id && r.garmentCategory === 'TOP');
  const otherDesign = records.find((r) => r.programId === p2.id && r.garmentCategory === 'TOP');
  const otherCategory = records.find((r) => r.garmentCategory === 'DUPATTA');
  assert.deepEqual(mine.image, { id: ok.body.data.id, version: 2 });
  assert.equal(otherDesign.image, null, 'same category and colour, different design: no image');
  assert.equal(otherCategory.image, null);

  const served = await call(api.image.GET, 'inventory', { id: ok.body.data.id, url: '/?v=2' });
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(served.body), Array.from(PNG));
  // Finished-garment challans show the image in every department that receives them; signed-in users only.
  assert.equal((await call(api.image.GET, 'steam', { id: ok.body.data.id })).status, 200);
  assert.equal((await call(api.image.GET, null, { id: ok.body.data.id })).status, 401);
  const shared = load('app/api/garment-images/route.ts');
  const listed = await call(shared.GET, 'steam', { url: `/?programIds=${p1.id},${p2.id}` });
  assert.deepEqual(listed.body.data.map((i) => [i.programId, i.garmentCategory, i.styleRef, i.version]), [[p1.id, 'TOP', 'Kurta', 2]]);
  // Only Finishing uploads through the Finishing route, and only for garments it holds.
  const finishingUpload = load('app/api/finishing/garment-images/route.ts');
  const form = new FormData();
  form.append('programId', p1.id);
  form.append('garmentCategory', 'TOP');
  form.append('file', new File([PNG], 'top.png', { type: 'image/png' }));
  assert.equal((await call(finishingUpload.POST, 'steam', { form })).status, 403);
  assert.equal((await call(finishingUpload.POST, 'admin', { form })).status, 404, 'not held in Finishing');

  // Garment images are stored in the database even when Cloudinary is configured; nothing is sent out.
  const realFetch = globalThis.fetch;
  let outside = 0;
  process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloud';
  globalThis.fetch = async () => {
    outside += 1;
    throw new Error('no outside calls');
  };
  try {
    const again = new FormData();
    again.append('programId', p1.id);
    again.append('garmentCategory', 'TOP');
    again.append('styleRef', 'Kurta');
    again.append('file', new File([PNG], 'top-v3.png', { type: 'image/png' }));
    const stored = await call(api.images.POST, 'inventory', { form: again });
    assert.equal(stored.status, 201, stored.body.error);
    const row = fake.rows('garmentImage').find((i) => i.id === stored.body.data.id);
    assert.deepEqual([row.storageProvider, row.imageUrl, row.storageKey, row.version], ['DATABASE', null, null, 3]);
    assert.deepEqual(Array.from(row.imageData), Array.from(PNG));
    assert.equal(outside, 0, 'no upload to Cloudinary');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.CLOUDINARY_URL;
  }
  assert.equal(fake.rows('stockLedgerEntry').filter((e) => e.entryType === 'IMAGE_UPLOADED').length, 3, 'uploads are in the history');
});

test('record details, transaction history and challan history', async () => {
  const detail = (await call(api.item.GET, 'inventory', { id: line('ch-1', 0).id })).body.data;
  assert.equal(detail.allocations.length, 3);
  assert.equal(detail.inboundChallan.challanNumber, 'FQ/101');
  assert.ok(detail.transactions.some((t) => t.entryType === 'RETURNED_FROM_PACKING'));

  const tx = async (q) => (await call(api.transactions.GET, 'inventory', { url: `/?${q}` })).body;
  const packedOnly = await tx('type=PACKED');
  assert.ok(packedOnly.data.every((t) => t.entryType === 'PACKED'));
  assert.ok(packedOnly.data.every((t) => /^PKG-/.test(t.reference)));
  const receipts = await tx('type=RECEIPT');
  assert.ok(receipts.data.some((t) => t.reference === 'FQ/101'));
  assert.ok(receipts.data.some((t) => t.legacy && t.itemName === 'Old carton stock'), 'the earlier Packing ledger is shown as history');
  const page = await tx('pageSize=5&page=1');
  assert.equal(page.data.length, 5);
  assert.ok(page.total > 5);

  const history = (await call(api.history.GET, 'inventory', { url: '/?challan=FQ/101' })).body.data;
  assert.deepEqual(history.map((c) => c.challanNumber), ['FQ/101']);
  assert.deepEqual(history[0].lines.map((l) => [l.garment, l.dispatchedQuantity, l.receivedQuantity]), [['Top · Kurta · Red', 40, 38], ['Dupatta · Blue', 15, 15]]);
  assert.equal(/fabricName|fabricCode/.test(JSON.stringify(history)), false);
});

test('alerts: Inventory work stays open until fully packed', () => {
  const config = alertConfigFor('INVENTORY');
  assert.equal(config.enabled, true);
  assert.deepEqual(config.source.openStatuses, ['AWAITING_RECEIPT', 'RECEIVED', 'IN_PROGRESS']);
  assert.deepEqual(config.recipients, ['INVENTORY']);
});

test('migrations name only tables the schema defines', () => {
  const schema = fs.readFileSync(path.resolve(here, '../packages/database/prisma/schema.prisma'), 'utf8');
  const models = new Set(Array.from(schema.matchAll(/^model (\w+) \{/gm), (m) => m[1]));
  assert.ok(models.has('PackingAllocation') && models.has('GarmentImage'));
  for (const file of ['20261026_inventory_packing.sql', '20261026_inventory_department.sql']) {
    const sql = fs.readFileSync(path.resolve(here, `../packages/database/prisma/manual-migrations/${file}`), 'utf8').replace(/--.*$/gm, '');
    const tables = new Set(Array.from(sql.matchAll(/(?:FROM|UPDATE|INTO|TABLE|JOIN|REFERENCES|to_regclass\(')\s*"(\w+)"/g), (m) => m[1]));
    for (const t of tables) assert.ok(models.has(t), `${file}: ${t} is not a model`);
  }
  const script = fs.readFileSync(path.resolve(here, 'apply-appearance-migrations.js'), 'utf8');
  assert.ok(script.indexOf('20261026_inventory_packing.sql') > script.indexOf('20261025_department_work_items.sql'));
});
