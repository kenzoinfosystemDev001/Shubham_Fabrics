import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STITCHING');
  if (!authUser) return authResponse;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {
      toDepartment: { in: ['STITCHING', 'STITCH', 'ASSEMBLY'] },
      status: {
        in: [
          'RECEIVED',
          'IN_PROCESS',
          'COMPLETED',
          'READY_FOR_HANDOVER',
          'READY_FOR_FINISHING',
          'READY_FOR_DISPATCH',
          'ON_HOLD',
        ],
      },
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { challanNumber: { contains: search, mode: 'insensitive' } },
        { program: { programNumber: { contains: search, mode: 'insensitive' } } },
        { program: { styleCode: { contains: search, mode: 'insensitive' } } },
        { program: { clientName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const jobs = await prisma.challan.findMany({
      where: whereClause,
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
        issuedBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        productionLogs: {
          where: { departmentCode: { in: ['STITCHING', 'STITCH', 'ASSEMBLY'] } },
          orderBy: { recordedAt: 'desc' },
          include: {
            operator: { select: { id: true, fullName: true, username: true } },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { receivedDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error: any) {
    console.error('Error fetching Stitching queue:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stitching queue' },
      { status: 500 }
    );
  }
}
