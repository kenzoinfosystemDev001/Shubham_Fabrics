import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: 'QC2',
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
          },
          orderBy: { inspectedAt: 'desc' },
          take: 1,
        },
        productionLogs: {
          where: {
            departmentCode: 'QC2',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group into 5 workflow swimlanes
    const lanes = {
      incoming: [] as any[],
      underInspection: [] as any[],
      passed: [] as any[],
      rejected: [] as any[],
      rework: [] as any[],
    };

    for (const c of challans) {
      if (c.status === 'ISSUED' || c.status === 'RECEIVED') {
        lanes.incoming.push(c);
      } else if (c.status === 'UNDER_INSPECTION' || c.status === 'ON_HOLD') {
        lanes.underInspection.push(c);
      } else if (c.status === 'QC_APPROVED' || c.status === 'COMPLETED') {
        lanes.passed.push(c);
      } else if (c.status === 'QC_REJECTED') {
        lanes.rejected.push(c);
      } else if (c.status === 'REWORK_REQUESTED') {
        lanes.rework.push(c);
      } else {
        lanes.incoming.push(c);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lanes,
        counts: {
          incoming: lanes.incoming.length,
          underInspection: lanes.underInspection.length,
          passed: lanes.passed.length,
          rejected: lanes.rejected.length,
          rework: lanes.rework.length,
          total: challans.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching QC2 floor board data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC2 floor board data' },
      { status: 500 }
    );
  }
}
