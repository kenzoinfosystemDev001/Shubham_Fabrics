import { prisma } from '@subham/database';
import { getDepartmentAlertConfig, getDepartmentAlertConfigs, getFactoryTimezone } from './config';
import { compareStages, planDepartmentAlerts, type DeadlineTask } from './plan';
import { DEADLINE_TASK_PROVIDERS, type DeadlineTaskProvider } from './providers';

/** Database access the engine needs; injectable so the engine can be tested without a database. */
export type AlertStore = Pick<typeof prisma, 'deadlineAlert' | 'deadlineAlertDismissal'>;
export interface EngineDeps {
  db?: AlertStore;
  providers?: Record<string, DeadlineTaskProvider>;
}
import { evaluateDeadline, formatRemaining } from './schedule';

/** Departments that are enabled in config AND have a task provider. */
export function getActiveAlertDepartments(): string[] {
  return getDepartmentAlertConfigs()
    .filter((c) => c.enabled && DEADLINE_TASK_PROVIDERS[c.department])
    .map((c) => c.department);
}

export function isAlertDepartmentActive(department: string): boolean {
  return getActiveAlertDepartments().includes(department);
}

export interface SyncResult {
  department: string;
  openTasks: DeadlineTask[];
  created: number;
  reactivated: number;
  closed: number;
}

/**
 * Brings one department's alerts in line with its current open work and deadlines.
 * Idempotent: the plan is recomputed from current task status and deadline every time,
 * alerts are keyed by dedupeKey (unique), and only state transitions are written.
 */
export async function syncDepartmentAlerts(department: string, now: Date = new Date(), deps: EngineDeps = {}): Promise<SyncResult> {
  const db = deps.db || prisma;
  const config = getDepartmentAlertConfig(department);
  const provider = (deps.providers || DEADLINE_TASK_PROVIDERS)[department];
  if (!config?.enabled || !provider) {
    return { department, openTasks: [], created: 0, reactivated: 0, closed: 0 };
  }

  const openTasks = await provider();
  const activeAlerts = await db.deadlineAlert.findMany({
    where: { departmentCode: department, status: 'ACTIVE' },
    select: { id: true, dedupeKey: true, taskType: true, taskId: true, deadlineAt: true },
  });
  const plan = planDepartmentAlerts(department, openTasks, activeAlerts, now, config.thresholdsDays, getFactoryTimezone());

  let created = 0;
  let reactivated = 0;
  if (plan.desired.length > 0) {
    const result = await db.deadlineAlert.createMany({
      data: plan.desired.map((d) => ({ ...d, lastEvaluatedAt: now })),
      skipDuplicates: true,
    });
    created = result.count;
    const keys = plan.desired.map((d) => d.dedupeKey);
    // A condition that was closed and now holds again (e.g. a deadline moved back) is re-opened,
    // keeping its existing per-user dismissals.
    reactivated = (await db.deadlineAlert.updateMany({
      where: { dedupeKey: { in: keys }, status: { not: 'ACTIVE' } },
      data: { status: 'ACTIVE', resolvedAt: null, resolutionReason: null, lastEvaluatedAt: now },
    })).count;
    await db.deadlineAlert.updateMany({
      where: { dedupeKey: { in: keys }, status: 'ACTIVE' },
      data: { lastEvaluatedAt: now },
    });
  }

  let closed = 0;
  const byReason = new Map<string, string[]>();
  for (const { id, reason } of plan.close) byReason.set(reason, [...(byReason.get(reason) || []), id]);
  for (const [reason, ids] of byReason) {
    closed += (await db.deadlineAlert.updateMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      data: {
        status: reason === 'TASK_CLOSED' ? 'RESOLVED' : 'SUPERSEDED',
        resolutionReason: reason,
        resolvedAt: now,
        lastEvaluatedAt: now,
      },
    })).count;
  }

  return { department, openTasks, created, reactivated, closed };
}

