import { prisma } from '@subham/database';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { userBelongsToDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import { DEADLINE_ALERTS, alertConfigFor, enabledAlertDepartments, type DepartmentAlertConfig } from './config';
import { loadWorkItems, type WorkItem } from './sources';
import {
  alertDedupKey,
  daysBetween,
  describeRemaining,
  evaluateDeadline,
  factoryDay,
  liveSeverity,
  planTaskAlerts,
} from './rules.mjs';

const rules = () => ({
  timeZone: DEADLINE_ALERTS.timeZone,
  thresholds: [...DEADLINE_ALERTS.thresholds],
  warningWithinDays: DEADLINE_ALERTS.warningWithinDays,
});

export interface ReconcileResult {
  department: string;
  openItems: number;
  created: number;
  reopened: number;
  updated: number;
  resolved: number;
  missingDeadline: WorkItem[];
}

interface DesiredAlert {
  item: WorkItem;
  key: string;
  alertType: string;
  thresholdDays: number | null;
  severity: string;
  deadlineDay: string;
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

/**
 * Brings one department's alerts in line with its current work. Safe to run any number of
 * times, concurrently and across retries: every alert is addressed by its dedup key, and a
 * re-run with unchanged data writes nothing.
 */
export async function reconcileDepartmentAlerts(department: DepartmentKey, now: Date = new Date()): Promise<ReconcileResult> {
  const config = alertConfigFor(department);
  const result: ReconcileResult = { department, openItems: 0, created: 0, reopened: 0, updated: 0, resolved: 0, missingDeadline: [] };
  if (!config?.enabled) return result;

  const [items, activeAlerts] = await Promise.all([
    loadWorkItems(config.source),
    prisma.deadlineAlert.findMany({
      where: { departmentCode: department, status: 'ACTIVE' },
      select: { id: true, dedupKey: true, entityId: true, deadlineDay: true, workStatus: true, severity: true },
    }),
  ]);
  result.openItems = items.length;

  const activeByEntity = new Map<string, typeof activeAlerts>();
  for (const alert of activeAlerts) {
    const list = activeByEntity.get(alert.entityId) || [];
    list.push(alert);
    activeByEntity.set(alert.entityId, list);
  }

  const resolveIds = new Map<string, string>(); // alertId -> reason
  const desired: DesiredAlert[] = [];
  const openIds = new Set(items.map((i) => i.entityId));

  for (const item of items) {
    const active = activeByEntity.get(item.entityId) || [];
    if (!item.isOpen) {
      // Task status looks open but its production sheet or source challan was closed / cancelled.
      for (const a of active) resolveIds.set(a.id, item.closedReason || 'CLOSED');
      continue;
    }
    if (!item.deadline) {
      result.missingDeadline.push(item);
      for (const a of active) resolveIds.set(a.id, 'DEADLINE_CHANGED');
      continue;
    }
    const evaluation = evaluateDeadline(item.deadline, now, rules());
    if (!evaluation.stage) {
      for (const a of active) resolveIds.set(a.id, a.deadlineDay !== evaluation.deadlineDay ? 'DEADLINE_CHANGED' : 'NO_LONGER_DUE');
      continue;
    }
    desired.push({
      item,
      key: alertDedupKey({ departmentCode: department, entityType: item.entityType, entityId: item.entityId, ...evaluation.stage, deadlineDay: evaluation.deadlineDay }),
      alertType: evaluation.stage.alertType,
      thresholdDays: evaluation.stage.thresholdDays,
      severity: evaluation.stage.severity,
      deadlineDay: evaluation.deadlineDay as string,
    });
  }

  // Alerts whose task is no longer in the open list: re-read the task to record why.
  const goneEntityIds = [...activeByEntity.keys()].filter((id) => !openIds.has(id));
  if (goneEntityIds.length > 0) {
    const current = new Map((await loadWorkItems(config.source, goneEntityIds)).map((i) => [i.entityId, i]));
    for (const entityId of goneEntityIds) {
      const item = current.get(entityId);
      if (item?.isOpen) continue; // Re-opened between the two reads; the next run evaluates it.
      for (const a of activeByEntity.get(entityId) || []) resolveIds.set(a.id, item?.closedReason || 'CLOSED');
    }
  }

  const existing = desired.length
    ? await prisma.deadlineAlert.findMany({
        where: { dedupKey: { in: desired.map((d) => d.key) } },
        select: { id: true, dedupKey: true, status: true, workStatus: true, severity: true },
      })
    : [];
  const existingByKey = new Map(existing.map((e) => [e.dedupKey, e]));

  const toCreate: DesiredAlert[] = [];
  const toReopen: DesiredAlert[] = [];
  for (const d of desired) {
    const plan = planTaskAlerts({
      desiredKey: d.key,
      existingByKey: existingByKey.get(d.key),
      activeAlerts: activeByEntity.get(d.item.entityId) || [],
      deadlineDay: d.deadlineDay,
    });
    for (const r of plan.resolve) resolveIds.set(r.id, r.reason);
    if (plan.action === 'create') toCreate.push(d);
    if (plan.action === 'reopen') toReopen.push(d);
    if (plan.action === 'keep') {
      const e = existingByKey.get(d.key)!;
      if (e.workStatus !== d.item.workStatus || e.severity !== d.severity) {
        await prisma.deadlineAlert.updateMany({
          where: { id: e.id, status: 'ACTIVE' },
          data: { workStatus: d.item.workStatus, severity: d.severity, lastEvaluatedAt: now },
        });
        result.updated++;
      }
    }
  }

  // Resolve first so a task never shows two active alerts.
  const byReason = new Map<string, string[]>();
  for (const [id, reason] of resolveIds) byReason.set(reason, [...(byReason.get(reason) || []), id]);
  for (const [reason, ids] of byReason) {
    const { count } = await prisma.deadlineAlert.updateMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      data: { status: 'RESOLVED', resolvedReason: reason, resolvedAt: now, lastEvaluatedAt: now },
    });
    result.resolved += count;
  }

  // Recheck status and deadline right before raising anything new.
  const pending = [...toCreate, ...toReopen];
  if (pending.length > 0) {
    const fresh = new Map((await loadWorkItems(config.source, pending.map((d) => d.item.entityId))).map((i) => [i.entityId, i]));
    const stillValid = (d: DesiredAlert) => {
      const f = fresh.get(d.item.entityId);
      return !!f?.isOpen && !!f.deadline && factoryDay(f.deadline, DEADLINE_ALERTS.timeZone) === d.deadlineDay;
    };

    for (const d of toCreate.filter(stillValid)) {
      try {
        await prisma.deadlineAlert.create({ data: alertData(department, config, d, now) });
        result.created++;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error; // Another run created it first.
      }
    }
    for (const d of toReopen.filter(stillValid)) {
      const { count } = await prisma.deadlineAlert.updateMany({
        where: { dedupKey: d.key, status: 'RESOLVED' },
        data: {
          ...alertData(department, config, d, now),
          status: 'ACTIVE',
          resolvedReason: null,
          resolvedAt: null,
          activatedAt: now,
        },
      });
      result.reopened += count;
    }
  }

  return result;
}

