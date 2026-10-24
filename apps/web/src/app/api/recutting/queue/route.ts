import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    const where: any = {
      toDepartment: { in: ['RECUTTING', 'RE-CUTTING', 'CUTTING_RECUT'] },
    };

    if (status && status !== 'ALL') {
      where.status = status;
    } else {
      // Default: show jobs currently in the operational queue
      where.status = { in: ['RECEIVED', 'IN_PROCESS', 'COMPLETED', 'READY_FOR_STITCHING', 'ON_HOLD', 'HANDED_OVER'] };
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        {
          program: {
            OR: [
              { programNumber: { contains: search, mode: 'insensitive' } },
              { programSerialNo: { contains: search, mode: 'insensitive' } },
              { clientName: { contains: search, mode: 'insensitive' } },
              { designNumber: { contains: search, mode: 'insensitive' } },
              { wilcomDesignNumber: { contains: search, mode: 'insensitive' } },
              { styleCode: { contains: search, mode: 'insensitive' } },
              { fabricName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const queueItems = await prisma.challan.findMany({
      where,
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            sizes: true,
            specifications: true,
          },
        },
        items: true,
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            issuedDate: true,
          },
        },
        receivedBy: {
          select: { id: true, fullName: true, username: true },
        },
        productionLogs: {
          where: {
            departmentCode: { in: ['RECUTTING', 'RE-CUTTING'] },
          },
          include: {
            operator: { select: { fullName: true, username: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
        childChallans: {
          where: {
            toDepartment: 'STITCHING',
          },
          select: {
            id: true,
            challanNumber: true,
            status: true,
            issuedDate: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { receivedDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      count: queueItems.length,
      data: queueItems,
    });
  } catch (error: any) {
    console.error('Error fetching Recutting queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Recutting work queue' },
      { status: 500 }
    );
  }
}
