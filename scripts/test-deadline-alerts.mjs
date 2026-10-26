// Smart Deadline Alerts tests: pure date / threshold / dedup rules, plus the real engine
// (apps/web/src/lib/deadline-alerts/engine.ts) run against an in-memory Prisma stand-in.
// Touches no database. Run: node --test scripts/test-deadline-alerts.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as rules from '../apps/web/src/lib/deadline-alerts/rules.mjs';

const {
  alertDedupKey,
  classifyDeadline,
  daysBetween,
  describeRemaining,
  evaluateDeadline,
  factoryDay,
  liveSeverity,
  planTaskAlerts,
} = rules;

const TZ = 'Asia/Kolkata';
const OPTS = { timeZone: TZ, thresholds: [7, 3, 1], warningWithinDays: 3 };

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test('factory day follows Asia/Kolkata, not UTC', () => {
  assert.equal(factoryDay(new Date('2026-10-24T18:29:59Z'), TZ), '2026-10-24');
  assert.equal(factoryDay(new Date('2026-10-24T18:30:00Z'), TZ), '2026-10-25');
  // A date picked as "2026-10-25" is stored as UTC midnight -> 05:30 IST the same day.
  assert.equal(factoryDay(new Date('2026-10-25T00:00:00Z'), TZ), '2026-10-25');
  // DD-MM-YYYY input is stored at UTC noon -> same IST day.
  assert.equal(factoryDay(new Date('2026-10-25T12:00:00Z'), TZ), '2026-10-25');
});

test('daysBetween counts calendar days across month and year ends', () => {
  assert.equal(daysBetween('2026-10-24', '2026-10-31'), 7);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2026-10-24', '2026-10-20'), -4);
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2); // leap year
});

test('thresholds: 7 days, 3 days, 1 day, due today, overdue', () => {
  const t = [7, 3, 1];
  assert.equal(classifyDeadline(10, t), null);
  assert.equal(classifyDeadline(8, t), null);
  assert.deepEqual(classifyDeadline(7, t), { alertType: 'DUE_SOON', thresholdDays: 7, severity: 'INFO' });
  assert.deepEqual(classifyDeadline(4, t), { alertType: 'DUE_SOON', thresholdDays: 7, severity: 'INFO' });
  assert.deepEqual(classifyDeadline(3, t), { alertType: 'DUE_SOON', thresholdDays: 3, severity: 'WARNING' });
  assert.deepEqual(classifyDeadline(2, t), { alertType: 'DUE_SOON', thresholdDays: 3, severity: 'WARNING' });
  assert.deepEqual(classifyDeadline(1, t), { alertType: 'DUE_SOON', thresholdDays: 1, severity: 'WARNING' });
  assert.deepEqual(classifyDeadline(0, t), { alertType: 'DUE_TODAY', thresholdDays: 0, severity: 'CRITICAL' });
  assert.deepEqual(classifyDeadline(-1, t), { alertType: 'OVERDUE', thresholdDays: null, severity: 'CRITICAL' });
  assert.deepEqual(classifyDeadline(-30, t), { alertType: 'OVERDUE', thresholdDays: null, severity: 'CRITICAL' });
});

test('thresholds are configurable and tolerate unsorted / invalid entries', () => {
  assert.deepEqual(classifyDeadline(10, [14, 'x', 2, 2, -1, 0]), { alertType: 'DUE_SOON', thresholdDays: 14, severity: 'INFO' });
  assert.deepEqual(classifyDeadline(2, [14, 2]), { alertType: 'DUE_SOON', thresholdDays: 2, severity: 'WARNING' });
  assert.equal(classifyDeadline(5, []), null);
  assert.equal(classifyDeadline(0, []).alertType, 'DUE_TODAY');
});

