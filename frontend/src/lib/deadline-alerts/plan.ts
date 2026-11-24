import { deadlineAlertKey, evaluateDeadline, type DeadlineSeverity, type DeadlineStage } from './schedule';

/** A unit of open work in a department, with its real deadline (or null when none was recorded). */
export interface DeadlineTask {
  department: string;
  taskType: string;
  taskId: string;
  challanId: string | null;
  challanNumber: string | null;
  programId: string | null;
  productionSheetNumber: string | null;
  designNumber: string | null;
  process: string;
  status: string;
  assignedUserId: string | null;
  deadline: Date | null;
  deadlineSource: string;
  viewUrl: string;
}

export interface ExistingActiveAlert {
  id: string;
  dedupeKey: string;
  taskType: string;
  taskId: string;
  deadlineAt: Date;
}

export interface DesiredAlert {
  dedupeKey: string;
  departmentCode: string;
  taskType: string;
  taskId: string;
  challanId: string | null;
  programId: string | null;
  assignedUserId: string | null;
  stage: DeadlineStage;
  severity: DeadlineSeverity;
  deadlineAt: Date;
  deadlineSource: string;
}

export type CloseReason = 'TASK_CLOSED' | 'STAGE_ADVANCED' | 'DEADLINE_CHANGED' | 'NOT_DUE' | 'DEADLINE_REMOVED';

export interface AlertPlan {
  /** Alerts that must exist and be ACTIVE (created if missing, re-activated if closed). */
  desired: DesiredAlert[];
  /** Active alerts to close, with the reason. TASK_CLOSED resolves; the others supersede. */
  close: Array<{ id: string; reason: CloseReason }>;
}

const taskKey = (taskType: string, taskId: string) => `${taskType}:${taskId}`;

/**
 * Decides which alerts should be active for a department right now. Deterministic and
 * side-effect free: running it again with the same inputs yields the same plan, which is
 * what keeps repeated scheduler runs and page refreshes from creating duplicates.
 */
export function planDepartmentAlerts(
  department: string,
  openTasks: DeadlineTask[],
  activeAlerts: ExistingActiveAlert[],
  now: Date,
  thresholdsDays: number[],
  timeZone: string
): AlertPlan {
  const desired: DesiredAlert[] = [];
  const close: AlertPlan['close'] = [];
  const tasksByKey = new Map(openTasks.map((t) => [taskKey(t.taskType, t.taskId), t]));
  const desiredKeyByTask = new Map<string, string | null>();

  for (const task of openTasks) {
    if (!task.deadline) {
      desiredKeyByTask.set(taskKey(task.taskType, task.taskId), null);
      continue;
    }
    const evaluation = evaluateDeadline(task.deadline, now, thresholdsDays, timeZone);
    if (!evaluation.stage || !evaluation.severity) {
      desiredKeyByTask.set(taskKey(task.taskType, task.taskId), null);
      continue;
    }
    const dedupeKey = deadlineAlertKey(department, task.taskType, task.taskId, evaluation.deadlineDate, evaluation.stage);
    desiredKeyByTask.set(taskKey(task.taskType, task.taskId), dedupeKey);
    desired.push({
      dedupeKey,
      departmentCode: department,
      taskType: task.taskType,
      taskId: task.taskId,
      challanId: task.challanId,
      programId: task.programId,
      assignedUserId: task.assignedUserId,
      stage: evaluation.stage,
      severity: evaluation.severity,
      deadlineAt: task.deadline,
      deadlineSource: task.deadlineSource,
    });
  }

  for (const alert of activeAlerts) {
    const key = taskKey(alert.taskType, alert.taskId);
    const task = tasksByKey.get(key);
    if (!task) {
      close.push({ id: alert.id, reason: 'TASK_CLOSED' });
      continue;
    }
    const wanted = desiredKeyByTask.get(key);
    if (wanted === alert.dedupeKey) continue;
    if (!task.deadline) {
      close.push({ id: alert.id, reason: 'DEADLINE_REMOVED' });
      continue;
    }
    const sameDeadline = task.deadline.getTime() === alert.deadlineAt.getTime();
    close.push({ id: alert.id, reason: !sameDeadline ? 'DEADLINE_CHANGED' : wanted ? 'STAGE_ADVANCED' : 'NOT_DUE' });
  }

  return { desired, close };
}

const STAGE_ORDER = (stage: string) =>
  stage === 'OVERDUE' ? 0 : stage === 'DUE_TODAY' ? 1 : 2 + (Number(stage.replace(/^D/, '')) || 99);

/** Most urgent first: overdue, due today, then fewest days remaining. */
export function compareStages(a: string, b: string): number {
  return STAGE_ORDER(a) - STAGE_ORDER(b);
}