function alertData(department: DepartmentKey, config: DepartmentAlertConfig, d: DesiredAlert, now: Date) {
  return {
    dedupKey: d.key,
    departmentCode: department,
    entityType: d.item.entityType,
    entityId: d.item.entityId,
    programId: d.item.programId,
    challanId: d.item.challanId,
    alertType: d.alertType,
    thresholdDays: d.thresholdDays,
    severity: d.severity,
    deadlineAt: d.item.deadline as Date,
    deadlineDay: d.deadlineDay,
    timeZone: DEADLINE_ALERTS.timeZone,
    workStatus: d.item.workStatus,
    taskLabel: d.item.taskLabel,
    productionSheetId: d.item.productionSheetId,
    designNumber: d.item.designNumber,
    challanNumber: d.item.challanNumber,
    recipientDepartments: [...config.recipients],
    lastEvaluatedAt: now,
  };
}

/** Runs every enabled department; one department failing does not stop the others. */
export async function reconcileAllDepartments(now: Date = new Date()) {
  const results: Array<Omit<ReconcileResult, 'missingDeadline'> & { missingDeadline: number; error?: string }> = [];
  for (const department of enabledAlertDepartments()) {
    try {
      const r = await reconcileDepartmentAlerts(department, now);
      results.push({ ...r, missingDeadline: r.missingDeadline.length });
    } catch (error: any) {
      console.error(`Deadline alerts: reconcile failed for ${department}:`, error);
      results.push({ department, openItems: 0, created: 0, reopened: 0, updated: 0, resolved: 0, missingDeadline: 0, error: error?.message || 'failed' });
    }
  }
  return results;
}

