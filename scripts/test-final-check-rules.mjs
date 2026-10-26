// Final QC tests: the inspection / transfer rules, and the real Final QC API handlers
// (lib/work-items-server.ts and the app/api/final-check routes) against an in-memory Prisma
// stand-in with real signed sessions. Steam Press -> Final QC -> Inventory, defective shelf and
// Steam Press rework routing, permissions and audit records. Touches no database.
// Run: node --test scripts/test-final-check-rules.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as rules from '../apps/web/src/lib/work-items.mjs';

// ---------------------------------------------------------------------------
// Rules (lib/work-items.mjs) for Final QC lines
// ---------------------------------------------------------------------------

const fqcLine = (over = {}) => ({
  id: 'w1',
  itemNumber: 'FQC-2026-0001',
  departmentCode: 'FINAL_CHECK',
  programId: 'p1',
  status: 'RECEIVED',
  uom: 'PCS',
  expectedQuantity: 50,
  receivedQuantity: 48,
  processedQuantity: 0,
  passedQuantity: 0,
  rejectedQuantity: 0,
  reworkQuantity: 0,
  transferredQuantity: 0,
  rejectSentQuantity: 0,
  reworkSentQuantity: 0,
  ...over,
});

test('rules: Final QC lines are QC lines (PASS / REJECT / REWORK)', () => {
  assert.equal(rules.isQcItem(fqcLine()), true);
  assert.ok(rules.QC_DEPARTMENTS.includes('FINAL_CHECK'));
});

test('rules: inspection never exceeds the received, uninspected quantity', () => {
  const r = rules.validateInspection(fqcLine({ processedQuantity: 40, passedQuantity: 40 }), { inspectedQuantity: 9, passQuantity: 9 });
  assert.equal(r.ok, false);
  assert.match(r.error, /Only 8 PCS is still uninspected/);
});

test('rules: PASS + REJECT + REWORK must account for exactly the inspected quantity', () => {
  const r = rules.validateInspection(fqcLine(), { inspectedQuantity: 10, passQuantity: 6, rejectQuantity: 2, rejectReason: 'Stain' });
  assert.equal(r.ok, false);
  assert.match(r.error, /must equal the inspected quantity/);
  assert.equal(rules.validateInspection(fqcLine(), { inspectedQuantity: 10, passQuantity: 6, rejectQuantity: 4 }).ok, false, 'defect reason required');
  assert.equal(rules.validateInspection(fqcLine(), { inspectedQuantity: 10, passQuantity: 6, reworkQuantity: 4 }).ok, false, 'rework reason required');
  assert.deepEqual(
    rules.validateInspection(fqcLine(), { inspectedQuantity: 10, passQuantity: 6, rejectQuantity: 3, reworkQuantity: 1, rejectReason: 'Stain', reworkReason: 'Loose thread' }),
    { ok: true, inspected: 10, pass: 6, reject: 3, rework: 1 },
  );
});

test('rules: lines awaiting receipt cannot be inspected', () => {
  assert.equal(rules.validateInspection(fqcLine({ status: 'AWAITING_RECEIPT', receivedQuantity: null }), { inspectedQuantity: 1, passQuantity: 1 }).ok, false);
});

