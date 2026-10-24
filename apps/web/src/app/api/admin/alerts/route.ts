import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';
import { getDepartmentAlertConfigs, getFactoryTimezone } from '@/lib/deadline-alerts/config';
import { getActiveAlertDepartments, syncAllDeadlineAlerts } from '@/lib/deadline-alerts/engine';
import { DEADLINE_TASK_PROVIDERS } from '@/lib/deadline-alerts/providers';
import { evaluateDeadline, formatRemaining } from '@/lib/deadline-alerts/schedule';

export const dynamic = 'force-dynamic';

// GET /api/admin/alerts?department=&severity=&status=ACTIVE|SUPERSEDED|RESOLVED&stage=&deadlineFrom=&deadlineTo=&page=
// Alerts across every department with their dismissal history, plus the engine configuration.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const runResults = await syncAllDeadlineAlerts();

    const where: any = {};
    const department = searchParams.get('department')?.trim().toUpperCase();
    const severity = searchParams.get('severity')?.trim().toUpperCase();
    const status = searchParams.get('status')?.trim().toUpperCase();
    const stage = searchParams.get('stage')?.trim().toUpperCase();
    if (department) where.departmentCode = department;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (stage) where.stage = stage;
    const deadline = parseDateRange(searchParams, 'deadlineFrom', 'deadlineTo');
    if (deadline) where.deadlineAt = deadline;

    const [total, rows, byStatus] = await Promise.all([
      prisma.deadlineAlert.count({ where }),
      prisma.deadlineAlert.findMany({
        where,
        orderBy: [{ status: 'asc' }, { deadlineAt: 'asc' }],
        skip,
        take: pageSize,
        include: {
          challan: { select: { id: true, challanNumber: true, status: true } },
          program: { select: { id: true, programSerialNo: true, programNumber: true, designNumber: true } },
          assignedUser: { select: { fullName: true } },
          dismissals: { select: { dismissedAt: true, user: { select: { fullName: true, username: true } } }, orderBy: { dismissedAt: 'desc' } },
        },
      }),
      prisma.deadlineAlert.groupBy({ by: ['departmentCode', 'status'], _count: { _all: true } }),
    ]);

    const timeZone = getFactoryTimezone();
    const configs = getDepartmentAlertConfigs();
    const now = new Date();
    const data = rows.map((alert) => {
      const thresholds = configs.find((c) => c.department === alert.departmentCode)?.thresholdsDays;
      const evaluation = evaluateDeadline(alert.deadlineAt, now, thresholds, timeZone);
      return { ...alert, deadlineDate: evaluation.deadlineDate, remaining: formatRemaining(evaluation.msRemaining) };
    });

    return NextResponse.json({
      success: true,
      data,
      page,
      pageSize,
      total,
      summary: byStatus.map((r) => ({ department: r.departmentCode, status: r.status, count: r._count._all })),
      config: {
        timeZone,
        activeDepartments: getActiveAlertDepartments(),
        departments: configs.map((c) => ({ ...c, hasTaskProvider: Boolean(DEADLINE_TASK_PROVIDERS[c.department]) })),
        // Configured through environment variables on the server (see lib/deadline-alerts/config.ts).
        settings: {
          DEADLINE_ALERTS_DEPARTMENTS: process.env.DEADLINE_ALERTS_DEPARTMENTS || null,
          DEADLINE_ALERT_THRESHOLD_DAYS: process.env.DEADLINE_ALERT_THRESHOLD_DAYS || null,
          DEADLINE_ALERTS_INTERVAL_MINUTES: process.env.DEADLINE_ALERTS_INTERVAL_MINUTES || null,
          DEADLINE_ALERTS_SCHEDULER: process.env.DEADLINE_ALERTS_SCHEDULER || null,
          FACTORY_TIMEZONE: process.env.FACTORY_TIMEZONE || null,
        },
      },
      lastRun: runResults,
    });
  } catch (error: any) {
    console.error('Error loading admin alerts:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}
