import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { DYEING_PROGRAM_SELECT, dyeingErrorResponse } from '@/lib/dyeing-server';
import { OPEN_DYEING_STATUSES, availableForQc, receivedBasis } from '@/lib/dyeing-workflow.mjs';

export const dynamic = 'force-dynamic';

type UnitTotals = Record<string, number>;
const add = (totals: UnitTotals, unit: string, qty: number) => {
  totals[unit] = Math.round(((totals[unit] || 0) + qty) * 1000) / 1000;
};

/**
 * GET /api/dyeing/dashboard — live counts for the Dyeing dashboard. Every number comes from the
 * database; quantities are totalled per unit (meters and pieces are never added together).
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    await syncInboundChallansToDyeingOrders();
    const now = new Date();

    const [openOrders, pendingInwardChallans, challansIssuedToQc, activeAlerts] = await Promise.all([
      prisma.dyeingOrder.findMany({
        where: { status: { in: OPEN_DYEING_STATUSES } },
        include: {
          program: { select: DYEING_PROGRAM_SELECT },
          inboundChallan: { select: { id: true, challanNumber: true } },
        },
      }),
      prisma.challan.count({
        where: { toDepartment: { equals: 'DYEING', mode: 'insensitive' }, dyeingInboundOrders: { some: { status: 'AWAITING_RECEIPT' } } },
      }),
      prisma.challan.count({ where: { fromDepartment: 'DYEING', toDepartment: 'QC1' } }),
      prisma.deadlineAlert.count({ where: { departmentCode: 'DYEING', status: 'ACTIVE' } }).catch(() => 0),
    ]);

    const received = openOrders.filter((o) => o.status === 'RECEIVED');
    const inProgress = openOrders.filter((o) => o.status === 'IN_DYEING' || o.status === 'PARTIALLY_DYED');
    const readyForQc = openOrders.filter((o) => availableForQc(o) > 0);
    const overdue = openOrders.filter((o) => o.program?.deliveryDate && new Date(o.program.deliveryDate) < now);

    const receivedQty: UnitTotals = {};
    for (const o of received) add(receivedQty, o.uom, receivedBasis(o));
    const readyQty: UnitTotals = {};
    for (const o of readyForQc) add(readyQty, o.uom, availableForQc(o));

    // Most urgent open work first: earliest delivery date, then priority.
    const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const pendingTasks = openOrders
      .slice()
      .sort((a, b) => {
        const da = a.program?.deliveryDate ? new Date(a.program.deliveryDate).getTime() : Infinity;
        const db = b.program?.deliveryDate ? new Date(b.program.deliveryDate).getTime() : Infinity;
        return da - db || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
      })
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        priority: o.priority,
        fabricName: o.fabricName,
        targetColor: o.targetColor,
        uom: o.uom,
        expected: o.requiredQuantity,
        received: receivedBasis(o),
        dyed: o.dyedQuantity,
        sent: o.sentToQc1Quantity,
        challanNumber: o.inboundChallan?.challanNumber ?? null,
        program: o.program,
      }));

    return NextResponse.json({
      data: {
        counts: {
          pendingInwardChallans,
          fabricReceived: received.length,
          dyeingInProgress: inProgress.length,
          readyForQc: readyForQc.length,
          challansIssuedToQc,
          deadlineAlerts: activeAlerts,
          overdueWork: overdue.length,
        },
        quantities: { received: receivedQty, readyForQc: readyQty },
        pendingTasks,
      },
    });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load the Dyeing dashboard.');
  }
}
