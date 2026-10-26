import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { addToUnitTotals, lineTotals, unitTotals } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC1');
  if (!authUser) return authResponse;
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
    const failed = qc1Challans.filter(
      (c) => c.status === 'QC_REJECTED' || Number(c.defectivePieces) > 0
    ).length;
    const rework = qc1Challans.filter((c) => c.status === 'REWORK_REQUESTED').length;
    const hold = qc1Challans.filter((c) => c.status === 'ON_HOLD').length;
    const completed = passed + failed + rework;

    // Quantities per unit ({ MTR, PCS }); meters and pieces are never added together.
    const totalQuantityReceived = unitTotals();
    for (const ch of qc1Challans) {
      for (const it of ch.items) addToUnitTotals(totalQuantityReceived, it.uom || ch.fabricUnit || 'MTR', it.quantity);
    }
    const byUnit = (field: 'inputQuantity' | 'goodQuantity' | 'rejectQuantity' | 'reworkQuantity' | 'balanceQuantity') =>
      qc1Transactions.reduce((totals, tx) => addToUnitTotals(totals, tx.unitOfMeasure || 'MTR', Number(tx[field]) || 0), unitTotals());
    const totalQuantityInspected = byUnit('inputQuantity');
    const passedQuantity = byUnit('goodQuantity');
    const failedQuantity = byUnit('rejectQuantity');
    const reworkQuantity = byUnit('reworkQuantity');
    const holdQuantity = byUnit('balanceQuantity');
    // One challan's total: a plain number in its unit, or "30 MTR · 10 PCS" when it carries both.
    const challanQuantity = (c: (typeof qc1Challans)[number]) => {
      const t = lineTotals(c.items, c.fabricUnit || 'MTR');
      return t.single ? { quantity: t.single.quantity, uom: t.single.unit } : { quantity: t.label, uom: '' };
    };

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
        ...challanQuantity(c),
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
        ...challanQuantity(c),
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