test('due today vs overdue flips exactly at factory midnight', () => {
  const deadline = new Date('2026-10-24T00:00:00Z'); // 24 Oct
  const lastMinute = evaluateDeadline(deadline, new Date('2026-10-24T18:29:00Z'), OPTS); // 23:59 IST 24 Oct
  const nextDay = evaluateDeadline(deadline, new Date('2026-10-24T18:31:00Z'), OPTS); // 00:01 IST 25 Oct
  assert.equal(lastMinute.stage.alertType, 'DUE_TODAY');
  assert.equal(nextDay.stage.alertType, 'OVERDUE');
  assert.equal(nextDay.daysRemaining, -1);
});

test('no deadline means no alert stage (never invented)', () => {
  assert.deepEqual(evaluateDeadline(null, new Date(), OPTS), { deadlineDay: null, daysRemaining: null, stage: null });
});

test('dedup key is stable for the same task + stage + deadline, and changes otherwise', () => {
  const base = { departmentCode: 'DYEING', entityType: 'DYEING_ORDER', entityId: 'o1', alertType: 'DUE_SOON', thresholdDays: 3, deadlineDay: '2026-10-27' };
  assert.equal(alertDedupKey(base), alertDedupKey({ ...base }));
  assert.equal(alertDedupKey(base), 'DYEING:DYEING_ORDER:o1:DUE_SOON_3:2026-10-27');
  assert.notEqual(alertDedupKey(base), alertDedupKey({ ...base, thresholdDays: 1 }));
  assert.notEqual(alertDedupKey(base), alertDedupKey({ ...base, deadlineDay: '2026-10-28' }));
  assert.notEqual(alertDedupKey(base), alertDedupKey({ ...base, departmentCode: 'QC1' }));
  assert.equal(alertDedupKey({ ...base, alertType: 'OVERDUE', thresholdDays: null }), 'DYEING:DYEING_ORDER:o1:OVERDUE:2026-10-27');
});

test('planTaskAlerts: keep / create / reopen / resolve with reasons', () => {
  const active = [{ id: 'a1', dedupKey: 'K3', deadlineDay: '2026-10-27' }];
  assert.deepEqual(planTaskAlerts({ desiredKey: 'K3', existingByKey: { status: 'ACTIVE' }, activeAlerts: active, deadlineDay: '2026-10-27' }), { action: 'keep', resolve: [] });
  assert.deepEqual(planTaskAlerts({ desiredKey: 'K1', existingByKey: undefined, activeAlerts: active, deadlineDay: '2026-10-27' }), {
    action: 'create',
    resolve: [{ id: 'a1', reason: 'SUPERSEDED' }],
  });
  assert.deepEqual(planTaskAlerts({ desiredKey: 'K9', existingByKey: undefined, activeAlerts: active, deadlineDay: '2026-11-02' }), {
    action: 'create',
    resolve: [{ id: 'a1', reason: 'DEADLINE_CHANGED' }],
  });
  assert.equal(planTaskAlerts({ desiredKey: 'K3', existingByKey: { status: 'RESOLVED' }, activeAlerts: [], deadlineDay: '2026-10-27' }).action, 'reopen');
});

test('remaining-time wording and live severity', () => {
  assert.equal(describeRemaining(5), 'Due in 5 days');
  assert.equal(describeRemaining(1), 'Due tomorrow');
  assert.equal(describeRemaining(0), 'Due today');
  assert.equal(describeRemaining(-1), 'Overdue by 1 day');
  assert.equal(describeRemaining(-3), 'Overdue by 3 days');
  assert.equal(describeRemaining(null), 'No delivery date');
  assert.equal(liveSeverity(-2, 'INFO'), 'CRITICAL');
  assert.equal(liveSeverity(5, 'INFO'), 'INFO');
});

// ---------------------------------------------------------------------------
// Engine against an in-memory Prisma stand-in
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '../apps/web/src');
const require = createRequire(import.meta.url);
const ts = require('typescript');

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(value);
      if ('gte' in cond) return value >= cond.gte;
      return false;
    }
    return value === cond;
  });
}

const clone = (v) => structuredClone(v);

