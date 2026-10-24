import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const validDepts = ['WASHING_QC'];

    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: {
          in: validDepts,
        },
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            fabricName: true,
            fabricType: true,
            fabricColor: true,
            deliveryDate: true,
            priority: true,
            wilcomDesignNumber: true,
          },
        },
        items: true,
        issuedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        receivedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        inspections: {
          include: {
            inspector: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
            defects: true,
            parameters: true,
          },
          orderBy: { inspectedAt: 'desc' },
          take: 1,
        },
        productionLogs: {
          where: {
            departmentCode: { in: ['WASHING_QC'] },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lanes = {
      incoming: [] as any[],
      underInspection: [] as any[],
      passed: [] as any[],
      rejected: [] as any[],
      rework: [] as any[],
    };

    challans.forEach((c) => {
      if (['ISSUED', 'RECEIVED'].includes(c.status)) {
        lanes.incoming.push(c);
      } else if (c.status === 'UNDER_INSPECTION' || c.status === 'ON_HOLD') {
        lanes.underInspection.push(c);
      } else if (['QC_APPROVED', 'COMPLETED', 'HANDED_OVER'].includes(c.status)) {
        lanes.passed.push(c);
      } else if (c.status === 'QC_REJECTED') {
        lanes.rejected.push(c);
      } else if (c.status === 'REWORK_REQUESTED' || c.status === 'REWORK') {
        lanes.rework.push(c);
      } else {
        lanes.incoming.push(c);
      }
    });

    const counts = {
      incoming: lanes.incoming.length,
      underInspection: lanes.underInspection.length,
      passed: lanes.passed.length,
      rejected: lanes.rejected.length,
      rework: lanes.rework.length,
      total: challans.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        lanes,
        counts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Washing QC floor board:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floor board data' },
      { status: 500 }
    );
  }
}
