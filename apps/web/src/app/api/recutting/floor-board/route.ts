import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const validDepts = ['RECUTTING', 'RE-CUTTING', 'CUTTING_RECUT'];

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
            designNumber: true,
            wilcomDesignNumber: true,
            targetQuantity: true,
            quantityMeasurement: true,
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
        childChallans: {
          where: { toDepartment: 'STITCHING' },
          select: {
            id: true,
            challanNumber: true,
            status: true,
            createdAt: true,
            items: {
              select: { quantity: true },
            },
          },
        },
        productionLogs: {
          where: {
            departmentCode: { in: ['RECUTTING', 'RE-CUTTING'] },
          },
          orderBy: { recordedAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const lanes = {
      incoming: [] as any[],
      inProcess: [] as any[],
      verification: [] as any[],
      readyForStitching: [] as any[],
      handedOver: [] as any[],
    };

    let totalPcs = 0;

    challans.forEach((c) => {
      const pcs = c.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      totalPcs += pcs;

      const itemData = {
        ...c,
        totalPcs: pcs,
        handedOverPcs: c.childChallans.reduce(
          (sum, ch) => sum + ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
          0
        ),
      };

      if (c.status === 'ISSUED' || c.status === 'RECEIVED') {
        lanes.incoming.push(itemData);
      } else if (c.status === 'IN_PROCESS') {
        lanes.inProcess.push(itemData);
      } else if (c.status === 'COMPLETED' || c.status === 'ON_HOLD') {
        lanes.verification.push(itemData);
      } else if (c.status === 'READY_FOR_STITCHING') {
        lanes.readyForStitching.push(itemData);
      } else if (c.status === 'HANDED_OVER') {
        lanes.handedOver.push(itemData);
      } else {
        lanes.incoming.push(itemData);
      }
    });

    const counts = {
      incoming: lanes.incoming.length,
      inProcess: lanes.inProcess.length,
      verification: lanes.verification.length,
      readyForStitching: lanes.readyForStitching.length,
      handedOver: lanes.handedOver.length,
      total: challans.length,
      totalPcs,
    };

    return NextResponse.json({
      success: true,
      data: {
        lanes,
        counts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Recutting floor board:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Recutting floor board data' },
      { status: 500 }
    );
  }
}
