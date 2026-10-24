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
            designNumber: true,
            wilcomDesignNumber: true,
            wilcomDesignPhoto: true,
            baseDesignPhoto: true,
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
        dyeingQcChallan: {
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

    // 1. KPI Counts
    const totalWork = orders.length;
    const received = orders.filter((o) => o.status === 'RECEIVED').length;
    const inDyeing = orders.filter((o) => o.status === 'IN_DYEING').length;
    const partiallyDyed = orders.filter((o) => o.status === 'PARTIALLY_DYED').length;
    const dyed = orders.filter((o) => o.status === 'DYED').length;
    const readyForDyeingQc = orders.filter((o) => o.status === 'READY_FOR_DYEING_QC' || (o.readyForDyeingQcQuantity > 0 && o.status !== 'SENT_TO_DYEING_QC')).length;
    const sentToDyeingQc = orders.filter((o) => o.status === 'SENT_TO_DYEING_QC').length;

    // 2. Quantity Aggregations
    const totalRequiredQuantity = orders.reduce((sum, o) => sum + (o.requiredQuantity || 0), 0);
    const totalDyedQuantity = orders.reduce((sum, o) => sum + (o.dyedQuantity || 0), 0);
    const totalUndyedQuantity = orders.reduce((sum, o) => sum + (o.undyedQuantity || 0), 0);
    const totalSentToDyeingQcQuantity = orders.reduce((sum, o) => sum + (o.sentToDyeingQcQuantity || 0), 0);

    // 3. Color Visibility Breakdown
    const colorMap = new Map<string, {
      colorName: string;
      colorCode: string | null;
      ordersCount: number;
      required: number;
      dyed: number;
      undyed: number;
      sentToDyeingQc: number;
      uom: string;
    }>();

    for (const order of orders) {
      const colorKey = (order.dyedColor || order.targetColor || 'Standard').trim();
      const existing = colorMap.get(colorKey) || {
        colorName: colorKey,
        colorCode: order.colorCode || null,
        ordersCount: 0,
        required: 0,
        dyed: 0,
        undyed: 0,
        sentToDyeingQc: 0,
        uom: order.uom || 'MTR',
      };

      existing.ordersCount += 1;
      existing.required += order.requiredQuantity || 0;
      existing.dyed += order.dyedQuantity || 0;
      existing.undyed += order.undyedQuantity || 0;
      existing.sentToDyeingQc += order.sentToDyeingQcQuantity || 0;

      colorMap.set(colorKey, existing);
    }

    const colorBreakdown = Array.from(colorMap.values());

    // 4. Current Dyeing Incharges
    const dyeingIncharges = await prisma.user.findMany({
      where: {
        OR: [
          { departmentCode: 'DYEING' },
          { username: 'dyeing' },
          { userRoles: { some: { role: { code: { in: ['DYEING_INCHARGE', 'DYEING_OPERATOR'] } } } } },
        ],
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
      },
    });

    // 5. Priority Work
    const priorityWork = orders
      .filter((o) => (o.priority === 'URGENT' || o.priority === 'HIGH') && o.status !== 'SENT_TO_DYEING_QC')
      .slice(0, 5);

    // 6. Upcoming Delivery
    const now = new Date();
    const upcomingDelivery = orders
      .filter((o) => o.program?.deliveryDate && o.status !== 'SENT_TO_DYEING_QC')
      .sort((a, b) => new Date(a.program.deliveryDate).getTime() - new Date(b.program.deliveryDate).getTime())
      .slice(0, 5);

    // 7. Recent Activity (Production Transactions & Challans)
    const recentTransactions = await prisma.productionTransaction.findMany({
      where: { departmentCode: 'DYEING' },
      take: 6,
      orderBy: { recordedAt: 'desc' },
      include: {
        program: { select: { programNumber: true, clientName: true } },
        operator: { select: { fullName: true } },
      },
    });

    return NextResponse.json({
      data: {
        kpis: {
          totalWork,
          received,
          inDyeing,
          partiallyDyed,
          dyed,
          readyForDyeingQc,
          sentToDyeingQc,
          totalRequiredQuantity,
          totalDyedQuantity,
          totalUndyedQuantity,
          totalSentToDyeingQcQuantity,
        },
        colorBreakdown,
        dyeingIncharges,
        priorityWork,
        upcomingDelivery,
        recentActivity: recentTransactions,
        receivedProductions: orders.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error('Error loading dyeing dashboard:', error);
    return NextResponse.json({ error: error.message || 'Failed to load dyeing dashboard' }, { status: 500 });
  }
}
