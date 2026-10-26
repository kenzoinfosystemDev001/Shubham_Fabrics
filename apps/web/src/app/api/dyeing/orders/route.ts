import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { DYEING_ORDER_INCLUDE, dyeingErrorResponse } from '@/lib/dyeing-server';
import { OPEN_DYEING_STATUSES, availableForQc, stageOf } from '@/lib/dyeing-workflow.mjs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dyeing/orders
 * Filters: status (comma list), stage (Floor Board stage key), open=1 (work still in Dyeing),
 * overdue=1 (open and past delivery date), qcReady=1 (dyed quantity not yet sent),
 * programId, priority, search.
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    await syncInboundChallansToDyeingOrders();
    const p = new URL(request.url).searchParams;
    const statuses = (p.get('status') || '').split(',').map((s) => s.trim()).filter((s) => s && s !== 'ALL');
    const priority = p.get('priority');
    const search = p.get('search')?.trim();

    const where: any = {};
    if (statuses.length) where.status = { in: statuses };
    else if (p.get('open') === '1' || p.get('overdue') === '1') where.status = { in: OPEN_DYEING_STATUSES };
    if (priority && priority !== 'ALL') where.priority = priority;
    if (p.get('programId')) where.programId = p.get('programId');
    if (p.get('overdue') === '1') where.program = { deliveryDate: { lt: new Date() } };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { fabricName: { contains: search, mode: 'insensitive' } },
        { targetColor: { contains: search, mode: 'insensitive' } },
        { dyedColor: { contains: search, mode: 'insensitive' } },
        { inboundChallan: { challanNumber: { contains: search, mode: 'insensitive' } } },
        {
          program: {
            OR: [
              { programNumber: { contains: search, mode: 'insensitive' } },
              { programSerialNo: { contains: search, mode: 'insensitive' } },
              { designNumber: { contains: search, mode: 'insensitive' } },
              { clientName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    let orders = await prisma.dyeingOrder.findMany({
      where,
      include: DYEING_ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { orderNumber: 'asc' }],
      take: 500,
    });
    const stage = p.get('stage');
    if (stage) orders = orders.filter((o) => stageOf(o) === stage);
    if (p.get('qcReady') === '1') orders = orders.filter((o) => availableForQc(o) > 0);

    return NextResponse.json({ data: orders });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load dyeing records.');
  }
}
