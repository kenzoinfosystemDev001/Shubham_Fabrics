import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch all Challans dispatched to Dyeing QC
    const dyeingQcChallans = await prisma.challan.findMany({
      where: {
        toDepartment: 'DYEING_QC',
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
            targetQuantity: true,
            deliveryDate: true,
            priority: true,
            status: true,
            quantityMeasurement: true,
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
            departmentCode: 'DYEING_QC',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch Dyeing QC Production Transactions for quantity aggregations
    const dyeingQcTransactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: 'DYEING_QC',
      },
      include: {
        operator: {
          select: {
            fullName: true,
            username: true,
          },
        },
        program: {
          select: {
            programNumber: true,
            programSerialNo: true,
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });

    // 3. Operational KPIs from real database records
    const totalWork = dyeingQcChallans.length;
    const awaitingReceiving = dyeingQcChallans.filter((c) => c.status === 'ISSUED').length;
    const received = dyeingQcChallans.filter((c) => c.status === 'RECEIVED').length;
    const underInspection = dyeingQcChallans.filter((c) => c.status === 'UNDER_INSPECTION').length;
    const passed = dyeingQcChallans.filter((c) => c.status === 'QC_APPROVED').length;
    const failed = dyeingQcChallans.filter(
      (c) => c.status === 'QC_REJECTED' || Number(c.defectivePieces) > 0
    ).length;
    const rework = dyeingQcChallans.filter((c) => c.status === 'REWORK_REQUESTED').length;
    const hold = dyeingQcChallans.filter((c) => c.status === 'ON_HOLD').length;
    const completed = passed + failed + rework;

    // Total Quantities received across all Dyeing QC Challans
    const totalQuantityReceived = dyeingQcChallans.reduce((sum, ch) => {
      const itemsSum = ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      return sum + itemsSum;
    }, 0);

    // Sum quantities from completed Dyeing QC transactions
    const totalQuantityInspected = dyeingQcTransactions.reduce((sum, tx) => sum + (Number(tx.inputQuantity) || 0), 0);
    const passedQuantity = dyeingQcTransactions.reduce((sum, tx) => sum + (Number(tx.goodQuantity) || 0), 0);
    const failedQuantity = dyeingQcTransactions.reduce((sum, tx) => sum + (Number(tx.rejectQuantity) || 0), 0);
    const reworkQuantity = dyeingQcTransactions.reduce((sum, tx) => sum + (Number(tx.reworkQuantity) || 0), 0);
    const holdQuantity = dyeingQcTransactions.reduce((sum, tx) => sum + (Number(tx.balanceQuantity) || 0), 0);

    // 4. Priority Work Items (Urgent / High priority awaiting or under inspection)
    const priorityWork = dyeingQcChallans
      .filter((c) => ['HIGH', 'URGENT'].includes(c.priority) && !['QC_APPROVED', 'QC_REJECTED'].includes(c.status))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        productionSheetNumber: c.program?.programSerialNo || c.program?.programNumber || '—',
        fabric: c.items[0]?.itemDescription || c.program?.fabricName || '—',
        color: c.items[0]?.colour || c.program?.fabricColor || '—',
        quantity: c.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        uom: c.items[0]?.uom || 'MTR',
        priority: c.priority,
        status: c.status,
        issuedDate: c.issuedDate,
      }));

    // 5. Upcoming Delivery Work
    const upcomingDelivery = dyeingQcChallans
      .filter((c) => !['QC_APPROVED', 'QC_REJECTED'].includes(c.status) && c.program?.deliveryDate)
      .sort((a, b) => new Date(a.program.deliveryDate).getTime() - new Date(b.program.deliveryDate).getTime())
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        productionSheetNumber: c.program?.programSerialNo || c.program?.programNumber || '—',
        clientName: c.program?.clientName || c.program?.buyerName || 'Standard Client',
        deliveryDate: c.program.deliveryDate,
        quantity: c.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        uom: c.items[0]?.uom || 'MTR',
        status: c.status,
      }));

    // 6. Recent Dyeing QC Activity Feed
    const recentActivity = dyeingQcTransactions.slice(0, 10).map((tx) => ({
      id: tx.id,
      operationName: tx.operationName,
      productionSheetNumber: tx.program?.programSerialNo || tx.program?.programNumber || '—',
      inputQuantity: tx.inputQuantity,
      goodQuantity: tx.goodQuantity,
      rejectQuantity: tx.rejectQuantity,
      reworkQuantity: tx.reworkQuantity,
      unitOfMeasure: tx.unitOfMeasure,
      inspector: tx.operator?.fullName || tx.operator?.username || 'Dyeing QC Inspector',
      notes: tx.notes,
      recordedAt: tx.recordedAt,
    }));

    return NextResponse.json({
      data: {
        kpis: {
          totalWork,
          awaitingReceiving,
          received,
          awaitingInspection: awaitingReceiving + received,
          underInspection,
          completed,
          passed,
          failed,
          rework,
          hold,
          totalQuantityReceived,
          totalQuantityInspected,
          passedQuantity,
          failedQuantity,
          reworkQuantity,
          holdQuantity,
        },
        priorityWork,
        upcomingDelivery,
        recentActivity,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Dyeing QC dashboard metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Dyeing QC dashboard metrics.' },
      { status: 500 }
    );
  }
}
