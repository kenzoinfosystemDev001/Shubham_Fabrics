import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { addTotals, formatTotals, totalsByUnit, unitOf } from '@/lib/challan-units.mjs';

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

    // Quantities are kept per unit (MTR / PCS), never added across units.
    const receivedByUnit = qc1Challans.reduce<Record<string, number>>((acc, ch) => addTotals(acc, totalsByUnit(ch.items, ch.fabricUnit)), {});
    const totalsOf = (field: 'inputQuantity' | 'goodQuantity' | 'rejectQuantity' | 'reworkQuantity' | 'balanceQuantity') =>
      totalsByUnit(qc1Transactions.map((tx) => ({ quantity: tx[field], uom: tx.unitOfMeasure })));
    // The plain numbers are the meter figures (QC1 receives dyed fabric, normally in meters); the
    // *Text fields show every unit, e.g. "1,200 MTR · 40 PCS".
    const quantityKpis = {
      totalQuantityReceived: receivedByUnit,
      totalQuantityInspected: totalsOf('inputQuantity'),
      passedQuantity: totalsOf('goodQuantity'),
      failedQuantity: totalsOf('rejectQuantity'),
      reworkQuantity: totalsOf('reworkQuantity'),
      holdQuantity: totalsOf('balanceQuantity'),
    };
    const totalQuantityReceived = quantityKpis.totalQuantityReceived.MTR || 0;
    const totalQuantityInspected = quantityKpis.totalQuantityInspected.MTR || 0;
    const passedQuantity = quantityKpis.passedQuantity.MTR || 0;
    const failedQuantity = quantityKpis.failedQuantity.MTR || 0;
    const reworkQuantity = quantityKpis.reworkQuantity.MTR || 0;
    const holdQuantity = quantityKpis.holdQuantity.MTR || 0;
    const quantityText = Object.fromEntries(Object.entries(quantityKpis).map(([k, v]) => [`${k}Text`, formatTotals(v)]));

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
        quantity: totalsByUnit(c.items, c.fabricUnit)[unitOf(c.items[0]?.uom) || 'MTR'] || 0,
        quantityText: formatTotals(totalsByUnit(c.items, c.fabricUnit)),
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
        quantity: totalsByUnit(c.items, c.fabricUnit)[unitOf(c.items[0]?.uom) || 'MTR'] || 0,
        quantityText: formatTotals(totalsByUnit(c.items, c.fabricUnit)),
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
          ...quantityText,
        },
        priorityWork,
        upcomingDelivery,
        recentActivity,
      },
    });
  } catch (error: any) {
    console.error('Error fetching QC1 dashboard metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Dyeing QC dashboard metrics.' },
      { status: 500 }
    );
  }
}
