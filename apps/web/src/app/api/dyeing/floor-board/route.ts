import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { DYEING_PROGRAM_SELECT, dyeingErrorResponse } from '@/lib/dyeing-server';
import { DYEING_STAGES, availableForQc, receivedBasis, remainingToDye, stageOf } from '@/lib/dyeing-workflow.mjs';

export const dynamic = 'force-dynamic';

const RECENT_DAYS = 30;

/**
 * GET /api/dyeing/floor-board — every Dyeing line in exactly one stage. Each line reports the
 * quantity that belongs to its stage (expected while awaiting receipt, received, remaining to dye,
 * available for QC, sent), so no quantity is counted in two stages. Fully transferred lines are
 * limited to the last 30 days.
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    await syncInboundChallansToDyeingOrders();
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000);
    const orders = await prisma.dyeingOrder.findMany({
      where: { OR: [{ status: { not: 'SENT_TO_QC1' } }, { sentToQc1At: { gte: since } }] },
      include: {
        program: { select: DYEING_PROGRAM_SELECT },
        inboundChallan: { select: { id: true, challanNumber: true } },
        qcTransfers: { select: { challan: { select: { id: true, challanNumber: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const stages = DYEING_STAGES.map((s) => ({ ...s, items: [] as any[] }));
    const byKey = new Map(stages.map((s) => [s.key, s]));
    for (const o of orders) {
      const stage = stageOf(o);
      const quantity =
        stage === 'AWAITING_RECEIPT'
          ? o.requiredQuantity
          : stage === 'RECEIVED' || stage === 'PENDING_DYEING'
          ? receivedBasis(o)
          : stage === 'IN_PROGRESS'
          ? remainingToDye(o)
          : stage === 'COMPLETED'
          ? availableForQc(o)
          : o.sentToQc1Quantity;
      byKey.get(stage)?.items.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        priority: o.priority,
        fabricName: o.fabricName,
        targetColor: o.targetColor,
        dyedColor: o.dyedColor,
        uom: o.uom,
        quantity,
        received: receivedBasis(o),
        dyed: o.dyedQuantity,
        sent: o.sentToQc1Quantity,
        availableForQc: availableForQc(o),
        challan: o.inboundChallan,
        qcChallans: Array.from(new Map(o.qcTransfers.map((t) => [t.challan.id, t.challan])).values()),
        program: o.program,
        expectedCompletionDate: o.expectedCompletionDate,
      });
    }
    return NextResponse.json({ data: { stages, generatedAt: new Date().toISOString() } });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load the Dyeing floor board.');
  }
}
