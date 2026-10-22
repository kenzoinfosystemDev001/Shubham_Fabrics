import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

    const [incomingChallans, outgoingChallans, finalCheckTransactions, statusTotals] = await Promise.all([
      prisma.challan.findMany({
        where: {
          toDepartment: { in: FINAL_CHECK_DEPTS },
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
              designNumber: true,
              wilcomDesignNumber: true,
              fabricName: true,
              targetQuantity: true,
              quantityMeasurement: true,
            },
          },
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      prisma.challan.findMany({
        where: {
          fromDepartment: { in: FINAL_CHECK_DEPTS },
        },
        include: {
          program: {
            select: {
              programNumber: true,
              programSerialNo: true,
              clientName: true,
              styleCode: true,
              designNumber: true,
              wilcomDesignNumber: true,
            },
          },
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),

      prisma.productionTransaction.findMany({
        where: {
          departmentCode: { in: FINAL_CHECK_DEPTS },
        },
        include: {
          operator: { select: { fullName: true, username: true } },
          program: { select: { programNumber: true, designNumber: true, wilcomDesignNumber: true, styleCode: true } },
          challan: { select: { challanNumber: true } },
        },
        orderBy: { recordedAt: 'desc' },
        take: 30,
      }),
      prisma.challan.groupBy({
        by: ['status'],
        where: { toDepartment: { in: FINAL_CHECK_DEPTS } },
        _count: { _all: true },
        _sum: { fabricIn: true, fabricOut: true },
      }),
    ]);

    let awaitingReceiptCount = 0, awaitingReceiptPcs = 0;
    let inQueueCount = 0, inQueuePcs = 0;
    let inProgressCount = 0, inProgressPcs = 0;
    let completedCount = 0, completedPcs = 0;
    let readyForHandoverCount = 0, readyForHandoverPcs = 0;
    let handedOverCount = 0, handedOverPcs = 0;
    let onHoldCount = 0, onHoldPcs = 0;

    const totalsByStatus = new Map(statusTotals.map((entry) => [entry.status, entry]));
    const statusCount = (status: string) => totalsByStatus.get(status)?._count._all || 0;
    const statusInput = (status: string) => Number(totalsByStatus.get(status)?._sum.fabricIn || 0);
    const statusOutput = (status: string) => Number(totalsByStatus.get(status)?._sum.fabricOut || 0);
    awaitingReceiptCount = statusCount('ISSUED');
    awaitingReceiptPcs = statusInput('ISSUED');
    inQueueCount = statusCount('RECEIVED');
    inQueuePcs = statusInput('RECEIVED');
    inProgressCount = statusCount('IN_PROCESS') + statusCount('QC_PENDING') + statusCount('REWORK');
    inProgressPcs = statusInput('IN_PROCESS') + statusInput('QC_PENDING') + statusInput('REWORK');
    completedCount = statusCount('QC_APPROVED') + statusCount('COMPLETED');
    completedPcs = statusOutput('QC_APPROVED') + statusOutput('COMPLETED');
    readyForHandoverCount = statusCount('QC_APPROVED') + statusCount('READY_FOR_HANDOVER') + statusCount('READY_FOR_DISPATCH');
    readyForHandoverPcs = statusOutput('QC_APPROVED') + statusOutput('READY_FOR_HANDOVER') + statusOutput('READY_FOR_DISPATCH');
    handedOverCount = statusCount('HANDED_OVER') + statusCount('CLOSED');
    handedOverPcs = statusOutput('HANDED_OVER') + statusOutput('CLOSED');
    onHoldCount = statusCount('ON_HOLD');
    onHoldPcs = statusInput('ON_HOLD');

    let totalInputPcs = 0, totalAcceptedPcs = 0, totalReworkPcs = 0, totalRejectPcs = 0;

    finalCheckTransactions.forEach((tx) => {
      totalInputPcs += Number(tx.inputQuantity) || 0;
      totalAcceptedPcs += Number(tx.goodQuantity) || 0;
      totalReworkPcs += Number(tx.reworkQuantity) || 0;
      totalRejectPcs += Number(tx.rejectQuantity) || 0;
    });

    const firstPassYield = totalInputPcs > 0
      ? ((totalAcceptedPcs / totalInputPcs) * 100).toFixed(1)
      : '100.0';

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          awaitingReceiptCount, awaitingReceiptPcs,
          inQueueCount, inQueuePcs,
          inProgressCount, inProgressPcs,
          completedCount, completedPcs,
          readyForHandoverCount, readyForHandoverPcs,
          handedOverCount, handedOverPcs,
          onHoldCount, onHoldPcs,
          totalIncomingChallans: incomingChallans.length,
          totalOutgoingChallans: outgoingChallans.length,
          totalInputPcs, totalAcceptedPcs, totalReworkPcs, totalRejectPcs,
          firstPassYield,
        },
        incomingChallans,
        outgoingChallans,
        recentTransactions: finalCheckTransactions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Final QC dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Final QC dashboard data' },
      { status: 500 }
    );
  }
}
