import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';
import { CANCELLED_CHALLAN_STATUSES, COMPLETED_CHALLAN_STATUSES } from '@/lib/admin-metrics';

export const dynamic = 'force-dynamic';

// GET /api/admin/challans
//   q (challan number / barcode), sheet (serial or program no.), design, from, to (department codes),
//   status | group=PENDING|COMPLETED|CANCELLED, priority, dateFrom/dateTo, deliveryFrom/deliveryTo,
//   fabric, color, page, pageSize
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const text = (key: string) => searchParams.get(key)?.trim() || '';
    const and: any[] = [];

    // The printed challan barcode encodes the challan number, so a barcode scan searches it too.
    if (text('q')) and.push({ challanNumber: { contains: text('q'), mode: 'insensitive' } });
    if (text('sheet')) {
      and.push({ program: { OR: [
        { programSerialNo: { contains: text('sheet'), mode: 'insensitive' } },
        { programNumber: { contains: text('sheet'), mode: 'insensitive' } },
      ] } });
    }
    if (text('design')) and.push({ program: { designNumber: { contains: text('design'), mode: 'insensitive' } } });
    if (text('from')) and.push({ fromDepartment: text('from').toUpperCase() });
    if (text('to')) and.push({ toDepartment: text('to').toUpperCase() });
    if (text('department')) and.push({ OR: [{ fromDepartment: text('department').toUpperCase() }, { toDepartment: text('department').toUpperCase() }] });
    if (text('status')) and.push({ status: text('status').toUpperCase() });
    const group = text('group').toUpperCase();
    if (group === 'COMPLETED') and.push({ status: { in: COMPLETED_CHALLAN_STATUSES } });
    if (group === 'CANCELLED') and.push({ status: { in: CANCELLED_CHALLAN_STATUSES } });
    if (group === 'PENDING') and.push({ status: { notIn: [...COMPLETED_CHALLAN_STATUSES, ...CANCELLED_CHALLAN_STATUSES] } });
    if (text('priority')) and.push({ priority: text('priority').toUpperCase() });
    const issued = parseDateRange(searchParams, 'dateFrom', 'dateTo');
    if (issued) and.push({ OR: [{ issuedDate: issued }, { issuedDate: null, createdAt: issued }] });
    const delivery = parseDateRange(searchParams, 'deliveryFrom', 'deliveryTo');
    if (delivery) and.push({ deliveryDate: delivery });
    if (text('fabric')) {
      and.push({ items: { some: { OR: [
        { fabricCode: { contains: text('fabric'), mode: 'insensitive' } },
        { itemDescription: { contains: text('fabric'), mode: 'insensitive' } },
      ] } } });
    }
    if (text('color')) {
      and.push({ items: { some: { OR: [
        { colour: { contains: text('color'), mode: 'insensitive' } },
        { requiredDyeColor: { contains: text('color'), mode: 'insensitive' } },
        { shade: { contains: text('color'), mode: 'insensitive' } },
      ] } } });
    }
    const where = and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.challan.count({ where }),
      prisma.challan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          program: { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, clientName: true, buyerName: true } },
          items: { select: { id: true, fabricCode: true, itemDescription: true, colour: true, requiredDyeColor: true, shade: true, quantity: true, uom: true } },
          parentChallan: { select: { id: true, challanNumber: true } },
          createdBy: { select: { fullName: true } },
          _count: { select: { childChallans: true } },
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: rows, page, pageSize, total });
  } catch (error: any) {
    console.error('Error listing admin challans:', error);
    return NextResponse.json({ error: 'Failed to load challans' }, { status: 500 });
  }
}