export interface AlertView {
  id: string;
  severity: string;
  alertType: string;
  thresholdDays: number | null;
  daysRemaining: number;
  remainingLabel: string;
  productionSheetId: string | null;
  designNumber: string | null;
  challanNumber: string | null;
  taskLabel: string;
  deadlineAt: string;
  deadlineDay: string;
  workStatus: string;
  workHref: string;
  /** Dismissed by this user. Overdue alerts stay listed (as acknowledged) even when dismissed. */
  dismissed: boolean;
}

/** True when the user may see a department's alerts: admins, or members of any recipient department. */
export function canSeeDepartmentAlerts(user: AuthenticatedUser, config: DepartmentAlertConfig) {
  return config.recipients.some((key) => userBelongsToDepartment(user, key));
}

/** Active alerts for one department as this user sees them, most urgent first. */
export async function listAlertsForUser(user: AuthenticatedUser, department: DepartmentKey, now: Date = new Date()) {
  const config = alertConfigFor(department);
  if (!config?.enabled) return { alerts: [] as AlertView[], visibleCount: 0, overdueCount: 0 };

  const alerts = await prisma.deadlineAlert.findMany({
    where: { departmentCode: department, status: 'ACTIVE' },
    include: { dismissals: { where: { userId: user.id }, orderBy: { dismissedAt: 'desc' }, take: 1 } },
    orderBy: { deadlineAt: 'asc' },
  });

  const today = factoryDay(now, DEADLINE_ALERTS.timeZone);
  const views: AlertView[] = [];
  for (const alert of alerts) {
    const daysRemaining = daysBetween(today, alert.deadlineDay);
    const lastDismissal = alert.dismissals[0];
    const dismissed = !!lastDismissal && lastDismissal.dismissedAt >= alert.activatedAt;
    if (dismissed && daysRemaining >= 0) continue;
    views.push({
      id: alert.id,
      severity: liveSeverity(daysRemaining, alert.severity),
      alertType: daysRemaining < 0 ? 'OVERDUE' : alert.alertType,
      thresholdDays: alert.thresholdDays,
      daysRemaining,
      remainingLabel: describeRemaining(daysRemaining),
      productionSheetId: alert.productionSheetId,
      designNumber: alert.designNumber,
      challanNumber: alert.challanNumber,
      taskLabel: alert.taskLabel,
      deadlineAt: alert.deadlineAt.toISOString(),
      deadlineDay: alert.deadlineDay,
      workStatus: alert.workStatus,
      workHref: config.workHref({ entityId: alert.entityId, challanId: alert.challanId, programId: alert.programId }),
      dismissed,
    });
  }
  // Undismissed first, then by how close (or how late) the deadline is.
  views.sort((a, b) => Number(a.dismissed) - Number(b.dismissed) || a.daysRemaining - b.daysRemaining);

  return {
    alerts: views,
    visibleCount: views.filter((v) => !v.dismissed).length,
    overdueCount: views.filter((v) => v.daysRemaining < 0).length,
  };
}

/**
 * Records that this user dismissed an alert. Writes only the dismissal history (and an audit
 * entry); the task, challan, dates and quantities are never touched. Idempotent.
 */
export async function dismissAlertForUser(user: AuthenticatedUser, alertId: string) {
  const alert = await prisma.deadlineAlert.findUnique({
    where: { id: alertId },
    select: { id: true, departmentCode: true, status: true, activatedAt: true, dedupKey: true },
  });
  const config = alert ? alertConfigFor(alert.departmentCode) : null;
  if (!alert || !config || !canSeeDepartmentAlerts(user, config)) return { status: 404 as const };

  const current = await prisma.deadlineAlertDismissal.findFirst({
    where: { alertId, userId: user.id, dismissedAt: { gte: alert.activatedAt } },
    orderBy: { dismissedAt: 'desc' },
  });
  if (current) return { status: 200 as const, dismissal: current };

  const dismissal = await prisma.$transaction(async (tx) => {
    // Same clock as activatedAt (set by the engine), so "dismissed since activation" compares like with like.
    const created = await tx.deadlineAlertDismissal.create({ data: { alertId, userId: user.id, dismissedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DEADLINE_ALERT_DISMISSED',
        entity: 'DeadlineAlert',
        entityId: alertId,
        afterState: JSON.stringify({ dedupKey: alert.dedupKey, dismissedAt: created.dismissedAt }),
      },
    });
    return created;
  });
  return { status: 201 as const, dismissal };
}