function createFakeDb() {
  // clock: optional simulated time for dismissals, so they line up with the engine's simulated 'now'.
  const db = { programs: [], challans: [], dyeingOrders: [], alerts: [], dismissals: [], audit: [], seq: 0, clock: null };
  const id = (p) => `${p}-${++db.seq}`;
  const programOf = (pid) => db.programs.find((p) => p.id === pid) || null;
  const challanOf = (cid) => db.challans.find((c) => c.id === cid) || null;

  const prisma = {
    dyeingOrder: {
      async findMany({ where }) {
        return db.dyeingOrders.filter((o) => matches(o, where)).map((o) => ({
          ...clone(o),
          program: clone(programOf(o.programId)),
          inboundChallan: clone(challanOf(o.inboundChallanId)),
        }));
      },
    },
    challan: {
      async findMany({ where }) {
        return db.challans.filter((c) => matches(c, where)).map((c) => ({ ...clone(c), program: clone(programOf(c.programId)) }));
      },
    },
    deadlineAlert: {
      async findMany({ where, include }) {
        let rows = db.alerts.filter((a) => matches(a, where)).map(clone);
        rows.sort((a, b) => a.deadlineAt - b.deadlineAt);
        if (include?.dismissals) {
          const dw = include.dismissals.where || {};
          rows = rows.map((a) => ({
            ...a,
            dismissals: db.dismissals
              .filter((d) => d.alertId === a.id && matches(d, dw))
              .sort((x, y) => y.dismissedAt - x.dismissedAt)
              .slice(0, include.dismissals.take ?? Infinity)
              .map(clone),
          }));
        }
        return rows;
      },
      async findUnique({ where }) {
        return clone(db.alerts.find((a) => matches(a, where)) || null);
      },
      async create({ data }) {
        await new Promise((r) => setImmediate(r)); // let concurrent runs interleave
        if (db.alerts.some((a) => a.dedupKey === data.dedupKey)) {
          throw Object.assign(new Error('Unique constraint failed on dedupKey'), { code: 'P2002' });
        }
        const now = new Date();
        const row = { id: id('alert'), status: 'ACTIVE', resolvedReason: null, resolvedAt: null, activatedAt: now, createdAt: now, ...clone(data) };
        db.alerts.push(row);
        return clone(row);
      },
      async updateMany({ where, data }) {
        const rows = db.alerts.filter((a) => matches(a, where));
        for (const row of rows) Object.assign(row, clone(data));
        return { count: rows.length };
      },
    },
    deadlineAlertDismissal: {
      async findFirst({ where }) {
        const rows = db.dismissals.filter((d) => matches(d, where)).sort((x, y) => y.dismissedAt - x.dismissedAt);
        return clone(rows[0] || null);
      },
      async create({ data }) {
        const row = { id: id('dismissal'), dismissedAt: new Date(), ...clone(data) };
        if (db.clock) row.dismissedAt = new Date(db.clock);
        db.dismissals.push(row);
        return clone(row);
      },
    },
    auditLog: {
      async create({ data }) {
        db.audit.push(clone(data));
        return data;
      },
    },
    async $transaction(fn) {
      return fn(prisma);
    },
  };
  return { db, prisma };
}

const fake = createFakeDb();
const stubs = {
  '@subham/database': { prisma: fake.prisma },
  // department-access only needs requireUser for route guards, which these tests do not call.
  '@/lib/auth/require-user': { requireUser: async () => ({ user: null, response: null }) },
};

