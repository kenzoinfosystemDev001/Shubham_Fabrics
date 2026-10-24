import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { auditAdminAction, readReason, reasonRequiredResponse, requireAdmin } from '@/lib/admin-auth';
import { guardStoreChallanStatusChange, StockChangeError } from '@/lib/fabric-stock-ledger';
import { isAlertDepartmentActive, syncDepartmentAlerts } from '@/lib/deadline-alerts/engine';
import { normalizeShelfDepartment } from '@/lib/defective-shelf';

export const dynamic = 'force-dynamic';

// POST /api/admin/challans/:id/cancel  { reason }
// Cancels instead of erasing: the challan, its items and history stay, Fabric Store stock is
// returned through the stock ledger, and the change is recorded as a challan event and audit entry.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  const reason = readReason(await request.json().catch(() => ({})));
  if (!reason) return reasonRequiredResponse();

  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true, program: { select: { fabricName: true } }, _count: { select: { childChallans: true } } },
    });
    if (!challan) return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    if (challan.status === 'CANCELLED') return NextResponse.json({ error: 'This challan is already cancelled.' }, { status: 409 });
    if (challan._count.childChallans > 0) {
      return NextResponse.json(
        { error: 'Downstream challans were already issued from this challan. Cancel those first so quantities stay reconciled.' },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const finishStock = await guardStoreChallanStatusChange(tx, challan, 'CANCELLED', auth.actor.id);
      const ch = await tx.challan.update({
        where: { id },
        data: { status: 'CANCELLED', remarks: [challan.remarks, `Cancelled by Admin: ${reason}`].filter(Boolean).join(' | ') },
      });
      await finishStock(tx);
      await tx.challanEvent.create({
        data: { challanId: id, fromStatus: challan.status, toStatus: 'CANCELLED', action: 'CANCEL', actorId: auth.actor.id, reason, notes: 'Cancelled from the Admin console' },
      });
      await auditAdminAction(request, auth.actor.id, 'CHALLAN_CANCELLED', 'Challan', id, {
        before: { status: challan.status },
        after: { status: 'CANCELLED', reason },
      }, tx);
      return ch;
    }, { maxWait: 15000, timeout: 30000 });

    // Cancelled work must not keep deadline alerts.
    const department = normalizeShelfDepartment(challan.toDepartment);
    if (department && isAlertDepartmentActive(department)) {
      await syncDepartmentAlerts(department).catch((err) => console.warn('[admin/cancel] alert re-sync failed:', err));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof StockChangeError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Error cancelling challan:', error);
    return NextResponse.json({ error: 'Failed to cancel challan' }, { status: 500 });
  }
}
