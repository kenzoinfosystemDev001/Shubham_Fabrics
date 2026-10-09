import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch all Challans dispatched to QC1
    const qc1Challans = await prisma.challan.findMany({
      where: {
        toDepartment: 'QC1',
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
            departmentCode: 'QC1',
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch QC1 Production Transactions for quantity aggregations
    const qc1Transactions = await prisma.productionTransaction.findMany({
      where: {
        departmentCode: 'QC1',
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
    const totalWork = qc1Challans.length;
    const awaitingReceiving = qc1Challans.filter((c) => c.status === 'ISSUED').length;
    const received = qc1Challans.filter((c) => c.status === 'RECEIVED').length;
    const underInspection = qc1Challans.filter((c) => c.status === 'UNDER_INSPECTION').length;
    const passed = qc1Challans.filter((c) => c.status === 'QC_APPROVED').length;
    const failed = qc1Challans.filter((c) => c.status === 'QC_REJECTED').length;
    const rework = qc1Challans.filter((c) => c.status === 'REWORK_REQUESTED').length;
    const hold = qc1Challans.filter((c) => c.status === 'ON_HOLD').length;
    const completed = passed + failed + rework;

    // Total Quantities received across all QC1 Challans
    const totalQuantityReceived = qc1Challans.reduce((sum, ch) => {
      const itemsSum = ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      return sum + itemsSum;
    }, 0);

    // Sum quantities from completed QC1 transactions
    const totalQuantityInspected = qc1Transactions.reduce((sum, tx) => sum + (Number(tx.inputQuantity) || 0), 0);
    const passedQuantity = qc1Transactions.reduce((sum, tx) => sum + (Number(tx.goodQuantity) || 0), 0);
    const failedQuantity = qc1Transactions.reduce((sum, tx) => sum + (Number(tx.rejectQuantity) || 0), 0);
    const reworkQuantity = qc1Transactions.reduce((sum, tx) => sum + (Number(tx.reworkQuantity) || 0), 0);
    const holdQuantity = qc1Transactions.reduce((sum, tx) => sum + (Number(tx.balanceQuantity) || 0), 0);

    // 4. Priority Work Items (Urgent / High priority awaiting or under inspection)
    const priorityWork = qc1Challans
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
    const upcomingDelivery = qc1Challans
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

    // 6. Recent QC1 Activity Feed
    const recentActivity = qc1Transactions.slice(0, 10).map((tx) => ({
      id: tx.id,
      operationName: tx.operationName,
      productionSheetNumber: tx.program?.programSerialNo || tx.program?.programNumber || '—',
      inputQuantity: tx.inputQuantity,
      goodQuantity: tx.goodQuantity,
      rejectQuantity: tx.rejectQuantity,
      reworkQuantity: tx.reworkQuantity,
      unitOfMeasure: tx.unitOfMeasure,
      inspector: tx.operator?.fullName || tx.operator?.username || 'QC1 Inspector',
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
    console.error('Error fetching QC1 dashboard metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch QC1 dashboard metrics.' },
      { status: 500 }
    );
  }
}