// Load the TypeScript engine as CommonJS, transpiled on the fly, with '@/' resolved to apps/web/src.
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request in stubs) return stubs[request];
  if (request.endsWith('rules.mjs')) return rules;
  return originalLoad.call(this, request, parent, ...rest);
};
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) {
    const base = path.join(webSrc, request.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  if (request.startsWith('.') && parent?.filename?.endsWith('.ts')) {
    const base = path.resolve(path.dirname(parent.filename), request);
    if (fs.existsSync(`${base}.ts`)) return `${base}.ts`;
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

const engine = require(path.join(webSrc, 'lib/deadline-alerts/engine.ts'));
const config = require(path.join(webSrc, 'lib/deadline-alerts/config.ts'));
const { reconcileDepartmentAlerts, listAlertsForUser, dismissAlertForUser } = engine;

const at = (iso) => new Date(iso);
// Noon IST on a given day.
const istNoon = (day) => new Date(`${day}T06:30:00Z`);

const dyeingUserA = { id: 'user-a', username: 'dyeing', fullName: 'A', departmentCode: 'DYEING', roles: ['DYEING_INCHARGE'], sessionRole: 'DYEING_INCHARGE', sessionDepartment: 'DYEING', isAdmin: false };
const dyeingUserB = { ...dyeingUserA, id: 'user-b', username: 'dyeing2' };
const qc1User = { id: 'user-q', username: 'qc1', fullName: 'Q', departmentCode: 'QC1', roles: ['QC1_INSPECTOR'], sessionRole: 'QC1_INSPECTOR', sessionDepartment: 'QC1', isAdmin: false };

function seedOrder({ orderId, deliveryDate, status = 'IN_DYEING', programStatus = 'IN_PRODUCTION', meta = null, challanStatus = 'RECEIVED' }) {
  const programId = `prog-${orderId}`;
  const challanId = `ch-${orderId}`;
  fake.db.programs.push({
    id: programId,
    programNumber: `PRG-${orderId}`,
    programSerialNo: `SF-${orderId}`,
    designNumber: `D-${orderId}`,
    wilcomDesignNumber: null,
    styleCode: 'S',
    deliveryDate,
    status: programStatus,
    metadataJson: meta ? JSON.stringify(meta) : null,
  });
  fake.db.challans.push({ id: challanId, challanNumber: `CH-${orderId}`, challanType: 'FABRIC_ISSUE', status: challanStatus, toDepartment: 'DYEING', programId });
  fake.db.dyeingOrders.push({ id: orderId, orderNumber: `DYE-${orderId}`, status, programId, inboundChallanId: challanId, requiredQuantity: 100, dyedQuantity: 10 });
  return { programId, challanId };
}

const alertsFor = (entityId) => fake.db.alerts.filter((a) => a.entityId === entityId);
const activeFor = (entityId) => alertsFor(entityId).filter((a) => a.status === 'ACTIVE');

test('engine: creates one alert, and re-runs / refreshes / concurrent runs create no duplicates', async () => {
  seedOrder({ orderId: 'o1', deliveryDate: at('2026-10-27T00:00:00Z') }); // 3 days from 24 Oct
  const now = istNoon('2026-10-24');

  const first = await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(first.created, 1);
  assert.equal(activeFor('o1').length, 1);
  assert.equal(activeFor('o1')[0].dedupKey, 'DYEING:DYEING_ORDER:o1:DUE_SOON_3:2026-10-27');
  assert.equal(activeFor('o1')[0].severity, 'WARNING');
  assert.deepEqual(activeFor('o1')[0].recipientDepartments, ['DYEING']);

  const second = await reconcileDepartmentAlerts('DYEING', now);
  assert.deepEqual([second.created, second.reopened, second.updated, second.resolved], [0, 0, 0, 0]);

  await Promise.all([reconcileDepartmentAlerts('DYEING', now), reconcileDepartmentAlerts('DYEING', now), reconcileDepartmentAlerts('DYEING', now)]);
  assert.equal(alertsFor('o1').length, 1);
});

test('engine: concurrent first runs (retry overlap) still store a single alert', async () => {
  seedOrder({ orderId: 'o2', deliveryDate: at('2026-10-30T00:00:00Z') });
  const now = istNoon('2026-10-24');
  await Promise.all([reconcileDepartmentAlerts('DYEING', now), reconcileDepartmentAlerts('DYEING', now)]);
  assert.equal(alertsFor('o2').length, 1);
  assert.equal(alertsFor('o2')[0].thresholdDays, 7);
});

test('engine: moving into the next threshold supersedes the previous alert', async () => {
  await reconcileDepartmentAlerts('DYEING', istNoon('2026-10-26')); // o1 due tomorrow
  const o1 = alertsFor('o1');
  assert.equal(activeFor('o1').length, 1);
  assert.equal(activeFor('o1')[0].thresholdDays, 1);
  assert.equal(o1.find((a) => a.thresholdDays === 3).resolvedReason, 'SUPERSEDED');
});

test('engine: due today, then overdue at factory midnight', async () => {
  await reconcileDepartmentAlerts('DYEING', at('2026-10-27T18:29:00Z')); // 23:59 IST 27 Oct
  assert.equal(activeFor('o1')[0].alertType, 'DUE_TODAY');
  await reconcileDepartmentAlerts('DYEING', at('2026-10-27T18:31:00Z')); // 00:01 IST 28 Oct
  assert.equal(activeFor('o1')[0].alertType, 'OVERDUE');
  assert.equal(activeFor('o1')[0].severity, 'CRITICAL');
  // Overdue alert is not recreated day after day.
  await reconcileDepartmentAlerts('DYEING', istNoon('2026-10-30'));
  assert.equal(alertsFor('o1').filter((a) => a.alertType === 'OVERDUE').length, 1);
});

test('engine: dismissal is per user, never touches the work, and overdue stays visible', async () => {
  const now = istNoon('2026-10-30');
  const orderBefore = clone(fake.db.dyeingOrders.find((o) => o.id === 'o1'));
  const programBefore = clone(fake.db.programs.find((p) => p.id === 'prog-o1'));
  const challanBefore = clone(fake.db.challans.find((c) => c.id === 'ch-o1'));
  const alertId = activeFor('o1')[0].id;

  const r1 = await dismissAlertForUser(dyeingUserA, alertId);
  assert.equal(r1.status, 201);
  const r2 = await dismissAlertForUser(dyeingUserA, alertId); // idempotent
  assert.equal(r2.status, 200);
  assert.equal(fake.db.dismissals.filter((d) => d.alertId === alertId).length, 1);
  assert.equal(fake.db.audit.at(-1).action, 'DEADLINE_ALERT_DISMISSED');

  assert.deepEqual(fake.db.dyeingOrders.find((o) => o.id === 'o1'), orderBefore);
  assert.deepEqual(fake.db.programs.find((p) => p.id === 'prog-o1'), programBefore);
  assert.deepEqual(fake.db.challans.find((c) => c.id === 'ch-o1'), challanBefore);
  assert.equal(activeFor('o1')[0].status, 'ACTIVE');

  const forA = await listAlertsForUser(dyeingUserA, 'DYEING', now);
  const forB = await listAlertsForUser(dyeingUserB, 'DYEING', now);
  const aRow = forA.alerts.find((a) => a.id === alertId);
  const bRow = forB.alerts.find((a) => a.id === alertId);
  assert.ok(aRow, 'overdue alert stays listed after dismissal');
  assert.equal(aRow.dismissed, true);
  assert.equal(aRow.remainingLabel, 'Overdue by 3 days');
  assert.equal(bRow.dismissed, false);
  assert.ok(forB.visibleCount > forA.visibleCount);

  // Refresh after dismissal raises nothing new.
  const rerun = await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(rerun.created + rerun.reopened, 0);
});

test('engine: a dismissed upcoming alert stays hidden for that user until the next threshold', async () => {
  seedOrder({ orderId: 'o3', deliveryDate: at('2026-11-05T00:00:00Z') });
  await reconcileDepartmentAlerts('DYEING', istNoon('2026-10-30')); // 6 days -> DUE_SOON_7
  const alertId = activeFor('o3')[0].id;
  await dismissAlertForUser(dyeingUserA, alertId);

  for (const day of ['2026-10-30', '2026-10-31', '2026-11-01']) {
    await reconcileDepartmentAlerts('DYEING', istNoon(day));
    const list = await listAlertsForUser(dyeingUserA, 'DYEING', istNoon(day));
    assert.equal(list.alerts.some((a) => a.id === alertId || a.productionSheetId === 'SF-o3'), false, `hidden on ${day}`);
  }
  await reconcileDepartmentAlerts('DYEING', istNoon('2026-11-02')); // 3 days -> next threshold
  const list = await listAlertsForUser(dyeingUserA, 'DYEING', istNoon('2026-11-02'));
  const row = list.alerts.find((a) => a.productionSheetId === 'SF-o3');
  assert.ok(row, 'reappears at next threshold');
  assert.equal(row.dismissed, false);
});

test('engine: deadline change reschedules the alert and it reappears for a user who dismissed it', async () => {
  seedOrder({ orderId: 'o9', deliveryDate: at('2026-10-30T00:00:00Z') });
  const program = fake.db.programs.find((p) => p.id === 'prog-o9');
  const now = istNoon('2026-10-24');
  await reconcileDepartmentAlerts('DYEING', now);
  const oldId = activeFor('o9')[0].id;
  fake.db.clock = at('2026-10-24T06:45:00Z');
  await dismissAlertForUser(dyeingUserA, oldId);
  fake.db.clock = null;

  program.deliveryDate = at('2026-10-26T00:00:00Z');
  const r = await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(r.created, 1);
  assert.equal(fake.db.alerts.find((a) => a.id === oldId).resolvedReason, 'DEADLINE_CHANGED');
  assert.equal(activeFor('o9').length, 1);
  assert.equal(activeFor('o9')[0].deadlineDay, '2026-10-26');
  const list = await listAlertsForUser(dyeingUserA, 'DYEING', now);
  assert.equal(list.alerts.find((a) => a.productionSheetId === 'SF-o9')?.dismissed, false);

  // Deadline pushed far out: no alert at all.
  program.deliveryDate = at('2026-12-31T00:00:00Z');
  await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(activeFor('o9').length, 0);

  // Moved back to the original date: the old alert is reopened, and the earlier dismissal no longer hides it.
  program.deliveryDate = at('2026-10-30T00:00:00Z');
  const back = await reconcileDepartmentAlerts('DYEING', at('2026-10-24T07:00:00Z'));
  assert.equal(back.reopened, 1);
  assert.equal(activeFor('o9')[0].id, oldId);
  const again = await listAlertsForUser(dyeingUserA, 'DYEING', at('2026-10-24T07:00:00Z'));
  assert.equal(again.alerts.find((a) => a.id === oldId)?.dismissed, false);
});

test('engine: completed, cancelled and closed work has no active alerts', async () => {
  seedOrder({ orderId: 'o4', deliveryDate: at('2026-10-25T00:00:00Z') });
  seedOrder({ orderId: 'o5', deliveryDate: at('2026-10-25T00:00:00Z') });
  seedOrder({ orderId: 'o6', deliveryDate: at('2026-10-25T00:00:00Z') });
  const now = istNoon('2026-10-24');
  await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(activeFor('o4').length + activeFor('o5').length + activeFor('o6').length, 3);

  fake.db.dyeingOrders.find((o) => o.id === 'o4').status = 'SENT_TO_QC1';
  fake.db.programs.find((p) => p.id === 'prog-o5').status = 'CANCELLED';
  fake.db.programs.find((p) => p.id === 'prog-o6').status = 'COMPLETED';
  await reconcileDepartmentAlerts('DYEING', now);

  assert.equal(activeFor('o4').length + activeFor('o5').length + activeFor('o6').length, 0);
  assert.equal(alertsFor('o4')[0].resolvedReason, 'COMPLETED');
  assert.equal(alertsFor('o5')[0].resolvedReason, 'CANCELLED');
  assert.equal(alertsFor('o6')[0].resolvedReason, 'COMPLETED');
  const list = await listAlertsForUser(dyeingUserB, 'DYEING', now);
  assert.equal(list.alerts.some((a) => ['SF-o4', 'SF-o5', 'SF-o6'].includes(a.productionSheetId)), false);
});

test('engine: an inbound challan cancelled closes the dyeing task', async () => {
  seedOrder({ orderId: 'o7', deliveryDate: at('2026-10-25T00:00:00Z') });
  const now = istNoon('2026-10-24');
  await reconcileDepartmentAlerts('DYEING', now);
  fake.db.challans.find((c) => c.id === 'ch-o7').status = 'CANCELLED';
  await reconcileDepartmentAlerts('DYEING', now);
  assert.equal(activeFor('o7').length, 0);
  assert.equal(alertsFor('o7')[0].resolvedReason, 'CANCELLED');
});

test('engine: server-defaulted delivery date is reported as missing, never alerted', async () => {
  seedOrder({ orderId: 'o8', deliveryDate: at('2026-10-25T00:00:00Z'), meta: { deliveryDateDefaulted: true } });
  const r = await reconcileDepartmentAlerts('DYEING', istNoon('2026-10-24'));
  assert.equal(alertsFor('o8').length, 0);
  assert.ok(r.missingDeadline.some((i) => i.entityId === 'o8'));
});

test('authorization: other departments cannot see or dismiss Dyeing alerts', async () => {
  const dyeingConfig = config.alertConfigFor('DYEING');
  assert.equal(engine.canSeeDepartmentAlerts(qc1User, dyeingConfig), false);
  assert.equal(engine.canSeeDepartmentAlerts(dyeingUserA, dyeingConfig), true);
  assert.equal(engine.canSeeDepartmentAlerts({ ...qc1User, isAdmin: true }, dyeingConfig), true);
  const anyAlert = fake.db.alerts.find((a) => a.departmentCode === 'DYEING');
  const r = await dismissAlertForUser(qc1User, anyAlert.id);
  assert.equal(r.status, 404);
  assert.equal(fake.db.dismissals.some((d) => d.userId === qc1User.id), false);
  assert.equal((await dismissAlertForUser(dyeingUserA, 'no-such-alert')).status, 404);
});

test('config: Dyeing and Embroidery are enabled; enabling QC1 needs no code change', async () => {
  assert.deepEqual(config.enabledAlertDepartments(), ['DYEING', 'EMBROIDERY', 'THREAD_CUTTING', 'QC2', 'WASHING', 'QC3', 'RECUTTING', 'STITCHING', 'FINISHING', 'STEAM_PRESS', 'FINAL_CHECK', 'INVENTORY']);
  fake.db.programs.push({ id: 'prog-q', programNumber: 'PRG-q', programSerialNo: 'SF-q', designNumber: null, wilcomDesignNumber: 'W-1', styleCode: 'S', deliveryDate: at('2026-10-25T00:00:00Z'), status: 'IN_PRODUCTION', metadataJson: null });
  fake.db.challans.push({ id: 'ch-q', challanNumber: 'QC1-001', challanType: 'INTER_DEPARTMENT', status: 'UNDER_INSPECTION', toDepartment: 'QC1', programId: 'prog-q' });

  const disabled = await reconcileDepartmentAlerts('QC1', istNoon('2026-10-24'));
  assert.equal(disabled.created, 0);

  config.DEPARTMENT_ALERTS.QC1.enabled = true;
  try {
    const r = await reconcileDepartmentAlerts('QC1', istNoon('2026-10-24'));
    assert.equal(r.created, 1);
    const row = activeFor('ch-q')[0];
    assert.equal(row.departmentCode, 'QC1');
    assert.equal(row.challanNumber, 'QC1-001');
    assert.equal(row.designNumber, 'W-1');
    const list = await listAlertsForUser(qc1User, 'QC1', istNoon('2026-10-24'));
    assert.equal(list.alerts[0].remainingLabel, 'Due tomorrow');
  } finally {
    config.DEPARTMENT_ALERTS.QC1.enabled = false;
  }
});
