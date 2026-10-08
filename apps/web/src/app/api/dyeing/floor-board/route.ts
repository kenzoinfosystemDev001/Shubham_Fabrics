import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await syncInboundChallansToDyeingOrders();

    const orders = await prisma.dyeingOrder.findMany({
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
            fabricColor: true,
            targetQuantity: true,
            deliveryDate: true,
            priority: true,
            status: true,
          },
        },
        inboundChallan: {
          select: {
            id: true,
            challanNumber: true,
            status: true,
            issuedDate: true,
          },
        },
        qc1Challan: {
          select: {
            id: true,
            challanNumber: true,
            status: true,
            issuedDate: true,
          },
        },
        incharge: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lanes = {
      RECEIVED: orders.filter((o) => o.status === 'RECEIVED'),
      IN_DYEING: orders.filter((o) => o.status === 'IN_DYEING'),
      PARTIALLY_DYED: orders.filter((o) => o.status === 'PARTIALLY_DYED'),
      DYED: orders.filter((o) => o.status === 'DYED'),
      READY_FOR_QC1: orders.filter((o) => o.status === 'READY_FOR_QC1'),
      SENT_TO_QC1: orders.filter((o) => o.status === 'SENT_TO_QC1'),
    };

    return NextResponse.json({
      data: {
        lanes,
        totalOrders: orders.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dyeing floor board:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch floor board' }, { status: 500 });
  }
}
