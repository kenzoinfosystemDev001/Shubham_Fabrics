import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { DYEING_ORDER_INCLUDE, DYEING_PROGRAM_SELECT, USER_NAME_SELECT, dyeingErrorResponse } from '@/lib/dyeing-server';

export const dynamic = 'force-dynamic';

const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

/**
 * GET /api/dyeing/history?view=lines|incoming|outgoing
 *   &from=YYYY-MM-DD&to=YYYY-MM-DD&challan=&design=&serial=&fabric=&color=&status=&priority=
 * Read-only history of Dyeing work. Nothing is filtered out by status unless asked, so cancelled
 * and corrected records stay visible.
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    const p = new URL(request.url).searchParams;
    const view = p.get('view') || 'lines';
    const f = (k: string) => p.get(k)?.trim() || '';
    const from = f('from') ? new Date(`${f('from')}T00:00:00`) : null;
    const to = f('to') ? new Date(`${f('to')}T23:59:59.999`) : null;
    const dateRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    const programFilter: any[] = [];
    if (f('design')) programFilter.push({ OR: [{ designNumber: contains(f('design')) }, { wilcomDesignNumber: contains(f('design')) }] });
    if (f('serial')) programFilter.push({ OR: [{ programSerialNo: contains(f('serial')) }, { programNumber: contains(f('serial')) }] });
    const program = programFilter.length ? { AND: programFilter } : undefined;

    if (view === 'lines') {
      const where: any = { AND: [] as any[] };
      if (dateRange) where.AND.push({ createdAt: dateRange });
      if (program) where.AND.push({ program });
      if (f('fabric')) where.AND.push({ fabricName: contains(f('fabric')) });
      if (f('color')) where.AND.push({ OR: [{ targetColor: contains(f('color')) }, { dyedColor: contains(f('color')) }] });
      if (f('status')) where.AND.push({ status: f('status') });
      if (f('priority')) where.AND.push({ priority: f('priority') });
      if (f('challan')) {
        where.AND.push({
          OR: [
            { inboundChallan: { challanNumber: contains(f('challan')) } },
            { qcTransfers: { some: { challan: { challanNumber: contains(f('challan')) } } } },
          ],
        });
      }
      const data = await prisma.dyeingOrder.findMany({ where, include: DYEING_ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 });
      return NextResponse.json({ data });
    }

    const outgoing = view === 'outgoing';
    const where: any = {
      AND: [
        outgoing ? { fromDepartment: 'DYEING', toDepartment: 'QC1' } : { toDepartment: { equals: 'DYEING', mode: 'insensitive' } },
      ] as any[],
    };
    if (dateRange) where.AND.push({ OR: [{ issuedDate: dateRange }, { issuedDate: null, createdAt: dateRange }] });
    if (program) where.AND.push({ program });
    if (f('challan')) where.AND.push({ challanNumber: contains(f('challan')) });
    if (f('status')) where.AND.push({ status: f('status') });
    if (f('priority')) where.AND.push({ priority: f('priority') });
    if (f('fabric')) where.AND.push({ items: { some: { OR: [{ fabricCode: contains(f('fabric')) }, { itemDescription: contains(f('fabric')) }] } } });
    if (f('color')) where.AND.push({ items: { some: { OR: [{ colour: contains(f('color')) }, { requiredColour: contains(f('color')) }] } } });

    const data = await prisma.challan.findMany({
      where,
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        program: { select: DYEING_PROGRAM_SELECT },
        parentChallan: { select: { id: true, challanNumber: true } },
        issuedBy: { select: USER_NAME_SELECT },
        receivedBy: { select: USER_NAME_SELECT },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: USER_NAME_SELECT } } },
      },
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load Dyeing history.');
  }
}
