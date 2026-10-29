import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { DYEING_ORDER_INCLUDE, DYEING_PROGRAM_SELECT, USER_NAME_SELECT, dyeingErrorResponse } from '@/lib/dyeing-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dyeing/challans?view=pending|received|all&search=
 * Challans issued to Dyeing with their per-line dyeing records. "pending" = at least one line
 * still awaiting receipt.
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    await syncInboundChallansToDyeingOrders();
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'pending';
    const search = searchParams.get('search')?.trim();

    const where: any = { toDepartment: { equals: 'DYEING', mode: 'insensitive' }, dyeingInboundOrders: { some: {} } };
    if (view === 'pending') where.dyeingInboundOrders = { some: { status: 'AWAITING_RECEIPT' } };
    if (view === 'received') where.dyeingInboundOrders = { some: {}, none: { status: 'AWAITING_RECEIPT' } };
    if (search) {
      where.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        { program: { programNumber: { contains: search, mode: 'insensitive' } } },
        { program: { programSerialNo: { contains: search, mode: 'insensitive' } } },
        { program: { designNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const challans = await prisma.challan.findMany({
      where,
      include: {
        program: { select: DYEING_PROGRAM_SELECT },
        items: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: USER_NAME_SELECT },
        issuedBy: { select: USER_NAME_SELECT },
        receivedBy: { select: USER_NAME_SELECT },
        dyeingInboundOrders: { include: DYEING_ORDER_INCLUDE, orderBy: { orderNumber: 'asc' } },
      },
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return NextResponse.json({ data: challans });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load incoming challans.');
  }
}