test('rules: every checkpoint is answered, and a failed one cannot pass the whole batch', () => {
  const all = (v) => Object.fromEntries(rules.FINAL_QC_CHECKPOINTS.map((c) => [c.key, v]));
  assert.equal(rules.FINAL_QC_CHECKPOINTS.length, 5);
  assert.match(rules.validateCheckpoints(rules.FINAL_QC_CHECKPOINTS, {}, { pass: 1, inspected: 1 }).error, /Stitching quality/);
  assert.match(rules.validateCheckpoints(rules.FINAL_QC_CHECKPOINTS, { ...all('PASS'), LABEL_CHECK: 'MAYBE' }, { pass: 1, inspected: 1 }).error, /Label/);
  const failed = { ...all('PASS'), APPEARANCE_CHECK: 'FAIL' };
  assert.match(rules.validateCheckpoints(rules.FINAL_QC_CHECKPOINTS, failed, { pass: 5, inspected: 5 }).error, /REJECT or REWORK/);
  const ok = rules.validateCheckpoints(rules.FINAL_QC_CHECKPOINTS, failed, { pass: 4, inspected: 5 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.results.find((r) => r.key === 'APPEARANCE_CHECK'), { key: 'APPEARANCE_CHECK', result: 'FAIL' });
  assert.equal(rules.validateCheckpoints(rules.FINAL_QC_CHECKPOINTS, all('pass'), { pass: 5, inspected: 5 }).ok, true, 'case-insensitive');
});

test('rules: outcomes stay separate; only passed, unsent quantity can go to Inventory', () => {
  const line = fqcLine({ processedQuantity: 30, passedQuantity: 25, rejectedQuantity: 3, reworkQuantity: 2, transferredQuantity: 10 });
  assert.equal(rules.readyToTransfer(line), 15);
  assert.equal(rules.availableFor(line, 'REJECT'), 3);
  assert.equal(rules.availableFor(line, 'REWORK'), 2);
  assert.equal(rules.availableToProcess(line), 18);
  assert.equal(rules.qcStatusOf(line), 'PARTIALLY_TRANSFERRED');
  assert.equal(rules.qcStatusOf(fqcLine()), 'RECEIVED');
  assert.equal(rules.qcStatusOf(fqcLine({ processedQuantity: 10, passedQuantity: 10 })), 'IN_PROGRESS');
  assert.equal(rules.qcStatusOf(fqcLine({ processedQuantity: 48, passedQuantity: 48 })), 'COMPLETED');
  assert.equal(rules.qcStatusOf(fqcLine({ processedQuantity: 48, passedQuantity: 45, rejectedQuantity: 3, transferredQuantity: 45, rejectSentQuantity: 3 })), 'TRANSFERRED');
});

test('rules: transfer lines block over-dispatch, duplicates, mixed units and other sheets', () => {
  const a = fqcLine({ processedQuantity: 20, passedQuantity: 18, rejectedQuantity: 2 });
  const b = fqcLine({ id: 'w2', itemNumber: 'FQC-2026-0002', uom: 'MTR', processedQuantity: 5, passedQuantity: 5 });
  const c = fqcLine({ id: 'w3', itemNumber: 'FQC-2026-0003', programId: 'p2', processedQuantity: 5, passedQuantity: 5 });
  const byId = new Map([a, b, c].map((i) => [i.id, i]));
  const check = (lines, kind) => rules.validateTransferLines(lines, byId, 'FINAL_CHECK', kind);
  assert.match(check([{ workItemId: 'w1', quantity: 19 }]).error, /only 18 PCS .* passed and not yet transferred/);
  assert.match(check([{ workItemId: 'w1', quantity: 3 }], 'REJECT').error, /only 2 PCS .* rejected/);
  assert.match(check([{ workItemId: 'w1', quantity: 1 }, { workItemId: 'w1', quantity: 1 }]).error, /listed twice/);
  assert.match(check([{ workItemId: 'w1', quantity: 1 }, { workItemId: 'w2', quantity: 1 }]).error, /cannot be mixed/);
  assert.match(check([{ workItemId: 'w1', quantity: 1 }, { workItemId: 'w3', quantity: 1 }]).error, /same Production Sheet/);
  assert.match(rules.validateTransferLines([{ workItemId: 'w1', quantity: 1 }], byId, 'QC3').error, /not found/, 'another department cannot move Final QC lines');
  assert.deepEqual(check([{ workItemId: 'w1', quantity: 18 }]), { ok: true, unit: 'PCS', programId: 'p1' });
});

// ---------------------------------------------------------------------------
// In-memory Prisma stand-in (enough of the query language for these handlers)
// ---------------------------------------------------------------------------

const RELATIONS = {
  user: {},
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
  challanItem: {},
  challanEvent: { actor: { model: 'user', one: 'actorId' } },
  departmentWorkItem: {
    program: { model: 'program', one: 'programId' },
    inboundChallan: { model: 'challan', one: 'inboundChallanId' },
    transfers: { model: 'departmentWorkTransfer', many: 'workItemId' },
    inspections: { model: 'workItemInspection', many: 'workItemId' },
    allocations: { model: 'recuttingAllocation', many: 'workItemId' },
    receivedBy: { model: 'user', one: 'receivedById' },
    sourceAllocation: { model: 'recuttingAllocation', one: 'sourceAllocationId' },
    sourceWorkItem: { model: 'departmentWorkItem', one: 'sourceWorkItemId' },
  },
  departmentWorkTransfer: {
    challan: { model: 'challan', one: 'challanId' },
    workItem: { model: 'departmentWorkItem', one: 'workItemId' },
    createdBy: { model: 'user', one: 'createdById' },
  },
  workItemInspection: { inspector: { model: 'user', one: 'inspectorId' }, workItem: { model: 'departmentWorkItem', one: 'workItemId' } },
};
const UNIQUE = { challan: ['challanNumber'], departmentWorkItem: ['itemNumber'], idempotencyRecord: ['key'] };
const WORK_ITEM_DEFAULTS = {
  receivedQuantity: null, processedQuantity: 0, passedQuantity: 0, rejectedQuantity: 0, reworkQuantity: 0,
  transferredQuantity: 0, rejectSentQuantity: 0, reworkSentQuantity: 0, takenQuantity: 0, defectQuantity: 0,
  startedAt: null, completedAt: null, receivedAt: null, receivedById: null, receiptRemarks: null, remarks: null,
  expectedCompletionDate: null, lastTransferredAt: null, sourceAllocationId: null, sourceWorkItemId: null, fabricStatusSource: null,
};

function createFakePrisma() {
  let db = {};
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 9, 25, 8, 0, 0) + ++tick);
  const table = (model) => (db[model] ??= []);
  const val = (v) => (v instanceof Date ? v.getTime() : v);
  const fold = (v, mode) => (mode === 'insensitive' && typeof v === 'string' ? v.toLowerCase() : val(v));

  function scalar(v, cond) {
    if (cond === null || typeof cond !== 'object' || cond instanceof Date) return val(v) === val(cond);
    const m = cond.mode;
    for (const [op, arg] of Object.entries(cond)) {
      if (op === 'mode') continue;
      const a = fold(v, m);
      const b = Array.isArray(arg) ? arg.map((x) => fold(x, m)) : fold(arg, m);
      const ok = {
        equals: () => a === b,
        not: () => (arg !== null && typeof arg === 'object' && !(arg instanceof Date) ? !scalar(v, arg) : a !== b),
        in: () => b.includes(a),
        notIn: () => !b.includes(a),
        gt: () => a !== null && a !== undefined && a > b,
        gte: () => a !== null && a !== undefined && a >= b,
        lt: () => a !== null && a !== undefined && a < b,
        lte: () => a !== null && a !== undefined && a <= b,
        contains: () => typeof a === 'string' && a.includes(b),
        startsWith: () => typeof a === 'string' && a.startsWith(b),
        endsWith: () => typeof a === 'string' && a.endsWith(b),
      }[op];
      if (!ok) throw new Error(`fake prisma: unsupported operator ${op}`);
      if (!ok()) return false;
    }
    return true;
  }

  function related(model, row, field) {
    const rel = RELATIONS[model]?.[field];
    if (rel.many) return table(rel.model).filter((r) => r[rel.many] === row.id);
    return table(rel.model).find((r) => r.id === row[rel.one]) || null;
  }

  function matches(model, row, where) {
    if (!where) return true;
    return Object.entries(where).every(([k, cond]) => {
      if (cond === undefined) return true;
      if (k === 'AND') return [].concat(cond).every((w) => matches(model, row, w));
      if (k === 'OR') return cond.some((w) => matches(model, row, w));
      if (k === 'NOT') return ![].concat(cond).some((w) => matches(model, row, w));
      const rel = RELATIONS[model]?.[k];
      if (rel?.many) {
        const rows = related(model, row, k);
        if ('some' in cond) return rows.some((r) => matches(rel.model, r, cond.some));
        if ('none' in cond) return !rows.some((r) => matches(rel.model, r, cond.none));
        if ('every' in cond) return rows.every((r) => matches(rel.model, r, cond.every));
        throw new Error(`fake prisma: unsupported list filter on ${k}`);
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
      if (typeof dir !== 'string') continue;
      rows.sort((x, y) => {
        const a = val(x[k]);
        const b = val(y[k]);
        const c = a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1;
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
        let rows = related(model, row, k).filter((r) => matches(rel.model, r, nested.where));
        rows = sortRows(rows, nested.orderBy);
        if (nested.take) rows = rows.slice(0, nested.take);
        out[k] = rows.map((r) => shape(rel.model, r, inner));
      } else {
        const r = related(model, row, k);
        out[k] = r ? shape(rel.model, r, inner) : null;
      }
    }
    return out;
  }

  const findMany = (model) => (args = {}) => {
    let rows = sortRows(table(model).filter((r) => matches(model, r, args.where)), args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows.map((r) => shape(model, r, args.include || args.select));
  };

  function checkUnique(model, row) {
    for (const k of UNIQUE[model] || []) {
      if (table(model).some((r) => r !== row && r[k] === row[k])) {
        const error = new Error(`Unique constraint failed on ${k}`);
        error.code = 'P2002';
        error.meta = { target: [k] };
        throw error;
      }
    }
  }

  const delegate = (model) => ({
    findMany: async (args) => findMany(model)(args),
    findFirst: async (args = {}) => findMany(model)({ ...args, take: 1 })[0] || null,
    findUnique: async (args) => findMany(model)(args)[0] || null,
    findUniqueOrThrow: async (args) => {
      const row = findMany(model)(args)[0];
      if (!row) throw new Error(`${model} not found`);
      return row;
    },
    count: async (args = {}) => table(model).filter((r) => matches(model, r, args.where)).length,
    create: async ({ data, include }) => {
      const t = now();
      const row = { id: `${model}-${table(model).length + 1}`, createdAt: t, updatedAt: t, ...(model === 'departmentWorkItem' ? WORK_ITEM_DEFAULTS : {}), ...data };
      checkUnique(model, row);
      table(model).push(row);
      return shape(model, row, include);
    },
    createMany: async ({ data }) => {
      for (const d of data) await delegate(model).create({ data: d });
      return { count: data.length };
    },
    update: async ({ where, data, include }) => {
      const row = table(model).find((r) => matches(model, r, where));
      if (!row) throw new Error(`${model} to update not found`);
      Object.assign(row, data, { updatedAt: now() });
      checkUnique(model, row);
      return shape(model, row, include);
    },
    updateMany: async ({ where, data }) => {
      const rows = table(model).filter((r) => matches(model, r, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: now() });
      return { count: rows.length };
    },
    groupBy: async ({ by, where, _sum }) => {
      const groups = new Map();
      for (const r of table(model).filter((x) => matches(model, x, where))) {
        const key = JSON.stringify(by.map((k) => r[k]));
        if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(by.map((k) => [k, r[k]])), _sum: Object.fromEntries(Object.keys(_sum).map((k) => [k, 0])) });
        for (const k of Object.keys(_sum)) groups.get(key)._sum[k] += Number(r[k]) || 0;
      }
      return [...groups.values()];
    },
  });

  const client = new Proxy(
    {
      // All-or-nothing, like the real thing: a failure restores the state from before the transaction.
      async $transaction(fn) {
        const snapshot = structuredClone(db);
        try {
          return await fn(client);
        } catch (error) {
          db = snapshot;
          throw error;
        }
      },
    },
    { get: (target, prop) => (prop in target ? target[prop] : typeof prop === 'string' ? delegate(prop) : undefined) },
  );
  return {
    prisma: client,
    rows: (model) => table(model),
    seed: (model, row) => {
      const t = now();
      const full = { createdAt: t, updatedAt: t, ...(model === 'departmentWorkItem' ? WORK_ITEM_DEFAULTS : {}), ...row };
      table(model).push(full);
      return full;
    },
  };
}

// ---------------------------------------------------------------------------
// Load the real handlers (TypeScript, "@/" paths) with the stand-in as @subham/database
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '../apps/web/src');
const require = createRequire(path.join(webSrc, 'lib/work-items-server.ts'));
const ts = require('typescript');
process.env.AUTH_SECRET = 'final-qc-test-secret-0123456789abcdefghijklmnop';

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
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'route.ts')]) {
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

const load = (p) => require(path.join(webSrc, p));
const server = load('lib/work-items-server.ts');
const { signSessionToken } = load('lib/auth/session-token.ts');
const route = (p) => load(`app/api/${p}/route.ts`);
const fqc = {
  challans: route('final-check/challans'),
  receive: route('final-check/challans/[id]/receive'),
  items: route('final-check/items'),
  inspect: route('final-check/items/[id]/inspections'),
  transfers: route('final-check/transfer-challans'),
  dashboard: route('final-check/dashboard'),
  history: route('final-check/history'),
  floor: route('final-check/floor-board'),
};
const steamPressChallans = route('steam-press/challans');
const inventoryIncoming = route('inventory/challans');
const { alertConfigFor } = load('lib/deadline-alerts/config.ts');

// People (real signed sessions; the handlers re-read them from the stand-in like production does).
const USERS = {
  fqc: { id: 'u-fqc', username: 'finalcheck', fullName: 'Final QC Incharge', email: 'fqc@x', departmentCode: 'FINAL_CHECK', isActive: true, userRoles: [{ role: { code: 'FINAL_CHECK_INSPECTOR' } }] },
  steam: { id: 'u-sp', username: 'steampress', fullName: 'Steam Press Incharge', email: 'sp@x', departmentCode: 'STEAM_PRESS', isActive: true, userRoles: [] },
  inventory: { id: 'u-inv', username: 'inventory', fullName: 'Inventory Incharge', email: 'inv@x', departmentCode: 'INVENTORY', isActive: true, userRoles: [] },
  admin: { id: 'u-ad', username: 'admin', fullName: 'Administrator', email: 'ad@x', departmentCode: 'ADMIN', isActive: true, userRoles: [{ role: { code: 'ADMIN' } }] },
};
for (const u of Object.values(USERS)) fake.seed('user', u);
const tokens = {};
for (const [k, u] of Object.entries(USERS)) {
  tokens[k] = await signSessionToken({ sub: u.id, username: u.username, fullName: u.fullName, role: 'X', roles: u.userRoles.map((r) => r.role.code), dept: u.departmentCode });
}

async function call(handler, who, { method = 'GET', url = '/', body, id } = {}) {
  const request = new Request(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(who ? { cookie: `subham_mes_token=${tokens[who]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler(request, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

// One Production Sheet, garments pressed at Steam Press, two Steam Press -> Final QC challans
// (the current type and the earlier module's INTER_DEPARTMENT type).
const program = fake.seed('program', {
  id: 'prog-1', programNumber: 'PRG-0101', programSerialNo: 'SR-0101', designNumber: 'D-77', wilcomDesignNumber: null,
  clientName: 'Client', styleCode: 'ST-1', deliveryDate: new Date(Date.UTC(2026, 10, 1)), priority: 'HIGH', status: 'IN_PRODUCTION',
});
const spChallan = fake.seed('challan', {
  id: 'ch-sp-1', challanNumber: 'SP/101', challanType: 'STEAM_PRESS_TO_FINAL_CHECK', programId: program.id, parentChallanId: null,
  fromDepartment: 'STEAM_PRESS', toDepartment: 'FINAL_CHECK', status: 'ISSUED', priority: 'HIGH', issuedById: USERS.steam.id, issuedDate: new Date(Date.UTC(2026, 9, 24)),
});
fake.seed('challanItem', { id: 'ci-1', challanId: spChallan.id, itemDescription: 'TOP — Rayon — Red', fabricCode: 'Rayon', colour: 'Red', garmentCategory: 'TOP', styleRef: 'Kurta', quantity: 50, uom: 'PCS', createdAt: new Date(1) });
fake.seed('challanItem', { id: 'ci-2', challanId: spChallan.id, itemDescription: 'DUPATTA — Chiffon — Blue', fabricCode: 'Chiffon', colour: 'Blue', garmentCategory: 'DUPATTA', styleRef: null, quantity: 20.5, uom: 'MTR', createdAt: new Date(2) });
const legacyChallan = fake.seed('challan', {
  id: 'ch-sp-legacy', challanNumber: 'SP/OLD-9', challanType: 'INTER_DEPARTMENT', programId: program.id, parentChallanId: null,
  fromDepartment: 'STEAM_PRESS', toDepartment: 'FINAL_CHECK', status: 'ISSUED', priority: 'NORMAL', issuedById: USERS.steam.id, issuedDate: new Date(Date.UTC(2026, 9, 20)),
});
fake.seed('challanItem', { id: 'ci-3', challanId: legacyChallan.id, itemDescription: 'Garments', fabricCode: 'Rayon', colour: 'Red', garmentCategory: 'BOTTOM', quantity: 12, uom: 'PCS', createdAt: new Date(3) });

const ALL_PASS = Object.fromEntries(rules.FINAL_QC_CHECKPOINTS.map((c) => [c.key, 'PASS']));
const item = (n) => fake.rows('departmentWorkItem').find((i) => i.inboundChallanItemId === n);

// The scenario runs in order: each test builds on the state the previous one left.

test('permissions: only Final QC (and administrators) reach Final QC endpoints', async () => {
  assert.equal((await call(fqc.challans.GET, null)).status, 401);
  assert.equal((await call(fqc.challans.GET, 'inventory')).status, 403);
  assert.equal((await call(fqc.challans.GET, 'steam')).status, 403);
  assert.equal((await call(fqc.dashboard.GET, 'admin')).status, 200);
  assert.equal((await call(fqc.challans.GET, 'fqc', { url: '/?view=all' })).status, 200);
});

test('incoming: Steam Press challans (current and earlier type) become Final QC lines awaiting receipt', async () => {
  const res = await call(fqc.challans.GET, 'fqc', { url: '/?view=pending' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((c) => c.challanNumber).sort(), ['SP/101', 'SP/OLD-9']);
  const lines = fake.rows('departmentWorkItem');
  assert.equal(lines.length, 3);
  assert.ok(lines.every((i) => i.departmentCode === 'FINAL_CHECK' && i.status === 'AWAITING_RECEIPT' && /^FQC-\d{4}-\d{4}$/.test(i.itemNumber)));
  assert.deepEqual([item('ci-1').garmentCategory, item('ci-1').colour, item('ci-1').uom, item('ci-1').expectedQuantity], ['TOP', 'Red', 'PCS', 50]);
  assert.deepEqual([item('ci-2').garmentCategory, item('ci-2').uom, item('ci-2').expectedQuantity], ['DUPATTA', 'MTR', 20.5]);
  // Listing again creates nothing twice.
  await call(fqc.challans.GET, 'fqc');
  assert.equal(fake.rows('departmentWorkItem').length, 3);
});

test('receiving: actual quantity recorded apart from dispatched; never above it; shortages kept', async () => {
  const over = await call(fqc.receive.POST, 'fqc', { method: 'POST', id: spChallan.id, body: { lines: [{ workItemId: item('ci-1').id, receivedQuantity: 51 }, { workItemId: item('ci-2').id, receivedQuantity: 20.5 }] } });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /more than the 50 PCS dispatched/);
  assert.equal(item('ci-1').status, 'AWAITING_RECEIPT', 'nothing saved');

  const ok = await call(fqc.receive.POST, 'fqc', { method: 'POST', id: spChallan.id, body: { remarks: 'Two pieces missing', lines: [{ workItemId: item('ci-1').id, receivedQuantity: 48, remarks: 'Counted twice' }, { workItemId: item('ci-2').id, receivedQuantity: 20.5 }] } });
  assert.equal(ok.status, 200, ok.body.error);
  assert.match(ok.body.message, /1 discrepancy/);
  assert.equal(item('ci-1').receivedQuantity, 48);
  assert.equal(item('ci-1').expectedQuantity, 50, 'dispatched quantity untouched');
  assert.equal(item('ci-1').receivedById, USERS.fqc.id);
  assert.ok(item('ci-1').receivedAt instanceof Date);
  assert.match(item('ci-1').receiptRemarks, /Short by 2 PCS · Counted twice/);
  assert.equal(fake.rows('challan').find((c) => c.id === spChallan.id).status, 'RECEIVED');
  assert.ok(fake.rows('auditLog').some((a) => a.action === 'FINAL_CHECK_RECEIVE' && a.entityId === spChallan.id));
  assert.ok(fake.rows('challanEvent').some((e) => e.challanId === spChallan.id && e.action === 'RECEIVE'));

  const again = await call(fqc.receive.POST, 'fqc', { method: 'POST', id: spChallan.id, body: { lines: [] } });
  assert.equal(again.status, 409);
});

test('inspection: checkpoints required, partial batches, no double counting, idempotent retries', async () => {
  const id = item('ci-1').id;
  const post = (body) => call(fqc.inspect.POST, 'fqc', { method: 'POST', id, body });

  assert.match((await post({ inspectedQuantity: 30, passQuantity: 30 })).body.error, /Stitching quality/);
  assert.match((await post({ inspectedQuantity: 49, passQuantity: 49, checkpoints: ALL_PASS })).body.error, /Only 48 PCS/);
  assert.match((await post({ inspectedQuantity: 30, passQuantity: 20, checkpoints: ALL_PASS })).body.error, /must equal/);
  assert.match((await post({ inspectedQuantity: 30, passQuantity: 30, checkpoints: { ...ALL_PASS, MEASUREMENT_CHECK: 'FAIL' } })).body.error, /REJECT or REWORK/);
  assert.equal(item('ci-1').processedQuantity, 0, 'rejected requests change nothing');

  const batch1 = { idempotencyKey: 'k-1', inspectedQuantity: 30, passQuantity: 25, rejectQuantity: 3, reworkQuantity: 2, rejectReason: 'Fabric hole', reworkReason: 'Crease marks', remarks: 'Batch 1', checkpoints: { ...ALL_PASS, APPEARANCE_CHECK: 'FAIL' } };
  const r1 = await post(batch1);
  assert.equal(r1.status, 201, r1.body.error);
  const retry = await post(batch1);
  assert.equal(retry.body.replayed, true);
  assert.deepEqual([item('ci-1').processedQuantity, item('ci-1').passedQuantity, item('ci-1').rejectedQuantity, item('ci-1').reworkQuantity], [30, 25, 3, 2]);
  assert.equal(item('ci-1').status, 'IN_PROGRESS');

  const r2 = await post({ idempotencyKey: 'k-2', inspectedQuantity: 18, passQuantity: 18, checkpoints: ALL_PASS });
  assert.equal(r2.status, 201, r2.body.error);
  assert.deepEqual([item('ci-1').processedQuantity, item('ci-1').passedQuantity], [48, 43]);
  assert.equal(item('ci-1').status, 'COMPLETED');
  assert.match((await post({ inspectedQuantity: 1, passQuantity: 1, checkpoints: ALL_PASS })).body.error, /Only 0 PCS/);

  // Audit trail: one inspection record, quality inspection, five checkpoint results and an audit entry per batch.
  assert.equal(fake.rows('workItemInspection').filter((x) => x.workItemId === id).length, 2);
  assert.equal(fake.rows('qualityInspectionParameter').length, 10);
  assert.ok(fake.rows('qualityInspectionParameter').some((p) => p.parameterName === 'APPEARANCE_CHECK' && p.status === 'FAIL'));
  assert.match(fake.rows('qualityInspection')[0].notes, /Checks: .*APPEARANCE_CHECK=FAIL/);
  assert.equal(fake.rows('qualityInspection')[0].departmentCode, 'FINAL_CHECK');
  assert.equal(fake.rows('auditLog').filter((a) => a.action === 'FINAL_CHECK_INSPECTION').length, 2);
  assert.equal(fake.rows('workItemInspection')[0].inspectorId, USERS.fqc.id);

  // MTR line inspected in meters, no conversion.
  const mtr = await call(fqc.inspect.POST, 'fqc', { method: 'POST', id: item('ci-2').id, body: { inspectedQuantity: 20.5, passQuantity: 20.5, checkpoints: ALL_PASS } });
  assert.equal(mtr.status, 201, mtr.body.error);
  assert.equal(item('ci-2').passedQuantity, 20.5);
});

test('Inventory challan: manual number; finished garments go whole (every passed piece), named by garment', async () => {
  const issue = (body, who = 'fqc') => call(fqc.transfers.POST, who, { method: 'POST', body });
  const pcs = item('ci-1').id;

  assert.equal((await issue({ challanNumber: 'FQ/1', lines: [{ workItemId: pcs }] }, 'inventory')).status, 403);
  assert.equal((await issue({ challanNumber: '  ', lines: [{ workItemId: pcs }] })).status, 400);
  assert.match((await issue({ challanNumber: 'FQ/1', lines: [{ workItemId: pcs }, { workItemId: item('ci-2').id }] })).body.error, /cannot be mixed/);
  assert.match((await issue({ challanNumber: 'SP/101', lines: [{ workItemId: pcs }] })).body.error, /already used/i, 'challan numbers stay unique');

  // No quantity is asked for: a quantity in the request is ignored and all 43 passed pieces go.
  const first = await issue({ idempotencyKey: 'pk-1', challanNumber: 'FQ/1', priority: 'URGENT', remarks: 'First lot', lines: [{ workItemId: pcs, quantity: 5, remarks: 'Bundle A' }] });
  assert.equal(first.status, 201, first.body.error);
  const ch = fake.rows('challan').find((c) => c.challanNumber === 'FQ/1');
  assert.deepEqual(
    [ch.fromDepartment, ch.toDepartment, ch.challanType, ch.status, ch.priority, ch.parentChallanId, ch.programId, ch.fabricOut, ch.fabricUnit, ch.issuedById],
    ['FINAL_CHECK', 'INVENTORY', 'FINAL_CHECK_TO_INVENTORY', 'ISSUED', 'URGENT', spChallan.id, program.id, 43, 'PCS', USERS.fqc.id],
  );
  const line = fake.rows('challanItem').find((i) => i.challanId === ch.id);
  assert.deepEqual([line.itemDescription, line.garmentCategory, line.styleRef, line.quantity, line.uom], ['Top · Kurta', 'TOP', 'Kurta', 43, 'PCS']);
  assert.match(line.remarks, /Incoming: SP\/101 · Ref: FQC-/);
  assert.ok(fake.rows('departmentWorkTransfer').some((t) => t.challanId === ch.id && t.workItemId === pcs && t.kind === 'PASS' && t.quantity === 43));
  assert.equal((await issue({ idempotencyKey: 'pk-1', challanNumber: 'FQ/1', lines: [{ workItemId: pcs }] })).body.replayed, true);
  assert.equal(item('ci-1').transferredQuantity, 43, 'a retried submission dispatches nothing twice');
  assert.match((await issue({ challanNumber: 'FQ/2', lines: [{ workItemId: pcs }] })).body.error, /Top · Kurta \(FQC-.*\) has nothing left to send/);

  // Inventory holds finished garments in pieces only: an MTR line is refused, never converted.
  const mtr = await issue({ challanNumber: 'FQ/M1', lines: [{ workItemId: item('ci-2').id, quantity: 20.5 }] });
  assert.equal(mtr.status, 400);
  assert.match(mtr.body.error, /Inventory receives finished garments in PCS only/);
  assert.equal(item('ci-2').transferredQuantity, 0);
  assert.equal(fake.rows('challan').some((c) => c.challanNumber === 'FQ/M1'), false);
});

test('Inventory sees the Final QC challans in its incoming challans', async () => {
  const res = await call(inventoryIncoming.GET, 'inventory', { url: '/?view=pending' });
  assert.equal(res.status, 200, res.body.error);
  const numbers = res.body.data.map((c) => c.challanNumber);
  assert.ok(numbers.includes('FQ/1'));
  const line = res.body.data.find((c) => c.challanNumber === 'FQ/1').lines[0];
  assert.deepEqual([line.garmentCategory, line.colour, line.dispatchedQuantity, line.uom], ['TOP', 'Red', 43, 'PCS']);
  assert.equal('fabricName' in line, false, 'Inventory sees garments, not fabric');
});

test('REJECT goes to the Fabric Store Defective Shelf and can never be sent to Packing', async () => {
  const pcs = item('ci-1').id;
  const res = await call(fqc.transfers.POST, 'fqc', { method: 'POST', body: { kind: 'REJECT', challanNumber: 'FQ/DEF-1', lines: [{ workItemId: pcs }] } });
  assert.equal(res.status, 201, res.body.error);
  const ch = fake.rows('challan').find((c) => c.challanNumber === 'FQ/DEF-1');
  assert.deepEqual(
    [ch.fromDepartment, ch.toDepartment, ch.challanType, ch.defectivePieces, ch.fabricOut, ch.defectReason],
    ['FINAL_CHECK', 'STORE', 'DEFECT_RETURN', 3, 0, 'Fabric hole'],
  );
  assert.match(ch.defectiveShelfLocation, /DEF-SHELF-STORE/);
  assert.equal(item('ci-1').rejectSentQuantity, 3);
  assert.equal(item('ci-1').transferredQuantity, 43, 'rejected pieces never count as dispatched');
  assert.match((await call(fqc.transfers.POST, 'fqc', { method: 'POST', body: { kind: 'REJECT', challanNumber: 'FQ/DEF-2', lines: [{ workItemId: pcs }] } })).body.error, /nothing left to send/);
});

test('REWORK returns to Steam Press, which takes it in as incoming work', async () => {
  const pcs = item('ci-1').id;
  const res = await call(fqc.transfers.POST, 'fqc', { method: 'POST', body: { kind: 'REWORK', challanNumber: 'FQ/RW-1', lines: [{ workItemId: pcs, quantity: 2 }] } });
  assert.equal(res.status, 201, res.body.error);
  const ch = fake.rows('challan').find((c) => c.challanNumber === 'FQ/RW-1');
  assert.deepEqual([ch.toDepartment, ch.challanType], ['STEAM_PRESS', 'REWORK_RETURN']);
  assert.match(ch.remarks, /Rework return from Final QC\. Must be inspected by Final QC again/);
  assert.match(ch.remarks, /Crease marks/);
  assert.equal(item('ci-1').reworkSentQuantity, 2);
  assert.equal(item('ci-1').status, 'TRANSFERRED', 'every inspected piece of the line has been routed');

  assert.equal(server.workflowReceiving(ch)?.code, 'STEAM_PRESS');
  assert.equal(server.workflowIssuing('FINAL_CHECK', 'STEAM_PRESS'), 'Final QC > My Work > Rework Material');
  assert.equal(server.workflowIssuing('FINAL_CHECK', 'INVENTORY'), 'Final QC > My Work > Issue Challan to Inventory');
  const sp = await call(steamPressChallans.GET, 'steam', { url: '/?view=pending' });
  assert.equal(sp.status, 200, sp.body.error);
  assert.ok(sp.body.data.some((c) => c.challanNumber === 'FQ/RW-1'));
  const spLine = fake.rows('departmentWorkItem').find((i) => i.departmentCode === 'STEAM_PRESS');
  assert.deepEqual([spLine.status, spLine.expectedQuantity, spLine.garmentCategory, spLine.sourceWorkItemId], ['AWAITING_RECEIPT', 2, 'TOP', pcs]);
});

test('Steam Press flow unchanged: Finishing challans in, Final QC out', () => {
  assert.equal(server.workflowReceiving({ fromDepartment: 'FINISHING', toDepartment: 'STEAM_PRESS', challanType: 'FINISHING_TO_STEAM_PRESS' })?.code, 'STEAM_PRESS');
  assert.equal(server.workflowReceiving({ fromDepartment: 'STEAM_PRESS', toDepartment: 'FINAL_CHECK', challanType: 'STEAM_PRESS_TO_FINAL_CHECK' })?.code, 'FINAL_CHECK');
  assert.equal(server.workflowReceiving({ fromDepartment: 'QC2', toDepartment: 'STEAM_PRESS', challanType: 'REWORK_RETURN' }), null, 'only Final QC rework returns');
  assert.deepEqual(server.WORKFLOWS.STEAM_PRESS.next, { code: 'FINAL_CHECK', label: 'Final QC', challanType: 'STEAM_PRESS_TO_FINAL_CHECK' });
  assert.equal(server.WORKFLOWS.QC3.qc.reworkTo.code, 'WASHING', 'other QC routing untouched');
});

test('dashboard: live counts and per-unit quantities, nothing counted twice', async () => {
  const res = await call(fqc.dashboard.GET, 'fqc');
  assert.equal(res.status, 200, res.body.error);
  const { counts, quantities, outcomes } = res.body.data;
  assert.equal(counts.pendingInward, 1, 'the earlier-type challan is still to be received');
  assert.deepEqual(quantities.awaitingReceipt, { PCS: 12 });
  assert.deepEqual(outcomes.passed, { PCS: 43, MTR: 20.5 });
  assert.deepEqual(outcomes.rejected, { PCS: 3 });
  assert.deepEqual(outcomes.rework, { PCS: 2 });
  assert.deepEqual(outcomes.dispatched, { PCS: 43 });
  assert.equal(counts.readyForNext, 1, 'the MTR line stays passed and waiting');
  assert.equal(counts.challansIssued, 1, 'Inventory challans only');
});

test('history: filters by category, decision, reason, rework and dispatch status', async () => {
  const lines = async (q) => (await call(fqc.history.GET, 'fqc', { url: `/?view=lines&${q}` })).body.data.map((i) => i.inboundChallanItemId).sort();
  assert.deepEqual(await lines('category=dupatta'), ['ci-2']);
  assert.deepEqual(await lines('outcome=REJECT'), ['ci-1']);
  assert.deepEqual(await lines('reason=crease'), ['ci-1']);
  assert.deepEqual(await lines('reworkStatus=RETURNED'), ['ci-1']);
  assert.deepEqual(await lines('reworkStatus=PENDING'), []);
  assert.deepEqual(await lines('dispatch=DISPATCHED'), ['ci-1']);
  assert.deepEqual(await lines('dispatch=AWAITING'), ['ci-2']);
  assert.deepEqual(await lines('challan=FQ/1'), ['ci-1']);
  const inspections = (await call(fqc.history.GET, 'fqc', { url: '/?view=inspections&reason=hole' })).body.data;
  assert.equal(inspections.length, 1);
  const outgoing = (await call(fqc.history.GET, 'fqc', { url: '/?view=outgoing&outcome=REWORK' })).body.data;
  assert.deepEqual(outgoing.map((c) => c.challanNumber), ['FQ/RW-1']);
});

test('floor board and alerts: Final QC stages and the deadline alert configuration', async () => {
  const res = await call(fqc.floor.GET, 'fqc');
  assert.equal(res.status, 200, res.body.error);
  const stage = (key) => res.body.data.stages.find((s) => s.key === key);
  assert.equal(stage('PASSED').label, 'Passed, awaiting Inventory');
  assert.equal(stage('REWORK').label, 'Rework, awaiting return to Steam Press');
  assert.equal(stage('AWAITING_RECEIPT').items.length, 1);
  const config = alertConfigFor('FINAL_CHECK');
  assert.equal(config.enabled, true);
  assert.deepEqual(config.recipients, ['FINAL_CHECK']);
  assert.equal(config.source.departmentCode, 'FINAL_CHECK');
});
