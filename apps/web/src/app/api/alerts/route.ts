import { NextResponse } from 'next/server';
import { requireDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import { alertConfigFor } from '@/lib/deadline-alerts/config';
import { listAlertsForUser, reconcileDepartmentAlerts, type ReconcileResult } from '@/lib/deadline-alerts/engine';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

// Every dashboard asks for its alerts on load. Re-evaluating a department's open work is idempotent
// and the scheduler keeps alerts current, so one pass per department per minute (per server) is enough;
// in between, the last pass is reused. Dismissals and the alert list itself are always read fresh.
const RECONCILE_EVERY_MS = 60_000;
const lastReconcile = new Map<string, { at: number; result: Promise<ReconcileResult> }>();

function reconcileThrottled(department: DepartmentKey, now: Date) {
  const last = lastReconcile.get(department);
  if (last && now.getTime() - last.at < RECONCILE_EVERY_MS) return last.result;
  const result = reconcileDepartmentAlerts(department, now);
  lastReconcile.set(department, { at: now.getTime(), result });
  // A failed pass is retried on the next request.
  result.catch(() => {
    if (lastReconcile.get(department)?.result === result) lastReconcile.delete(department);
  });
  return result;
}

/**
 * GET /api/alerts?department=DYEING
 * Active deadline alerts for a department, as the signed-in user sees them. Only members of the
 * department's recipient departments (and administrators) may read them.
 */
export async function GET(request: Request) {
  const department = (new URL(request.url).searchParams.get('department') || '').toUpperCase() as DepartmentKey;
  const config = alertConfigFor(department);
  if (!config) {
    return NextResponse.json({ error: 'Unknown department.' }, { status: 400 });
  }

  const { user: authUser, response: authResponse } = await requireDepartment(request, ...config.recipients);
  if (!authUser) return authResponse;

  if (!config.enabled) {
    return NextResponse.json({ data: { enabled: false, alerts: [], visibleCount: 0, overdueCount: 0, missingDeadline: [] } });
  }

  try {
    // The scheduler keeps alerts current; this pass picks up changes made since its last run
    // (it is idempotent and writes nothing when nothing changed).
    const now = new Date();
    const reconcile = await reconcileThrottled(department, now);
    const list = await listAlertsForUser(authUser, department, now);

    return NextResponse.json({
      data: {
        enabled: true,
        ...list,
        missingDeadline: reconcile.missingDeadline.map((item) => ({
          entityId: item.entityId,
          taskLabel: item.taskLabel,
          productionSheetId: item.productionSheetId,
          challanNumber: item.challanNumber,
          workStatus: item.workStatus,
          workHref: config.workHref(item),
        })),
      },
    });
  } catch (error) {
    // Setup problems (e.g. the alert tables not migrated yet) say what to run; anything else stays generic.
    return apiErrorResponse(error, 'Failed to load deadline alerts.', 'Error loading deadline alerts:');
  }
}
