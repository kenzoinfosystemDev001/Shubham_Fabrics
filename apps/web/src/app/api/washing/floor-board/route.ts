import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'WASHING');
  if (!authUser) return authResponse;
  try {
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: 'WASHING',
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
            mainStyle: true,
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
        productionLogs: {
          where: {
            departmentCode: 'WASHING',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lanes = {
      incoming: [] as any[],
      inWasher: [] as any[],
      hydroDrying: [] as any[],
      qualityChecked: [] as any[],
      dispatched: [] as any[],
    };

    for (const c of challans) {
      const latestLog = c.productionLogs?.[0];
      const op = latestLog?.operationName?.toUpperCase() || '';

      if (c.status === 'COMPLETED') {
        lanes.dispatched.push(c);
      } else if (c.status === 'QC_APPROVED' || c.status === 'WASH_COMPLETED') {
        lanes.qualityChecked.push(c);
      } else if (op.includes('DRY') || op.includes('HYDRO')) {
        lanes.hydroDrying.push(c);
      } else if (c.status === 'IN_PROCESS' || op.includes('WASH')) {
        lanes.inWasher.push(c);
      } else {
        lanes.incoming.push(c);
      }
    }

    const counts = {
      incoming: lanes.incoming.length,
      inWasher: lanes.inWasher.length,
      hydroDrying: lanes.hydroDrying.length,
      qualityChecked: lanes.qualityChecked.length,
      dispatched: lanes.dispatched.length,
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
    console.error('Error fetching Washing floor board:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floor board data' },
      { status: 500 }
    );
  }
}
