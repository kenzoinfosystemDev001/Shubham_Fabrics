import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { authorizeAlertAccess } from '@/lib/deadline-alerts/access';

export const dynamic = 'force-dynamic';

// POST /api/alerts/:id/dismiss
// Hides the alert from the caller's own active list. It never changes the challan, the task,
// its delivery date or any quantity, and other users keep seeing the alert.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const alert = await prisma.deadlineAlert.findUnique({
      where: { id },
      select: { id: true, departmentCode: true, stage: true, taskType: true, taskId: true, challanId: true },
    });
    if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

    const auth = await authorizeAlertAccess(request, alert.departmentCode);
    if (!auth.actor) return auth.response;

    const dismissal = await prisma.deadlineAlertDismissal.upsert({
      where: { alertId_userId: { alertId: id, userId: auth.actor.id } },
      create: { alertId: id, userId: auth.actor.id },
      update: {},
    });
    await prisma.auditLog.create({
      data: {
        actorId: auth.actor.id,
        action: 'DEADLINE_ALERT_DISMISSED',
        entity: 'DeadlineAlert',
        entityId: id,
        afterState: JSON.stringify({ stage: alert.stage, taskType: alert.taskType, taskId: alert.taskId, challanId: alert.challanId }),
      },
    });

    return NextResponse.json({ success: true, data: { alertId: id, dismissedAt: dismissal.dismissedAt } });
  } catch (error: any) {
    console.error('Error dismissing deadline alert:', error);
    return NextResponse.json({ error: 'Failed to dismiss alert' }, { status: 500 });
  }
}