/** Runs every active department. Failures are isolated per department and reported. */
export async function syncAllDeadlineAlerts(now: Date = new Date()) {
  const results: Array<
    { department: string; openTaskCount: number; created: number; reactivated: number; closed: number } | { department: string; error: string }
  > = [];
  for (const department of getActiveAlertDepartments()) {
    try {
      const { openTasks, ...summary } = await syncDepartmentAlerts(department, now);
      results.push({ ...summary, openTaskCount: openTasks.length });
    } catch (error) {
      console.error(`[deadline-alerts] Sync failed for ${department}:`, error);
      results.push({ department, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export interface AlertViewItem {
  id: string;
  stage: string;
  severity: string;
  deadlineAt: string;
  deadlineDate: string;
  remaining: string;
  daysRemaining: number;
  challanNumber: string | null;
  productionSheetNumber: string | null;
  designNumber: string | null;
  process: string;
  status: string;
  viewUrl: string;
  dismissedAt: string | null;
}

/**
 * The alert panel for one user: their active (not dismissed) alerts, their dismissal history,
 * and work that is overdue regardless of dismissal, plus how much open work has no deadline.
 */
export async function getDepartmentAlertView(department: string, userId: string, now: Date = new Date(), deps: EngineDeps = {}) {
  const db = deps.db || prisma;
  const { openTasks } = await syncDepartmentAlerts(department, now, deps);
  const timeZone = getFactoryTimezone();
  const config = getDepartmentAlertConfig(department);
  const tasksByKey = new Map(openTasks.map((t) => [`${t.taskType}:${t.taskId}`, t]));

  const toItem = (alert: { id: string; stage: string; severity: string; deadlineAt: Date; taskType: string; taskId: string }, dismissedAt: Date | null): AlertViewItem | null => {
    const task = tasksByKey.get(`${alert.taskType}:${alert.taskId}`);
    if (!task) return null;
    const evaluation = evaluateDeadline(alert.deadlineAt, now, config?.thresholdsDays, timeZone);
    return {
      id: alert.id,
      stage: alert.stage,
      severity: alert.severity,
      deadlineAt: alert.deadlineAt.toISOString(),
      deadlineDate: evaluation.deadlineDate,
      remaining: formatRemaining(evaluation.msRemaining),
      daysRemaining: evaluation.daysRemaining,
      challanNumber: task.challanNumber,
      productionSheetNumber: task.productionSheetNumber,
      designNumber: task.designNumber,
      process: task.process,
      status: task.status,
      viewUrl: task.viewUrl,
      dismissedAt: dismissedAt ? dismissedAt.toISOString() : null,
    };
  };

  const active = await db.deadlineAlert.findMany({
    where: { departmentCode: department, status: 'ACTIVE' },
    include: { dismissals: { where: { userId }, select: { dismissedAt: true } } },
  });
  const alerts = active
    .filter((a) => a.dismissals.length === 0)
    .map((a) => toItem(a, null))
    .filter((a): a is AlertViewItem => Boolean(a))
    .sort((a, b) => compareStages(a.stage, b.stage) || a.daysRemaining - b.daysRemaining);

  const dismissedRows = await db.deadlineAlertDismissal.findMany({
    where: { userId, alert: { departmentCode: department } },
    include: { alert: true },
    orderBy: { dismissedAt: 'desc' },
    take: 20,
  });
  const dismissed = dismissedRows.map((row) => {
    const task = tasksByKey.get(`${row.alert.taskType}:${row.alert.taskId}`);
    return {
      id: row.alert.id,
      stage: row.alert.stage,
      severity: row.alert.severity,
      alertStatus: row.alert.status,
      deadlineAt: row.alert.deadlineAt.toISOString(),
      dismissedAt: row.dismissedAt.toISOString(),
      challanNumber: task?.challanNumber || null,
      process: task?.process || null,
      viewUrl: task?.viewUrl || null,
    };
  });

  // Overdue stays visible even when its alert was dismissed.
  const overdueWork = openTasks
    .filter((t) => t.deadline && evaluateDeadline(t.deadline, now, config?.thresholdsDays, timeZone).stage === 'OVERDUE')
    .map((t) => ({
      taskId: t.taskId,
      challanNumber: t.challanNumber,
      process: t.process,
      remaining: formatRemaining(evaluateDeadline(t.deadline as Date, now, config?.thresholdsDays, timeZone).msRemaining),
      viewUrl: t.viewUrl,
    }));

  return {
    department,
    timeZone,
    thresholdsDays: config?.thresholdsDays || [],
    alerts,
    dismissed,
    overdueWork,
    missingDeadlineCount: openTasks.filter((t) => !t.deadline).length,
    openTaskCount: openTasks.length,
  };
}
