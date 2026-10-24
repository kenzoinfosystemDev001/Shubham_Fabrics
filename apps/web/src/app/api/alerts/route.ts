import { NextResponse } from 'next/server';
import { requireDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import { alertConfigFor } from '@/lib/deadline-alerts/config';
import { listAlertsForUser, reconcileDepartmentAlerts } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';

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
    const reconcile = await reconcileDepartmentAlerts(department, now);
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
  } catch (error: any) {
    console.error('Error loading deadline alerts:', error);
    return NextResponse.json({ error: 'Failed to load deadline alerts.' }, { status: 500 });
  }
}
